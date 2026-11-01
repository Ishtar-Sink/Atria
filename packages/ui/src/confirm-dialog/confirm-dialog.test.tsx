import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { ConfirmDialog } from './confirm-dialog';

function Harness({ onConfirm = () => undefined }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Excluir
      </button>
      <ConfirmDialog
        open={open}
        title="Excluir item?"
        description="Isto não pode ser desfeito."
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        onCancel={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('traps focus and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Excluir' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(trigger).toHaveFocus();
  });

  it('calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('is built on Dialog, with the actions after the description', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.querySelector('[data-dialog-body]')).toHaveTextContent(
      'Isto não pode ser desfeito.',
    );
    const actions = dialog.querySelector('[data-dialog-actions]');
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Cancelar' }));
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Confirmar' }));
  });
});
