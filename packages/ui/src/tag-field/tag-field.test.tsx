import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { TagField } from './tag-field';

function Harness({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <TagField
      label="Etiquetas"
      value={value}
      onChange={setValue}
      list_label="Etiquetas adicionadas"
      remove_label={(tag) => `Remover ${tag}`}
    />
  );
}

const pills = () => screen.queryAllByRole('listitem').map((item) => item.textContent);

describe('TagField', () => {
  it('adds a pill on Enter and on comma', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Etiquetas');
    await userEvent.type(input, '#casa{Enter}');
    await userEvent.type(input, 'mercado,');
    expect(pills()).toEqual(['casa×', 'mercado×']);
    expect(input).toHaveValue('');
  });

  it('ignores repeated tags regardless of case', async () => {
    render(<Harness initial={['casa']} />);
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'CASA{Enter}');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('removes the last pill with Backspace on an empty input', async () => {
    render(<Harness initial={['a', 'b']} />);
    screen.getByLabelText('Etiquetas').focus();
    await userEvent.keyboard('{Backspace}');
    expect(pills()).toEqual(['a×']);
  });

  it('removes a pill with its × button', async () => {
    render(<Harness initial={['a', 'b']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover a' }));
    expect(pills()).toEqual(['b×']);
    expect(screen.getByLabelText('Etiquetas')).toHaveFocus();
  });

  it('commits the pending text on blur', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'viagem');
    await userEvent.tab();
    expect(pills()).toEqual(['viagem×']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness initial={['a']} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses the prototype spacing between field, pills and help', () => {
    const css = readFileSync(join(import.meta.dirname, 'tag-field.module.css'), 'utf8');
    const block = (name: string) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(block('pills')).toContain('gap: var(--s1)');
    expect(block('pills')).toContain('margin: var(--s2) 0 0');
    expect(block('root')).toContain('gap: var(--s1)');
    expect(block('help')).toContain('margin: 0');
  });
});
