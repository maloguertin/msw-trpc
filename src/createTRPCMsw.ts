import { AnyRouter, BuildProcedure, CombinedDataTransformer, defaultTransformer, ProcedureParams } from '@trpc/server'
import {
  DefaultBodyType,
  MockedRequest,
  PathParams,
  ResponseResolver,
  ResponseTransformer,
  rest,
  RestContext,
  RestHandler,
  RestRequest,
} from 'msw'

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
  type ExtractKeys<T extends Router[any], K extends keyof T = keyof T> = T[K] extends
    | BuildProcedure<'query', any, any>
    | BuildProcedure<'mutation', any, any>
    | AnyRouter
    ? K
    : never

  type ExtractInput<T extends ProcedureParams> = T extends ProcedureParams<any, any, any, infer P> ? P : never

  type WithInput<T extends Router[any], K extends keyof T = keyof T> = {
    getInput: () => T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : never
  }

  type ContextWithDataTransformer<T extends Router[any], K extends keyof T = keyof T> = RestContext & {
    data: (
      data: T[K] extends BuildProcedure<any, any, infer P> ? P : never
    ) => ResponseTransformer<DefaultBodyType, any>
  }

  type SetQueryHandler<T extends Router[any], K extends keyof T> = (
    handler: ResponseResolver<
      RestRequest<never, PathParams<string>> & WithInput<T, K>,
      ContextWithDataTransformer<T, K>,
      DefaultBodyType
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type SetMutationHandler<T extends Router[any], K extends keyof T> = (
    handler: ResponseResolver<
      //@ts-expect-error DefaultBodyType doesn't handle unknown but it will be resolved at usage time
      RestRequest<T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : DefaultBodyType, PathParams>,
      ContextWithDataTransformer<T, K>
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type Query<T extends Router[any], K extends keyof T> = {
    query: SetQueryHandler<T, K>
  }

  type Mutation<T extends Router[any], K extends keyof T> = {
    mutation: SetMutationHandler<T, K>
  }

  type ExtractProcedureHandler<T extends Router | Router[any], K extends keyof T> = T[K] extends BuildProcedure<
    'mutation',
    any,
    any
  >
    ? Mutation<T, K>
    : T[K] extends BuildProcedure<'query', any, any>
    ? Query<T, K>
    : T[K] extends AnyRouter
    ? MswTrpc<T[K]>
    : never

  type MswTrpc<T extends Router | AnyRouter> = {
    [key in keyof T as ExtractKeys<T, key>]: ExtractProcedureHandler<T, key>
  }

  return createUntypedTRPCMsw(config) as MswTrpc<Router>
}

export default createTRPCMsw
