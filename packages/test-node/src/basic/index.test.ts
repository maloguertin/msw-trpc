import { createTRPCClient } from '@trpc/client'
import { TRPCError } from '@trpc/server'
import { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'

import { setupServer } from 'msw/node'
import { describe, test, beforeAll, afterAll, expect, afterEach } from 'vitest'

import { links } from './links.js'
import { AppRouter, NestedAppRouter } from '../routers.js'
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

    test('handle mutations properly', async () => {
      server.use(mswTrpc.createUser.mutation((name) => ({ id: '2', name })))

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

    test('throwing custom error works with custom properties', async () => {
      class CustomError extends TRPCError {
        constructor(
          opts: {
            message?: string
            code: TRPC_ERROR_CODE_KEY
            cause?: unknown
          },
          public validationError: unknown
        ) {
          super(opts)
        }
      }

      server.use(
        mswTrpc.userById.query(() => {
          throw new CustomError(
            { code: 'UNPROCESSABLE_CONTENT', message: 'Validation failed' },
            { code: 'invalid-uuid' }
          )
        })
      )

      await expect(trpc.userById.query('1')).rejects.toMatchObject({
        message: 'Validation failed',
        data: {
          code: 'UNPROCESSABLE_CONTENT',
          httpStatus: 422,
          path: 'userById',
          validationError: {
            code: 'invalid-uuid',
          },
        },
        meta: {
          response: expect.any(Response),
          responseJSON: {
            error: {
              message: 'Validation failed',
              code: -32022,
              data: {
                code: 'UNPROCESSABLE_CONTENT',
                httpStatus: 422,
                path: 'userById',
                validationError: {
                  code: 'invalid-uuid',
                },
              },
            },
          },
        },
        shape: {
          message: 'Validation failed',
          code: -32022,
          data: {
            code: 'UNPROCESSABLE_CONTENT',
            httpStatus: 422,
            path: 'userById',
            validationError: {
              code: 'invalid-uuid',
            },
          },
        },
      })
    })
  })

  describe('nested router', () => {
    const mswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })
    const trpc = createTRPCClient<NestedAppRouter>({ links })
    const server = setupServer()

    beforeAll(() => server.listen())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    test('handle queries properly', async () => {
      server.use(mswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' })))
      const user = await trpc.deeply.nested.userById.query('1')

      expect(user).toEqual({ id: '1', name: 'Malo' })
    })

    test('mutations properly', async () => {
      server.use(mswTrpc.deeply.nested.createUser.mutation((name) => ({ id: '2', name })))
      const user = await trpc.deeply.nested.createUser.mutate('Robert')

      expect(user).toEqual({ id: '2', name: 'Robert' })
    })

    test('throwing error works', async () => {
      server.use(
        mswTrpc.deeply.nested.userById.query(() => {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' })
        })
      )

      await expect(trpc.deeply.nested.userById.query('1')).rejects.toMatchObject({
        message: 'Resource not found',
        data: { code: 'NOT_FOUND', httpStatus: 404, path: 'deeply.nested.userById' },
        shape: {
          message: 'Resource not found',
          code: -32004,
          data: { code: 'NOT_FOUND', httpStatus: 404, path: 'deeply.nested.userById' },
        },
        meta: {
          response: expect.any(Response),
          responseJSON: {
            error: {
              message: 'Resource not found',
              code: -32004,
              data: { code: 'NOT_FOUND', httpStatus: 404, path: 'deeply.nested.userById' },
            },
          },
        },
      })
    })
  })
})
