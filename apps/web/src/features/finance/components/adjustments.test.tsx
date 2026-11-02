import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '../../../shared/test/render';
import { emptyAdjustment, toAdjustments, type AdjustmentFormItem } from '../lib/adjustment-form';
import { computeNet } from '../lib/adjustments';
import { breakdownRows, mockApi, PAYSLIP_ADJUSTMENTS, SALARY_ADJUSTMENTS } from '../test-utils';
import { AdjustmentsBreakdown, breakdownItems, type BreakdownItem } from './adjustments-breakdown';
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

type Shape = { adjustments: AdjustmentFormItem[] };

function LiveBreakdown({ control, gross }: { control: Control<Shape>; gross: number }) {
  const items = useWatch({ control, name: 'adjustments' });
  const adjustments = toAdjustments(items);
  const result = adjustments ? computeNet(gross, adjustments) : null;
  if (!result?.ok) return null;
  return (
    <AdjustmentsBreakdown
      currency="BRL"
      gross_amount={result.breakdown.gross_amount}
      items={result.breakdown.adjustments}
      net_amount={result.breakdown.net_amount}
      net_label="Líquido previsto"
    />
  );
}

function LiveHarness({ items, gross }: { items: AdjustmentFormItem[]; gross: number }) {
  const { control } = useForm<Shape>({ defaultValues: { adjustments: items } });
  return (
    <>
      <AdjustmentsField control={control} />
      <LiveBreakdown control={control} gross={gross} />
    </>
  );
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

const fixedItem = (name: string, amount: number): AdjustmentFormItem => ({
  ...emptyAdjustment(),
  name,
  mode: 'fixed',
  amount,
});

const linkedIrpf = (
  base_items: number[],
  overrides: Partial<AdjustmentFormItem> = {},
): AdjustmentFormItem => ({
  ...emptyAdjustment(),
  name: 'IRPF',
  rate_text: '27,5',
  base_different: true,
  base_source: 'items',
  base_items,
  ...overrides,
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

  it('ct09 links the base to chosen items with the keyboard and shows the base live', async () => {
    quietApi();
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <LiveHarness
        gross={1450000}
        items={[
          fixedItem('INSS', 98807),
          { ...emptyAdjustment(), name: 'IRPF', rate_text: '27,5' },
        ]}
      />,
    );
    const group = await screen.findByRole('group', { name: 'Item 2' });
    await user.click(within(group).getByLabelText('Base diferente do bruto'));
    const typed = within(group).getByRole('radio', { name: 'Valor digitado' });
    expect(typed).toBeChecked();
    typed.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(group).getByRole('radio', { name: 'Itens da lista' })).toBeChecked();
    const links = within(group).getByRole('group', { name: 'Itens da base' });
    expect(within(links).queryByRole('checkbox', { name: 'IRPF' })).toBeNull();
    within(links).getByRole('checkbox', { name: 'INSS' }).focus();
    await user.keyboard(' ');
    expect(within(links).getByRole('checkbox', { name: 'INSS' })).toBeChecked();
    await user.type(within(group).getByLabelText('Parcela a deduzir (R$)'), '908,73');
    const list = container.querySelector('dl') as HTMLElement;
    expect(breakdownRows(list)).toContain(
      'IRPF 27,50% de R$ 13.511,93 menos R$ 908,73 −R$ 2.807,05',
    );
  });

  it('rf03 offers the three bases of a percent item', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[inss()]} />);
    const group = await screen.findByRole('group', { name: 'Item 1' });
    expect(within(group).queryByLabelText('Base de cálculo (R$)')).toBeNull();
    expect(within(group).queryByRole('group', { name: 'Itens da base' })).toBeNull();
    await user.click(within(group).getByLabelText('Base diferente do bruto'));
    expect(within(group).getByRole('radio', { name: 'Valor digitado' })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Itens da lista' })).toBeInTheDocument();
    expect(within(group).getByLabelText('Base de cálculo (R$)')).toBeInTheDocument();
    await user.click(within(group).getByRole('radio', { name: 'Itens da lista' }));
    expect(within(group).queryByLabelText('Base de cálculo (R$)')).toBeNull();
    expect(within(group).getByRole('group', { name: 'Itens da base' })).toBeInTheDocument();
    expect(within(group).getByText('Adicione outro item para ligar a base.')).toBeInTheDocument();
  });

  it('rf04 shows the deduction only on a percent item', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[inss()]} />);
    const group = await screen.findByRole('group', { name: 'Item 1' });
    expect(within(group).getByLabelText('Parcela a deduzir (R$)')).toBeInTheDocument();
    expect(
      within(group).getByText(
        'Opcional. É subtraída do percentual, como a parcela a deduzir do IRPF, e muda com a faixa.',
      ),
    ).toBeInTheDocument();
    await user.click(within(group).getByText('Valor fixo'));
    expect(within(group).queryByLabelText('Parcela a deduzir (R$)')).toBeNull();
  });

  it('ct14 refuses to remove an item used as a base and explains why', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(<Harness items={[fixedItem('INSS', 98807), linkedIrpf([0])]} />);
    await user.click(await screen.findByRole('button', { name: 'Remover INSS' }));
    expect(screen.getByRole('group', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Item 2' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'INSS é base de IRPF. Desmarque o vínculo antes de remover.',
    );
    const links = within(screen.getByRole('group', { name: 'Item 2' })).getByRole('group', {
      name: 'Itens da base',
    });
    await user.click(within(links).getByRole('checkbox', { name: 'INSS' }));
    await user.click(screen.getByRole('button', { name: 'Remover INSS' }));
    expect(screen.getAllByRole('group', { name: /^Item \d+$/ })).toHaveLength(1);
  });

  it('ct14 keeps the links right after removing an earlier item', async () => {
    quietApi();
    const user = userEvent.setup();
    renderWithProviders(
      <Harness items={[fixedItem('Pensão', 100000), fixedItem('INSS', 98807), linkedIrpf([1])]} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Remover Pensão' }));
    const group = screen.getByRole('group', { name: 'Item 2' });
    const links = within(group).getByRole('group', { name: 'Itens da base' });
    expect(within(links).getByRole('checkbox', { name: 'INSS' })).toBeChecked();
  });

  it('ct10 shows the linked base and the deduction in the breakdown', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <>
        <AdjustmentsBreakdown
          currency="BRL"
          gross_amount={1450000}
          items={breakdownItems(PAYSLIP_ADJUSTMENTS)}
          net_amount={692318}
          net_label="Líquido previsto"
        />
        <AdjustmentsBreakdown
          currency="BRL"
          gross_amount={800000}
          items={[
            {
              name: 'X',
              direction: 'deduction',
              mode: 'percent',
              rate_bp: 1100,
              deduction_amount: 1000,
              computed_amount: 87000,
            },
          ]}
          net_amount={713000}
          net_label="Líquido previsto"
        />
      </>,
    );
    await screen.findAllByText('Valor bruto');
    const [payslipList, grossList] = Array.from(container.querySelectorAll('dl'));
    expect(breakdownRows(payslipList as HTMLElement)).toEqual([
      'Valor bruto R$ 14.500,00',
      'INSS valor fixo −R$ 988,07',
      'IRPF 27,50% de R$ 13.511,93 menos R$ 908,73 −R$ 2.807,05',
      'Sindical valor fixo −R$ 35,00',
      'Consignados valor fixo −R$ 3.746,70',
      'Líquido previsto R$ 6.923,18',
    ]);
    expect(breakdownRows(grossList as HTMLElement)).toContain(
      'X 11,00% do bruto menos R$ 10,00 −R$ 870,00',
    );
  });

  it('rnf04 labels the linked base and deduction fields with no axe violations', async () => {
    quietApi();
    const { container } = renderWithProviders(
      <>
        <Harness items={[fixedItem('INSS', 98807), linkedIrpf([0], { deduction_amount: 90873 })]} />
        <AdjustmentsBreakdown
          currency="BRL"
          gross_amount={1450000}
          items={breakdownItems(PAYSLIP_ADJUSTMENTS)}
          net_amount={692318}
          net_label="Líquido previsto"
        />
      </>,
    );
    expect(await screen.findByRole('group', { name: 'Item 2' })).toBeInTheDocument();
    for (const role of ['textbox', 'radio', 'checkbox'] as const) {
      for (const field of screen.getAllByRole(role)) {
        expect(field).toHaveAccessibleName();
      }
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
