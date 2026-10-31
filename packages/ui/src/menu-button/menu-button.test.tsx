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
  it('aligns the menu to the trigger start when it would leave the window', async () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const left =
          this.getAttribute('role') === 'menu' && !this.className.includes('alignStart') ? -60 : 8;
        return {
          left,
          right: left + 176,
          top: 0,
          bottom: 0,
          width: 176,
          height: 0,
          x: left,
          y: 0,
          toJSON: () => ({}),
        };
      });
    try {
      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
      expect(screen.getByRole('menu').className).toContain('alignStart');
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps the end alignment when the menu fits', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.getByRole('menu').className).not.toContain('alignStart');
  });

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

  it('names the button by its content and the menu by menuLabel when label is omitted', async () => {
    render(
      <MenuButton
        menuLabel="Conta"
        trigger="Ana Souza"
        items={[{ id: 'a', label: 'Sair', onSelect: vi.fn() }]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Ana Souza' });
    expect(trigger).not.toHaveAttribute('aria-label');
    await userEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Conta' })).toBeInTheDocument();
  });

  it('adds menuClassName to the open menu only, leaving the default classes', async () => {
    render(
      <MenuButton
        label="Conta"
        trigger="Ana"
        menuClassName="extra-menu"
        items={[{ id: 'a', label: 'Sair', onSelect: vi.fn() }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Conta' }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('extra-menu');
    expect(menu.className).toMatch(/menu/);
    expect(screen.getByRole('button', { name: 'Conta' })).not.toHaveClass('extra-menu');
  });
});
