import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../shared/test/render';
import { ChecklistField } from './checklist-field';
import type { ChecklistDraft } from './use-kanban';

function Harness({ initial = [] }: { initial?: ChecklistDraft[] }) {
  const [items, setItems] = useState<ChecklistDraft[]>(initial);
  return (
    <form onSubmit={onSubmit}>
      <ChecklistField label="Checklist" help="Ajuda" items={items} onChange={setItems} />
      <output data-testid="items">{JSON.stringify(items)}</output>
    </form>
  );
}
const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
  event.preventDefault();
});

function items(): { text: string; done: boolean }[] {
  const raw = JSON.parse(screen.getByTestId('items').textContent) as ChecklistDraft[];
  return raw.map(({ text, done }) => ({ text, done }));
}

async function ready() {
  await screen.findByLabelText('Novo item do checklist');
}

const abc: ChecklistDraft[] = [
  { key: 'a', text: 'A', done: false },
  { key: 'b', text: 'B', done: false },
  { key: 'c', text: 'C', done: false },
];

describe('checklist field', () => {
  it('rf33 adds an item with Enter and keeps an empty input at the end', async () => {
    onSubmit.mockClear();
    renderWithProviders(<Harness />);
    await ready();
    const input = screen.getByLabelText('Novo item do checklist');
    await userEvent.type(input, 'Medir{Enter}');
    expect(items()).toEqual([{ text: 'Medir', done: false }]);
    const again = screen.getByLabelText('Novo item do checklist');
    expect(again).toHaveValue('');
    expect(again).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cb12 does not add an item made only of spaces', async () => {
    renderWithProviders(<Harness />);
    await ready();
    const input = screen.getByLabelText('Novo item do checklist');
    await userEvent.type(input, '   {Enter}');
    expect(items()).toEqual([]);
    expect(input).toHaveValue('');
  });

  it('rf33 adds the pending text when the input loses focus', async () => {
    renderWithProviders(<Harness />);
    await ready();
    await userEvent.type(screen.getByLabelText('Novo item do checklist'), 'Comparar');
    await userEvent.tab();
    expect(items()).toEqual([{ text: 'Comparar', done: false }]);
  });

  it('rf33 marks an item as done', async () => {
    renderWithProviders(<Harness initial={[{ key: 'm', text: 'Medir', done: false }]} />);
    await ready();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Feito: Medir' }));
    expect(items()).toEqual([{ text: 'Medir', done: true }]);
  });

  it('rf33 removes an item', async () => {
    renderWithProviders(<Harness initial={[{ key: 'm', text: 'Medir', done: false }]} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Remover o item Medir' }));
    expect(items()).toEqual([]);
    expect(screen.getByLabelText('Novo item do checklist')).toHaveFocus();
  });

  it('rf33 reorders with the arrow keys on the handle', async () => {
    renderWithProviders(<Harness initial={abc} />);
    await ready();
    screen.getByRole('button', { name: 'Reordenar o item A, posição 1 de 3' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(items().map((item) => item.text)).toEqual(['B', 'A', 'C']);
    const handle = screen.getByRole('button', { name: 'Reordenar o item A, posição 2 de 3' });
    expect(handle).toHaveFocus();
    expect(screen.getByText('Item “A” na posição 2 de 3.')).toHaveAttribute('role', 'status');
  });

  it('rf33 moves to the next item input with Enter', async () => {
    renderWithProviders(<Harness initial={abc} />);
    await ready();
    await userEvent.click(screen.getByLabelText('Item 1 do checklist'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Item 2 do checklist')).toHaveFocus();
    await userEvent.click(screen.getByLabelText('Item 3 do checklist'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Novo item do checklist')).toHaveFocus();
    expect(items()).toHaveLength(3);
  });

  it('rf33 has no axe violations', async () => {
    const { container } = renderWithProviders(
      <Harness
        initial={[
          { key: 'a', text: 'A', done: true },
          { key: 'b', text: 'B', done: false },
        ]}
      />,
    );
    await ready();
    expect(await axe(container)).toHaveNoViolations();
  });
});
