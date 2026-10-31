import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreferencesProvider } from '../preferences/preferences-context';
import { I18nProvider, registerMessages, useT } from './i18n';

function Probe({ id, params }: { id: string; params?: Record<string, string | number> }) {
  const t = useT();
  return <p>{t(id, params)}</p>;
}

function renderProbe(id: string, params?: Record<string, string | number>) {
  render(
    <PreferencesProvider>
      <I18nProvider>
        <Probe id={id} {...(params ? { params } : {})} />
      </I18nProvider>
    </PreferencesProvider>,
  );
}

describe('i18n', () => {
  it('translates a registered key with params', () => {
    registerMessages('demo', { hello: 'Olá, {name}!' });
    renderProbe('demo.hello', { name: 'Ana' });
    expect(screen.getByText('Olá, Ana!')).toBeInTheDocument();
  });

  it('uses Intl.PluralRules for counts', () => {
    registerMessages('demo', { items: '{count, plural, one {# item} other {# itens}}' });
    renderProbe('demo.items', { count: 1 });
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('falls back to the key and never throws', () => {
    renderProbe('demo.missing');
    expect(screen.getByText('demo.missing')).toBeInTheDocument();
  });
});
