import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPrefersDark } from '../../shared/test/setup';
import { ThemeProvider, useTheme } from './theme-provider';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('defaults to light without a saved choice or system preference', () => {
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('follows prefers-color-scheme when nothing is saved', () => {
    setPrefersDark(true);
    renderProbe();
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    act(() => {
      setPrefersDark(false);
    });
    expect(screen.getByRole('button')).toHaveTextContent('light');
  });

  it('saves the choice and sets data-theme on html', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('atria_theme')).toBe('dark');
  });

  it('ignores storage errors', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderProbe();
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
