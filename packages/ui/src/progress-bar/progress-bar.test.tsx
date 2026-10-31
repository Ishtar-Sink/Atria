import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('has no axe violations', async () => {
    const { container } = render(<ProgressBar label="Meta" value={40} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes aria-valuenow, min and max', () => {
    render(<ProgressBar label="Meta" value={40} />);
    const bar = screen.getByRole('progressbar', { name: 'Meta' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps the value to 100', () => {
    render(<ProgressBar label="Meta" value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
