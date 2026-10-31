import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AppProviders } from '../../app/providers';
import { CreateTypeDialog, type CreateType } from './create-type-dialog';

const icon = (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const types: CreateType[] = [
  {
    id: 'income',
    label: 'Entrada',
    description: 'Dinheiro que entra',
    icon,
    href: '/finance/new?kind=income',
  },
  {
    id: 'expense',
    label: 'Saída',
    description: 'Conta ou gasto',
    icon,
    href: '/finance/new?kind=expense',
  },
  {
    id: 'transfer',
    label: 'Transferência',
    description: 'Entre duas contas',
    icon,
    href: '/finance/transfers/new',
  },
  {
    id: 'category',
    label: 'Categoria',
    description: 'Para agrupar',
    icon,
    href: '/finance/categories/new',
  },
];

function Harness({
  layout,
  focused_type,
  on_select,
  on_close,
}: {
  layout?: 'grid' | 'list';
  focused_type?: string;
  on_select?: (type: CreateType) => void;
  on_close?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AppProviders {...(layout ? { preferences: { create_layout: layout } } : {})}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Novo registro
      </button>
      <CreateTypeDialog
        types={types}
        {...(focused_type ? { focused_type } : {})}
        open={open}
        title="O que você quer registrar?"
        description="Escolha o tipo de registro do Financeiro."
        {...(on_select ? { on_select } : {})}
        on_close={() => {
          on_close?.();
          setOpen(false);
        }}
      />
    </AppProviders>
  );
}

async function openDialog(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Novo registro' }));
}

describe('CreateTypeDialog', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a labelled dialog with one link card per type', async () => {
    await openDialog();
    const dialog = screen.getByRole('dialog', { name: 'O que você quer registrar?' });
    expect(dialog).toHaveAccessibleDescription('Escolha o tipo de registro do Financeiro.');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Saída.*Conta ou gasto/ })).toHaveAttribute(
      'href',
      '/finance/new?kind=expense',
    );
  });

  it('focuses the card of the focused type', async () => {
    await openDialog({ focused_type: 'transfer' });
    expect(screen.getByRole('link', { name: /Transferência/ })).toHaveFocus();
  });

  it('focuses the first card without a focused type', async () => {
    await openDialog({ focused_type: 'unknown' });
    expect(screen.getByRole('link', { name: /Entrada/ })).toHaveFocus();
  });

  it('lays the cards out as a grid by default', async () => {
    await openDialog();
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'grid');
  });

  it('lays the cards out as a list when the create layout is list', async () => {
    await openDialog({ layout: 'list' });
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'list');
  });

  it('moves between the cards with the arrow keys in the grid', async () => {
    await openDialog();
    // Duas colunas: o jsdom não calcula o layout, então informamos a posição de cada cartão.
    screen.getAllByRole('link').forEach((link, index) => {
      link.getBoundingClientRect = () =>
        ({ top: Math.floor(index / 2) * 100, left: (index % 2) * 200 }) as DOMRect;
    });
    expect(screen.getByRole('link', { name: /Entrada/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('link', { name: /Saída/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('link', { name: /Categoria/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('link', { name: /Transferência/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('link', { name: /Entrada/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('link', { name: /Categoria/ })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('link', { name: /Entrada/ })).toHaveFocus();
  });

  it('moves between the cards with up and down in the list', async () => {
    await openDialog({ layout: 'list' });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('link', { name: /Transferência/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('link', { name: /Saída/ })).toHaveFocus();
  });

  it('stays on the edge cards instead of wrapping', async () => {
    await openDialog({ layout: 'list' });
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('link', { name: /Entrada/ })).toHaveFocus();
    await userEvent.keyboard('{End}{ArrowDown}');
    expect(screen.getByRole('link', { name: /Categoria/ })).toHaveFocus();
  });

  it('opens the focused card with Enter', async () => {
    const on_select = vi.fn();
    await openDialog({ on_select });
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(on_select).toHaveBeenCalledTimes(1);
    expect(on_select.mock.calls[0]?.[0]).toMatchObject({ id: 'expense' });
  });

  it('closes after choosing a card', async () => {
    const on_close = vi.fn();
    await openDialog({ on_select: vi.fn(), on_close });
    await userEvent.click(screen.getByRole('link', { name: /Categoria/ }));
    expect(on_close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with Escape and returns the focus to the trigger', async () => {
    const on_close = vi.fn();
    await openDialog({ on_close });
    await userEvent.keyboard('{Escape}');
    expect(on_close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo registro' })).toHaveFocus();
  });

  it('closes with Cancelar', async () => {
    const on_close = vi.fn();
    await openDialog({ on_close });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(on_close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Novo registro' })).toHaveFocus();
  });

  it('closes when the backdrop is clicked, but not the dialog padding', async () => {
    const on_close = vi.fn();
    await openDialog({ on_close });
    const dialog = screen.getByRole('dialog');
    dialog.getBoundingClientRect = () =>
      ({ left: 100, right: 500, top: 100, bottom: 400 }) as DOMRect;
    fireEvent.click(dialog, { clientX: 120, clientY: 120 });
    expect(on_close).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(on_close).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations in the grid', async () => {
    await openDialog();
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('has no axe violations in the list', async () => {
    await openDialog({ layout: 'list' });
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});
