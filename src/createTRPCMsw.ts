import { AnyRouter, CombinedDataTransformer, defaultTransformer } from '@trpc/server'
import type { RestRequest } from 'msw'

import { rest } from 'msw'
import { MswTrpc } from './types'

const getQueryInput = (req: RestRequest) => {
  const inputString = req.url.searchParams.get('input')

  if (inputString === null) return {}

  return JSON.parse(inputString)
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
            rest.get(buildUrlFromPathParts(pathParts), (req, res, ctx) => {
              return handler({ ...req, getInput: () => getQueryInput(req) }, res, {
                ...ctx,
                // @ts-expect-error any
                data: body => ctx.json({ result: { data: transformer.input.serialize(body) } }),
              })
            })
        }

        if (procedureKey === 'mutation') {
          // @ts-expect-error any
          return handler =>
            rest.post(buildUrlFromPathParts(pathParts), (req, res, ctx) => {
              return handler(req, res, {
                ...ctx,
                // @ts-expect-error any
                data: body => ctx.json({ result: { data: transformer.input.serialize(body) } }),
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
