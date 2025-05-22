import { httpLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'
import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient } from '@trpc/client'

import type { AppRouter } from './router.js'

export const queryClient = new QueryClient()

const links = [
  httpLink({
    url: `http://localhost:3000/trpc`,
    transformer: superjson,
    fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
  }),
]

export const trpcClient = createTRPCClient<AppRouter>({ links })

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
