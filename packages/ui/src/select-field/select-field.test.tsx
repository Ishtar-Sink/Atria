import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { SelectField } from './select-field';

const options = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gama' },
  { value: 'd', label: 'Delta' },
];

function Controlled({ error }: { error?: string }) {
  const [value, setValue] = useState('a');
  return (
    <SelectField
      label="Tipo"
      options={options}
      value={value}
      onChange={setValue}
      {...(error ? { error } : {})}
    />
  );
}

describe('SelectField', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Controlled />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('associates the label with the control', () => {
    render(<Controlled />);
    const control = screen.getByLabelText('Tipo');
    expect(control.tagName).toBe('BUTTON');
    expect(control).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('shows the error with role alert and aria-invalid', () => {
    render(<Controlled error="Escolha um tipo" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha um tipo');
    expect(screen.getByLabelText('Tipo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders no native select', () => {
    const { container } = render(<Controlled />);
    expect(container.querySelector('select')).toBeNull();
  });

  it('opens the listbox with ArrowDown and picks with Enter', async () => {
    render(<Controlled />);
    const trigger = screen.getByLabelText('Tipo');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent('Beta');
  });

  it('moves with Home and End and jumps by typed letters', async () => {
    render(<Controlled />);
    const trigger = screen.getByLabelText('Tipo');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}{End}');
    expect(screen.getByRole('option', { name: 'Delta' })).toHaveAttribute('id');
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Delta' }).id,
    );
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Alfa' }).id,
    );
    await userEvent.keyboard('g');
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Gama' }).id,
    );
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Controlled />);
    const trigger = screen.getByLabelText('Tipo');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
