import { createTRPCClient } from '@trpc/client'
import { TRPCError } from '@trpc/server'

import { setupServer } from 'msw/node'
import { describe, test, beforeAll, afterAll, expect, afterEach } from 'vitest'

import { links } from './links.js'
import { AppRouter } from '../routers.js'
import { createTRPCMsw } from '../../../msw-trpc/src/index.js'
import { httpLink } from '../../../msw-trpc/src/links.js'

const mswLinks = [
  httpLink({
    url: 'http://localhost:3000/trpc',
    headers() {
      return {
        'content-type': 'application/json',
      }
    },
    methodOverride: 'POST',
  }),
]

describe('with http link', () => {
  describe('queries and mutations', () => {
    const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })
    const trpc = createTRPCClient<AppRouter>({ links })
    const server = setupServer()

    beforeAll(() => server.listen())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    test('handle queries properly', async () => {
      server.use(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' })))

      const user = await trpc.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('handle queries with input properly', async () => {
      server.use(mswTrpc.userById.query(({ input }) => ({ id: input, name: 'Malo' })))

      const user = await trpc.userById.query('3')

      expect(user).toEqual({ id: '3', name: 'Malo' })
    })

    test('handle mutations properly', async () => {
      server.use(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input })))

      const user = await trpc.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })

    test('throwing error works', async () => {
      server.use(
        mswTrpc.userById.query(() => {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' })
        })
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
              message: 'Resource not found',
              code: -32004,
              data: { code: 'NOT_FOUND', httpStatus: 404, path: 'userById' },
            },
          },
        },
      })
    })

    test('should use POST method for queries', async () => {
      server.use(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' })))

      const interceptedPromise = new Promise<Request>((resolve) => {
        server.events.on('request:start', ({ request }) => {
          resolve(request)
        })
      })

      await trpc.userById.query('1')

      const intercepted = await interceptedPromise

      expect(intercepted.method).toBe('POST')
    })

    test('should use POST method for mutations', async () => {
      server.use(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input })))

      const interceptedPromise = new Promise<Request>((resolve) => {
        server.events.on('request:start', ({ request }) => {
          resolve(request)
        })
      })

      await trpc.createUser.mutate('Robert')

      const intercepted = await interceptedPromise

      expect(intercepted.method).toBe('POST')
    })
  })
})
