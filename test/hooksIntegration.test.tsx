import { mswTrpc, nestedMswTrpc, trpcReact, trpcReactClient } from './setup'
import { setupServer } from 'msw/node'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

type MswTrpc = typeof mswTrpc
type NestedMswTrpc = typeof nestedMswTrpc

const setupServerWithQueries = (mswTrpc: MswTrpc, nestedMswTrpc: NestedMswTrpc) => {
  return setupServer(
    mswTrpc.userById.query((req, res, ctx) => {
      return res(ctx.status(200), ctx.data({ id: '1', name: 'Tyler' }))
    }),
  )
}

describe('Query hook', () => {
  const server = setupServerWithQueries(mswTrpc, nestedMswTrpc);
  
  const ComponentWithHook = () => {
    const result = trpcReact.userById.useQuery('1');
    return (
      <div>
        <span data-testid="isLoading">{JSON.stringify(result.isLoading)}</span>
        <span data-testid="name">{JSON.stringify(result.data?.name)}</span>
      </div>
    );
  };

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterAll(() => server.close());

  const queryClient = new QueryClient();

  test('query hook gets intercepted by msw properly', async () => {
    render(
      <trpcReact.Provider client={trpcReactClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ComponentWithHook />
        </QueryClientProvider>
      </trpcReact.Provider>
    );
    
    const loadingElement = screen.getByTestId('isLoading');
    const nameElement = screen.getByTestId('name');
    expect(loadingElement).toHaveTextContent('true');
    
    await waitFor(() => {
      expect(loadingElement).toHaveTextContent('false');
      expect(nameElement).toHaveTextContent('Tyler');
    });
  });
});
