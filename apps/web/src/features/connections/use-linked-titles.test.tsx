import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../shared/test/render';
import { ENTITY_CATEGORIES, LINKABLE_TYPES } from './entity-categories';
import { linkedKey, useLinkedTitles, type LinkedRef } from './use-linked-titles';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DETAILS: Record<string, unknown> = {
  '/api/v1/accounts/a-1': { id: 'a-1', name: 'Conta corrente' },
  '/api/v1/transactions/tx-1': { id: 'tx-1', description: 'Aluguel' },
  '/api/v1/goals/g-1': { id: 'g-1', title: 'Viajar' },
  '/api/v1/tasks/t-1': { id: 't-1', title: 'Comprar passagens' },
  '/api/v1/reminders/r-1': { id: 'r-1', title: 'Pagar fatura' },
  '/api/v1/notes/n-1': { id: 'n-1', title: 'Ideias' },
  '/api/v1/journal-entries/j-1': { id: 'j-1', occurred_at: '2026-03-15T15:00:00Z' },
  '/api/v1/books/b-1': { id: 'b-1', title: 'Guia' },
  '/api/v1/articles/ar-1': { id: 'ar-1', title: 'Artigo bom' },
  '/api/v1/videos/v-1': { id: 'v-1', title: null, url: 'https://exemplo.com/v' },
  '/api/v1/projects/p-1': { id: 'p-1', name: 'Reforma' },
  '/api/v1/cards/c-1': { id: 'c-1', title: 'Roteiro', project_id: 'p-9' },
};

const paths: string[] = [];

function stubFetch() {
  paths.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      if (url.pathname === '/api/v1/me')
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      paths.push(url.pathname);
      const detail = DETAILS[url.pathname];
      return Promise.resolve(
        detail ? json(detail) : json({ code: 'card_not_found', title: 'x' }, 404),
      );
    }),
  );
}

function Probe({ refs }: { refs: LinkedRef[] }) {
  const titles = useLinkedTitles(refs);
  return (
    <ul>
      {refs.map((ref) => {
        const found = titles.get(linkedKey(ref));
        return (
          <li key={linkedKey(ref)} data-testid={linkedKey(ref)}>
            {found?.title}|{found?.href ?? 'sem-link'}|{found?.loading ? 'carregando' : 'pronto'}
          </li>
        );
      })}
    </ul>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function textOf(testid: string, expected: string) {
  await waitFor(() => {
    expect(screen.getByTestId(testid)).toHaveTextContent(expected, { normalizeWhitespace: true });
  });
}

describe('linked titles', () => {
  it('reads the title from the detail endpoint of each linked type', async () => {
    stubFetch();
    const refs: LinkedRef[] = [
      { type: 'account', id: 'a-1' },
      { type: 'transaction', id: 'tx-1' },
      { type: 'goal', id: 'g-1' },
      { type: 'task', id: 't-1' },
      { type: 'reminder', id: 'r-1' },
      { type: 'note', id: 'n-1' },
      { type: 'book', id: 'b-1' },
      { type: 'article', id: 'ar-1' },
      { type: 'video', id: 'v-1' },
      { type: 'project', id: 'p-1' },
    ];
    renderWithProviders(<Probe refs={refs} />);
    await textOf('account:a-1', 'Conta corrente|/finance/accounts/a-1|pronto');
    await textOf('transaction:tx-1', 'Aluguel|/finance/transactions/tx-1|pronto');
    await textOf('goal:g-1', 'Viajar|/goals/g-1|pronto');
    await textOf('task:t-1', 'Comprar passagens|/tasks/t-1|pronto');
    await textOf('reminder:r-1', 'Pagar fatura|/reminders/r-1|pronto');
    await textOf('note:n-1', 'Ideias|/notes/n-1|pronto');
    await textOf('book:b-1', 'Guia|/library/books/b-1|pronto');
    await textOf('article:ar-1', 'Artigo bom|/library/articles/ar-1|pronto');
    // Vídeo sem título mostra a url.
    await textOf('video:v-1', 'https://exemplo.com/v|/library/videos/v-1|pronto');
    await textOf('project:p-1', 'Reforma|/projects/p-1|pronto');
  });

  it('keeps the contract: 14 linkable types, none of them called card', () => {
    expect(LINKABLE_TYPES).toHaveLength(14);
    expect(Object.keys(ENTITY_CATEGORIES).sort()).toEqual([...LINKABLE_TYPES].sort());
  });

  it('formats the journal entry date with Intl', async () => {
    stubFetch();
    renderWithProviders(<Probe refs={[{ type: 'journal_entry', id: 'j-1' }]} />);
    await textOf('journal_entry:j-1', '15 de mar. de 2026|/journal/j-1|pronto');
  });

  it('shows the type label without link for transfer and milestone', async () => {
    stubFetch();
    renderWithProviders(
      <Probe
        refs={[
          { type: 'transfer', id: 'x-1' },
          { type: 'milestone', id: 'm-1' },
        ]}
      />,
    );
    await textOf('transfer:x-1', 'Transferência|sem-link|pronto');
    await textOf('milestone:m-1', 'Marco|sem-link|pronto');
    expect(paths).toEqual([]);
  });

  it('dec003 reads the project card title and link from the card endpoint', async () => {
    stubFetch();
    renderWithProviders(<Probe refs={[{ type: 'project_card', id: 'c-1' }]} />);
    await textOf('project_card:c-1', 'Roteiro|/projects/p-9/cards/c-1|pronto');
    expect(paths).toEqual(['/api/v1/cards/c-1']);
  });

  it('shows the project card type label without link when the card is not found', async () => {
    stubFetch();
    renderWithProviders(<Probe refs={[{ type: 'project_card', id: 'c-404' }]} />);
    await textOf('project_card:c-404', 'Cartão de projeto|sem-link|pronto');
  });
});
