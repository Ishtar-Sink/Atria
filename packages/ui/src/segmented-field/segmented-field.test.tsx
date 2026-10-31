import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { SegmentedField } from './segmented-field';

const options = [
  { value: 'out', label: 'Saída' },
  { value: 'in', label: 'Entrada' },
];

function Controlled() {
  const [value, setValue] = useState('out');
  return <SegmentedField label="Tipo" options={options} value={value} onChange={setValue} />;
}

describe('SegmentedField', () => {
  it('renders a radiogroup named by the legend', () => {
    render(<Controlled />);
    expect(screen.getByRole('radiogroup', { name: 'Tipo' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Saída' })).toBeChecked();
  });

  it('moves the choice with the arrow keys', async () => {
    render(<Controlled />);
    screen.getByRole('radio', { name: 'Saída' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Entrada' })).toBeChecked();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Controlled />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
