import type {
  inferProcedureInput,
  AnyTRPCRouter,
  AnyTRPCProcedure,
  inferTRPCClientTypes,
  inferTransformedProcedureOutput,
  TRPCCombinedDataTransformer,
} from '@trpc/server'
import type { RequestHandler, WebSocketHandler } from 'msw'
import { Link } from './links.js'
import { inferAsyncIterableYield } from '@trpc/server/unstable-core-do-not-import'

type PromiseOrValue<T> = T | Promise<T>

export interface TRPCMswConfig {
  links: Link[]
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
        ? $Value['_def']['type'] extends 'query' | 'mutation'
          ? {
              [K in $Value['_def']['type']]: (
                handler: ({
                  input,
                }: {
                  input: inferProcedureInput<$Value>
                }) => PromiseOrValue<inferTransformedProcedureOutputOrVoid<TRouter, $Value>>
              ) => RequestHandler
            }
          : $Value['_def']['type'] extends 'subscription'
            ? {
              subscription: (
                handler?: ({
                  input,
                  signal,
                }: {
                  input: inferProcedureInput<$Value>,
                  signal: AbortSignal | undefined,
                }) => AsyncIterable<inferAsyncIterableYield<inferTransformedProcedureOutputOrVoid<TRouter, $Value>>, void, unknown>
              ) => WebSocketHandler
            }
            : never
        : never
    : never
}

export type MswTrpc<TRPCRouter extends AnyTRPCRouter> = ProcedureHandlerRecord<TRPCRouter, TRPCRouter['_def']['record']>
