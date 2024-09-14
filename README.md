<div align="center">
  <img src="assets/trpc-msw.png" style="height: 100px;"/>
  <h1>msw-trpc</h1>
  <a href="https://www.npmjs.com/package/msw-trpc"><img src="https://img.shields.io/npm/v/msw-trpc.svg?style=flat&color=brightgreen" target="_blank" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" /></a>
  <br />
  <hr />
</div>

> [!WARNING]
> You are looking at a pre-release version of msw-trpc, which adds support for msw v2. Documentation may be out of date and bugs might occur, use at your own risk

## **[tPRC](https://trpc.io/) support for [MSW](https://mswjs.io/)**

- Create MSW handlers from your tRPC router.
- Get your tRPC typing into your MSW handlers.
- Augments MSW with utils for tRPC.
- Use it like you would use the tRPC client.
- Merged routers supported !
- Use `msw` v2

## Motivation

As someone who loves MSW and was already using it I wanted to keep using it instead of mocking tRPC. While it is possible to simply write the Rest handlers it felt like it would be great not to lose the full power of tRPC types in the tests.

## Usage

**1. Install `msw-trpc`.**

```bash
npm i msw-trpc --save-dev
```

**2. build your trpcMsw with createTRPCMsw.**

```typescript
import { createTRPCMsw } from 'msw-trpc'
import type { AppRouter } from 'path/to/your/router'

export const trpcMsw = createTRPCMsw<AppRouter>() /* 👈 */
```

**3. Start using it.**

```typescript
const server = setupServer(
  trpcMsw.userById.query(() => ({ id: '1', name: 'Uncle bob' })),
  trpcMsw.createUser.mutation((name) => ({ id: '2', name }))
)
```

You can find examples of how to use it in the [test-react](./packages/test-react/package.json) package or in the [test-node](./packages/test-node/package.json) package.

## How it works

`createTRPCMsw` returns a Proxy that infers types from your AppRouter

```typescript
// all queries will expose a query function that accepts a MSW handler
trpcMsw.myQuery.query(() => {})

// all mutations will expose a mutation function that accepts a MSW handler
trpcMsw.myMutation.mutation(() => {})
```

## Config

You need to pass a `httpLink` to the `createTRPCMsw` function like you would do with the tRPC client.

You can pass an optional transformer like `superjson` to the `createTRPCMsw` function.

```typescript
interface TRPCMswConfig {
  links: Link[]
  transformer?: TRPCCombinedDataTransformer
}
```

## Requirements

Peer dependencies:

- [`tRPC`](https://github.com/trpc/trpc) server v11 (`@trpc/server@next`) must be installed.
- [`msw`](https://github.com/mswjs/msw) (`msw`) must be installed.

Please note:

- Batch is not yet supported
