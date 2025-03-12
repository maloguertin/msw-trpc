import { HttpHandler } from 'msw'
import { describe, test, expect } from 'vitest'

import { AppRouter, NestedAppRouter } from '../routers.js'
import { createTRPCMsw } from '../../../msw-trpc/src/index.js'
import { httpLink } from '../../../msw-trpc/src/links.js'

describe('building handlers based on trpc links', () => {
  describe('with http link', () => {
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

    test('should intercept http handler', async () => {
      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(HttpHandler)
    })

    test('should intercept http handler with nested routers', async () => {
      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(nestedMswTrpc.deeply.nested.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(
        HttpHandler
      )
    })
  })
})
