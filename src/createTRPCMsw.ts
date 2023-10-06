import { AnyRouter, CombinedDataTransformer, defaultTransformer } from '@trpc/server'

import { HttpResponse, HttpResponseInit, http } from 'msw'
import { MswTrpc } from './types'

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
        if (procedureKey === 'query') {
          // @ts-expect-error any
          return handler =>
            http.get(buildUrlFromPathParts(pathParts), params => {
              return handler({
                ...params,
                getInput: () => getQueryInput(params.request, transformer),
                // @ts-expect-error any
                data: (body, init?: HttpResponseInit) =>
                  HttpResponse.json({ result: { data: transformer.input.serialize(body) } }, init),
              })
            })
        }

        if (procedureKey === 'mutation') {
          // @ts-expect-error any
          return handler =>
            http.post(buildUrlFromPathParts(pathParts), params => {
              return handler({
                ...params,
                getInput: () => getMutationInput(params.request, transformer),
                // @ts-expect-error any
                data: (body, init?: HttpResponseInit) =>
                  HttpResponse.json({ result: { data: transformer.input.serialize(body) } }, init),
              })
            })
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
