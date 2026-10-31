import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { DateField } from './date-field';

const labels = {
  placeholder: 'Escolher data',
  today: 'Hoje',
  clear: 'Limpar',
  previous: 'Mês anterior',
  next: 'Próximo mês',
  today_marker: 'hoje',
};

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      label="Vencimento"
      value={value}
      onChange={setValue}
      locale="pt-BR"
      today="2026-10-30"
      labels={labels}
    />
  );
}

describe('DateField', () => {
  it('shows the placeholder when empty and the formatted date when set', () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByRole('button', { name: /Vencimento/ })).toHaveTextContent('Escolher data');
    unmount();
    render(<Harness initial="2026-10-12" />);
    expect(screen.getByRole('button', { name: /Vencimento/ })).toHaveTextContent('12/10/2026');
  });

  it('opens the calendar popover and picks a day', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Vencimento/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Vencimento' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '12 de outubro de 2026' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent('12/10/2026');
    expect(trigger).toHaveFocus();
  });

  it('sets today and clears', async () => {
    render(<Harness initial="2026-10-12" />);
    const trigger = screen.getByRole('button', { name: /Vencimento/ });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(trigger).toHaveTextContent('30/10/2026');
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(trigger).toHaveTextContent('Escolher data');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Vencimento/ });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: /Vencimento/ }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
