import { httpLink } from '@trpc/client'

export const links = [
  httpLink({
    url: 'http://localhost:3000/trpc',
    headers() {
      return {
        'content-type': 'application/json',
      }
    },
  }),
]
