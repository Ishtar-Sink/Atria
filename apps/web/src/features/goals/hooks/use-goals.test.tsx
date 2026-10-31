import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import { renderWithProviders } from '../../../shared/test/render';
import type { Goal } from '../lib/goal-progress';
import {
  goalsSearchSchema,
  searchToFilters,
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
} from './use-goals';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g-1',
    owner_id: 'u-1',
    title: 'Reserva de emergência',
    description: null,
    deadline: null,
    status: 'in_progress',
    labels: [],
    visibility: 'personal',
    milestone_count: 0,
    completed_milestone_count: 0,
    progress_percent: 0,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Call {
  method: string;
  url: URL;
  body: unknown;
}

function stubApi(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      const call: Call = {
        method: init?.method ?? 'GET',
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return Promise.resolve(handler(call));
    }),
  );
  return calls;
}

function Listing() {
  const { search } = useListSearch(goalsSearchSchema);
  const query = useGoals(searchToFilters(search));
  const update = useUpdateGoal();
  const remove = useDeleteGoal();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          update.mutate({ id: 'g-1', patch: { title: 'Novo título' } });
        }}
      >
        rename
      </button>
      <button
        type="button"
        onClick={() => {
          remove.mutate({ id: 'g-1' });
        }}
      >
        remove
      </button>
    </div>
  );
}

function Creator({ deadline }: { deadline?: string }) {
  const create = useCreateGoal();
  return (
    <button
      type="button"
      onClick={() => {
        create.mutate({ title: 'Nova', ...(deadline ? { deadline } : {}) });
      }}
    >
      create
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('goal hooks', () => {
  it('lists goals with filters from the url', async () => {
    const calls = stubApi(() => json({ items: [goal()], next_cursor: null }));
    renderWithProviders(<Listing />, { route: '/?status=in_progress&q=reserva' });
    expect(await screen.findByText('Reserva de emergência')).toBeInTheDocument();
    const list = calls.find((call) => call.url.pathname === '/api/v1/goals');
    expect(list?.url.searchParams.get('status')).toBe('in_progress');
    expect(list?.url.searchParams.get('q')).toBe('reserva');
  });

  it('dec006 sends the label and has_deadline filters to the server', async () => {
    const calls = stubApi(() => json({ items: [], next_cursor: null }));
    renderWithProviders(<Listing />, { route: '/?label=casa&has_deadline=true' });
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(0);
    });
    const list = calls[0];
    expect(list?.url.searchParams.get('label')).toBe('casa');
    expect(list?.url.searchParams.get('has_deadline')).toBe('true');
  });

  it('creates a goal with an optional deadline', async () => {
    const calls = stubApi((call) =>
      json(goal({ id: 'g-9', title: (call.body as { title: string }).title })),
    );
    const { router } = renderWithProviders(<Creator />);
    await userEvent.click(await screen.findByRole('button', { name: 'create' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/goals/g-9');
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({ title: 'Nova' });
  });

  it('sends the deadline when one is given', async () => {
    const calls = stubApi(() => json(goal({ id: 'g-9' })));
    renderWithProviders(<Creator deadline="2026-12-31" />);
    await userEvent.click(await screen.findByRole('button', { name: 'create' }));
    await waitFor(() => {
      expect(calls[0]?.body).toEqual({ title: 'Nova', deadline: '2026-12-31' });
    });
  });

  it('rolls back a goal update when refused', async () => {
    let release: (response: Response) => void = () => undefined;
    stubApi((call) => {
      if (call.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return json({ items: [goal()], next_cursor: null });
    });
    renderWithProviders(<Listing />);
    await screen.findByText('Reserva de emergência');
    await userEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(await screen.findByText('Novo título')).toBeInTheDocument();
    release(json({ code: 'validation_failed', title: 'x' }, 422));
    expect(await screen.findByText('Reserva de emergência')).toBeInTheDocument();
    expect(screen.queryByText('Novo título')).not.toBeInTheDocument();
    expect(getToasts().some((toast) => toast.tone === 'danger')).toBe(true);
  });

  it('deletes a goal and rolls back when refused', async () => {
    let release: (response: Response) => void = () => undefined;
    let refuse = true;
    stubApi((call) => {
      if (call.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return json({ items: refuse || call.method !== 'GET' ? [goal()] : [], next_cursor: null });
    });
    const { router } = renderWithProviders(<Listing />);
    await screen.findByText('Reserva de emergência');
    await userEvent.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => {
      expect(screen.queryByText('Reserva de emergência')).not.toBeInTheDocument();
    });
    release(json({ code: 'not_found', title: 'x' }, 404));
    expect(await screen.findByText('Reserva de emergência')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    refuse = false;
    await userEvent.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => {
      expect(screen.queryByText('Reserva de emergência')).not.toBeInTheDocument();
    });
    release(new Response(null, { status: 204 }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/goals');
    });
  });
});
