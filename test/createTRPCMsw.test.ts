import { expectTypeOf } from 'expect-type'
import {
  ResponseResolver,
  RestRequest,
  PathParams,
  DefaultBodyType,
  RestHandler,
  MockedRequest,
  RestContext,
} from 'msw'
import superjson from 'superjson'
import { mswTrpc, mswTrpcWithSuperJson, nestedMswTrpc, User } from './setup'

describe('proxy returned by createMswTrpc', () => {
  it('should expose property query on properties that match TRPC query procedures', () => {
    expectTypeOf(mswTrpc.userById.query).toEqualTypeOf<
      (
        handler: ResponseResolver<
          RestRequest<never, PathParams<string>> & { getInput: () => string },
          RestContext & {
            data: (data: User | undefined) => any
          },
          DefaultBodyType
        >
      ) => RestHandler<MockedRequest<DefaultBodyType>>
    >()
  })

  it('should expose property mutation on properties that match TRPC mutation procedures', () => {
    expectTypeOf(mswTrpc.createUser.mutation).toEqualTypeOf<
      (
        handler: ResponseResolver<
          RestRequest<string, PathParams> & { getInput: () => string },
          RestContext & {
            data: (data: User) => any
          }
        >
      ) => RestHandler<MockedRequest<DefaultBodyType>>
    >()
  })

  describe('with merged routers', () => {
    it('should expose property query on properties that match TRPC query procedures', () => {
      expectTypeOf(nestedMswTrpc.users.userById.query).toEqualTypeOf<
        (
          handler: ResponseResolver<
            RestRequest<never, PathParams<string>> & { getInput: () => string },
            RestContext & {
              data: (data: User | undefined) => any
            },
            DefaultBodyType
          >
        ) => RestHandler<MockedRequest<DefaultBodyType>>
      >()
    })
  })

  describe('with transformer', () => {
    it('context.data should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.createUser.mutation).toEqualTypeOf<
        (
          handler: ResponseResolver<
            RestRequest<string, PathParams> & { getInput: () => string },
            RestContext & {
              data: (data: User) => ReturnType<superjson['serialize']>
            }
          >
        ) => RestHandler<MockedRequest<DefaultBodyType>>
      >()
    })

    it('req.getInput should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.userById.query).toEqualTypeOf<
        (
          handler: ResponseResolver<
            RestRequest<never, PathParams<string>> & { getInput: () => string },
            RestContext & {
              data: (data: User | undefined) => any
            },
            DefaultBodyType
          >
        ) => RestHandler<MockedRequest<DefaultBodyType>>
      >()
    })
  })
})
