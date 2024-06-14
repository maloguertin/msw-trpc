import { http, HttpResponse, WebSocketLink, ws } from 'msw'
import { Link } from './links.js'
import { TRPCCombinedDataTransformer, TRPCError, getTRPCErrorFromUnknown } from '@trpc/server'
import {
  TRPC_ERROR_CODES_BY_KEY,
  TRPC_ERROR_CODE_KEY,
  defaultTransformer,
  getHTTPStatusCodeFromError,
} from '@trpc/server/unstable-core-do-not-import'
import { Observable, Unsubscribable, observable } from '@trpc/server/observable'
import { TRPCMswConfig } from './types.js'

const getQueryInput = (req: Request, transformer: TRPCCombinedDataTransformer) => {
  const inputString = new URL(req.url).searchParams.get('input')

  if (inputString == null) return inputString

  return transformer.input.deserialize(JSON.parse(inputString))
}

const getMutationInput = async (req: Request, transformer: TRPCCombinedDataTransformer) => {
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

  const { type: handlerType, url } = link({ type: procedureType, path })

  if (!handler && (procedureType === 'query' || procedureType === 'mutation')) {
    throw new Error('Handler is required for query and mutation procedures')
  }

  if (handlerType === 'http') {
    if (procedureType === 'query' || procedureType === 'mutation') {
      const getInput = procedureType === 'query' ? getQueryInput : getMutationInput
      const httpHandler = procedureType === 'query' ? http.get : http.post

      const urlRegex = new RegExp(`${url}/${path.replace('.', '[/.|.]')}$`)

      return httpHandler(urlRegex, async (params) => {
        try {
          const input = await getInput(params.request, transformer)
          const body = await handler!(input) // TS doesn't seem to understand that handler is defined here, despite the check above
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
    }

    throw new Error('Subscriptions require a WebSocket link (wsLink)')
  } else if (handlerType === 'ws') {
    const wsLink = wsLinks.get(url) ?? wsLinks.set(url, ws.link(url)).get(url)!
    const clients = new Map<string, Map<number | string, Unsubscribable>>()

    let innerTrigger: (input: unknown) => void

    return {
      handler: wsLink.on('connection', ({ client }) => {
        if (!clients.has(client.id)) {
          clients.set(client.id, new Map())
        }

        const clientSubscriptions = clients.get(client.id)!

        client.addEventListener('message', async (event) => {
          // @ts-ignore Wrong type for event ?
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
                // Default to an observable that does nothing, in case we want a subscription that only sends data on trigger
                const obs = (handler?.(input) as Observable<unknown, unknown>) ?? observable(() => {})

                const sub = obs.subscribe({
                  next(data) {
                    client.send(
                      JSON.stringify({
                        id: message.id,
                        jsonrpc: message.jsonrpc,
                        result: {
                          type: 'data',
                          data: transformer.output.serialize(data),
                        },
                      })
                    )
                  },
                  error(e) {
                    client.send(
                      JSON.stringify({
                        id: message.id,
                        jsonrpc: message.jsonrpc,
                        error: getSerializedTrpcError(e, path, transformer),
                      })
                    )
                  },
                  complete() {
                    sub.unsubscribe()

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
                  },
                })

                // WebSocket.OPEN = 1
                if (client.socket.readyState !== 1) {
                  sub.unsubscribe()
                  return
                }

                if (clientSubscriptions.has(message.id)) {
                  sub.unsubscribe()

                  client.send(
                    JSON.stringify({
                      id: message.id,
                      jsonrpc: message.jsonrpc,
                      result: {
                        type: 'stopped',
                      },
                    })
                  )

                  throw new TRPCError({
                    message: `Duplicate id ${message.id}`,
                    code: 'BAD_REQUEST',
                  })
                }

                clientSubscriptions.set(message.id, sub)

                innerTrigger = (input) =>
                  client.send(
                    JSON.stringify({
                      id: message.id,
                      jsonrpc: message.jsonrpc,
                      result: {
                        type: 'data',
                        data: transformer.output.serialize(input),
                      },
                    })
                  )

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
                const result = await handler!(input) // TS doesn't seem to understand that handler is defined here, despite the check above

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
            clientSubscriptions.forEach((sub) => sub.unsubscribe())
            clients.delete(client.id)
          },
          { once: true }
        )
      }),
      trigger: async (input: unknown, wait = 10) => {
        // Ensure the subscription is started before triggering it
        await new Promise((resolve) => setTimeout(resolve, wait))

        if (!innerTrigger) {
          throw new Error('Subscription not started')
        }

        innerTrigger(input)
        await new Promise((resolve) => setTimeout(resolve, wait))
      },
    }
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
