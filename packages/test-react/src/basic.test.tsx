import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createTRPCMsw, createWSClient, httpLink, splitLink, wsLink } from '../../msw-trpc/src'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import type { AppRouter } from './routers/basic.js'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  createTRPCClient,
  httpLink as TRPCClientHttpLink,
  wsLink as TRPCClientWSLink,
  createWSClient as TRPCCreateWSClient,
  TRPCLink,
  splitLink as TRPCClientSplitLink,
} from '@trpc/client'
import { createTRPCOptionsProxy, useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'

describe('basic', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  test('http link', async () => {
    const queryClient = new QueryClient()

    const links = [
      TRPCClientHttpLink({
        url: 'http://localhost:3000/trpc',
      }),
    ]

    const trpcClient = createTRPCClient<AppRouter>({ links })

    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: trpcClient,
      queryClient,
    })

    const App = () => {
      const { data } = useQuery(trpc.userById.queryOptions('1'))

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        httpLink({
          url: 'http://localhost:3000/trpc',
          headers() {
            return {
              'content-type': 'application/json',
            }
          },
        }),
      ],
    })

    server.use(
      mswTrpc.userById.query(({ input }) => {
        return { id: input, name: 'Tutu' }
      })
    )

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tutu')).toBeInTheDocument()
    })
  })

  test('ws link', async () => {
    const queryClient = new QueryClient()

    const links = [
      TRPCClientWSLink({
        client: TRPCCreateWSClient({
          url: 'ws://localhost:3001/trpc',
        }),
      }), // bypassing type check
    ]

    const trpcClient = createTRPCClient<AppRouter>({ links })

    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: trpcClient,
      queryClient,
    })

    const App = () => {
      const { data } = useQuery(trpc.userById.queryOptions('1'))

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            url: 'ws://localhost:3001/trpc',
          }),
        }),
      ],
    })

    server.use(mswTrpc.userById.query(({ input }) => ({ id: input, name: 'Malo' })))

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Malo')).toBeInTheDocument()
    })
  })

  test('subscriptions', async () => {
    const queryClient = new QueryClient()

    const links = [
      TRPCClientWSLink({
        client: TRPCCreateWSClient({
          url: 'ws://localhost:3001/trpc',
        }),
      }) as unknown as TRPCLink<AppRouter>, // bypassing type check
    ]

    const trpcClient = createTRPCClient<AppRouter>({ links })

    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: trpcClient,
      queryClient,
    })

    const App = () => {
      const [data, setData] = useState<{
        id: string
        name: string
      } | null>(null)

      useSubscription(
        trpc.getUserUpdates.subscriptionOptions('1', {
          onData: (data) => setData(data),
        })
      )

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            url: 'ws://localhost:3001/trpc',
          }),
        }),
      ],
    })

    const subscription = mswTrpc.getUserUpdates.subscription(async function* (opts) {
      yield await new Promise((resolve) => setTimeout(() => resolve({ id: opts.input, name: 'Didier' }), 500))
    })

    server.use(subscription)

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Didier')).toBeInTheDocument()
    })
  })

  test('split link', async () => {
    const queryClient = new QueryClient()

    const links = [
      TRPCClientSplitLink({
        condition: (op) => {
          return op.type === 'subscription'
        },
        true: TRPCClientWSLink({
          client: TRPCCreateWSClient({
            url: `ws://api.localhost:3001/trpc`,
          }),
        }),
        false: TRPCClientHttpLink({
          url: `http://api.localhost:3000/trpc`,
          fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
        }),
      }),
    ]

    const trpcClient = createTRPCClient<AppRouter>({ links })

    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: trpcClient,
      queryClient,
    })

    const App = () => {
      const { data } = useQuery(trpc.userById.queryOptions('1'))

      useSubscription(
        trpc.getUserUpdates.subscriptionOptions('1', {
          onData: (data) => setRecord(data),
        })
      )

      const [record, setRecord] = useState<{
        id: string
        name: string
      } | null>(null)

      if (record) {
        return <div>{record.name}</div>
      }

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        splitLink({
          condition: (op) => {
            return op.type === 'subscription'
          },
          true: wsLink({
            client: createWSClient({
              url: 'ws://api.localhost:3001/trpc',
            }),
          }),
          false: httpLink({
            url: 'http://api.localhost:3000/trpc',
          }),
        }),
      ],
    })

    const subscription = mswTrpc.getUserUpdates.subscription(async function* (opts) {
      yield await new Promise((resolve) => setTimeout(() => resolve({ id: opts.input, name: 'Didier' }), 500))
    })

    server.use(
      mswTrpc.userById.query(({ input }) => {
        return { id: input, name: 'Tutu' }
      }),
      subscription
    )

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tutu')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Didier')).toBeInTheDocument()
    })
  })
})
