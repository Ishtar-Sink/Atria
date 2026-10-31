import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import { renderWithProviders } from '../../../shared/test/render';
import { goalProgress, type Goal, type Milestone } from '../lib/goal-progress';
import { useGoal } from './use-goals';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useToggleMilestone,
} from './use-milestones';

const GOAL: Goal = {
  id: 'g-1',
  owner_id: 'u-1',
  title: 'Ler doze livros',
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
};

function milestone(index: number, completed = false): Milestone {
  return {
    id: `m-${String(index)}`,
    goal_id: 'g-1',
    owner_id: 'u-1',
    title: `Marco ${String(index)}`,
    completed,
    position: index,
    visibility: 'personal',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Servidor falso com marcos em memória; `hold` segura a resposta das mudanças. */
function stubServer(initial: Milestone[]) {
  const state = { items: [...initial], hold: false, refuse: false, release: () => undefined };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      const respond = (): Response => {
        if (url.pathname === '/api/v1/me') return json({ id: 'u-1', email: 'a@b.c' });
        if (url.pathname === '/api/v1/goals/g-1') return json(GOAL);
        if (method === 'GET') return json({ items: state.items, next_cursor: null });
        if (state.refuse) return json({ code: 'validation_failed', title: 'x' }, 422);
        if (method === 'POST') {
          const created = milestone(state.items.length + 1);
          created.title = String(body.title);
          state.items.push(created);
          return json(created, 201);
        }
        const id = url.pathname.split('/').pop();
        if (method === 'PATCH') {
          state.items = state.items.map((item) =>
            item.id === id ? { ...item, completed: Boolean(body.completed) } : item,
          );
          return json(state.items.find((item) => item.id === id));
        }
        state.items = state.items.filter((item) => item.id !== id);
        return new Response(null, { status: 204 });
      };
      const mutating = method !== 'GET' && url.pathname !== '/api/v1/me';
      if (!(mutating && state.hold)) return Promise.resolve(respond());
      return new Promise<Response>((resolve) => {
        state.release = () => {
          resolve(respond());
        };
      });
    }),
  );
  return state;
}

function Probe() {
  const goal = useGoal('g-1');
  const milestones = useMilestones('g-1');
  const create = useCreateMilestone('g-1');
  const toggle = useToggleMilestone('g-1');
  const remove = useDeleteMilestone('g-1');
  const items = milestones.data ?? [];
  const percent = goal.data ? goalProgress(goal.data, items) : 0;
  return (
    <div>
      <p data-testid="percent">{percent}</p>
      <p data-testid="count">{goal.data?.milestone_count ?? '-'}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(event) => {
                  toggle.mutate({ id: item.id, completed: event.target.checked });
                }}
              />
              {item.title}
            </label>
            <button
              type="button"
              onClick={() => {
                remove.mutate({ id: item.id });
              }}
            >
              {`remove ${item.title}`}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          create.mutate({ title: `Marco ${String(items.length + 1)}` });
        }}
      >
        add
      </button>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('milestone hooks', () => {
  it('adds four milestones', async () => {
    stubServer([]);
    renderWithProviders(<Probe />);
    await screen.findByRole('button', { name: 'add' });
    for (let index = 1; index <= 4; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'add' }));
      await screen.findByLabelText(`Marco ${String(index)}`);
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    await waitFor(() => {
      expect(screen.getByTestId('percent')).toHaveTextContent('0');
    });
  });

  it('completes a milestone and shows 25 percent at once', async () => {
    const state = stubServer([milestone(1), milestone(2), milestone(3), milestone(4)]);
    renderWithProviders(<Probe />);
    await screen.findByLabelText('Marco 1');
    state.hold = true;
    await userEvent.click(screen.getByLabelText('Marco 1'));
    // O servidor ainda não respondeu: o número já mudou.
    expect(screen.getByTestId('percent')).toHaveTextContent('25');
    expect(screen.getByLabelText('Marco 1')).toBeChecked();
    state.release();
    await waitFor(() => {
      expect(screen.getByTestId('percent')).toHaveTextContent('25');
    });
  });

  it('rolls back a completed milestone when refused', async () => {
    const state = stubServer([milestone(1), milestone(2), milestone(3), milestone(4)]);
    renderWithProviders(<Probe />);
    await screen.findByLabelText('Marco 1');
    state.hold = true;
    state.refuse = true;
    await userEvent.click(screen.getByLabelText('Marco 1'));
    expect(screen.getByTestId('percent')).toHaveTextContent('25');
    state.release();
    await waitFor(() => {
      expect(screen.getByTestId('percent')).toHaveTextContent('0');
    });
    expect(screen.getByLabelText('Marco 1')).not.toBeChecked();
    expect(getToasts().some((toast) => toast.tone === 'danger')).toBe(true);
  });

  it('removes a milestone from the progress at once', async () => {
    const state = stubServer([milestone(1, true), milestone(2), milestone(3), milestone(4)]);
    renderWithProviders(<Probe />);
    await screen.findByLabelText('Marco 1');
    expect(screen.getByTestId('percent')).toHaveTextContent('25');
    state.hold = true;
    await userEvent.click(screen.getByRole('button', { name: 'remove Marco 2' }));
    expect(screen.getByTestId('percent')).toHaveTextContent('33');
    state.release();
  });
});
