import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePreferences } from '../preferences/preferences-context';

export type MessageParams = Record<string, string | number>;
type Messages = Record<string, string>;

const registry = new Map<string, Messages>();

export function registerMessages(namespace: string, messages: Messages) {
  registry.set(namespace, { ...registry.get(namespace), ...messages });
}

function lookup(key: string): string | undefined {
  const dot = key.indexOf('.');
  if (dot < 0) return undefined;
  return registry.get(key.slice(0, dot))?.[key.slice(dot + 1)];
}

export function hasMessage(key: string): boolean {
  return lookup(key) !== undefined;
}

const PLURAL = /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^{}]*\}\s*)+)\}/g;
const BRANCH = /(\w+)\s*\{([^{}]*)\}/g;

function applyPlural(text: string, params: MessageParams, locale: string): string {
  return text.replace(PLURAL, (_match, name: string, branches: string) => {
    const count = Number(params[name] ?? 0);
    const category = new Intl.PluralRules(locale).select(count);
    const table = new Map<string, string>();
    for (const branch of branches.matchAll(BRANCH)) {
      table.set(branch[1] ?? '', branch[2] ?? '');
    }
    const chosen = table.get(category) ?? table.get('other') ?? '';
    return chosen.replaceAll('#', new Intl.NumberFormat(locale).format(count));
  });
}

function interpolate(text: string, params: MessageParams): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export type Translate = (key: string, params?: MessageParams) => string;

export function translate(key: string, params: MessageParams = {}, locale = 'pt-BR'): string {
  const raw = lookup(key);
  if (raw === undefined) return key;
  try {
    return interpolate(applyPlural(raw, params, locale), params);
  } catch {
    return key;
  }
}

const I18nContext = createContext<Translate>((key, params) => translate(key, params));

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = usePreferences();
  const t = useCallback<Translate>((key, params) => translate(key, params, locale), [locale]);
  const value = useMemo(() => t, [t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext);
}
