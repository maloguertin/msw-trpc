import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { page } from '@vitest/browser/context'
import { setupWorker } from 'msw/browser'
import { render } from 'vitest-browser-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCMsw, httpLink } from '../../msw-trpc/src/index.ts'
import type { PropsWithChildren } from 'react'
import superjson from 'superjson'

import type { AppRouter } from './router.ts'
import { App } from './app.tsx'

const mswTrpc = createTRPCMsw<AppRouter>({
  transformer: { input: superjson, output: superjson },
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

const MockedProviders = (props: PropsWithChildren) => {
  const queryClient = new QueryClient()

  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
}

describe('basics', () => {
  const worker = setupWorker()

  beforeAll(() => worker.start({ onUnhandledRequest: 'error' }))
  afterAll(() => worker.stop())

  test('should render', async () => {
    render(<App />, { wrapper: MockedProviders })

    const div = page.getByText('Hello')

    await expect.element(div).toBeInTheDocument()
  })

  test('with msw', async () => {
    worker.use(
      mswTrpc.userById.query(({ input }) => {
        return { id: input, name: 'Tutu' }
      })
    )
    
    render(<App />, { wrapper: MockedProviders })

    const div = page.getByText('Tutu')

    await expect.element(div).toBeInTheDocument()
  })
})
