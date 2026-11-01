import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { EmotionPicker, type PickedEmotion } from './emotion-picker';
import type { Emotion } from './use-emotions';

function emotion(
  id: string,
  system_key: Emotion['system_key'],
  name: string | null = null,
): Emotion {
  return {
    id,
    owner_id: 'u1',
    name,
    system_key,
    visibility: 'personal',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };
}

const EMOTIONS = [
  emotion('joy', 'joy'),
  emotion('anxiety', 'anxiety'),
  emotion('calm', 'calm', 'Paz'),
];

function Harness({
  emotions = EMOTIONS,
  initial = [],
  on_value,
}: {
  emotions?: Emotion[];
  initial?: PickedEmotion[];
  on_value?: (value: PickedEmotion[]) => void;
}) {
  const [value, setValue] = useState<PickedEmotion[]>(initial);
  return (
    <EmotionPicker
      emotions={emotions}
      value={value}
      onChange={(next) => {
        setValue(next);
        on_value?.(next);
      }}
    />
  );
}

afterEach(cleanup);

describe('emotion picker', () => {
  it('selects more than one emotion', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);

    await user.click(screen.getByRole('button', { name: 'Alegria' }));
    await user.click(screen.getByRole('button', { name: 'Ansiedade' }));

    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy' }, { emotion_id: 'anxiety' }]);
  });

  it('shows default emotions translated by system key', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Alegria' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ansiedade' })).toBeInTheDocument();
  });

  it('shows the user name of a renamed default emotion', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Paz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calma' })).not.toBeInTheDocument();
  });

  it('keeps intensity optional', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);

    await user.click(screen.getByRole('button', { name: 'Alegria' }));

    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy' }]);
    const group = screen.getByRole('radiogroup', { name: 'Intensidade de Alegria' });
    expect(within(group).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('is operable by keyboard only', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Alegria' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Alegria' })).toHaveAttribute('aria-pressed', 'true');

    await user.tab();
    const group = screen.getByRole('radiogroup', { name: 'Intensidade de Alegria' });
    expect(within(group).getByRole('radio', { name: '1 de 5' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy', intensity: 3 }]);
  });

  it('does not use the danger color for any emotion', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/features/journal/emotion-picker.module.css'),
      'utf8',
    );
    expect(css).not.toMatch(/danger/);
  });

  it('pd62 shows the emotions as chips in a grid', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Emoções' });
    expect(group.tagName).toBe('FIELDSET');
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(within(group).getByText(/de 1 a 5/)).toBeInTheDocument();
    expect(group.querySelector('ul')).not.toBeNull();
  });

  it('pd62 enables the intensity from 1 to 5 only after the emotion is marked', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);
    expect(screen.queryByRole('radiogroup', { name: 'Intensidade de Alegria' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Alegria' }));
    const group = screen.getByRole('radiogroup', { name: 'Intensidade de Alegria' });
    const dots = within(group).getAllByRole('radio');
    expect(dots.map((dot) => dot.getAttribute('aria-label'))).toEqual([
      '1 de 5',
      '2 de 5',
      '3 de 5',
      '4 de 5',
      '5 de 5',
    ]);
    dots.forEach((dot) => {
      expect(dot).toBeEnabled();
    });
    await user.click(within(group).getByRole('radio', { name: '4 de 5' }));
    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy', intensity: 4 }]);
    await user.click(within(group).getByRole('radio', { name: '2 de 5' }));
    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy', intensity: 2 }]);

    await user.click(screen.getByRole('button', { name: 'Alegria' }));
    expect(on_value).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('radiogroup', { name: 'Intensidade de Alegria' })).toBeNull();
  });

  it('pd62 sends the emotion without intensity when no dot is chosen', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);
    await user.click(screen.getByRole('button', { name: 'Ansiedade' }));
    const last = on_value.mock.calls.at(-1)?.[0] as PickedEmotion[];
    expect(last).toEqual([{ emotion_id: 'anxiety' }]);
    expect(last[0]).not.toHaveProperty('intensity');
  });

  it('shows the icon of each emotion inside its button', () => {
    render(<Harness />);
    const joy = screen.getByRole('button', { name: 'Alegria' });
    expect(joy.querySelector('svg[data-icon="sun"]')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Ansiedade' }).querySelector('svg[data-icon="wind"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Paz' }).querySelector('svg[data-icon="leaf"]'),
    ).not.toBeNull();
  });

  it('keeps long names inside the button without overlapping the dots', async () => {
    const user = userEvent.setup();
    const long_name = 'Uma emoção com um nome muito longo para caber numa linha só '
      .slice(0, 60)
      .trim();
    render(
      <Harness emotions={[emotion('long', null, long_name)]} initial={[{ emotion_id: 'long' }]} />,
    );
    const button = screen.getByRole('button', { name: long_name });
    const group = screen.getByRole('radiogroup', { name: `Intensidade de ${long_name}` });
    const name = within(button).getByText(long_name);
    expect(name.tagName).toBe('SPAN');
    expect(group.contains(name)).toBe(false);
    expect(button.contains(group)).toBe(false);
    expect(group.parentElement).toBe(button.parentElement);
    await user.click(button);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('saves an emotion without intensity', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);
    await user.click(screen.getByRole('button', { name: 'Alegria' }));
    const last = on_value.mock.calls.at(-1)?.[0] as PickedEmotion[];
    expect(last).toEqual([{ emotion_id: 'joy' }]);
    expect(last[0]).not.toHaveProperty('intensity');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness initial={[{ emotion_id: 'joy', intensity: 3 }]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
