import { describe, it, expectTypeOf } from 'vitest'
import { RequestHandler, WebSocketHandler } from 'msw'
import { mswTrpc, mswTrpcWithSuperJson, nestedMswTrpc, User } from './setup'
import { Observable } from '@trpc/server/observable'

type PromiseOrValue<T> = T | Promise<T>

describe('proxy returned by createMswTrpc', () => {
  it('should expose property query on properties that match TRPC query procedures', () => {
    expectTypeOf(mswTrpc.userById.query).toEqualTypeOf<
      (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
    >()
  })

  it('should expose property mutation on properties that match TRPC mutation procedures', () => {
    expectTypeOf(mswTrpc.createUser.mutation).toEqualTypeOf<
      (handler: (input: string) => PromiseOrValue<User>) => RequestHandler
    >()
  })

  it('should expose property subscription on properties that match TRPC subscription procedures', () => {
    expectTypeOf(mswTrpc.getUserUpdates.subscription).toEqualTypeOf<
      (handler: (input: string) => Observable<User, unknown>) => WebSocketHandler
    >()
  })

  it('should interpret procedure without return as void', () => {
    mswTrpc.noReturn.mutation(input => {
      return
    })
    expectTypeOf(mswTrpc.noReturn.mutation).toEqualTypeOf<
      (handler: (input: void) => PromiseOrValue<void>) => RequestHandler
    >
  })

  describe('with merged routers', () => {
    it('should expose property query on properties that match TRPC query procedures', () => {
      expectTypeOf(nestedMswTrpc.deeply.nested.userById.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })
  })

  describe('with transformer', () => {
    it('context.data should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.createUser.mutation).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User>) => RequestHandler
      >()
    })

    it('req.getInput should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.userById.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })
  })

  describe('with output transformer', () => {
    it('query context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.userByName.query).toEqualTypeOf<
        (handler: (input: string) => PromiseOrValue<User | undefined>) => RequestHandler
      >()
    })

    it('mutation context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.updateUser.mutation).toEqualTypeOf<
        (handler: (input: User) => PromiseOrValue<User>) => RequestHandler
      >()
    })
  })
})
