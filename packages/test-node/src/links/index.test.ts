import { observable } from '@trpc/server/observable'

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

    test('should use http handler', async () => {
      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(mswTrpc.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(HttpHandler)
    })

    test('should use http handler with nested routers', async () => {
      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(HttpHandler)
      expect(nestedMswTrpc.deeply.nested.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(HttpHandler)
    })
  })

  describe('with ws link', () => {
    const mswLinks = [
      wsLink({
        client: createWSClient({
          url: 'ws://localhost:3001',
        }),
        onOpen() {},
      }),
    ]

    test('should use ws handler', async () => {
      const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })

      expect(mswTrpc.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(WebSocketHandler)
      expect(mswTrpc.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(WebSocketHandler)
      expect(
        mswTrpc.getUserUpdates.subscription((id) => {
          return observable((emit) => emit.next({ id, name: 'Toto' }))
        }).handler
      ).toBeInstanceOf(WebSocketHandler)
    })

    test('should use ws handler with nested routers', async () => {
      const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

      expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(
        WebSocketHandler
      )
      expect(nestedMswTrpc.deeply.nested.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(
        WebSocketHandler
      )
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
        expect(mswTrpc.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(HttpHandler)
        expect(
          mswTrpc.getUserUpdates.subscription((id) => {
            return observable((emit) => emit.next({ id, name: 'Toto' }))
          }).handler
        ).toBeInstanceOf(WebSocketHandler)
      })

      test('should use correct handler with nested routers', async () => {
        const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })

        expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(
          HttpHandler
        )
        expect(nestedMswTrpc.deeply.nested.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(
          HttpHandler
        )
        expect(
          nestedMswTrpc.deeply.nested.getUserUpdates.subscription((id) => {
            return observable((emit) => emit.next({ id, name: 'Toto' }))
          }).handler
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
        expect(mswTrpc.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(WebSocketHandler)
        expect(
          mswTrpc.getUserUpdates.subscription((id) => {
            return observable((emit) => emit.next({ id, name: 'Toto' }))
          }).handler
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

        expect(nestedMswTrpc.deeply.nested.userById.query(() => ({ id: '1', name: 'Malo' }))).toBeInstanceOf(
          HttpHandler
        )
        expect(nestedMswTrpc.deeply.nested.createUser.mutation((name) => ({ id: '2', name }))).toBeInstanceOf(
          WebSocketHandler
        )
        expect(
          nestedMswTrpc.deeply.nested.getUserUpdates.subscription((id) => {
            return observable((emit) => emit.next({ id, name: 'Toto' }))
          }).handler
        ).toBeInstanceOf(WebSocketHandler)
      })
    })
  })
})
