export interface SettingsOption {
  value: string;
  label: string;
}

/** Idiomas com tradução no app; hoje só o português do Brasil. */
export function availableLocales(): SettingsOption[] {
  return [{ value: 'pt-BR', label: 'Português (Brasil)' }];
}

function supported(key: 'timeZone' | 'currency'): string[] {
  try {
    return Intl.supportedValuesOf(key);
  } catch {
    return [];
  }
}

/** Garante que o valor atual da pessoa aparece na lista, mesmo que o navegador não o liste. */
function withCurrent(values: string[], current: string | undefined): string[] {
  return current && !values.includes(current) ? [current, ...values] : values;
}

export function timeZoneOptions(current?: string): SettingsOption[] {
  return withCurrent(supported('timeZone'), current).map((zone) => ({
    value: zone,
    label: zone.replaceAll('_', ' '),
  }));
}

export function currencyOptions(locale: string, current?: string): SettingsOption[] {
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames([locale], { type: 'currency' });
  } catch {
    names = undefined;
  }
  return withCurrent(supported('currency'), current).map((code) => {
    const name = names?.of(code);
    return { value: code, label: name && name !== code ? `${name} (${code})` : code };
  });
}
