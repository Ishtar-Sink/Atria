import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  EMOTION_ICON_KEYS,
  EmotionIcon,
  EmotionIconField,
  resolveEmotionIcon,
  type EmotionIconChoice,
} from './emotion-icons';
import './use-emotions';

afterEach(cleanup);

function Field({ on_value }: { on_value?: (icon: EmotionIconChoice) => void }) {
  const [value, setValue] = useState<EmotionIconChoice>('neutral');
  return (
    <EmotionIconField
      label="Ícone"
      value={value}
      onChange={(next) => {
        setValue(next);
        on_value?.(next);
      }}
    />
  );
}

describe('emotion icons', () => {
  it('maps every default emotion to its icon by system key', () => {
    expect(resolveEmotionIcon({ system_key: 'joy' })).toBe('sun');
    expect(resolveEmotionIcon({ system_key: 'sadness' })).toBe('rain');
    expect(resolveEmotionIcon({ system_key: 'anger' })).toBe('flame');
    expect(resolveEmotionIcon({ system_key: 'fear' })).toBe('bolt');
    expect(resolveEmotionIcon({ system_key: 'anxiety' })).toBe('wind');
    expect(resolveEmotionIcon({ system_key: 'calm' })).toBe('leaf');
    expect(resolveEmotionIcon({ system_key: 'gratitude' })).toBe('heart');
  });

  it('uses the chosen icon of a custom emotion', () => {
    expect(resolveEmotionIcon({ icon: 'star', system_key: null })).toBe('star');
    expect(resolveEmotionIcon({ icon: 'moon', system_key: 'joy' })).toBe('moon');
  });

  it('uses the neutral icon for a custom emotion without icon', () => {
    expect(resolveEmotionIcon({ icon: null, system_key: null })).toBe('neutral');
    expect(resolveEmotionIcon({})).toBe('neutral');
    expect(resolveEmotionIcon({ icon: 'unknown' })).toBe('neutral');
  });

  it('renders every icon as inline svg hidden from assistive tech', () => {
    const { container } = render(
      <div>
        {([...EMOTION_ICON_KEYS, 'neutral'] as EmotionIconChoice[]).map((key) => (
          <EmotionIcon key={key} icon={key} />
        ))}
      </div>,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(EMOTION_ICON_KEYS.length + 1);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
      expect(svg.getAttribute('data-icon')).not.toBeNull();
    });
  });

  it('chooses an icon in the icon field by click and by arrow keys', async () => {
    const user = userEvent.setup();
    const on_value = vi.fn();
    render(<Field on_value={on_value} />);
    expect(screen.getByRole('radio', { name: 'Círculo' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Estrela' }));
    expect(on_value).toHaveBeenLastCalledWith('star');
    expect(screen.getByRole('radio', { name: 'Estrela' })).toBeChecked();

    screen.getByRole('radio', { name: 'Estrela' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(on_value).toHaveBeenLastCalledWith('moon');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Field />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
