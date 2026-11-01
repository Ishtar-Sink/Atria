import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { Autocomplete } from './autocomplete';

const OPTIONS = [
  { value: '', label: 'Todas as categorias' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'saude', label: 'Saúde' },
] as const;

function Single({
  initial = '',
  onChange,
  error,
  disabled,
  name,
}: {
  initial?: string | null;
  onChange?: (value: string | null) => void;
  error?: string;
  disabled?: boolean;
  name?: string;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Autocomplete
      label="Categoria"
      options={OPTIONS}
      empty_text="Nenhuma categoria encontrada"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...(error ? { error } : {})}
      {...(disabled ? { disabled } : {})}
      {...(name ? { name } : {})}
    />
  );
}

function Multiple({ initial = [], name }: { initial?: string[]; name?: string }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <Autocomplete
      multiple
      label="Categoria"
      options={OPTIONS}
      empty_text="Nenhuma categoria encontrada"
      value={value}
      onChange={(next) => {
        setValue(next);
      }}
      list_label="Categorias escolhidas"
      remove_label={(label) => `Remover ${label}`}
      {...(name ? { name } : {})}
    />
  );
}

const combobox = () => screen.getByRole('combobox', { name: 'Categoria' });

describe('Autocomplete', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Single />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(combobox());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes an editable combobox labelled by the field', () => {
    const { container } = render(<Single />);
    const input = combobox();
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('Todas as categorias');
    expect(container.querySelector('select')).toBeNull();
  });

  it('ct16 filters the options while typing, ignoring case and accents', async () => {
    render(<Single />);
    const input = combobox();
    await userEvent.click(input);
    await userEvent.keyboard('sau');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Saúde']);
    await userEvent.clear(input);
    await userEvent.keyboard('MER');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Mercado']);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  });

  it('ct16 picks the active option with the arrow keys and Enter', async () => {
    const onChange = vi.fn();
    render(<Single initial={null} onChange={onChange} />);
    const input = combobox();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    const active = screen.getByRole('option', { name: 'Moradia' });
    expect(input).toHaveAttribute('aria-activedescendant', active.id);
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('moradia');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Moradia');
  });

  it('ct16 closes on Escape keeping the previous value', async () => {
    const onChange = vi.fn();
    const onParentKeyDown = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={onParentKeyDown}>
        <Single initial="mercado" onChange={onChange} />
      </div>,
    );
    const input = combobox();
    await userEvent.click(input);
    await userEvent.keyboard('tra');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    onParentKeyDown.mockClear();
    const notCancelled = fireEvent.keyDown(input, { key: 'Escape' });
    expect(notCancelled).toBe(false);
    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Mercado');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cb10 shows the empty text and keeps the previous value', async () => {
    const onChange = vi.fn();
    render(<Single initial="mercado" onChange={onChange} />);
    const input = combobox();
    await userEvent.click(input);
    await userEvent.keyboard('xyz');
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma categoria encontrada');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(input).toHaveValue('Mercado');
  });

  it('picks an option with the mouse', async () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    await userEvent.click(combobox());
    expect(screen.getAllByRole('option')).toHaveLength(6);
    await userEvent.click(screen.getByRole('option', { name: 'Lazer' }));
    expect(onChange).toHaveBeenCalledWith('lazer');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on a click outside restoring the text', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Single initial="mercado" onChange={onChange} />
        <button type="button">Fora</button>
      </>,
    );
    const input = combobox();
    await userEvent.click(input);
    await userEvent.keyboard('mo');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Mercado');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ct16 chooses several options and keeps the list open', async () => {
    render(<Multiple />);
    const input = combobox();
    await userEvent.click(input);
    await userEvent.keyboard('la{Enter}');
    await userEvent.keyboard('tra{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(input).toHaveValue('');
    const pills = screen.getByRole('list', { name: 'Categorias escolhidas' });
    expect(pills).toHaveTextContent('Lazer');
    expect(pills).toHaveTextContent('Transporte');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    const selected = screen
      .getAllByRole('option')
      .filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected.map((o) => o.textContent)).toEqual(['Transporte', 'Lazer']);
  });

  it('ct16 removes each chosen option', async () => {
    render(<Multiple initial={['lazer', 'transporte']} />);
    const input = combobox();
    await userEvent.click(screen.getByRole('button', { name: 'Remover Lazer' }));
    const pills = screen.getByRole('list', { name: 'Categorias escolhidas' });
    expect(pills).not.toHaveTextContent('Lazer');
    expect(pills).toHaveTextContent('Transporte');
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(screen.queryByRole('list', { name: 'Categorias escolhidas' })).toBeNull();
    // Escolhe de novo e desmarca com Enter sobre a opção já escolhida.
    await userEvent.keyboard('la{Enter}');
    expect(screen.getByRole('list', { name: 'Categorias escolhidas' })).toHaveTextContent('Lazer');
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('list', { name: 'Categorias escolhidas' })).toBeNull();
  });

  it('shows the error with role alert and aria-invalid', () => {
    render(<Single error="Escolha uma categoria." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escolha uma categoria.');
    expect(combobox()).toHaveAttribute('aria-invalid', 'true');
    expect(combobox().getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('does not open when disabled', async () => {
    render(<Single disabled />);
    await userEvent.click(combobox());
    fireEvent.keyDown(combobox(), { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('submits the value through hidden inputs', () => {
    const { container, unmount } = render(<Single initial="mercado" name="categoria" />);
    const hidden = container.querySelectorAll('input[type=hidden][name=categoria]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toHaveAttribute('value', 'mercado');
    unmount();
    const multi = render(<Multiple initial={['lazer', 'saude']} name="categoria" />);
    expect(multi.container.querySelectorAll('input[type=hidden][name=categoria]')).toHaveLength(2);
  });
});
