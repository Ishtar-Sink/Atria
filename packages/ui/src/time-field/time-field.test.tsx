import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { parseTime } from './parse-time';
import { TimeField } from './time-field';

describe('parseTime', () => {
  it('normalizes 930, 9:30, 09:30 and 9 to 24 h', () => {
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('9:30')).toBe('09:30');
    expect(parseTime('09:30')).toBe('09:30');
    expect(parseTime('9')).toBe('09:00');
  });

  it('clamps hours to 23 and minutes to 59', () => {
    expect(parseTime('2575')).toBe('23:59');
    expect(parseTime('99')).toBe('23:00');
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('ab')).toBeNull();
  });
});

function Controlled() {
  const [value, setValue] = useState('');
  return (
    <TimeField label="Hora (24 horas)" value={value} onChange={setValue} placeholder="hh:mm" />
  );
}

describe('TimeField', () => {
  it('inserts the colon while typing and normalizes on blur', async () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Hora (24 horas)');
    await userEvent.type(input, '930');
    expect(input).toHaveValue('93:0');
    await userEvent.clear(input);
    await userEvent.type(input, '0930');
    expect(input).toHaveValue('09:30');
    await userEvent.clear(input);
    await userEvent.type(input, '9');
    await userEvent.tab();
    expect(input).toHaveValue('09:00');
  });

  it('uses inputmode numeric and the 24 h label', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Hora (24 horas)');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '5');
    expect(input).toHaveAttribute('placeholder', 'hh:mm');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Controlled />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
