import { AnyTRPCRouter } from '@trpc/server'

import { MswTrpc, TRPCMswConfig } from './types'

import { trpc } from './handler'

const createTRPCMsw = <Router extends AnyTRPCRouter>(config: TRPCMswConfig) => {
  const { links, transformer } = config

  // @ts-expect-error any
  const createUntypedTRPCMsw = (pathParts: string[] = []) => {
    return new Proxy(
      {},
      {
        get(_target: unknown, lastKey) {
          if (lastKey === 'query' || lastKey === 'mutation' || lastKey === 'subscription') {
            const procedurePath = pathParts.join('.')
            return (handler: Function) => trpc[lastKey](procedurePath, handler, { links, transformer })
          }

          return createUntypedTRPCMsw([...pathParts, lastKey as string])
        },
      },
    )
  }

  return createUntypedTRPCMsw() as MswTrpc<Router>
}

export default createTRPCMsw
