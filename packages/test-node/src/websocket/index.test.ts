import { createTRPCClient } from '@trpc/client'

import { setupServer } from 'msw/node'
import { describe, test, beforeAll, afterAll, expect, afterEach } from 'vitest'

import { createLinks } from './links.js'
import { AppRouter, NestedAppRouter, User } from '../routers.js'
import { createTRPCMsw } from '../../../msw-trpc/src/index.js'
import { createWSClient, wsLink } from '../../../msw-trpc/src/links.js'

const mswLinks = [
  wsLink({
    client: createWSClient({
      url: 'ws://localhost:3001',
    }),
  }),
]

describe('with ws link', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  describe('simple router', () => {
    const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

    afterEach(() => server.resetHandlers())

    test('handles queries properly', async () => {
      server.use(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' })))

      const trpc = createTRPCClient<AppRouter>({ links: createLinks() })
      const user = await trpc.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('handles mutations properly', async () => {
      server.use(
        mswTrpc.createUser.mutation(({ input }) => {
          console.log('Creating user:', input)
          return { id: '2', name: input }
        })
      )

      const trpc = createTRPCClient<AppRouter>({ links: createLinks() })
      const user = await trpc.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })

    test('handles subscriptions properly', async () => {
      const subscription = mswTrpc.getUserUpdates.subscription(async function* (opts) {
        const id = opts.input
        yield await new Promise((resolve) => setTimeout(() => resolve({ id, name: 'Toto' }), 1000))
      })

      server.use(subscription)

      const trpc = createTRPCClient<AppRouter>({ links: createLinks() })

      const promise = new Promise<User>((resolve) => {
        trpc.getUserUpdates.subscribe('3', {
          onData: resolve,
        })
      })

      await expect(promise).resolves.toEqual({ id: '3', name: 'Toto' })
    })

    test('can receive multiple subscription updates', async () => {
      const subscription = mswTrpc.getUserUpdates.subscription(async function* (opts) {
        const id = opts.input
        const names = ['Toto', 'Tutu', 'Titi']
        for (let i = 0; i < names.length; i++) {
          yield await new Promise((resolve) => setTimeout(() => resolve({ id, name: names[i]! }), i * 50))
        }
      })

      server.use(subscription)

      const trpc = createTRPCClient<AppRouter>({ links: createLinks() })

      const promise = new Promise<User[]>((resolve) => {
        const results: User[] = []
        trpc.getUserUpdates.subscribe('4', {
          onData: (data) => {
            results.push(data)
            if (results.length === 3) {
              resolve(results)
            }
          },
        })
      })

      await expect(promise).resolves.toEqual([
        { id: '4', name: 'Toto' },
        { id: '4', name: 'Tutu' },
        { id: '4', name: 'Titi' },
      ])
    })
  })

  describe('nested router', () => {
    const mswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

    afterEach(() => server.resetHandlers())

    test('handles queries properly', async () => {
      server.use(mswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' })))

      const trpc = createTRPCClient<NestedAppRouter>({ links: createLinks() })
      const user = await trpc.deeply.nested.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('handles mutations properly', async () => {
      server.use(mswTrpc.deeply.nested.createUser.mutation(({ input }) => ({ id: '2', name: input })))

      const trpc = createTRPCClient<NestedAppRouter>({ links: createLinks() })
      const user = await trpc.deeply.nested.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })

    test('handles subscriptions properly', async () => {
      const subscription = mswTrpc.deeply.nested.getUserUpdates.subscription(async function* (opts) {
        const id = opts.input
        yield await new Promise((resolve) => setTimeout(() => resolve({ id, name: 'Tutu' }), 1000))
      })

      server.use(subscription)

      const trpc = createTRPCClient<NestedAppRouter>({ links: createLinks() })

      const promise = new Promise<User>((resolve) => {
        trpc.deeply.nested.getUserUpdates.subscribe('21', {
          onData: resolve,
        })
      })

      await expect(promise).resolves.toEqual({ id: '21', name: 'Tutu' })
    })
  })
})
