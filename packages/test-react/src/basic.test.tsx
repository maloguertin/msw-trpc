import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createTRPCMsw, httpLink } from '../../msw-trpc/src'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import type { AppRouter } from './routers/basic.js'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createTRPCClient, httpLink as TRPCClientHttpLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

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
})
