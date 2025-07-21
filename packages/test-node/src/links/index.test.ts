import { HttpHandler, WebSocketHandler } from 'msw'
import { describe, test, expect } from 'vitest'

import { AppRouter, NestedAppRouter } from '../routers.js'
import { createTRPCMsw } from '../../../msw-trpc/src/index.js'
import { createWSClient, httpLink, splitLink, wsLink } from '../../../msw-trpc/src/links.js'

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

  describe('with ws link', () => {
    const mswLinks = [
      wsLink({
        client: createWSClient({
          url: 'ws://localhost:3001/trpc',
        }),
      }),
    ]

    test('should intercept ws handler', async () => {
      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      const myAsyncGenerator = async function* (opts: { input: string; signal?: AbortSignal }) {
        yield { id: opts.input, name: 'Toto' }
      }

      typeof myAsyncGenerator

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(WebSocketHandler)
      expect(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(WebSocketHandler)
      expect(
        mswTrpc.getUserUpdates.subscription(async function* (opts) {
          yield { id: opts.input, name: 'Toto' }
        })
      ).toBeInstanceOf(WebSocketHandler)
    })

    test('should intercept ws handler with nested routers', async () => {
      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(
        WebSocketHandler
      )
      expect(nestedMswTrpc.deeply.nested.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(
        WebSocketHandler
      )
    })
  })
})

describe('with split link', () => {
  describe('with a condition on type', () => {
    const mswLinks = [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: wsLink({
          client: createWSClient({
            url: 'ws://localhost:3001',
          }),
          onOpen() {},
        }),
        false: httpLink({
          url: 'http://localhost:3000/trpc',
          headers() {
            return {
              'content-type': 'application/json',
            }
          },
        }),
      }),
    ]

    test('should use correct handler', async () => {
      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(HttpHandler)
      expect(
        mswTrpc.getUserUpdates.subscription(async function* (opts) {
          yield { id: opts.input, name: 'Toto' }
        })
      ).toBeInstanceOf(WebSocketHandler)
    })

    test('should use correct handler with nested routers', async () => {
      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(nestedMswTrpc.deeply.nested.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(
        HttpHandler
      )
      expect(
        nestedMswTrpc.deeply.nested.getUserUpdates.subscription(async function* (opts) {
          yield { id: opts.input, name: 'Toto' }
        })
      ).toBeInstanceOf(WebSocketHandler)
    })
  })

  describe('with a condition on path', () => {
    test('should use correct handler', async () => {
      const mswLinks = [
        splitLink({
          condition: (op) => op.type === 'subscription' || op.path === 'createUser',
          true: wsLink({
            client: createWSClient({
              url: 'ws://localhost:3001',
            }),
            onOpen() {},
          }),
          false: httpLink({
            url: 'http://localhost:3000/trpc',
            headers() {
              return {
                'content-type': 'application/json',
              }
            },
          }),
        }),
      ]

      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(mswTrpc.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(WebSocketHandler)
      expect(
        mswTrpc.getUserUpdates.subscription(async function* (opts) {
          yield { id: opts.input, name: 'Toto' }
        })
      ).toBeInstanceOf(WebSocketHandler)
    })

    test('should use correct handler with nested routers', async () => {
      const mswLinks = [
        splitLink({
          condition: (op) => op.type === 'subscription' || op.path === 'deeply.nested.createUser',
          true: wsLink({
            client: createWSClient({
              url: 'ws://localhost:3001',
            }),
            onOpen() {},
          }),
          false: httpLink({
            url: 'http://localhost:3000/trpc',
            headers() {
              return {
                'content-type': 'application/json',
              }
            },
          }),
        }),
      ]

      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(nestedMswTrpc.deeply.nested.createUser.mutation(({ input }) => ({ id: '2', name: input }))).toBeInstanceOf(
        WebSocketHandler
      )
      expect(
        nestedMswTrpc.deeply.nested.getUserUpdates.subscription(async function* (opts) {
          yield { id: opts.input, name: 'Toto' }
        })
      ).toBeInstanceOf(WebSocketHandler)
    })
  })
})
