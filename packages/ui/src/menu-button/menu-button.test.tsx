import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { MenuButton } from './menu-button';

function Harness() {
  return (
    <MenuButton
      label="Mais ações"
      trigger="Mais"
      items={[
        { id: 'dup', label: 'Duplicar', onSelect: vi.fn() },
        { id: 'del', label: 'Excluir', tone: 'danger', onSelect: vi.fn() },
      ]}
    />
  );
}

describe('MenuButton', () => {
  it('opens the menu and focuses the first item', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).toHaveFocus();
  });

  it('moves with the arrow keys and closes on Escape returning focus', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Excluir' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Duplicar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders danger items with the danger tone', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    const item = screen.getByRole('menuitem', { name: 'Excluir' });
    expect(item).toHaveAttribute('data-tone', 'danger');
    expect(item.className).toMatch(/danger/);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
