import { Observable } from '@trpc/server/observable'

import { RequestHandler, WebSocketHandler } from 'msw'
import { describe, expectTypeOf, test } from 'vitest'
import superjson from 'superjson'

import { AppRouter, AppRouterWithSuperJson, NestedAppRouter, User } from './router.js'
import { createTRPCMsw } from '../../../msw-trpc/src/index.js'
import { httpLink } from '../../../msw-trpc/src/links.js'

type PromiseOrValue<T> = T | Promise<T>

const mswLinks = [
  httpLink({
    transformer: superjson,
    url: 'http://localhost:3000/trpc',
    headers: () => ({ 'content-type': 'application/json' }),
  }),
]

const mswTrpc = createTRPCMsw<AppRouter>({ links: mswLinks })
const nestedMswTrpc = createTRPCMsw<NestedAppRouter>({ links: mswLinks })
const mswTrpcWithSuperJson = createTRPCMsw<AppRouterWithSuperJson>({
  links: mswLinks,
  transformer: { input: superjson, output: superjson },
})

describe('proxy returned by createMswTrpc', () => {
  test('should expose property query on properties that match TRPC query procedures', () => {
    expectTypeOf(mswTrpc.userById.query).toEqualTypeOf<
      (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
    >()
  })

  test('should expose property mutation on properties that match TRPC mutation procedures', () => {
    expectTypeOf(mswTrpc.createUser.mutation).toEqualTypeOf<
      (handler: (input: string) => PromiseOrValue<User>) => RequestHandler
    >()
  })

  test('should expose property subscription on properties that match TRPC subscription procedures', () => {
    expectTypeOf(mswTrpc.getUserUpdates.subscription).toEqualTypeOf<
      (handler?: (input: string) => Observable<User, unknown>) => {
        handler: WebSocketHandler
        trigger: (data: User) => void
      }
    >()
  })

  test('should interpret procedure without return as void', () => {
    mswTrpc.noReturn.mutation((input) => {
      return
    })
    expectTypeOf(mswTrpc.noReturn.mutation).toEqualTypeOf<
      (handler: (input: void) => PromiseOrValue<void>) => RequestHandler
    >
  })

  describe('with merged routers', () => {
    test('should expose property query on properties that match TRPC query procedures', () => {
      expectTypeOf(nestedMswTrpc.deeply.nested.userById.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })
  })

  describe('with transformer', () => {
    test('context.data should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.createUser.mutation).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User>) => RequestHandler
      >()
    })

    test('req.getInput should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.userById.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })

    test('req.getOutput should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.addDateToSet.mutation).toEqualTypeOf<
        (handler: (input: Date) => PromiseOrValue<Set<Date>>) => RequestHandler
      >()
    })
  })

  describe('with output transformer', () => {
    test('query context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.userByName.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })

    test('mutation context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.updateUser.mutation).toEqualTypeOf<
        (handler: (input: User) => PromiseOrValue<User>) => RequestHandler
      >()
    })
  })
})
