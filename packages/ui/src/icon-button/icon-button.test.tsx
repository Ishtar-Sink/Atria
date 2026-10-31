import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('has no axe violations', async () => {
    const { container } = render(<IconButton aria-label="Fechar" icon={<svg />} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes the aria-label', () => {
    render(<IconButton aria-label="Fechar" icon={<svg data-testid="icon" />} />);
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
