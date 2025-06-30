import { AnyTRPCRouter } from '@trpc/server'

import { MswTrpc, TRPCMswConfig } from './types.js'

import { trpc } from './handler.js'

export const createTRPCMsw = <Router extends AnyTRPCRouter>(config: TRPCMswConfig) => {
  const { links, transformer } = config

  const createUntypedTRPCMsw = (pathParts: string[] = []) => {
    return new Proxy(
      {},
      {
        get(target: unknown, lastKey) {
          const procedurePath = pathParts.join('.')
          if (lastKey === 'query' || lastKey === 'mutation') {
            return (handler: Function) => {
              const result = trpc[lastKey](procedurePath, handler, { links, transformer })

              return result
            }
          }

          return createUntypedTRPCMsw([...pathParts, lastKey as string])
        },
      }
    )
  }

  return createUntypedTRPCMsw() as MswTrpc<Router>
}
