import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { CompleteButton } from './complete-button';

describe('CompleteButton', () => {
  it('pd04 names the action and the title', () => {
    const { rerender } = render(
      <CompleteButton title="Pagar a luz" done={false} when="single" onToggle={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Concluir: Pagar a luz' })).toBeInTheDocument();

    rerender(<CompleteButton title="Pagar a luz" done when="single" onToggle={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Reabrir: Pagar a luz' })).toBeInTheDocument();

    rerender(
      <CompleteButton title="Alongamento" done={false} when="today" onToggle={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Concluir hoje: Alongamento' })).toHaveAttribute(
      'title',
      'Concluir hoje: Alongamento',
    );

    rerender(
      <CompleteButton
        title="Alongamento"
        done={false}
        when={{ date: '2026-11-07' }}
        onToggle={() => undefined}
      />,
    );
    expect(
      screen.getByRole('button', { name: /^Concluir em .*7.*: Alongamento$/ }),
    ).toBeInTheDocument();
  });

  it('pd04 uses the success variant and aria-pressed when done', () => {
    const { rerender } = render(
      <CompleteButton title="Pagar a luz" done={false} when="single" onToggle={() => undefined} />,
    );
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/success/);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('');

    rerender(<CompleteButton title="Pagar a luz" done when="single" onToggle={() => undefined} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles with Space and Enter', async () => {
    const onToggle = vi.fn();
    render(<CompleteButton title="Pagar a luz" done={false} when="single" onToggle={onToggle} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <CompleteButton title="Pagar a luz" done={false} when="single" onToggle={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
