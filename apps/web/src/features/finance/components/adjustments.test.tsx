import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '../../../shared/test/render';
import { emptyAdjustment, type AdjustmentFormItem } from '../lib/adjustment-form';
import { breakdownRows, mockApi, SALARY_ADJUSTMENTS } from '../test-utils';
import { AdjustmentsBreakdown, type BreakdownItem } from './adjustments-breakdown';
import { AdjustmentsField } from './adjustments-field';

afterEach(() => {
  vi.unstubAllGlobals();
});

function quietApi() {
  mockApi({ 'GET /me': { status: 401, body: { code: 'unauthenticated', title: 'x' } } });
}

function Harness({ items }: { items: AdjustmentFormItem[] }) {
  const { control } = useForm<{ adjustments: AdjustmentFormItem[] }>({
    defaultValues: { adjustments: items },
  });
  return <AdjustmentsField control={control} />;
}

const inss = (overrides: Partial<AdjustmentFormItem> = {}): AdjustmentFormItem => ({
  ...emptyAdjustment(),
  name: 'INSS',
  rate_text: '11',
  ...overrides,
});

const sindical = (): AdjustmentFormItem => ({
  ...emptyAdjustment(),
  name: 'Sindical',
  mode: 'fixed',
  amount: 4000,
});

const SAMPLE: BreakdownItem[] = [
  ...SALARY_ADJUSTMENTS.map((entry) => ({ ...entry, computed_amount: entry.computed_amount ?? 0 })),
  { name: 'Sindical', direction: 'deduction', mode: 'fixed', computed_amount: 4000 },
  { name: 'Taxa', direction: 'addition', mode: 'fixed', computed_amount: 500 },
];

function Sample() {
  return (
    <AdjustmentsBreakdown
      currency="BRL"
      gross_amount={800000}
      items={SAMPLE}
      net_amount={601700}
      net_label="Líquido previsto"
    />
  );
}

describe('adjustments components', () => {
  it('rf06 shows the base field only when the base differs from the gross', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[]} />);
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar desconto ou acréscimo' }),
    );
    const group = screen.getByRole('group', { name: 'Item 1' });
    expect(within(group).queryByLabelText('Base de cálculo (R$)')).toBeNull();
    await user.click(within(group).getByLabelText('Base diferente do bruto'));
    expect(within(group).getByLabelText('Base de cálculo (R$)')).toBeInTheDocument();
  });

  it('rf05 switches an item between fixed value and percent', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[inss()]} />);
    const group = await screen.findByRole('group', { name: 'Item 1' });
    expect(within(group).getByLabelText('Percentual (%)')).toBeInTheDocument();
    await user.click(within(group).getByText('Valor fixo'));
    expect(within(group).getByLabelText('Valor do item (R$)')).toBeInTheDocument();
    expect(within(group).queryByLabelText('Percentual (%)')).toBeNull();
  });

  it('cb08 stops adding at 20 items', async () => {
    quietApi();
    renderWithProviders(<Harness items={Array.from({ length: 20 }, () => inss())} />);
    expect(
      await screen.findByRole('button', { name: 'Adicionar desconto ou acréscimo' }),
    ).toBeDisabled();
    expect(screen.getByText('Até 20 itens por movimentação.')).toBeInTheDocument();
  });

  it('shows that the percent is the effective rate', async () => {
    quietApi();
    renderWithProviders(<Harness items={[inss()]} />);
    expect(
      await screen.findByText(
        'Informe a alíquota efetiva de cada percentual: o Atria não aplica as tabelas do INSS e do IRRF por faixas.',
      ),
    ).toBeInTheDocument();
  });

  it('removes an item by its name', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[inss(), sindical()]} />);
    await user.click(await screen.findByRole('button', { name: 'Remover INSS' }));
    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remover Sindical' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover INSS' })).toBeNull();
  });

  it('rf12 shows the gross, each item with its value and the net', async () => {
    quietApi();
    const { container } = renderWithProviders(<Sample />);
    await screen.findByText('Valor bruto');
    const list = container.querySelector('dl') as HTMLElement;
    expect(breakdownRows(list)).toEqual([
      'Valor bruto R$ 8.000,00',
      'INSS 11,00% do bruto −R$ 880,00',
      'IRPF 15,00% de R$ 7.120,00 −R$ 1.068,00',
      'Sindical valor fixo −R$ 40,00',
      'Taxa valor fixo +R$ 5,00',
      'Líquido previsto R$ 6.017,00',
    ]);
  });

  it('rn07 shows deductions and additions without red', async () => {
    quietApi();
    const { container } = renderWithProviders(<Sample />);
    await screen.findByText('Valor bruto');
    expect(
      container.querySelector('[class*="danger"], [class*="positive"], [class*="negative"]'),
    ).toBeNull();
  });

  it('rnf04 labels every field and has no axe violations', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <>
        <Harness items={[inss({ base_different: true, base_amount: 712000 }), sindical()]} />
        <Sample />
      </>,
    );
    expect(await screen.findByRole('group', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Item 2' })).toBeInTheDocument();
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAccessibleName();
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
