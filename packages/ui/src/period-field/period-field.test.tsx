import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { PeriodField, type PeriodFieldProps } from './period-field';
import type { PeriodValue } from './period';

const labels = {
  presets: {
    this_month: 'Este mês',
    last_month: 'Mês passado',
    next_30_days: 'Próximos 30 dias',
    last_30_days: 'Últimos 30 dias',
    this_year: 'Este ano',
    all: 'Qualquer período',
  },
  title: 'Escolher período',
  custom: 'Personalizado',
  apply: 'Aplicar',
  first_day: 'Escolha o primeiro dia.',
  last_day: 'escolha o último dia',
  first_day_error: 'Escolha o primeiro dia no calendário.',
  previous: 'Mês anterior',
  next: 'Próximo mês',
  today_marker: 'hoje',
};

function Harness({
  initial,
  spy,
  ...rest
}: { initial?: PeriodValue; spy?: (v: PeriodValue) => void } & Partial<PeriodFieldProps>) {
  const [value, setValue] = useState<PeriodValue | undefined>(initial);
  return (
    <div>
      <PeriodField
        label="Período"
        {...(value ? { value } : {})}
        onChange={(next) => {
          setValue(next);
          spy?.(next);
        }}
        placement="toolbar"
        today="2026-10-30"
        locale="pt-BR"
        labels={labels}
        {...rest}
      />
      <button type="button">fora</button>
    </div>
  );
}

const trigger = () => screen.getByRole('button', { name: /Período/ });

describe('PeriodField', () => {
  it('shows the label of the current period on the trigger', () => {
    const { unmount } = render(<Harness />);
    expect(trigger()).toHaveTextContent('Este mês');
    unmount();
    render(<Harness initial={{ preset: 'custom', from: '2026-10-01', to: '2026-10-30' }} />);
    expect(trigger()).toHaveTextContent('01/10/2026 – 30/10/2026');
  });

  it('lists only the presets passed by the screen', async () => {
    render(<Harness presets={['this_month', 'all']} allow_custom={false} />);
    await userEvent.click(trigger());
    const dialog = screen.getByRole('dialog', { name: 'Escolher período' });
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Este mês', 'Qualquer período']);
  });

  it('marks the current preset with aria-pressed and focuses it on open', async () => {
    render(<Harness initial={{ preset: 'last_month' }} />);
    await userEvent.click(trigger());
    const current = screen.getByRole('button', { name: 'Mês passado' });
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(current).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Este mês' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('picks a preset and closes returning focus', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Este ano' }));
    expect(spy).toHaveBeenCalledWith({ preset: 'this_year' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent('Este ano');
  });

  it('applies a custom range from the calendar', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: '10 de outubro de 2026' }));
    expect(screen.getByText(/10\/10\/2026 · escolha o último dia/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '14 de outubro de 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(spy).toHaveBeenCalledWith({ preset: 'custom', from: '2026-10-10', to: '2026-10-14' });
    expect(trigger()).toHaveTextContent('10/10/2026 – 14/10/2026');
  });

  it('shows an error when applying without the first day', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha o primeiro dia no calendário.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('applies a single day as from and to', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: '10 de outubro de 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(spy).toHaveBeenCalledWith({ preset: 'custom', from: '2026-10-10', to: '2026-10-10' });
  });

  it('emits all without dates', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Qualquer período' }));
    expect(spy).toHaveBeenCalledWith({ preset: 'all' });
  });

  it('centers the popover under the field in form placement', async () => {
    render(<Harness placement="form" name="range" />);
    await userEvent.click(trigger());
    expect(document.querySelector('input[type="hidden"][name="period"]')).toHaveValue('this_month');
    expect(document.querySelector('input[type="hidden"][name="from"]')).toHaveValue('2026-10-01');
    expect(document.querySelector('input[type="hidden"][name="to"]')).toHaveValue('2026-10-31');
  });

  it('keeps the popover inside a small window, scrolling inside when taller', async () => {
    const proto = HTMLElement.prototype;
    const rect = vi.spyOn(proto, 'getBoundingClientRect').mockReturnValue({
      left: 20,
      right: 340,
      top: 500,
      bottom: 540,
      width: 320,
      height: 40,
      x: 20,
      y: 500,
      toJSON: () => ({}),
    });
    const width = vi.spyOn(proto, 'offsetWidth', 'get').mockReturnValue(500);
    const height = vi.spyOn(proto, 'offsetHeight', 'get').mockReturnValue(900);
    vi.stubGlobal('innerWidth', 360);
    vi.stubGlobal('innerHeight', 640);
    try {
      render(<Harness placement="form" />);
      await userEvent.click(trigger());
      const dialog = screen.getByRole('dialog');
      expect(dialog.style.left).toBe('8px');
      expect(Number.parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(8);
      expect(dialog.style.maxHeight).toBe('624px');
      fireEvent(window, new Event('resize'));
      expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(8);
    } finally {
      rect.mockRestore();
      width.mockRestore();
      height.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('closes on Escape and on outside click', async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(trigger());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides the label visually but keeps it as the accessible name', () => {
    render(<Harness label_visible={false} />);
    expect(trigger()).toHaveTextContent('Este mês');
    expect(screen.getByText('Período').className).toMatch(/srOnly/);
  });

  it('shows the label by default', () => {
    render(<Harness />);
    expect(screen.getByText('Período').className).not.toMatch(/srOnly/);
  });

  it('has no axe violations with the hidden label', async () => {
    const { container } = render(<Harness label_visible={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides the label with the visually-hidden pattern and keeps the trigger 40 px tall', () => {
    const css = readFileSync(join(import.meta.dirname, 'period-field.module.css'), 'utf8');
    const block = (name: string) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const sr = block('srOnly');
    for (const rule of [
      'position: absolute',
      'width: 1px',
      'height: 1px',
      'overflow: hidden',
      'clip-path: inset(50%)',
    ])
      expect(sr).toContain(rule);
    const control = block('control');
    expect(control).toContain('min-height: calc(var(--space) * 10)');
    expect(control).toContain('box-sizing: border-box');
  });
});
