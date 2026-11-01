import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';

const STORAGE_KEY = 'atria_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readSaved(): ThemeMode | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** O valor só evita o piscar ao abrir; a fonte do tema é a preferência no servidor (RN-06). */
function saveChoice(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Armazenamento bloqueado: a escolha vale só nesta sessão.
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

interface ThemeValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => Theme;
}

const ThemeContext = createContext<ThemeValue>({
  theme: 'light',
  mode: 'system',
  setMode: () => undefined,
  setTheme: () => undefined,
  toggleTheme: () => 'light',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readSaved() ?? 'system');
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      setSystem(query.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  const theme = mode === 'system' ? system : mode;

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    saveChoice(next);
    setModeState(next);
  }, []);
  const setTheme = useCallback(
    (next: Theme) => {
      setMode(next);
    },
    [setMode],
  );
  const toggleTheme = useCallback((): Theme => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setMode(next);
    return next;
  }, [setMode, theme]);

  const value = useMemo(
    () => ({ theme, mode, setMode, setTheme, toggleTheme }),
    [theme, mode, setMode, setTheme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
