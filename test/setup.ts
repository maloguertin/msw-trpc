import createTRPCMsw from '../src/createTRPCMsw'
import { initTRPC } from '@trpc/server'
import { createTRPCProxyClient, httpBatchLink, httpLink } from '@trpc/client'
import superjson from 'superjson'

import 'whatwg-fetch'

const t = initTRPC.create()
const tWithSuperJson = initTRPC.create({
  transformer: superjson,
})

export interface User {
  id: string
  name: string
}
const userList: User[] = [
  {
    id: '1',
    name: 'KATT',
  },
]

const appRouter = t.router({
  userById: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .query(req => {
      const { input } = req

      const user = userList.find(u => u.id === input)

      return user
    }),
  userByIdAndPost: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .query(req => {
      const { input } = req

      const user = userList.find(u => u.id === input)

      return { ...user, posts: ['1'] }
    }),
  userByName: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .output((val: unknown) => {
      if (typeof val === 'undefined') {
        return val
      }
      if (typeof val !== 'object' || val === null) {
        throw new Error(`Invalid output: ${typeof val}`)
      }
      if (!('id' in val) || typeof val.id !== 'string' || !('name' in val) || typeof val.name !== 'string') {
        throw new Error(`Invalid output: ${typeof val}`)
      }
      return val as User
    })
    .query(req => {
      const { input } = req

      const user = userList.find(u => u.name === input)

      return user
    }),
  createUser: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .mutation(req => {
      const { input } = req

      return {
        id: '2',
        name: input,
      } as User
    }),
  updateUser: t.procedure
    .input((val: unknown) => {
      if (typeof val !== 'object' || val === null) {
        throw new Error(`Invalid input: ${typeof val}`)
      }
      if (!('id' in val) || !('name' in val)) {
        throw new Error(`Invalid input: ${typeof val}`)
      }
      if (typeof val.id !== 'string' || typeof val.name !== 'string') {
        throw new Error(`Invalid input: ${typeof val}`)
      }
      return val as User
    })
    .output((val: unknown) => {
      if (typeof val !== 'object' || val === null) {
        throw new Error(`Invalid output: ${typeof val}`)
      }
      if (!('id' in val) || typeof val.id !== 'string' || !('name' in val) || typeof val.name !== 'string') {
        throw new Error(`Invalid output: ${typeof val}`)
      }
      return val as User
    })
    .mutation(req => {
      const { input } = req

      return input
    }),
})

const appRouterWithSuperJson = tWithSuperJson.router({
  userById: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .query(req => {
      const { input } = req

      const user = userList.find(u => u.id === input)

      return user
    }),
  userByIdAndPost: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .query(req => {
      const { input } = req

      const user = userList.find(u => u.id === input)

      return { ...user, posts: ['1'] }
    }),
  createUser: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .mutation(req => {
      const { input } = req

      return {
        id: '2',
        name: input,
      } as User
    }),
  listUsers: t.procedure
    .input((val: unknown) => {
      return val as { take: number; skip: number }
    })
    .query(req => {
      const { input } = req
      return input
    }),
  createFriend: t.procedure
    .input((val: unknown) => {
      return val as { name: string }
    })
    .mutation(req => {
      const { input } = req
      return { id: 'new-user', name: input.name }
    }),
})

export type AppRouter = typeof appRouter
export type AppRouterWithSuperJson = typeof appRouterWithSuperJson

const nestedRouter = t.router({
  users: appRouter,
})

export type NestedAppRouter = typeof nestedRouter

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'content-type': 'application/json',
        }
      },
    }),
  ],
})

export const trpcWithSuperJson = createTRPCProxyClient<AppRouterWithSuperJson>({
  transformer: superjson,
  links: [
    httpLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'content-type': 'application/json',
        }
      },
    }),
  ],
})

export const nestedTrpc = createTRPCProxyClient<NestedAppRouter>({
  links: [
    httpLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'content-type': 'application/json',
        }
      },
    }),
  ],
})

export const mswTrpc = createTRPCMsw<AppRouter>()
export const nestedMswTrpc = createTRPCMsw<NestedAppRouter>()

export const mswTrpcWithSuperJson = createTRPCMsw<AppRouterWithSuperJson>({
  transformer: { input: superjson, output: superjson },
})
