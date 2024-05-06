import { createWSClient, httpLink, splitLink, wsLink } from '@trpc/client'

import { LazyWebSocket } from '../lazy-websocket.js'

export const createLinks = () => [
  splitLink({
    condition: (op) => op.type === 'subscription',
    true: wsLink({
      client: createWSClient({
        url: 'ws://localhost:3001',
        WebSocket: LazyWebSocket as any,
        // During tests, we don't want to retry the connection as the connection to the websocket server
        // starts before the proper mock server is set up, so tRPC will fall into an infinite retry loop
        // (for some reason, the exponential backoff doesn't work as expected in this case)
        retryDelayMs() {
          return 1000000000
        },
      }),
    }),
    false: httpLink({
      url: 'http://localhost:3000/trpc',
      headers() {
        return {
          'content-type': 'application/json',
        }
      },
    }),
  }),
]
