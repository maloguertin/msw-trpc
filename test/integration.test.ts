import { AppRouter, mswTrpc, NestedAppRouter, nestedMswTrpc, nestedTrpc, trpc } from './setup'

import { setupServer } from 'msw/node'
import { createTRPCMsw } from '../src'

describe('queries and mutations', () => {
  const server = setupServer(
    mswTrpc.userById.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
    }),
    mswTrpc.createUser.mutation(async (req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
    }),
    nestedMswTrpc.users.userById.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
    }),
    nestedMswTrpc.users.createUser.mutation(async (req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
    })
  )

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

    const server = setupServer(
      mswTrpc.userById.query((req, res, ctx) => {
        return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
      }),
      mswTrpc.createUser.mutation(async (req, res, ctx) => {
        return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
      }),
      nestedMswTrpc.users.userById.query((req, res, ctx) => {
        return res(ctx.status(200), ctx.data({ id: '1', name: 'Malo' }))
      }),
      nestedMswTrpc.users.createUser.mutation(async (req, res, ctx) => {
        return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
      })
    )

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

      test('msw server setup from msw-trpc query handle should handle mutations properly', async () => {
        const user = await nestedTrpc.users.createUser.mutate('Robert')

        expect(user).toEqual({ id: '2', name: 'Robert' })
      })
    })
  })
})
