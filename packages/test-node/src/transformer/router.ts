import { initTRPC } from '@trpc/server'
import superjson from 'superjson'

const t = initTRPC.create({ transformer: superjson })

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

const router = t.router({
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
  superjson: t.procedure
    .input((val: unknown) => {
      if (val instanceof Date) return val

      throw new Error(`Invalid input: ${typeof val}`)
    })
    .query((req) => {
      const { input } = req

      return new Set([input])
    }),
})

export type AppRouter = typeof router
