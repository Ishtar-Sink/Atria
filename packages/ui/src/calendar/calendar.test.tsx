import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { Calendar, type CalendarValue } from './calendar';

const labels = { previous: 'Mês anterior', next: 'Próximo mês', today: 'hoje' };

function Harness({
  mode = 'single',
  initial = { from: '' },
  spy,
}: {
  mode?: 'single' | 'range';
  initial?: CalendarValue;
  spy?: (value: CalendarValue) => void;
}) {
  const [month, setMonth] = useState('2026-10');
  const [value, setValue] = useState<CalendarValue>(initial);
  return (
    <Calendar
      mode={mode}
      month={month}
      onMonthChange={setMonth}
      value={value}
      onChange={(next) => {
        setValue(next);
        spy?.(next);
      }}
      today="2026-10-30"
      locale="pt-BR"
      labels={labels}
    />
  );
}

describe('Calendar', () => {
  it('marks days outside the month with data-outside', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[data-day="2026-10-15"]')).not.toHaveAttribute('data-outside');
    expect(container.querySelector('[data-day="2026-09-30"]')).toHaveAttribute('data-outside');
  });

  it('renders the month grid with weekday headers in the locale', () => {
    render(<Harness />);
    expect(screen.getByRole('grid', { name: 'outubro de 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getByRole('columnheader', { name: 'domingo' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /de 2026|de 2025/ })).toHaveLength(42);
    expect(screen.getByRole('button', { name: '30 de outubro de 2026, hoje' })).toBeInTheDocument();
  });

  it('moves focus with the arrow keys across months', async () => {
    render(<Harness />);
    const today = screen.getByRole('button', { name: '30 de outubro de 2026, hoje' });
    today.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('grid', { name: 'novembro de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6 de novembro de 2026' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: '5 de novembro de 2026' })).toHaveFocus();
  });

  it('picks a single day', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: '12 de outubro de 2026' }));
    expect(spy).toHaveBeenCalledWith({ from: '2026-10-12' });
    expect(screen.getByRole('button', { name: '12 de outubro de 2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('marks a range with two clicks and highlights the days between', async () => {
    const spy = vi.fn();
    render(<Harness mode="range" spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: '10 de outubro de 2026' }));
    await userEvent.click(screen.getByRole('button', { name: '14 de outubro de 2026' }));
    expect(spy).toHaveBeenLastCalledWith({ from: '2026-10-10', to: '2026-10-14' });
    const between = screen.getByRole('button', { name: '12 de outubro de 2026' });
    expect(between.className).toMatch(/inRange/);
    expect(between).toHaveAttribute('aria-pressed', 'false');
  });

  it('swaps the ends when the second click is before the first', async () => {
    const spy = vi.fn();
    render(<Harness mode="range" spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: '20 de outubro de 2026' }));
    await userEvent.click(screen.getByRole('button', { name: '15 de outubro de 2026' }));
    expect(spy).toHaveBeenLastCalledWith({ from: '2026-10-15', to: '2026-10-20' });
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
