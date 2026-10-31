import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('has no axe violations', async () => {
    const { container } = render(<EmptyState title="Nada aqui" description="Crie o primeiro." />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders title and explanation', () => {
    render(
      <EmptyState
        title="Nada aqui"
        description="Crie o primeiro."
        action={<a href="/">Criar</a>}
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar' })).toBeInTheDocument();
  });
});
