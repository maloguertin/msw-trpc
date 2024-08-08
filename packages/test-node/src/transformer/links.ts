import { httpLink } from '@trpc/client'
import superjson from 'superjson'

export const links = [
  httpLink({
    transformer: superjson,
    url: 'http://localhost:3000/trpc',
    headers: () => ({ 'content-type': 'application/json' }),
  }),
]
