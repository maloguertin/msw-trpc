import {
  AppRouter,
  mswTrpc,
  mswTrpcWithSuperJson,
  NestedAppRouter,
  nestedMswTrpc,
  nestedTrpc,
  trpc,
  trpcWithSuperJson,
} from './setup'

import { setupServer } from 'msw/node'
import { createTRPCMsw } from '../src'
import { TRPCError } from '@trpc/server'
import { TRPCClientError } from '@trpc/client'

type MswTrpc = typeof mswTrpc
type NestedMswTrpc = typeof nestedMswTrpc

const setupServerWithQueries = (mswTrpc: MswTrpc, nestedMswTrpc: NestedMswTrpc) => {
  return setupServer(
    mswTrpc.userById.query(() => {
      return { id: '1', name: 'Malo' }
    }),
    mswTrpc.userByIdAndPost.query(() => {
      return { id: '1', name: 'Malo', posts: ['1'] }
    }),
    mswTrpc.createUser.mutation(name => {
      return { id: '2', name }
    }),
    nestedMswTrpc.users.userById.query(() => {
      return { id: '1', name: 'Malo' }
    }),
    nestedMswTrpc.users.userByIdAndPost.query(() => {
      return { id: '1', name: 'Malo', posts: ['1'] }
    }),
    nestedMswTrpc.users.createUser.mutation(name => {
      return { id: '2', name }
    })
  )
}

describe('queries and mutations', () => {
  const server = setupServerWithQueries(mswTrpc, nestedMswTrpc)

  beforeAll(() => server.listen())

  afterAll(() => server.close())

  test('msw server setup from msw-trpc query handle should handle queries properly', async () => {
    const user = await trpc.userById.query('1')

    expect(user).toEqual({ id: '1', name: 'Malo' })
  })

  test('msw server setup from msw-trpc query handle should handle mutations properly', async () => {
    const user = await trpc.createUser.mutate('Robert')

    expect(user).toEqual({ id: '2', name: 'Robert' })
  })

  describe('nested router', () => {
    test('msw server setup from msw-trpc query handle should handle queries properly', async () => {
      const user = await nestedTrpc.users.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('msw server setup from msw-trpc query handle should handle queries with same starting string properly', async () => {
      const user = await nestedTrpc.users.userByIdAndPost.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo', posts: ['1'] })
    })

    test('msw server setup from msw-trpc query handle should handle mutations properly', async () => {
      const user = await nestedTrpc.users.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })
  })

  test('throwing error works', async () => {
    server.use(
      mswTrpc.userById.query(() => {
        throw new TRPCError({ code: 'BAD_REQUEST' })
      })
    )
    await expect(async () => {
      await trpc.userById.query('1')
    }).rejects.toThrow(new TRPCClientError('BAD_REQUEST'))
  })
})

describe('config', () => {
  describe('createTRCPMsw should map requests to baseUrl prop when passed', () => {
    const mswTrpc = createTRPCMsw<AppRouter>({ baseUrl: 'http://localhost:3000/trpc' })
    const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ baseUrl: 'http://localhost:3000/trpc' })

    const server = setupServerWithQueries(mswTrpc, nestedMswTrpc)

    beforeAll(() => server.listen())

    afterAll(() => server.close())

    test('msw server setup from msw-trpc query handle should handle queries properly', async () => {
      const user = await trpc.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('msw server setup from msw-trpc query handle should handle mutations properly', async () => {
      const user = await trpc.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })

    describe('nested router', () => {
      test('msw server setup from msw-trpc query handle should handle queries properly', async () => {
        const user = await nestedTrpc.users.userById.query('1')

        expect(user).toEqual({ id: '1', name: 'Malo' })
      })

      test('msw server setup from msw-trpc query handle should handle queries with same starting string properly', async () => {
        const user = await nestedTrpc.users.userByIdAndPost.query('1')

        expect(user).toEqual({ id: '1', name: 'Malo', posts: ['1'] })
      })

      test('msw server setup from msw-trpc query handle should handle mutations properly', async () => {
        const user = await nestedTrpc.users.createUser.mutate('Robert')

        expect(user).toEqual({ id: '2', name: 'Robert' })
      })
    })
  })

  describe('with SuperJson transformer', () => {
    const serverWithSuperJson = setupServer(
      mswTrpcWithSuperJson.listUsers.query(users => {
        return users
      }),
      mswTrpcWithSuperJson.createFriend.mutation(async ({ name }) => {
        return { name, id: 'new-friend' }
      })
    )

    beforeAll(() => {
      serverWithSuperJson.listen()
    })

    afterAll(() => {
      serverWithSuperJson.close()
    })

    test('query should use the transformer to deserialize the input correctly and return it', async () => {
      const result = await trpcWithSuperJson.listUsers.query({ take: 3, skip: 10 })

      expect(result).toEqual({ take: 3, skip: 10 })
    })

    test('mutation should use the transformer to deserialize the input correctly and return it', async () => {
      const result = await trpcWithSuperJson.createFriend.mutate({ name: 'Jason' })

      expect(result).toEqual({ name: 'Jason', id: 'new-friend' })
    })
  })
})
