import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToasts } from '../../../shared/toast/toast-store';
import { mockApi, renderFinanceHook } from '../test-utils';
import { usePayStatement, useStatements } from './use-statements';

const NOVEMBER = {
  period: '2026-11',
  closing_date: '2026-11-03',
  due_date: '2026-11-10',
  total_amount: 30000,
  outstanding_amount: 30000,
  paid: false,
  transaction_count: 2,
};
const DECEMBER = {
  ...NOVEMBER,
  period: '2026-12',
  closing_date: '2026-12-03',
  due_date: '2026-12-10',
};

afterEach(() => {
  clearToasts();
  vi.unstubAllGlobals();
});

describe('statements hooks', () => {
  it('lists statements by period with their installments', async () => {
    mockApi({ 'GET /credit-cards/:id/statements': { body: { items: [NOVEMBER, DECEMBER] } } });
    const { result } = renderFinanceHook(() => useStatements('card'));
    await waitFor(() => {
      expect(result.current.data?.map((item) => item.period)).toEqual(['2026-11', '2026-12']);
    });
    expect(result.current.data?.[0]?.transaction_count).toBe(2);
  });

  it('pays a statement from the chosen account', async () => {
    const { calls } = mockApi({
      'GET /credit-cards/:id/statements': { body: { items: [NOVEMBER] } },
      'POST /credit-cards/:id/statements/:period/payment': { hang: true },
    });
    const { result } = renderFinanceHook(() => ({
      list: useStatements('card'),
      pay: usePayStatement('card', '2026-11'),
    }));
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    act(() => {
      result.current.pay.mutate({
        from_account_id: 'a1',
        paid_on: '2026-11-09',
        idempotency_key: 'k',
      });
    });
    await waitFor(() => {
      expect(result.current.list.data?.[0]?.paid).toBe(true);
    });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.path).toBe('/credit-cards/card/statements/2026-11/payment');
    expect(post?.body).toEqual({ from_account_id: 'a1', paid_on: '2026-11-09' });
  });
});
