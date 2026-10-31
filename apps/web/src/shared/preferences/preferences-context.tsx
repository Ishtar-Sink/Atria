import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Opções do botão de criar (PD-10): cartões em grade ou em lista. */
export type CreateLayout = 'grid' | 'list';

export interface PreferenceValues {
  locale: string;
  time_zone: string;
  currency: string;
  palette_shortcut: string;
  create_layout: CreateLayout;
}

export interface Preferences extends PreferenceValues {
  set_create_layout: (value: CreateLayout) => void;
}

export const defaultPreferences: PreferenceValues = {
  locale: 'pt-BR',
  time_zone: 'America/Sao_Paulo',
  currency: 'BRL',
  palette_shortcut: 'mod+k',
  create_layout: 'grid',
};

const CREATE_LAYOUT_KEY = 'atria.settings.create_layout';

function isCreateLayout(value: unknown): value is CreateLayout {
  return value === 'grid' || value === 'list';
}

function readCreateLayout(user_id: string): CreateLayout | undefined {
  try {
    const stored = localStorage.getItem(`${CREATE_LAYOUT_KEY}.${user_id}`);
    return isCreateLayout(stored) ? stored : undefined;
  } catch {
    // Armazenamento bloqueado: vale o padrão.
    return undefined;
  }
}

function writeCreateLayout(user_id: string, layout: CreateLayout) {
  try {
    localStorage.setItem(`${CREATE_LAYOUT_KEY}.${user_id}`, layout);
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
}

const PreferencesContext = createContext<Preferences>({
  ...defaultPreferences,
  set_create_layout: () => undefined,
});

export interface PreferencesProviderProps {
  value?: Partial<PreferenceValues>;
  /** Id do usuário atual; guarda as preferências do navegador separadas por pessoa. */
  user_id?: string;
  children: ReactNode;
}

export function PreferencesProvider({ value, user_id, children }: PreferencesProviderProps) {
  const [chosen, setChosen] = useState<{ user_id: string | undefined; layout: CreateLayout }>();
  const saved = useMemo(() => (user_id ? readCreateLayout(user_id) : undefined), [user_id]);
  const create_layout =
    chosen && chosen.user_id === user_id
      ? chosen.layout
      : (saved ?? value?.create_layout ?? defaultPreferences.create_layout);

  // Acompanha a mudança feita em outra aba.
  useEffect(() => {
    if (!user_id) return;
    const key = `${CREATE_LAYOUT_KEY}.${user_id}`;
    function onStorage(event: StorageEvent) {
      if (event.key !== key) return;
      setChosen({
        user_id,
        layout: isCreateLayout(event.newValue) ? event.newValue : defaultPreferences.create_layout,
      });
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [user_id]);

  const set_create_layout = useCallback(
    (layout: CreateLayout) => {
      setChosen({ user_id, layout });
      if (user_id) writeCreateLayout(user_id, layout);
    },
    [user_id],
  );

  const merged = useMemo<Preferences>(
    () => ({ ...defaultPreferences, ...value, create_layout, set_create_layout }),
    [value, create_layout, set_create_layout],
  );
  return <PreferencesContext.Provider value={merged}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
