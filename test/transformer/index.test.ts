import { AppRouter } from './router'
import { describe, test, beforeAll, afterAll, expect, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { createTRPCMsw } from '../../src'
import { TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { createTRPCClient } from '@trpc/client'
import { httpLink } from '@trpc/client'

describe('queries and mutations', () => {
  const server = setupServer()
  const mswTrpc = createTRPCMsw<AppRouter>({
    transformer: { input: superjson, output: superjson },
  })
  const trpc = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        transformer: superjson,
        url: 'http://localhost:3000/trpc',
        headers: () => ({ 'content-type': 'application/json' }),
      }),
    ],
  })

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  test('handle queries properly', async () => {
    server.use(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' })))

    const user = await trpc.userById.query('1')

    expect(user).toEqual({ id: '1', name: 'Malo' })
  })

  test('handle mutations properly', async () => {
    server.use(mswTrpc.createUser.mutation(name => ({ id: '2', name })))

    const user = await trpc.createUser.mutate('Robert')

    expect(user).toEqual({ id: '2', name: 'Robert' })
  })

  test('throwing error with superjson works', async () => {
    server.use(
      mswTrpc.userById.query(() => {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' })
      }),
    )

    await expect(trpc.userById.query('1')).rejects.toMatchObject({
      message: 'Resource not found',
      data: { code: 'NOT_FOUND', httpStatus: 404, path: 'userById' },
      shape: {
        message: 'Resource not found',
        code: -32004,
        data: { code: 'NOT_FOUND', httpStatus: 404, path: 'userById' },
      },
      meta: {
        response: expect.any(Response),
        responseJSON: {
          error: {
            json: {
              message: 'Resource not found',
              code: -32004,
              data: { code: 'NOT_FOUND', httpStatus: 404, path: 'userById' },
            },
          },
        },
      },
    })
  })

  test('superjson transformer works', async () => {
    server.use(
      mswTrpc.superjson.query(date => {
        return new Set([date])
      }),
    )

    const date = new Date()
    const set = await trpc.superjson.query(date)

    expect(set).toBeInstanceOf(Set)
    expect(set.size).toBe(1)
    expect([...set][0]).toEqual(date)
  })
})
