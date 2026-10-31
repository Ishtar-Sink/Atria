import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <ErrorState
        title="Falhou"
        description="Tente de novo."
        retryLabel="Tentar de novo"
        onRetry={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders title and explanation', () => {
    render(<ErrorState title="Falhou" description="Tente de novo." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    expect(screen.getByText('Tente de novo.')).toBeInTheDocument();
  });

  it('calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Falhou" retryLabel="Tentar de novo" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
