import type {
  inferProcedureInput,
  AnyTRPCRouter,
  AnyTRPCProcedure,
  inferTRPCClientTypes,
  inferTransformedProcedureOutput,
  TRPCCombinedDataTransformer,
} from '@trpc/server'
import { Observable } from '@trpc/server/observable'
import type { RequestHandler, WebSocketHandler } from 'msw'

type PromiseOrValue<T> = T | Promise<T>

export interface TRPCMswConfig {
  baseUrl?: string
  basePath?: string
  wsUrl?: string
  transformer?: TRPCCombinedDataTransformer
}

export interface RouterRecord {
  [key: string]: AnyTRPCProcedure | RouterRecord
}

export type inferTransformedProcedureOutputOrVoid<TRouter extends AnyTRPCRouter, TProcedure extends AnyTRPCProcedure> =
  inferTransformedProcedureOutput<inferTRPCClientTypes<TRouter>, TProcedure> extends never
    ? void
    : inferTransformedProcedureOutput<inferTRPCClientTypes<TRouter>, TProcedure>

export type ProcedureHandlerRecord<TRouter extends AnyTRPCRouter, TRecord extends RouterRecord> = {
  [TKey in keyof TRecord]: TRecord[TKey] extends infer $Value
    ? $Value extends RouterRecord
      ? ProcedureHandlerRecord<TRouter, $Value>
      : $Value extends AnyTRPCProcedure
        ? $Value['_def']['type'] extends 'subscription'
          ? {
              subscription: (
                handler: (
                  input: inferProcedureInput<$Value>,
                ) => Observable<inferTransformedProcedureOutputOrVoid<TRouter, $Value>, unknown>,
              ) => WebSocketHandler
            }
          : {
              [K in 'query' | 'mutation']: (
                handler: (
                  input: inferProcedureInput<$Value>,
                ) => PromiseOrValue<inferTransformedProcedureOutputOrVoid<TRouter, $Value>>,
              ) => RequestHandler
            }
        : never
    : never
}

export type MswTrpc<TRPCRouter extends AnyTRPCRouter> = ProcedureHandlerRecord<TRPCRouter, TRPCRouter['_def']['record']>
