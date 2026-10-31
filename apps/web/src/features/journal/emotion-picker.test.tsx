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

    await user.click(screen.getByRole('checkbox', { name: 'Alegria' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ansiedade' }));

    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy' }, { emotion_id: 'anxiety' }]);
  });

  it('shows default emotions translated by system key', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Alegria' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ansiedade' })).toBeInTheDocument();
  });

  it('shows the user name of a renamed default emotion', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Paz' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Calma' })).not.toBeInTheDocument();
  });

  it('keeps intensity optional', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);

    await user.click(screen.getByRole('checkbox', { name: 'Alegria' }));

    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy' }]);
    const group = screen.getByRole('radiogroup', { name: 'Intensidade de Alegria' });
    expect(within(group).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('is operable by keyboard only', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);

    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Alegria' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'Alegria' })).toBeChecked();

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
    expect(within(group).getAllByRole('checkbox')).toHaveLength(3);
    expect(within(group).getByText(/de 1 a 5/)).toBeInTheDocument();
    expect(group.querySelector('ul')).not.toBeNull();
  });

  it('pd62 enables the intensity from 1 to 5 only after the emotion is marked', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);
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
      expect(dot).toBeDisabled();
    });

    await user.click(screen.getByRole('checkbox', { name: 'Alegria' }));
    dots.forEach((dot) => {
      expect(dot).toBeEnabled();
    });
    await user.click(within(group).getByRole('radio', { name: '4 de 5' }));
    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy', intensity: 4 }]);
    await user.click(within(group).getByRole('radio', { name: '2 de 5' }));
    expect(on_value).toHaveBeenLastCalledWith([{ emotion_id: 'joy', intensity: 2 }]);

    await user.click(screen.getByRole('checkbox', { name: 'Alegria' }));
    expect(on_value).toHaveBeenLastCalledWith([]);
    within(group)
      .getAllByRole('radio')
      .forEach((dot) => {
        expect(dot).toBeDisabled();
      });
  });

  it('pd62 sends the emotion without intensity when no dot is chosen', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Harness on_value={on_value} />);
    await user.click(screen.getByRole('checkbox', { name: 'Ansiedade' }));
    const last = on_value.mock.calls.at(-1)?.[0] as PickedEmotion[];
    expect(last).toEqual([{ emotion_id: 'anxiety' }]);
    expect(last[0]).not.toHaveProperty('intensity');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness initial={[{ emotion_id: 'joy', intensity: 3 }]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
