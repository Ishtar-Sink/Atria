import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../shared/toast/toast-store';
import { PassageNotePanel } from './passage-note-panel';

interface Call {
  path: string;
  body: Record<string, unknown>;
}

function stubApi(status = 201) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      calls.push({
        path: input,
        body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Call['body']) : {},
      });
      return Promise.resolve(
        new Response(JSON.stringify(status < 400 ? { id: 'n-1' } : { code: 'boom', title: 'x' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
  return calls;
}

function renderPanel(props: { quote?: string; onClose?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PassageNotePanel
        item_type="book"
        item_id="b-1"
        page={14}
        quote={props.quote}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearToasts();
});

describe('PassageNotePanel', () => {
  it('creates a note with the passage and the page', async () => {
    const user = userEvent.setup();
    const calls = stubApi();
    const { onClose } = renderPanel({ quote: 'Um trecho marcado' });
    await user.click(screen.getByRole('button', { name: 'Salvar nota' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(calls[0]?.path).toBe('/api/v1/books/b-1/book-notes');
    expect(calls[0]?.body).toEqual({ page: 14, quote: 'Um trecho marcado' });
  });

  it('creates a note with the passage, the page and a comment', async () => {
    const user = userEvent.setup();
    const calls = stubApi();
    renderPanel({ quote: 'Um trecho marcado' });
    await user.type(screen.getByLabelText('Comentário (opcional)'), 'Voltar aqui');
    await user.click(screen.getByRole('button', { name: 'Salvar nota' }));
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.body).toEqual({
      page: 14,
      quote: 'Um trecho marcado',
      comment: 'Voltar aqui',
    });
  });

  it('creates a page only note when the page has no text', async () => {
    const user = userEvent.setup();
    const calls = stubApi();
    renderPanel();
    expect(screen.getByText(/guarda só a página 14/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Comentário'), 'Figura importante');
    await user.click(screen.getByRole('button', { name: 'Salvar nota' }));
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.body).toEqual({ page: 14, comment: 'Figura importante' });
  });

  it('shows the error inside the panel with role alert', async () => {
    const user = userEvent.setup();
    stubApi(500);
    const { onClose } = renderPanel({ quote: 'Trecho' });
    await user.click(screen.getByRole('button', { name: 'Salvar nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar a nota');
    expect(onClose).not.toHaveBeenCalled();
  });
});
