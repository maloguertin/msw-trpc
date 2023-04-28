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

type MswTrpc = typeof mswTrpc
type NestedMswTrpc = typeof nestedMswTrpc

const setupServerWithQueries = (mswTrpc: MswTrpc, nestedMswTrpc: NestedMswTrpc) => {
  return setupServer(
    mswTrpc.userById.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
    }),
    mswTrpc.userByIdAndPost.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo', posts: ['1'] }))
    }),
    mswTrpc.createUser.mutation(async (req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
    }),
    nestedMswTrpc.users.userById.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
    }),
    nestedMswTrpc.users.userByIdAndPost.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo', posts: ['1'] }))
    }),
    nestedMswTrpc.users.createUser.mutation(async (req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
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
      mswTrpcWithSuperJson.listUsers.query((req, res, ctx) => {
        return res(ctx.status(200), ctx.data(req.getInput()))
      }),
      mswTrpcWithSuperJson.createFriend.mutation(async (req, res, ctx) => {
        const input = await req.getInput()
        return res(ctx.status(200), ctx.data({ name: input.name, id: 'new-friend' }))
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
