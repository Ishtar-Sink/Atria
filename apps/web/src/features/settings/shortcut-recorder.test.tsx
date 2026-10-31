import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider, registerMessages } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import { ShortcutRecorder } from './shortcut-recorder';

registerMessages('settings', messages);

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('mod+k');
  return (
    <I18nProvider>
      <ShortcutRecorder
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </I18nProvider>
  );
}

describe('ShortcutRecorder', () => {
  it('records a key combination', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    expect(screen.getByText('Pressione a combinação…')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith('mod+j');
    expect(screen.getByText('Ctrl + J')).toBeInTheDocument();
    expect(screen.getByText('Atalho gravado: Ctrl + J')).toBeInTheDocument();
  });

  it('rejects a combination without modifier', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    fireEvent.keyDown(window, { key: 'j' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Use Ctrl, Alt ou ⌘ junto com uma tecla.');
    fireEvent.keyDown(window, { key: 'p', altKey: true });
    expect(onChange).toHaveBeenCalledWith('alt+p');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('resets to the default shortcut', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(onChange).toHaveBeenLastCalledWith('mod+k');
    expect(screen.getByText('Ctrl + K')).toBeInTheDocument();
  });

  it('is operable by keyboard only', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Gravar' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Gravar' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Control>}m{/Control}');
    expect(onChange).toHaveBeenCalledWith('mod+m');
    // Escape cancela a gravação sem mudar o atalho
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Gravar' })).toHaveAttribute('aria-pressed', 'false');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
