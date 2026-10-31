import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { LoadingState, Skeleton } from './loading-state';

describe('LoadingState', () => {
  it('has no axe violations', async () => {
    const { container } = render(<LoadingState label="Carregando" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('marks the region as busy', () => {
    render(<LoadingState label="Carregando" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Carregando');
  });

  it('renders the requested skeleton rows', () => {
    const { container } = render(<Skeleton rows={4} />);
    expect(container.querySelectorAll('i')).toHaveLength(4);
  });
});
