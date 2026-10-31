import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { TextField } from './text-field';

describe('TextField', () => {
  it('has no axe violations', async () => {
    const { container } = render(<TextField label="Nome" help="Como aparece na lista" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('associates the label with the control', () => {
    render(<TextField label="Nome" help="Ajuda" />);
    const input = screen.getByLabelText('Nome');
    expect(input).toHaveAccessibleDescription('Ajuda');
  });

  it('shows the error with role alert and aria-invalid', () => {
    render(<TextField label="Nome" error="Informe o nome" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome');
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Informe o nome');
  });
});
