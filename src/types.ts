import { AnyRouter, BuildProcedure, Procedure, ProcedureParams, ProcedureType, inferRouterInputs } from '@trpc/server'
import {
  DefaultBodyType,
  MockedRequest,
  PathParams,
  ResponseResolver,
  ResponseTransformer,
  RestContext,
  RestHandler,
  RestRequest,
} from 'msw'

export type ContextWithDataTransformer<T> = RestContext & {
  data: (
    data: T extends Procedure<ProcedureType, infer ProcedureParams> ? ProcedureParams['_output_out'] : never
  ) => ResponseTransformer<DefaultBodyType, any>
}

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
  handler: ResponseResolver<
    RestRequest<never, PathParams<string>> & WithQueryInput<T, K>,
    ContextWithDataTransformer<T[K]>,
    DefaultBodyType
  >
) => RestHandler<MockedRequest<DefaultBodyType>>

export type SetMutationHandler<T, K extends keyof T> = (
  handler: ResponseResolver<
    RestRequest<T[K] extends BuildProcedure<any, infer P, any> ? ExtractInput<P> : DefaultBodyType, PathParams> &
      WithMutationInput<T, K>,
    ContextWithDataTransformer<T[K]>
  >
) => RestHandler<MockedRequest<DefaultBodyType>>

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
