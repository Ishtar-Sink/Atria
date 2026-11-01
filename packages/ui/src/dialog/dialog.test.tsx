import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { axe } from 'vitest-axe';
import { Button } from '../button/button';
import { Dialog, type DialogProps } from './dialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

function Harness({
  body,
  ...props
}: Partial<Omit<DialogProps, 'open' | 'children'>> & { body?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir
      </button>
      <Dialog
        title="Registrar?"
        onClose={() => {
          props.onClose?.();
          setOpen(false);
        }}
        actions={
          <>
            <Button>Cancelar</Button>
            <Button variant="primary">Registrar</Button>
          </>
        }
        {...props}
        open={open}
      >
        {body ?? <input aria-label="Campo" />}
      </Dialog>
    </>
  );
}

async function openIt() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Abrir' }));
  return user;
}

describe('Dialog', () => {
  it('renders the title, the body and the actions', async () => {
    render(<Harness />);
    await openIt();
    const dialog = screen.getByRole('dialog', { name: 'Registrar?' });
    const body = dialog.querySelector('[data-dialog-body]');
    const actions = dialog.querySelector('[data-dialog-actions]');
    expect(body).toContainElement(screen.getByLabelText('Campo'));
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Registrar' }));
    expect(body?.compareDocumentPosition(actions as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('focuses the element marked with data-autofocus, or the first focusable one', async () => {
    const first = render(<Harness body={<input aria-label="Um" />} />);
    await openIt();
    expect(screen.getByLabelText('Um')).toHaveFocus();
    first.unmount();
    render(<Harness body={<input aria-label="Dois" data-autofocus="" />} />);
    await openIt();
    expect(screen.getByLabelText('Dois')).toHaveFocus();
  });

  it('routes Escape to onClose without closing by itself', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openIt();
    const dialog = screen.getByRole('dialog');
    const notPrevented = fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(notPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab inside the dialog', async () => {
    render(<Harness />);
    const user = await openIt();
    const field = screen.getByLabelText('Campo');
    expect(field).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Registrar' })).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Registrar' })).toHaveFocus();
  });

  it('returns focus to the trigger when closed', async () => {
    render(<Harness />);
    const user = await openIt();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('uses alertdialog with the body as description', async () => {
    const view = render(<Harness role="alertdialog" body={<p>Texto</p>} />);
    await openIt();
    const dialog = screen.getByRole('alertdialog');
    const bodyId = dialog.querySelector('[data-dialog-body]')?.id;
    expect(bodyId).toBeTruthy();
    expect(dialog).toHaveAttribute('aria-describedby', bodyId);
    view.unmount();
    render(<Harness role="alertdialog" described_by="x" body={<p id="x">Texto</p>} />);
    await openIt();
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-describedby', 'x');
  });

  it('closes on a backdrop click only when asked', async () => {
    const onClose = vi.fn();
    const view = render(<Harness close_on_backdrop onClose={onClose} body={<p>Corpo</p>} />);
    await openIt();
    fireEvent.click(screen.getByText('Corpo'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    const other = vi.fn();
    render(<Harness onClose={other} body={<p>Corpo</p>} />);
    await openIt();
    fireEvent.click(screen.getByRole('dialog'));
    expect(other).not.toHaveBeenCalled();
  });

  it('submits a form of the body from a button in the actions', async () => {
    const spy = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(
      <Harness
        body={
          <form id="f" onSubmit={spy}>
            <input aria-label="Nome" />
          </form>
        }
        actions={
          <Button type="submit" form="f">
            Enviar
          </Button>
        }
      />,
    );
    const user = await openIt();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('applies the wide size', async () => {
    render(<Harness size="wide" />);
    await openIt();
    expect(screen.getByRole('dialog').className).toMatch(/wide/);
  });

  it('has the prototype spacing', () => {
    const css = readFileSync(join(__dirname, 'dialog.module.css'), 'utf8');
    const block = (name: string) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(block('inner')).toContain('padding: var(--s6)');
    expect(block('actions')).toContain('margin-top: var(--s4)');
    expect(block('actions')).toContain('justify-content: flex-end');
    expect(block('title')).toContain('margin: 0 0 var(--s2)');
    expect(block('root')).toContain('calc(var(--space) * 120)');
    expect(block('wide')).toContain('calc(var(--space) * 140)');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    await openIt();
    expect(await axe(container)).toHaveNoViolations();
  });
});
