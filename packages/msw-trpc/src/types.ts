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
import { Link } from './links.js'

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
        ? $Value['_def']['type'] extends 'subscription'
          ? {
              subscription: (
                handler?: (
                  input: inferProcedureInput<$Value>
                ) => Observable<inferTransformedProcedureOutputOrVoid<TRouter, $Value>, unknown>
              ) => {
                handler: WebSocketHandler
                trigger: (data: inferTransformedProcedureOutputOrVoid<TRouter, $Value>) => void
              }
            }
          : {
              [K in `${$Value['_def']['type']}`]: (
                handler: (
                  input: inferProcedureInput<$Value>
                ) => PromiseOrValue<inferTransformedProcedureOutputOrVoid<TRouter, $Value>>
              ) => RequestHandler
            }
        : never
    : never
}

export type MswTrpc<TRPCRouter extends AnyTRPCRouter> = ProcedureHandlerRecord<TRPCRouter, TRPCRouter['_def']['record']>
