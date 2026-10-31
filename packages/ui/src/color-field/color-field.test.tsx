import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { ColorField } from './color-field';

const labels = {
  title: 'Escolher cor',
  lightness: 'Luminosidade',
  hex: 'HEX',
  rgb: 'RGB',
  red: 'Vermelho',
  green: 'Verde',
  blue: 'Azul',
  hsl: 'HSL',
  hue: 'Matiz',
  saturation: 'Saturação',
  cancel: 'Cancelar',
  apply: 'Aplicar',
  wheel: 'Roda de cores',
};

function Harness({ spy }: { spy?: (hex: string) => void }) {
  const [value, setValue] = useState('#7C3AED');
  return (
    <ColorField
      label="Cor"
      value={value}
      onChange={(hex) => {
        setValue(hex);
        spy?.(hex);
      }}
      labels={labels}
    />
  );
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: /Cor/ }));
  return screen.getByRole('dialog', { name: 'Escolher cor' });
}

function wheelOf(dialog: HTMLElement) {
  return within(dialog).getByRole('slider', { name: 'Roda de cores' });
}

function wheelValue(dialog: HTMLElement) {
  const text = wheelOf(dialog).getAttribute('aria-valuetext') ?? '';
  const match = /Matiz (\d+) graus, saturação (\d+)%/.exec(text);
  return { hue: Number(match?.[1]), sat: Number(match?.[2]) };
}

describe('ColorField', () => {
  it('shows the swatch and the HEX on the trigger', () => {
    const { container } = render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Cor/ });
    expect(trigger).toHaveTextContent('#7C3AED');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(container.querySelector('[data-swatch]')).toHaveStyle({ backgroundColor: '#7c3aed' });
  });

  it('opens the picker in a dialog on the current color', async () => {
    render(<Harness />);
    const dialog = await open();
    expect(within(dialog).getByLabelText('HEX')).toHaveValue('#7C3AED');
    expect(wheelValue(dialog)).toEqual({ hue: 262, sat: 83 });
    expect(wheelOf(dialog)).toHaveAttribute('tabindex', '0');
  });

  it('changes hue with left and right arrows and saturation with up and down', async () => {
    render(<Harness />);
    const dialog = await open();
    wheelOf(dialog).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(wheelValue(dialog).hue).toBe(263);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(wheelValue(dialog).hue).toBe(261);
    await userEvent.keyboard('{ArrowDown}');
    expect(wheelValue(dialog).sat).toBe(82);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(wheelValue(dialog).sat).toBe(84);
  });

  it('uses a larger step with Shift', async () => {
    render(<Harness />);
    const dialog = await open();
    wheelOf(dialog).focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(wheelValue(dialog).hue).toBe(272);
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(wheelValue(dialog).sat).toBe(73);
  });

  it('syncs HEX, RGB and HSL fields and the preview', async () => {
    const { container } = render(<Harness />);
    const dialog = await open();
    const hex = within(dialog).getByLabelText('HEX');
    await userEvent.clear(hex);
    await userEvent.type(hex, '#FF0000');
    const rgb = within(within(dialog).getByRole('group', { name: 'RGB' }));
    expect(rgb.getByLabelText('Vermelho')).toHaveValue(255);
    expect(rgb.getByLabelText('Verde')).toHaveValue(0);
    const hsl = within(within(dialog).getByRole('group', { name: 'HSL' }));
    expect(hsl.getByLabelText('Matiz')).toHaveValue(0);
    expect(hsl.getByLabelText('Saturação')).toHaveValue(100);
    expect(container.ownerDocument.querySelector('[data-preview]')).toHaveStyle({
      backgroundColor: '#ff0000',
    });
    const green = rgb.getByLabelText('Verde');
    await userEvent.clear(green);
    await userEvent.type(green, '255');
    expect(hex).toHaveValue('#FFFF00');
    expect(hsl.getByLabelText('Matiz')).toHaveValue(60);
  });

  it('marks an invalid HEX with aria-invalid and keeps the color', async () => {
    render(<Harness />);
    const dialog = await open();
    const hex = within(dialog).getByLabelText('HEX');
    await userEvent.clear(hex);
    await userEvent.type(hex, '#12');
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(wheelValue(dialog)).toEqual({ hue: 262, sat: 83 });
  });

  it('applies any HEX as #RRGGBB', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const dialog = await open();
    const hex = within(dialog).getByLabelText('HEX');
    await userEvent.clear(hex);
    await userEvent.type(hex, 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
    expect(spy).toHaveBeenCalledWith('#AABBCC');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cor/ })).toHaveTextContent('#AABBCC');
  });

  it('cancels with Escape or Cancelar without changing the value', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    let dialog = await open();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    dialog = await open();
    wheelOf(dialog).focus();
    await userEvent.keyboard('{ArrowRight}');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Cor/ })).toHaveTextContent('#7C3AED');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
    const dialog = await open();
    expect(await axe(dialog)).toHaveNoViolations();
  });
});
