import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { ViewSwitcher } from './view-switcher';

const views = [
  { value: 'list', label: 'Lista' },
  { value: 'grid', label: 'Grade', icon: <svg data-testid="grid-icon" /> },
];

describe('ViewSwitcher', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <ViewSwitcher label="Visualização" options={views} value="list" onChange={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('marks the active view with aria-pressed', () => {
    render(
      <ViewSwitcher label="Visualização" options={views} value="grid" onChange={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen value', async () => {
    const onChange = vi.fn();
    render(<ViewSwitcher label="Visualização" options={views} value="list" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Grade' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });
});
