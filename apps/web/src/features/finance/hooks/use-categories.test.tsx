import { light } from '@atria/theme';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../../shared/toast/toast-store';
import { category, mockApi, problem, renderFinanceHook } from '../test-utils';
import {
  categoryInk,
  normalizeHex,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from './use-categories';

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

const SALARY = category({ id: 'c1', name: 'Salário', kind: 'income', color: 'success' });
const MARKET = category({ id: 'c2', name: 'Mercado', kind: 'expense' });
const HOME = category({ id: 'c3', name: 'Casa', kind: 'expense', color: 'info' });

describe('categories hooks', () => {
  it('lists categories by kind', async () => {
    const { calls } = mockApi({
      'GET /categories': (call) => ({
        body: {
          items: [SALARY, MARKET, HOME].filter(
            (item) => item.kind === call.url.searchParams.get('kind'),
          ),
        },
      }),
    });
    const { result } = renderFinanceHook(() => useCategories('expense'));
    await waitFor(() => {
      expect(result.current.data?.map((item) => item.name)).toEqual(['Casa', 'Mercado']);
    });
    expect(calls[0]?.url.searchParams.get('kind')).toBe('expense');
  });

  it('creates a category with kind and color', async () => {
    const { calls } = mockApi({
      'GET /categories': { body: { items: [] } },
      'POST /categories': { status: 201, body: MARKET },
    });
    const { result } = renderFinanceHook(() => useCreateCategory());
    await act(() =>
      result.current.mutateAsync({ name: 'Mercado', kind: 'expense', color: '#92400e' }),
    );
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Mercado',
      kind: 'expense',
      color: '#92400e',
    });
  });

  it('asks for a destination when the category is in use', async () => {
    mockApi({ 'DELETE /categories/:id': problem(409, 'category_replacement_required') });
    const { result } = renderFinanceHook(() => useDeleteCategory());
    await act(async () => {
      await result.current.mutateAsync({ id: 'c2' }).catch(() => undefined);
    });
    await waitFor(() => {
      expect(result.current.state).toBe('needs_destination');
    });
  });

  it('deletes moving transactions to the destination', async () => {
    const { calls } = mockApi({ 'DELETE /categories/:id': { status: 204 } });
    const { result } = renderFinanceHook(() => useDeleteCategory());
    await act(() => result.current.mutateAsync({ id: 'c2', replacement_id: 'c3' }));
    expect(calls[0]?.path).toBe('/categories/c2');
    expect(calls[0]?.url.searchParams.get('replacement_id')).toBe('c3');
    expect(result.current.state).toBe('idle');
  });
  it('cb09 picks the text color with more contrast on the category color', () => {
    expect(categoryInk('#fef08a')).toBe(light.text);
    expect(categoryInk('#1e1b4b')).toBe(light.surface);
    expect(categoryInk('#6d28d9')).toBe(light.surface);
  });

  it('rn09 normalizes the hex color to lowercase', () => {
    expect(normalizeHex('#0EA5E9')).toBe('#0ea5e9');
  });
});
