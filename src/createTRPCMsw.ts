import { AnyTRPCRouter, TRPCCombinedDataTransformer, TRPCError, getTRPCErrorFromUnknown } from '@trpc/server'
import { defaultTransformer } from '@trpc/server/unstable-core-do-not-import'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'

import { HttpResponse, http, ws } from 'msw'
import { MswTrpc, TRPCMswConfig } from './types'
import { TRPC_ERROR_CODES_BY_KEY, TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'
import { Observable, Unsubscribable } from '@trpc/server/observable'

const getQueryInput = (req: Request, transformer: TRPCCombinedDataTransformer) => {
  const inputString = new URL(req.url).searchParams.get('input')

  if (inputString == null) return inputString

  return transformer.input.deserialize(JSON.parse(inputString))
}

const getMutationInput = async (req: Request, transformer: TRPCCombinedDataTransformer) => {
  const body = await req.json()

  return transformer.input.deserialize(body)
}

const getRegexpAsString = (baseUrl: string | RegExp) => {
  if (baseUrl instanceof RegExp === false) return baseUrl

  let baseUrlAsString = `${baseUrl}`.replace('\\/', '')
  if (baseUrlAsString[0] === '/') baseUrlAsString = baseUrlAsString.substring(1)
  if (baseUrlAsString[baseUrlAsString.length - 1] === '/')
    baseUrlAsString = baseUrlAsString.substring(0, baseUrlAsString.length - 1)
  return baseUrlAsString
}

const buildUrlFromPathParts = (pathParts: string[]) => new RegExp(pathParts.map(getRegexpAsString).join('[/.|.]') + '$')

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

const createTRPCMsw = <Router extends AnyTRPCRouter>(config: TRPCMswConfig = {}) => {
  const { baseUrl, basePath = 'trpc', wsUrl, transformer = defaultTransformer } = config

  const wsLink = ws.link(wsUrl ?? '*')
  const clients = new Map<string, Map<number | string, Unsubscribable>>()

  // @ts-expect-error any
  const createUntypedTRPCMsw = (pathParts: string[] = []) => {
    return new Proxy(
      {},
      {
        get(_target: unknown, procedureKey) {
          if (procedureKey === 'query' || procedureKey === 'mutation') {
            const getInput = procedureKey === 'query' ? getQueryInput : getMutationInput
            // @ts-expect-error any
            return handler =>
              (procedureKey === 'query' ? http.get : http.post)(
                buildUrlFromPathParts(pathParts),
                async (params): Promise<any> => {
                  try {
                    const body = await handler(await getInput(params.request, transformer))
                    return HttpResponse.json({ result: { data: transformer.output.serialize(body) } })
                  } catch (e) {
                  if (!(e instanceof Error)) {
                    throw e
                  }
                  if (!('code' in e)) {
                    throw e
                  }

                  const status = getHTTPStatusCodeFromError(e as TRPCError)
                  const path = pathParts.slice(1).join('.')
                  const { name: _, ...otherErrorData } = e
                  const jsonError = {
                    message: e.message,
                    code: TRPC_ERROR_CODES_BY_KEY[e.code as TRPC_ERROR_CODE_KEY],
                    data: { ...otherErrorData, code: e.code, httpStatus: status, path },
                  }
                  return HttpResponse.json({ error: transformer.output.serialize(jsonError) }, { status })
                }
                },
              )
          } else if (procedureKey === 'subscription') {
            if (!wsLink) throw new Error('Please provide wsUrl in config to use subscriptions')

            // @ts-expect-error any
            return handler =>
              wsLink.on('connection', ({ client }) => {
                if (!clients.has(client.id)) {
                  clients.set(client.id, new Map())
                }

                const clientSubscriptions = clients.get(client.id)!

                client.addEventListener('message', event => {
                  const message = JSON.parse(event.data.toString()) as {
                    id: number | string
                    jsonrpc?: '2.0'
                    method: 'subscription'
                    params: {
                      path: string
                      input?: unknown // <-- pass input of procedure, serialized by transformer
                    }
                  }

                  try {
                    if (
                      message.method === 'subscription' &&
                      message.params.path === pathParts.filter(part => part !== (`\/${basePath}` as string)).join('.')
                    ) {
                      console.log('data', message)
                      const input = transformer.input.deserialize(message.params.input)
                      console.log('input', input)
                      const observable = handler(input) as Observable<unknown, unknown>

                      const sub = observable.subscribe({
                        next(data) {
                          console.log('next', data)

                          client.send(
                            JSON.stringify({
                              id: message.id,
                              jsonrpc: message.jsonrpc,
                              result: {
                                type: 'data',
                                data: transformer.output.serialize(data),
                              },
                            }),
                          )
                        },
                        error(e) {
                          client.send(
                            JSON.stringify({
                              id: message.id,
                              jsonrpc: message.jsonrpc,
                              error: getSerializedTrpcError(e, pathParts.slice(1).join('.'), transformer),
                            }),
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
                            }),
                          )

                          clientSubscriptions.delete(message.id)
                        },
                      })

                      if (client.socket.readyState !== WebSocket.OPEN) {
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
                          }),
                        )

                        throw new TRPCError({
                          message: `Duplicate id ${message.id}`,
                          code: 'BAD_REQUEST',
                        })
                      }

                      clientSubscriptions.set(message.id, sub)

                      client.send(
                        JSON.stringify({
                          id: message.id,
                          jsonrpc: message.jsonrpc,
                          result: {
                            type: 'started', // subscription started
                          },
                        }),
                      )
                    } /*  else {
                      client.send(JSON.stringify({ id: null, method: 'reconnect' }))
                      client.close(1002)
                    } */
                  } catch (e) {
                    client.send(
                      JSON.stringify({
                        id: message.id,
                        jsonrpc: message.jsonrpc,
                        error: getSerializedTrpcError(e, pathParts.slice(1).join('.')),
                      }),
                    )
                  }
                })

                client.addEventListener(
                  'close',
                  () => {
                    clientSubscriptions.forEach(sub => sub.unsubscribe())
                    clients.delete(client.id)
                  },
                  { once: true },
                )
              })
          }

          const newPathParts =
            pathParts.length === 0 ? (baseUrl != null ? [baseUrl] : [`\/${basePath}` as string]) : pathParts
          return createUntypedTRPCMsw([...newPathParts, procedureKey as string])
        },
      },
    )
  }

  return createUntypedTRPCMsw() as MswTrpc<Router>
}

export default createTRPCMsw
