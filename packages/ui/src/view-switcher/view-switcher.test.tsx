import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axe } from 'vitest-axe';
import { GridIcon, ListIcon } from '../icons';
import { ViewSwitcher, type ViewOption } from './view-switcher';

const views = [
  { value: 'list', label: 'Lista', icon: <ListIcon /> },
  { value: 'grid', label: 'Grade', icon: <GridIcon /> },
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

  it('shows only the icon, named by aria-label and title', () => {
    render(
      <ViewSwitcher label="Visualização" options={views} value="list" onChange={() => undefined} />,
    );
    const button = screen.getByRole('button', { name: 'Grade' });
    expect(button).toHaveAttribute('title', 'Grade');
    expect(button.textContent).toBe('');
  });

  it('puts the icon straight in the button, without an inline wrapper', () => {
    render(
      <ViewSwitcher label="Visualização" options={views} value="list" onChange={() => undefined} />,
    );
    const button = screen.getByRole('button', { name: 'Grade' });
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('requires an icon in every option', () => {
    // @ts-expect-error -- opção sem ícone não compila (CT-05)
    const missing: ViewOption = { value: 'list', label: 'Lista' };
    expect(missing.label).toBe('Lista');
  });

  it('centers the icon and keeps only the width of the options', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/view-switcher/view-switcher.module.css'),
      'utf8',
    );
    const root = /\.root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(root).toMatch(/flex:\s*none/);
    expect(root).toMatch(/width:\s*fit-content/);
    expect(css).toMatch(/\.option svg\s*\{[^}]*display:\s*block/);
  });
});
