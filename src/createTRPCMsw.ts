import { AnyRouter, BuildProcedure, CombinedDataTransformer, defaultTransformer, ProcedureParams } from '@trpc/server'
import {
  DefaultBodyType,
  MockedRequest,
  PathParams,
  ResponseResolver,
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

const createTRPCMsw = <Router extends AnyRouter>({
  baseUrl,
  basePath = 'trpc',
  transformer = defaultTransformer,
}: { baseUrl?: string; basePath?: string; transformer?: CombinedDataTransformer } = {}) => {
  type ExtractKeys<T extends Router, K extends keyof T = keyof T> = T[K] extends
    | BuildProcedure<'query', any, any>
    | BuildProcedure<'mutation', any, any>
    ? K
    : never

  type ExtractInput<T extends ProcedureParams> = T extends ProcedureParams<any, any, any, infer P> ? P : never

  type WithInput<T extends Router, K extends keyof T = keyof T> = {
    getInput: () => T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : never
  }

  type ContextWithDataTransformer<T extends Router, K extends keyof T = keyof T> = RestContext & {
    data: (data: T[K] extends BuildProcedure<any, any, infer P> ? P : never) => any
  }

  type SetQueryHandler<T extends Router, K extends keyof T> = (
    handler: ResponseResolver<
      RestRequest<never, PathParams<string>> & WithInput<T, K>,
      ContextWithDataTransformer<T, K>,
      DefaultBodyType
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type SetMutationHandler<T extends Router, K extends keyof T> = (
    handler: ResponseResolver<
      //@ts-expect-error DefaultBodyType doesn't handle unknown but it will be resolved at usage time
      RestRequest<T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : DefaultBodyType, PathParams>,
      ContextWithDataTransformer<T, K>
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type Query<T extends Router, K extends keyof T> = {
    query: SetQueryHandler<T, K>
  }

  type Mutation<T extends Router, K extends keyof T> = {
    mutation: SetMutationHandler<T, K>
  }

  type QueryAndMutation<T extends Router, K extends keyof T> = Query<T, K> & Mutation<T, K>

  type ExtractProcedureHandler<T extends Router, K extends keyof T> = T[K] extends BuildProcedure<'mutation', any, any>
    ? Mutation<T, K>
    : T[K] extends BuildProcedure<'query', any, any>
    ? Query<T, K>
    : never

  type ExtractProcedures = {
    [key in keyof Router as ExtractKeys<Router, key>]: ExtractProcedureHandler<Router, key>
  }

  const isProceduresKey = (key: keyof ExtractProcedures | string | symbol): key is keyof ExtractProcedures => {
    if (typeof key !== 'symbol') return true
    return false
  }

  return new Proxy(
    {},
    {
      get(_target: unknown, procedureKey: keyof ExtractProcedures | string | symbol) {
        if (!isProceduresKey(procedureKey)) return

        const procedure = {} as QueryAndMutation<Router, keyof Router>

        const path = baseUrl
          ? `${baseUrl}/${procedureKey as string}`
          : new RegExp(`\/${basePath}\/${procedureKey as string}`)

        procedure.query = handler =>
          rest.get(path, (req, res, ctx) => {
            // @ts-expect-error any
            return handler({ ...req, getInput: () => getQueryInput(req) }, res, {
              ...ctx,
              data: body => ctx.json({ result: { data: transformer.input.serialize(body) } }),
            })
          })

        procedure.mutation = handler =>
          rest.post(path, (req, res, ctx) => {
            // @ts-expect-error any
            return handler(req, res, {
              ...ctx,
              data: body => ctx.json({ result: { data: transformer.input.serialize(body) } }),
            })
          })

        return procedure as ExtractProcedures[typeof procedureKey]
      },
    }
  ) as ExtractProcedures
}

export default createTRPCMsw
