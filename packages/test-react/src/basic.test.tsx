import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createTRPCMsw, httpLink } from '../../msw-trpc/src'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import type { AppRouter } from './routers/basic.js'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact, httpLink as TRPChttpLink } from '@trpc/react-query'

describe('basic', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
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
      mswTrpc.userById.query(({ input }) => {
        return { id: input, name: 'Tutu' }
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
})
