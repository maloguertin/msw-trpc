import { AnyTRPCRouter } from '@trpc/server'

import { MswTrpc, TRPCMswConfig } from './types'

import { trpc } from './handler'
import { HttpHandler, WebSocketHandler } from 'msw'

const createTRPCMsw = <Router extends AnyTRPCRouter>(config: TRPCMswConfig) => {
  const { links, transformer } = config

  // @ts-expect-error any
  const createUntypedTRPCMsw = (pathParts: string[] = []) => {
    return new Proxy(
      {},
      {
        get(target: unknown, lastKey) {
          if (lastKey === 'query' || lastKey === 'mutation' || lastKey === 'subscription') {
            const procedurePath = pathParts.join('.')
            return (handler: Function) => {
              const result = trpc[lastKey](procedurePath, handler, { links, transformer })

              if (result instanceof HttpHandler) {
                return result
              }

              if (lastKey === 'subscription') {
                return result
              }

              return result.handler
            }
          }

          return createUntypedTRPCMsw([...pathParts, lastKey as string])
        },
      },
    )
  }

  return createUntypedTRPCMsw() as MswTrpc<Router>
}

export default createTRPCMsw
