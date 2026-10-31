import { Button, TextField, ViewSwitcher } from '@atria/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { SEARCH_MAX } from '../hooks/use-transactions';
import styles from './finance.module.css';

export type ListView = 'list' | 'grid';

const SEARCH_DELAY_MS = 300;

/** Rascunho da busca: vai para a URL 300 ms depois da última tecla e volta quando a URL muda. */
export function useSearchDraft(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => {
      commit.current(draft);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, value]);
  return [draft, setDraft] as const;
}

export interface ListToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  search_placeholder: string;
  filters?: ReactNode;
  view: ListView;
  onView: (view: ListView) => void;
}

/** Busca, filtros e visualização com os nomes acessíveis "Busca", "Filtros" e "Visualização". */
export function ListToolbar({
  search,
  onSearch,
  search_placeholder,
  filters,
  view,
  onView,
}: ListToolbarProps) {
  const t = useT();
  const [draft, setDraft] = useSearchDraft(search, onSearch);
  return (
    <div className={styles.filters}>
      <div role="search">
        <TextField
          type="search"
          label={t('finance.list.search')}
          placeholder={search_placeholder}
          maxLength={SEARCH_MAX}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
      </div>
      {filters ? (
        <div role="group" aria-label={t('finance.list.filters')} className={styles.filters}>
          {filters}
        </div>
      ) : null}
      <ViewSwitcher
        label={t('finance.list.view')}
        value={view}
        onChange={(next) => {
          onView(next === 'grid' ? 'grid' : 'list');
        }}
        options={[
          { value: 'list', label: t('finance.list.view_list') },
          { value: 'grid', label: t('finance.list.view_grid') },
        ]}
      />
    </div>
  );
}

export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

export interface ChipsProps<V extends string> {
  legend: string;
  value: V;
  options: readonly ChipOption<V>[];
  onChange: (value: V) => void;
}

/** Filtro em chips (PD-13, PD-52): botões com `aria-pressed`. */
export function Chips<V extends string>({ legend, value, options, onChange }: ChipsProps<V>) {
  return (
    <fieldset className={styles.chips}>
      <legend className={styles.chipsLegend}>{legend}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

export function LoadMore({
  visible,
  loading,
  onClick,
}: {
  visible: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const t = useT();
  if (!visible) return null;
  return (
    <div className={styles.more}>
      <Button loading={loading} onClick={onClick}>
        {t('finance.list.load_more')}
      </Button>
    </div>
  );
}
