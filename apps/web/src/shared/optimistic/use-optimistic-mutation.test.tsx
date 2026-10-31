import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '../api/problem';
import { clearToasts, getToasts } from '../toast/toast-store';
import { useOptimisticMutation } from './use-optimistic-mutation';

const KEY = ['items'];

function setup(mutation_fn: (name: string) => Promise<undefined>, fetch_items = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetch_items.mockResolvedValue(['a']);

  function Page() {
    const list = useQuery({ queryKey: KEY, queryFn: fetch_items as () => Promise<string[]> });
    const mutation = useOptimisticMutation<undefined, string, string[]>({
      mutation_fn,
      query_key: KEY,
      apply: (current, name) => [...(current ?? []), name],
    });
    return (
      <>
        <ul>
          {(list.data ?? []).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            mutation.mutate('b');
          }}
        >
          add
        </button>
      </>
    );
  }

  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
  return { fetch_items };
}

afterEach(() => {
  clearToasts();
});

describe('useOptimisticMutation', () => {
  it('applies the change before the server answers', async () => {
    setup(() => new Promise<undefined>(() => undefined));
    await screen.findByText('a');
    await userEvent.click(screen.getByText('add'));
    expect(await screen.findByText('b')).toBeInTheDocument();
  });

  it('rolls back and shows a toast when the server refuses', async () => {
    setup(() =>
      Promise.reject(new ApiProblem({ status: 409, code: 'not_found', title: 'Refused' })),
    );
    await screen.findByText('a');
    await userEvent.click(screen.getByText('add'));
    await waitFor(() => {
      expect(screen.queryByText('b')).not.toBeInTheDocument();
    });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ tone: 'danger' });
  });

  it('invalidates the queries after settling', async () => {
    const { fetch_items } = setup(() => Promise.resolve(undefined));
    await screen.findByText('a');
    await userEvent.click(screen.getByText('add'));
    await waitFor(() => {
      expect(fetch_items).toHaveBeenCalledTimes(2);
    });
  });
});
