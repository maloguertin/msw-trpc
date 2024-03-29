import { AnyRouter, CombinedDataTransformer, TRPCError, defaultTransformer } from '@trpc/server'
import { getHTTPStatusCodeFromError } from '@trpc/server/http'

import { HttpResponse, http } from 'msw'
import { MswTrpc } from './types'
import { TRPC_ERROR_CODES_BY_KEY } from '@trpc/server/rpc'

const getQueryInput = (req: Request, transformer: CombinedDataTransformer) => {
  const inputString = new URL(req.url).searchParams.get('input')

  if (inputString == null) return inputString

  return transformer.input.deserialize(JSON.parse(inputString))
}

const getMutationInput = async (req: Request, transformer: CombinedDataTransformer) => {
  const body = await req.json()

  return transformer.output.deserialize(body)
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

// @ts-expect-error any
const createUntypedTRPCMsw = (
  {
    baseUrl,
    basePath = 'trpc',
    transformer = defaultTransformer,
  }: { baseUrl?: string; basePath?: string; transformer?: CombinedDataTransformer } = {},
  pathParts: string[] = []
) => {
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
                  return HttpResponse.json({ result: { data: transformer.input.serialize(body) } })
                } catch (e) {
                  if (e instanceof TRPCError) {
                    const status = getHTTPStatusCodeFromError(e)
                    return HttpResponse.json(
                      {
                        error: {
                          message: e.message,
                          code: TRPC_ERROR_CODES_BY_KEY[e.code],
                          data: { code: e.code, httpStatus: status },
                        },
                      },
                      { status }
                    )
                  } else {
                    throw e
                  }
                }
              }
            )
        }

        const newPathParts =
          pathParts.length === 0 ? (baseUrl != null ? [baseUrl] : [`\/${basePath}` as string]) : pathParts

        return createUntypedTRPCMsw({ transformer }, [...newPathParts, procedureKey as string])
      },
    }
  )
}

const createTRPCMsw = <Router extends AnyRouter>(
  config: { baseUrl?: string; basePath?: string; transformer?: CombinedDataTransformer } = {}
) => {
  return createUntypedTRPCMsw(config) as MswTrpc<Router>
}

export default createTRPCMsw
