import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateTimeField } from './date-time-field';

const labels = {
  date: 'Início: data',
  time: 'Início: hora (24 horas)',
  placeholder: 'Escolher data',
  time_placeholder: 'hh:mm',
  today: 'Hoje',
  clear: 'Limpar',
  previous: 'Mês anterior',
  next: 'Próximo mês',
  today_marker: 'hoje',
};

function Harness({ spy }: { spy: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <DateTimeField
      label="Início"
      value={value}
      onChange={(next) => {
        setValue(next);
        spy(next);
      }}
      locale="pt-BR"
      today="2026-10-30"
      labels={labels}
    />
  );
}

describe('DateTimeField', () => {
  it('combines date and time into YYYY-MM-DDTHH:mm', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: /Início: data/ }));
    await userEvent.click(screen.getByRole('button', { name: '12 de outubro de 2026' }));
    await userEvent.type(screen.getByLabelText('Início: hora (24 horas)'), '930');
    await userEvent.tab();
    expect(spy).toHaveBeenLastCalledWith('2026-10-12T09:30');
  });

  it('emits an empty value while one part is missing', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: /Início: data/ }));
    await userEvent.click(screen.getByRole('button', { name: '12 de outubro de 2026' }));
    expect(spy).toHaveBeenLastCalledWith('');
  });
});
