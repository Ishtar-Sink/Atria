import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { MoneyField } from './money-field';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const prefix = brl.format(0).replace(/0,00$/, '');

function Harness({
  initial = null,
  error,
  calls,
}: {
  initial?: number | null;
  error?: string;
  calls: (number | null)[];
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <MoneyField
      label="Valor"
      value_cents={value}
      error={error}
      onChange={(cents) => {
        calls.push(cents);
        setValue(cents);
      }}
    />
  );
}

describe('MoneyField', () => {
  it('formats while typing and stores the same value in cents', async () => {
    const user = userEvent.setup();
    const calls: (number | null)[] = [];
    render(<Harness calls={calls} />);
    const input = screen.getByLabelText('Valor');
    await user.type(input, '14500');
    expect(input).toHaveValue(`${prefix}14.500`);
    expect(calls[calls.length - 1]).toBe(1450000);
    await user.tab();
    expect(input).toHaveValue(brl.format(14500));
  });

  it('completes the decimals of a pasted value on blur', async () => {
    const user = userEvent.setup();
    const calls: (number | null)[] = [];
    render(<Harness calls={calls} />);
    const input = screen.getByLabelText('Valor');
    await user.click(input);
    await user.paste('14500,5');
    await user.tab();
    expect(input).toHaveValue(brl.format(14500.5));
    expect(calls[calls.length - 1]).toBe(1450050);
  });

  it('sends null when everything is erased and shows the message', async () => {
    const user = userEvent.setup();
    const calls: (number | null)[] = [];
    render(<Harness initial={1000} error="Informe o valor." calls={calls} />);
    const input = screen.getByLabelText('Valor');
    await user.clear(input);
    expect(calls[calls.length - 1]).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o valor.');
  });

  it('shows the initial cents formatted', () => {
    render(<Harness initial={1450000} calls={[]} />);
    expect(screen.getByLabelText('Valor')).toHaveValue(brl.format(14500));
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness initial={1450000} calls={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
