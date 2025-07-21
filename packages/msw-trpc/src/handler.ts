import { http, HttpResponse, WebSocketLink, ws } from 'msw'
import { Link } from './links.js'
import { TRPCCombinedDataTransformer, TRPCError } from '@trpc/server'
import {
  TRPC_ERROR_CODES_BY_KEY,
  TRPC_ERROR_CODE_KEY,
  Unpromise,
  defaultTransformer,
  getHTTPStatusCodeFromError,
  getTRPCErrorFromUnknown,
  isTrackedEnvelope,
  iteratorResource,
  run,
} from '@trpc/server/unstable-core-do-not-import'

import { TRPCMswConfig } from './types.js'

const getQueryInput = (req: Request, transformer: TRPCCombinedDataTransformer) => {
  const inputString = new URL(req.url).searchParams.get('input')

  if (inputString == null) return inputString

  return transformer.input.deserialize(JSON.parse(inputString))
}

const getMutationInput = async (req: Request, transformer: TRPCCombinedDataTransformer) => {
  if (!req.body) return undefined

  const body = await req.json()

  return transformer.input.deserialize(body)
}

const getSerializedTrpcError = (e: unknown, path: string, transformer = defaultTransformer) => {
  const error = getTRPCErrorFromUnknown(e)

  const jsonError = {
    message: error.message,
    code: TRPC_ERROR_CODES_BY_KEY[error.code],
    data: {
      code: error.code,
      httpStatus: getHTTPStatusCodeFromError(error),
      path,
      stack: error.stack,
    },
  }

  return transformer.output.serialize(jsonError)
}

const wsLinks = new Map<string, WebSocketLink>()

const createTrpcHandler = (
  procedureType: 'query' | 'mutation' | 'subscription',
  path: string,
  handler: Function | undefined,
  {
    links,
    transformer = defaultTransformer,
  }: {
    // Only support a single link for now
    links: Link[]
    transformer?: TRPCCombinedDataTransformer
  }
) => {
  const [link] = links

  if (!link) {
    throw new Error('No link provided')
  } else if (links.length > 1) {
    throw new Error('Only a single link is supported')
  }

  const { type: handlerType, url, methodOverride } = link({ type: procedureType, path })

  if (!handler && (procedureType === 'query' || procedureType === 'mutation')) {
    throw new Error('Handler is required for query and mutation procedures')
  }

  if (handlerType === 'http') {
    if (procedureType === 'query' || procedureType === 'mutation') {
      const getInput = procedureType === 'query' ? getQueryInput : getMutationInput
      const httpHandler = procedureType === 'mutation' || methodOverride === 'POST' ? http.post : http.get

      const urlRegex = new RegExp(`${url}/${path.replace('.', '[/.|.]')}$`)

      return httpHandler(urlRegex, async (params) => {
        try {
          const input = await getInput(params.request, transformer)
          const body = await handler!({ input }) // TS doesn't seem to understand that handler is defined here, despite the check above
          return HttpResponse.json({ result: { data: transformer.output.serialize(body) } })
        } catch (e) {
          if (!(e instanceof Error)) {
            throw e
          }
          if (!('code' in e)) {
            throw e
          }

          const status = getHTTPStatusCodeFromError(e as TRPCError)
          const { name: _, ...otherErrorData } = e
          const jsonError = {
            message: e.message,
            code: TRPC_ERROR_CODES_BY_KEY[e.code as TRPC_ERROR_CODE_KEY],
            data: { ...otherErrorData, code: e.code, httpStatus: status, path },
          }
          return HttpResponse.json({ error: transformer.output.serialize(jsonError) }, { status })
        }
      })
    } else if (procedureType === 'subscription') {
      throw new Error('Subscriptions require a WebSocket link (wsLink)')
    }
    throw new Error('Unknown procedure type')
  } else if (handlerType === 'ws') {
    const wsLink = wsLinks.get(url) ?? wsLinks.set(url, ws.link(url)).get(url)!
    const clients = new Map<string, Map<number | string, AbortController>>()

    return wsLink.addEventListener('connection', ({ client }) => {
      if (!clients.has(client.id)) {
        clients.set(client.id, new Map())
      }

      const clientSubscriptions = clients.get(client.id)!

      client.addEventListener('message', async (event) => {
        const message = JSON.parse(event.data.toString()) as {
          id: number | string
          jsonrpc?: '2.0'
          method: 'query' | 'mutation' | 'subscription'
          params: {
            path: string
            input?: unknown
          }
        }

        try {
          if (message.params.path === path) {
            const input = transformer.input.deserialize(message.params.input)

            if (message.method === 'subscription') {
              if (handler === undefined) {
                handler = async function* () {}
              }

              // WebSocket.OPEN = 1
              if (client.socket.readyState !== 1) {
                return;
              }

              if (clientSubscriptions.has(message.id)) {
                // duplicate request ids for client

                throw new TRPCError({
                  message: `Duplicate id ${message.id}`,
                  code: 'BAD_REQUEST',
                });
              }

              const abortController = new AbortController();

              run(async () => {
                const abortPromise = new Promise<'abort'>((resolve) => {
                  abortController.signal.onabort = () => resolve('abort');
                });

                const opts = {
                  input,
                  signal: abortController.signal,
                }

                await using iterator = iteratorResource(handler!(opts) as AsyncIterable<unknown, void, unknown>);

                let next:
                  | null
                  | TRPCError
                  | Awaited<
                      typeof abortPromise | ReturnType<(typeof iterator)['next']>
                    >;

                while (true) {
                  next = await Unpromise.race([
                    iterator.next().catch(getTRPCErrorFromUnknown),
                    abortPromise,
                  ]);

                  if (next === 'abort') {
                    await iterator.return?.();
                    break;
                  }
                  if (next instanceof Error) {
                    client.send(
                      JSON.stringify({
                        id: message.id,
                        jsonrpc: message.jsonrpc,
                        error: getSerializedTrpcError(next, path, transformer),
                      })
                    )
                    continue;
                  }
                  if (next.done) {
                    break;
                  }

                  if (isTrackedEnvelope(next.value)) {
                    const [id, data] = next.value;
                    client.send(
                      JSON.stringify({
                        id,
                        jsonrpc: message.jsonrpc,
                        result: {
                          type: 'data',
                          data: {
                            id,
                            data: transformer.output.serialize(data),
                          },
                        },
                      })
                    )
                  } else {
                    client.send(
                      JSON.stringify({
                        id: message.id,
                        jsonrpc: message.jsonrpc,
                        result: {
                          type: 'data',
                          data: transformer.output.serialize(next.value),
                        },
                      })
                    )
                  }
                }

                client.send(
                  JSON.stringify({
                    id: message.id,
                    jsonrpc: message.jsonrpc,
                    result: {
                      type: 'stopped',
                    },
                  })
                )
                clientSubscriptions.delete(message.id)
              }).catch((cause) => {
                const error = getTRPCErrorFromUnknown(cause);
                client.send(
                  JSON.stringify({
                    id: message.id,
                    jsonrpc: message.jsonrpc,
                    error: getSerializedTrpcError(error, path),
                  })
                )
                abortController.abort();
              });
              clientSubscriptions.set(message.id, abortController);

              client.send(
                JSON.stringify({
                  id: message.id,
                  jsonrpc: message.jsonrpc,
                  result: {
                    type: 'started',
                  },
                })
              )
            } else {
              const result = await handler!({ input }) // TS doesn't seem to understand that handler is defined here, despite the check above

              client.send(
                JSON.stringify({
                  id: message.id,
                  jsonrpc: message.jsonrpc,
                  result: {
                    type: 'data',
                    data: transformer.output.serialize(result),
                  },
                })
              )
            }
          }
        } catch (e) {
          client.send(
            JSON.stringify({
              id: message.id,
              jsonrpc: message.jsonrpc,
              error: getSerializedTrpcError(e, path),
            })
          )
        }
      })

      client.addEventListener(
        'close',
        () => {
          clientSubscriptions.forEach((abortController) => abortController.abort());
          clients.delete(client.id);
        },
        { once: true }
      )
    });
  }

  throw new Error('Unknown handler type')
}

export const trpc = {
  query: (path: string, handler: Function, opts: TRPCMswConfig) => createTrpcHandler('query', path, handler, opts),
  mutation: (path: string, handler: Function, opts: TRPCMswConfig) =>
    createTrpcHandler('mutation', path, handler, opts),
  subscription: (path: string, handler: Function | undefined, opts: TRPCMswConfig) =>
    createTrpcHandler('subscription', path, handler, opts),
}
