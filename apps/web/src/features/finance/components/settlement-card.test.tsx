import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  account,
  breakdownRows,
  financeServer,
  pageHeading,
  payslip,
  renderFinance,
  world,
  type ApiCall,
} from '../test-utils';

const IRPF = {
  name: 'IRPF',
  direction: 'deduction',
  mode: 'percent',
  rate_bp: 2750,
  base_items: [0],
  deduction_amount: 90873,
};

let calls: ApiCall[] = [];

beforeEach(() => {
  const state = world({
    accounts: [account({ id: 'a1', name: 'Conta principal', is_default: true })],
    transactions: [payslip()],
  });
  calls = financeServer(state).calls;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall(method: string, path: string) {
  return [...calls].reverse().find((call) => call.method === method && call.path === path);
}

function previewCalls() {
  return calls.filter(
    (call) => call.method === 'POST' && call.path === '/transactions/settlement-preview',
  );
}

function lastPreviewIrpf() {
  const body = previewCalls().at(-1)?.body as { adjustments: unknown[] } | undefined;
  return body?.adjustments[1];
}

/** Linhas da prévia assim que ela mostrar a linha esperada. */
async function previewRows(expected: string) {
  const region = await screen.findByRole('region', { name: 'Prévia da liquidação' });
  await waitFor(() => {
    expect(breakdownRows(region.querySelector('dl') as Element)).toContain(expected);
  });
  return breakdownRows(region.querySelector('dl') as Element);
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Editar descontos e acréscimos' }));
}

describe('settlement with a linked base', () => {
  it('ct02 settles the payslip by the net back to the gross', async () => {
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t40');
    await pageHeading('Holerite');
    const rows = await previewRows('Valor bruto R$ 14.500,00');
    expect(rows).toContain('IRPF 27,50% de R$ 13.511,93 menos R$ 908,73 −R$ 2.807,05');
    expect(rows).toContain('Líquido informado R$ 6.923,18');
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall('POST', '/transactions/t40/settlement')).toBeDefined();
    });
    const body = lastCall('POST', '/transactions/t40/settlement')?.body as {
      settled_amount: number;
      adjustments: unknown[];
    };
    expect(body.settled_amount).toBe(692318);
    expect(body.adjustments[1]).toEqual(IRPF);
  });

  it('ct11 recalculates the preview after editing the deduction', async () => {
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t40');
    await pageHeading('Holerite');
    await previewRows('Valor bruto R$ 14.500,00');
    await openEditor(user);
    const group = screen.getByRole('group', { name: 'Item 2' });
    const deduction = within(group).getByRole<HTMLInputElement>('textbox', {
      name: 'Parcela a deduzir (R$)',
    });
    expect(deduction.value.replace(/[  ]/g, ' ')).toBe('R$ 908,73');
    await user.clear(deduction);
    await user.type(deduction, '875,00');
    await user.tab();
    const rows = await previewRows('Valor bruto R$ 14.546,53');
    expect(rows).toContain('IRPF 27,50% de R$ 13.558,46 menos R$ 875,00 −R$ 2.853,58');
    expect(rows).toContain('Líquido informado R$ 6.923,18');
    expect(lastPreviewIrpf()).toEqual(
      expect.objectContaining({ deduction_amount: 87500, base_items: [0] }),
    );
    await user.click(screen.getByRole('button', { name: 'Liquidar' }));
    await waitFor(() => {
      expect(lastCall('POST', '/transactions/t40/settlement')).toBeDefined();
    });
    const body = lastCall('POST', '/transactions/t40/settlement')?.body as {
      adjustments: unknown[];
    };
    expect(body.adjustments[1]).toEqual({ ...IRPF, deduction_amount: 87500 });
  });

  it('rf08 explains how a linked base and the deduction behave at settlement', async () => {
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t40');
    await pageHeading('Holerite');
    await openEditor(user);
    const group = screen.getByRole('group', { name: 'Item 2' });
    expect(
      within(group).getByText(
        'Na liquidação, a base ligada é recalculada pelos itens liquidados e a parcela a deduzir não muda.',
      ),
    ).toBeInTheDocument();
    expect(within(group).queryByText(/A base digitada acompanha o bruto/)).toBeNull();
  });

  it('rf08 keeps the linked base when the base item changes at settlement', async () => {
    const user = userEvent.setup();
    renderFinance('/finance/transactions/t40');
    await pageHeading('Holerite');
    await previewRows('Valor bruto R$ 14.500,00');
    await openEditor(user);
    const inss = screen.getByRole('group', { name: 'Item 1' });
    const amount = within(inss).getByRole('textbox', { name: 'Valor do item (R$)' });
    await user.clear(amount);
    await user.type(amount, '1.000,00');
    await user.tab();
    await waitFor(() => {
      expect(lastPreviewIrpf()).toEqual(expect.objectContaining({ base_items: [0] }));
      const body = previewCalls().at(-1)?.body as { adjustments: { amount?: number }[] };
      expect(body.adjustments[0]?.amount).toBe(100000);
    });
    const region = screen.getByRole('region', { name: 'Prévia da liquidação' });
    await waitFor(() => {
      const rows = breakdownRows(region.querySelector('dl') as Element);
      expect(rows.some((row) => row.startsWith('INSS valor fixo −R$ 1.000,00'))).toBe(true);
    });
    const rows = breakdownRows(region.querySelector('dl') as Element);
    const gross = Number(
      (rows[0] ?? '').replace('Valor bruto R$ ', '').replace(/\./g, '').replace(',', '.'),
    );
    const base = (gross - 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    expect(rows.find((row) => row.startsWith('IRPF'))).toContain(`27,50% de R$ ${base}`);
  });

  it('rnf04 the settlement editor with a linked base has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderFinance('/finance/transactions/t40');
    await pageHeading('Holerite');
    await openEditor(user);
    expect(await axe(container)).toHaveNoViolations();
  });
});
