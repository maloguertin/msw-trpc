import createTRPCMsw from '../src/createTRPCMsw'
import { initTRPC } from '@trpc/server'
import { createTRPCProxyClient, httpBatchLink, httpLink } from '@trpc/client'
import 'whatwg-fetch'

const t = initTRPC.create()
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
})
export type AppRouter = typeof appRouter

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

export const mswTrpc = createTRPCMsw<AppRouter>()
