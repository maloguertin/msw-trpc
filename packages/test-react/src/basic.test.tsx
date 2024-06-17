import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createTRPCMsw, httpLink, wsLink, createWSClient, splitLink } from '../../msw-trpc/src'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import type { AppRouter } from './routers/basic.js'
import type { AppRouteWithSuperJson } from './routers/superjson.js'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createTRPCReact,
  httpLink as TRPChttpLink,
  wsLink as TRPCwsLink,
  splitLink as TRPCsplitLink,
  createWSClient as TRPCcreateWSClient,
} from '@trpc/react-query'
import { useState } from 'react'
import SuperJSON from 'superjson'

describe.only('basic', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  test('http link', async () => {
    const queryClient = new QueryClient()

    const trpc = createTRPCReact<AppRouter>()

    const client = trpc.createClient({
      links: [
        TRPChttpLink({
          url: 'http://localhost:3000/trpc',
        }),
      ],
    })

    const App = () => {
      const { data } = trpc.userById.useQuery('1')

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
      mswTrpc.userById.query((id) => {
        return { id, name: 'Tutu' }
      })
    )

    render(
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tutu')).toBeInTheDocument()
    })
  })

  test('ws link', async () => {
    const queryClient = new QueryClient()

    const trpc = createTRPCReact<AppRouter>()

    const App = () => {
      const { data } = trpc.userById.useQuery('1')

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const client = trpc.createClient({
      links: [
        TRPCwsLink({
          client: TRPCcreateWSClient({
            url: 'ws://localhost:3001',
          }),
        }),
      ],
    })

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            url: 'ws://localhost:3001',
          }),
        }),
      ],
    })

    server.use(mswTrpc.userById.query((id) => ({ id, name: 'Malo' })))

    render(
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Malo')).toBeInTheDocument()
    })
  })

  test('subscriptions', async () => {
    const queryClient = new QueryClient()

    const trpc = createTRPCReact<AppRouter>()

    const App = () => {
      const [data, setData] = useState<{
        id: string
        name: string
      } | null>(null)

      trpc.getUserUpdates.useSubscription('1', {
        onData: (data) => setData(data),
      })

      if (data) {
        return <div>{data.name}</div>
      }

      return <div>Hello</div>
    }

    const mswTrpc = createTRPCMsw<AppRouter>({
      links: [
        wsLink({
          client: createWSClient({
            url: 'ws://localhost:3001',
          }),
        }),
      ],
    })

    const subscription = mswTrpc.getUserUpdates.subscription()

    server.use(subscription.handler)

    const client = trpc.createClient({
      links: [
        TRPCwsLink({
          client: TRPCcreateWSClient({
            url: 'ws://localhost:3001',
          }),
        }),
      ],
    })

    render(
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await subscription.trigger({ id: '5', name: 'Didier' })

    await waitFor(() => {
      expect(screen.getByText('Didier')).toBeInTheDocument()
    })
  })

  test('split link', async () => {
    const queryClient = new QueryClient()

    const trpc = createTRPCReact<AppRouter>()

    const client = trpc.createClient({
      links: [
        TRPCsplitLink({
          condition: (op) => {
            return op.type === 'subscription'
          },
          true: TRPCwsLink({
            client: TRPCcreateWSClient({
              url: `ws://api.localhost:3001/trpc`,
            }),
          }),
          false: TRPChttpLink({
            url: `http://api.localhost:3000/trpc`,
            fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
          }),
        }),
      ],
    })

    const App = () => {
      const { data } = trpc.userById.useQuery('1')

      trpc.getUserUpdates.useSubscription('1', {
        onData: (data) => setRecord(data),
      })

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

    const subscription = mswTrpc.getUserUpdates.subscription()

    server.use(
      mswTrpc.userById.query((id) => {
        return { id, name: 'Tutu' }
      }),
      subscription.handler
    )

    render(
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tutu')).toBeInTheDocument()
    })

    await subscription.trigger({ id: '5', name: 'Didier' })

    await waitFor(() => {
      expect(screen.getByText('Didier')).toBeInTheDocument()
    })
  })
})
