import { expectTypeOf } from 'expect-type'
import { ResponseResolver, DefaultBodyType, HttpResponse, RequestHandler, HttpResponseInit, StrictResponse } from 'msw'
import { mswTrpc, mswTrpcWithSuperJson, nestedMswTrpc, User } from './setup'

type ResultData<T> = { result: { data: T } }

describe('proxy returned by createMswTrpc', () => {
  it('should expose property query on properties that match TRPC query procedures', () => {
    expectTypeOf(mswTrpc.userById.query).toEqualTypeOf<
      (
        handler: ResponseResolver<
          {
            getInput: () => string
            data: (data: User | undefined, init?: HttpResponseInit) => StrictResponse<ResultData<User | undefined>>
          },
          DefaultBodyType,
          ResultData<User | undefined>
        >
      ) => RequestHandler
    >()
  })

  it('should expose property mutation on properties that match TRPC mutation procedures', () => {
    expectTypeOf(mswTrpc.createUser.mutation).toEqualTypeOf<
      (
        handler: ResponseResolver<
          {
            getInput: () => Promise<string>
            data: (data: User, init?: HttpResponseInit) => StrictResponse<ResultData<User>>
          },
          string,
          ResultData<User>
        >
      ) => RequestHandler
    >()
  })

  describe('with merged routers', () => {
    it('should expose property query on properties that match TRPC query procedures', () => {
      expectTypeOf(nestedMswTrpc.users.userById.query).toEqualTypeOf<
        (
          handler: ResponseResolver<
            {
              getInput: () => string
              data: (data: User | undefined, init?: HttpResponseInit) => StrictResponse<ResultData<User | undefined>>
            },
            DefaultBodyType,
            ResultData<User | undefined>
          >
        ) => RequestHandler
      >()
    })
  })

  describe('with transformer', () => {
    it('context.data should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.createUser.mutation).toEqualTypeOf<
        (
          handler: ResponseResolver<
            {
              getInput: () => Promise<string>
              data: (data: User, init?: HttpResponseInit) => StrictResponse<ResultData<User>>
            },
            string,
            ResultData<User>
          >
        ) => RequestHandler
      >()
    })

    it('req.getInput should return the correct type', () => {
      expectTypeOf(mswTrpcWithSuperJson.userById.query).toEqualTypeOf<
        (
          handler: ResponseResolver<
            {
              getInput: () => string
              data: (data: User | undefined, init?: HttpResponseInit) => StrictResponse<ResultData<User | undefined>>
            },
            DefaultBodyType,
            ResultData<User | undefined>
          >
        ) => RequestHandler
      >()
    })
  })

  describe('with output transformer', () => {
    it('query context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.userByName.query).toEqualTypeOf<
        (
          handler: ResponseResolver<
            {
              getInput: () => string
              data: (data: User | undefined, init?: HttpResponseInit) => StrictResponse<ResultData<User | undefined>>
            },
            DefaultBodyType,
            ResultData<User | undefined>
          >
        ) => RequestHandler
      >()
    })

    it('mutation context.data should consider output transformer', () => {
      expectTypeOf(mswTrpc.updateUser.mutation).toEqualTypeOf<
        (
          handler: ResponseResolver<
            {
              getInput: () => Promise<User>
              data: (data: User, init?: HttpResponseInit) => StrictResponse<ResultData<User>>
            },
            User,
            ResultData<User>
          >
        ) => RequestHandler
      >()
    })
  })
})
