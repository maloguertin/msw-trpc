import { AnyRouter, BuildProcedure, Procedure, ProcedureParams, ProcedureType, inferRouterInputs } from '@trpc/server'
import { DefaultBodyType, HttpResponse, HttpResponseInit, RequestHandler, ResponseResolver, StrictResponse } from 'msw'

export type ExtractKeys<T, K extends keyof T = keyof T> = T[K] extends
  | BuildProcedure<'query', any, any>
  | BuildProcedure<'mutation', any, any>
  | AnyRouter
  ? K
  : never

export type ExtractInput<T extends ProcedureParams> = T extends ProcedureParams<any, any, any, infer P>
  ? P extends DefaultBodyType
    ? P
    : DefaultBodyType
  : never

export type ExtractOutput<T> = T extends Procedure<ProcedureType, infer ProcedureParams>
  ? ProcedureParams['_output_out'] extends DefaultBodyType
    ? { result: { data: ProcedureParams['_output_out'] } }
    : never
  : never

export type TRPCResponse<T> = StrictResponse<ExtractOutput<T>>

type WithDataHelper<T> = {
  data: (
    data: T extends Procedure<ProcedureType, infer ProcedureParams> ? ProcedureParams['_output_out'] : never,
    init?: HttpResponseInit
  ) => TRPCResponse<T>
}

export type WithQueryInput<T, K extends keyof T = keyof T> = {
  getInput: () => T[K] extends BuildProcedure<any, any, any>
    ? T extends AnyRouter
      ? inferRouterInputs<T>[K]
      : never
    : never
}

export type WithMutationInput<T, K extends keyof T = keyof T> = {
  getInput: () => T[K] extends BuildProcedure<any, any, any>
    ? T extends AnyRouter
      ? Promise<inferRouterInputs<T>[K]>
      : never
    : never
}

export type SetQueryHandler<T, K extends keyof T> = (
  handler: ResponseResolver<WithDataHelper<T[K]> & WithQueryInput<T, K>, DefaultBodyType, ExtractOutput<T[K]>>
) => RequestHandler

export type SetMutationHandler<T, K extends keyof T> = (
  handler: ResponseResolver<
    WithDataHelper<T[K]> & WithMutationInput<T, K>,
    T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : DefaultBodyType,
    ExtractOutput<T[K]>
  >
) => RequestHandler

export type Query<T, K extends keyof T> = {
  query: SetQueryHandler<T, K>
}

export type Mutation<T, K extends keyof T> = {
  mutation: SetMutationHandler<T, K>
}

type ExtractProcedureHandler<T, K extends keyof T> = T[K] extends BuildProcedure<'mutation', any, any>
  ? Mutation<T, K>
  : T[K] extends BuildProcedure<'query', any, any>
  ? Query<T, K>
  : T[K] extends AnyRouter
  ? MswTrpc<T[K]>
  : never

export type MswTrpc<T> = {
  [key in keyof T as ExtractKeys<T, key>]: ExtractProcedureHandler<T, key>
}
