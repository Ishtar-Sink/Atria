import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Toolbar } from './toolbar';
import { GridIcon, ListIcon } from '../icons';
import { ViewSwitcher } from '../view-switcher/view-switcher';

const views = [
  { value: 'list', label: 'Lista', icon: <ListIcon /> },
  { value: 'grid', label: 'Grade', icon: <GridIcon /> },
];

function setup(onSearchChange: (value: string) => void = () => undefined) {
  return render(
    <Toolbar
      searchLabel="Buscar"
      searchValue=""
      onSearchChange={onSearchChange}
      filters={<span>Filtros</span>}
    >
      <ViewSwitcher label="Visualização" options={views} value="list" onChange={() => undefined} />
    </Toolbar>,
  );
}

describe('Toolbar', () => {
  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('calls onSearchChange', async () => {
    const onSearchChange = vi.fn();
    setup(onSearchChange);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('marks the active view with aria-pressed', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'false');
  });
});
