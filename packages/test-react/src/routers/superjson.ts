import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import SuperJSON from 'superjson'

const t = initTRPC.create({ transformer: SuperJSON })

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
    .subscription(() => {
      return observable<User>((emit) => {
        emit.next({ id: '3', name: 'Marie' })
      })
    }),
})

export type AppRouteWithSuperJson = typeof appRouter
