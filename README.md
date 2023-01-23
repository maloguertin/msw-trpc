
<div align="center">
  <img src="assets/trpc-msw.png" style="height: 100px;"/>
  <h1>msw-trpc</h1>
  <a href="https://www.npmjs.com/package/mswp-trpc"><img src="https://img.shields.io/npm/v/msw-trpc.svg?style=flat&color=brightgreen" target="_blank" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" /></a>
  <br />
  <hr />
</div>

## **[tPRC](https://trpc.io/) support for [MSW](https://mswjs.io/)**

- Create MSW handlers from your tRPC router.
- Get your tRPC typing into your MSW handlers.
- Augments MSW with utils for tRPC.

## Motivation

As someone who loves MSW and was already using it I wanted to keep using it instead of mocking tRPC. While it is possible to simply write the Rest handlers it felt like it would be great not to lose the full power of tRPC types in the tests.

## Usage

**1. Install `msw-trpc`.**

```bash
npm i msw-trpc --save-dev
```

**2. build your tpcMsw with createTRPCMsw.**

```typescript
import { createTRPCMsw } from '@trpc/server'
import type { AppRouter } from 'path/to/your/router'

export const trpcMsw = createTRPCMsw<AppRouter>() /* 👈 */
```

**3. Start using it.**

```typescript
const server = setupServer(
  mswTrpc.userById.query((req, res, ctx) => {
    return res(ctx.status(200), ctx.data({ id: '1', name: 'Uncle bob' }))
  }),
  mswTrpc.createUser.mutation(async (req, res, ctx) => {
    return res(ctx.status(200), ctx.data({ id: '2', name: await req.json() }))
  })
)
```

## How it works

`createTRPCMsw` returns a Proxy that infers types from your AppRouter

```typescript
// all queries will expose a query function that accepts a MSW handler
trpcMsw.myQuery.query((req, res, ctx) => {})

// all mutations will expose a mutation function that accepts a MSW handler
trpcMsw.myMutation.mutation((req, res, ctx) => {})
```

## MSW Augments

**ctx.data**

Inspired by MSW GraphQL the context of your handlers now exposes a data function that will transform your data to the tRPC structure

```typescript
mswTrpc.userById.query((req, res, ctx) => {
  console.log(ctx.data({ my: 'data' })) /* 👈 */
})

// return ctx.json with
{
  result: {
    data: {
      my: 'data'
    }
  }
}
```

**req.getInput**

Only available in query handlers

Returns the parsed input from the request

```typescript
//router.ts
const appRouter = t.router({
  userById: t.procedure.input(z.object({ name: z.string() })).query(req => {
    const { input } = req
    const user = userList.find(u => u.name === input.name)
    return user
  }),
})

//test-file.ts
mswTrpc.userById.query((req, res, ctx) => {
  console.log(req.getInput()) /* 👈 */
})

// outputs
{
  name: 'Pedro'
}

test('should do something', () => {
  trpc.userById.query({ name: 'Pedro' })
})
```

## Config

`createTRPCMsw` accepts a 2nd argument:

```typescript
type config = {
  basePath?: string
  baseUrl?: string
  transformer?: {
    input: {
      serialize(object: any): any
      deserialize(object: any): any
    }
    output: {
      serialize(object: any): any
      deserialize(object: any): any
    }
  }
}
```

| property    | default            | details                                                                                     |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------- |
| basePath    | 'trpc'             | Will match all requests to _basePath_ regardless of host                                    |
| baseUrl     | undefined          | Setting this overrides basePath and will only match requests to this specific _baseUrl_     |
| transformer | defaultTransformer | Will transform your output data with `transformer.output.serialize` when calling `ctx.data` |

## Requirements

Peer dependencies:

- [`tRPC`](https://github.com/trpc/trpc) server v10 (`@trpc/server`) must be installed.
- [`msw`](https://github.com/mswjs/msw) (`msw`) must be installed.

Please note:

- Batch is not yet supported
