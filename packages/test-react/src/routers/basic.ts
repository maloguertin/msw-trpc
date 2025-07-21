import { initTRPC } from '@trpc/server'

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
    .query((req) => {
      const { input } = req

      const user = userList.find((u) => u.id === input)

      return user
    }),
  createUser: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .mutation((req) => {
      const { input } = req

      return {
        id: '2',
        name: input,
      } as User
    }),
  getUserUpdates: t.procedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .subscription(async function* (opts) {
      yield { id: opts.input, name: 'Marie' } as User
    }),
})

const nestedRouter = t.router({ deeply: { nested: appRouter } })

export type NestedAppRouter = typeof nestedRouter
export type AppRouter = typeof appRouter
