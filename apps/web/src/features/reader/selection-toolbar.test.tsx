import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import commonMessages from '../../shared/i18n/pt-br.json';
import { registerMessages } from '../../shared/i18n/i18n';
import { describe, expect, it, vi } from 'vitest';
import { HighlightColorPanel, SelectionToolbar } from './selection-toolbar';

registerMessages('common', commonMessages);

const ACCENT = '#0e7490';
const SUCCESS = '#047857';
const PRESETS = ['#0e7490', '#6d28d9', '#047857', '#92400e', '#0369a1'];

function renderToolbar(onHighlight = vi.fn(), onPickColor = vi.fn()) {
  const view = render(
    <SelectionToolbar
      can_highlight
      onNote={vi.fn()}
      onHighlight={onHighlight}
      onPickColor={onPickColor}
    />,
  );
  return { ...view, onHighlight, onPickColor };
}

describe('selection toolbar', () => {
  it('rf19 highlights with a preset hex color', async () => {
    const { onHighlight } = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Destacar em verde' }));
    expect(onHighlight).toHaveBeenCalledWith(SUCCESS);
    const swatches = screen
      .getAllByRole('button', { name: /^Destacar em / })
      .filter((button) => button.getAttribute('aria-label') !== 'Destacar em outra cor');
    expect(swatches.map((button) => button.getAttribute('style'))).toEqual(
      PRESETS.map((hex) => `--swatch-color: ${hex};`),
    );
  });

  it('rf19 opens the color panel from other color', async () => {
    const { onPickColor } = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Destacar em outra cor' }));
    expect(onPickColor).toHaveBeenCalledTimes(1);
  });

  it('rf19 highlights with the hex chosen in the color panel', async () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(<HighlightColorPanel value={ACCENT} onApply={onApply} onCancel={onCancel} />);
    const panel = screen.getByRole('group', { name: 'Cor do novo destaque' });
    await userEvent.click(within(panel).getByRole('button', { name: /^Cor do destaque/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Escolher cor' });
    const field = within(dialog).getByLabelText('HEX');
    await userEvent.clear(field);
    await userEvent.type(field, '#DB2777');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Destacar' }));
    expect(onApply).toHaveBeenCalledWith('#db2777');
    await userEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('rf19 has no axe violations in the toolbar and the color panel', async () => {
    const { container } = renderToolbar();
    expect(await axe(container)).toHaveNoViolations();
    const panel = render(
      <HighlightColorPanel value={ACCENT} onApply={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(await axe(panel.container)).toHaveNoViolations();
  });
});
