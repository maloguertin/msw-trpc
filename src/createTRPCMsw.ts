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

const transformBody = (data: any) => ({ result: { data } })

const getInput = (req: RestRequest) => {
  const inputString = req.url.searchParams.get('input')

  if (inputString === null) return {}

  return JSON.parse(inputString)
}

const createTRPCMsw = <Trpc>(trpc: Trpc, { baseUrl } = { baseUrl: 'trpc' }) => {
  type ExtractKeys<T extends Trpc, K extends keyof T = keyof T> = T[K] extends { useQuery: any } | { useMutation: any }
    ? K
    : never

  type ExtractQuery<T extends Trpc, K extends keyof T = keyof T> = T[K] extends {
    useQuery: (...args: any) => infer D
  }
    ? D extends { data: any }
      ? T[K]
      : never
    : never

  type ExtractMutation<T extends Trpc, K extends keyof T = keyof T> = T[K] extends {
    useMutation: (...args: any) => any
  }
    ? T[K]
    : never

  type WithQueryInput<T extends Trpc, K extends keyof T = keyof T> = {
    getInput: () => Parameters<ExtractQuery<T, K>['useQuery']>[0]
  }

  type WithMutationInput<T extends Trpc, K extends keyof T = keyof T> = {
    getInput: () => Parameters<ExtractMutation<T, K>['useMutation']>[0]
  }

  type ContextWithQueryDataTransformer<T extends Trpc, K extends keyof T = keyof T> = RestContext & {
    data: (data: ReturnType<ExtractQuery<T, K>['useQuery']>) => any
  }

  type ContextWithMutationDataTransformer<T extends Trpc, K extends keyof T = keyof T> = RestContext & {
    data: (data: ReturnType<ExtractMutation<T, K>['useMutation']>) => any
  }

  type SetQueryHandler<T extends Trpc, K extends keyof T> = (
    handler: ResponseResolver<
      RestRequest<never, PathParams<string>> & WithQueryInput<T, K>,
      ContextWithQueryDataTransformer<T, K>,
      DefaultBodyType
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type SetMutationHandler<T extends Trpc, K extends keyof T> = (
    handler: ResponseResolver<
      RestRequest<DefaultBodyType, PathParams> & WithMutationInput<T, K>,
      ContextWithMutationDataTransformer<T, K>
    >
  ) => RestHandler<MockedRequest<DefaultBodyType>>

  type Query<T extends Trpc, K extends keyof T> = {
    query: SetQueryHandler<T, K>
  }

  type Mutation<T extends Trpc, K extends keyof T> = {
    mutation: SetMutationHandler<T, K>
  }

  type QueryAndMutation<T extends Trpc, K extends keyof T> = Query<T, K> & Mutation<T, K>

  type ExtractProcedureHandler<T extends Trpc, K extends keyof T> = T[K] extends {
    useMutation: any
    useQuery: any
  }
    ? QueryAndMutation<T, K>
    : T[K] extends { useMutation: any }
    ? Mutation<T, K>
    : T[K] extends { useQuery: any }
    ? Query<T, K>
    : never

  type ExtractProcedures = {
    [key in keyof Trpc as ExtractKeys<Trpc, key>]: ExtractProcedureHandler<Trpc, key>
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

        const procedure = {} as QueryAndMutation<Trpc, keyof Trpc>

        procedure.query = handler =>
          rest.get(`${baseUrl}/${procedureKey as string}`, (req, res, ctx) => {
            // @ts-expect-error any
            return handler({ ...req, getInput: () => getInput(req) }, res, {
              ...ctx,
              data: (body: typeof x) => ctx.json(transformBody(body)),
            })
          })

        procedure.mutation = handler =>
          rest.post(`${baseUrl}/${procedureKey as string}`, (req, res, ctx) => {
            // @ts-expect-error any
            return handler({ ...req, getInput: () => getInput(req) }, res, {
              ...ctx,
              data: body => ctx.json(transformBody(body)),
            })
          })

        return procedure as ExtractProcedures[typeof procedureKey]
      },
    }
  ) as ExtractProcedures
}

export default createTRPCMsw
