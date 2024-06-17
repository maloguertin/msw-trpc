import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createTRPCMsw, httpLink } from '../../msw-trpc/src'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import type { AppRouteWithSuperJson } from './routers/superjson.js'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact, httpLink as TRPChttpLink } from '@trpc/react-query'
import SuperJSON from 'superjson'

describe('superjson', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  test('http link', async () => {
    const queryClient = new QueryClient()

    const trpc = createTRPCReact<AppRouteWithSuperJson>()

    const client = trpc.createClient({
      links: [
        TRPChttpLink({
          url: 'http://localhost:3000/trpc',
          transformer: SuperJSON,
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

    const mswTrpc = createTRPCMsw<AppRouteWithSuperJson>({
      transformer: { input: SuperJSON, output: SuperJSON },
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
})
