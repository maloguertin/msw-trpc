import type {
  inferProcedureInput,
  inferProcedureOutput,
  AnyTRPCMutationProcedure,
  AnyTRPCQueryProcedure,
} from '@trpc/server'
import type { RequestHandler } from 'msw'

type PromiseOrValue<T> = T | Promise<T>

type Router = Record<string, AnyTRPCQueryProcedure | AnyTRPCMutationProcedure>

type Query<TRPCRouter, K extends keyof TRPCRouter> = TRPCRouter[K] extends AnyTRPCQueryProcedure
  ? {
      query: (
        handler: (input: inferProcedureInput<TRPCRouter[K]>) => PromiseOrValue<inferProcedureOutput<TRPCRouter[K]>> 
      ) => RequestHandler
    }
  : never

type Mutation<TRPCRouter, K extends keyof TRPCRouter> = TRPCRouter[K] extends AnyTRPCMutationProcedure
  ?  {
    mutation: (
      handler: (input: inferProcedureInput<TRPCRouter[K]>) => PromiseOrValue<inferProcedureOutput<TRPCRouter[K]>> 
    ) => RequestHandler
  }
  : never

type ExtractKeys<TRPCRouter, K extends keyof TRPCRouter = keyof TRPCRouter> = TRPCRouter[K] extends
  | AnyTRPCQueryProcedure
  | AnyTRPCMutationProcedure
  | Router
  | Record<string, Router>
  ? K
  : never

type ExtractProcedureHandler<TRPCRouter, K extends keyof TRPCRouter> = TRPCRouter[K] extends AnyTRPCMutationProcedure
  ? Mutation<TRPCRouter, K>
  : TRPCRouter[K] extends AnyTRPCQueryProcedure
  ? Query<TRPCRouter, K>
  : TRPCRouter[K] extends Router
  ? MswTrpc<TRPCRouter[K]>
  : TRPCRouter[K] extends Record<string, Router>
  ? MswTrpc<TRPCRouter[K]>
  : never

export type MswTrpc<TRPCRouter> = {
  [K in keyof TRPCRouter as ExtractKeys<TRPCRouter, K>]: ExtractProcedureHandler<TRPCRouter, K>
}
