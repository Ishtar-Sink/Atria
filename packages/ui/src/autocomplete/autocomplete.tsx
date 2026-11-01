// Combobox editável com lista (padrão da WAI-ARIA): o foco fica sempre no campo e a opção ativa é
// apontada por `aria-activedescendant`. A busca ignora maiúsculas e acentos porque as categorias
// têm nome livre ("saude" acha "Saúde").
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './autocomplete.module.css';

export interface AutocompleteOption<T extends string | number> {
  value: T;
  label: string;
}

interface AutocompleteBaseProps<T extends string | number> {
  label: string;
  options: readonly AutocompleteOption<T>[];
  /** Texto mostrado quando nenhuma opção combina com o que foi digitado. */
  empty_text: string;
  placeholder?: string;
  help?: string;
  error?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
}

export interface AutocompleteSingleProps<
  T extends string | number,
> extends AutocompleteBaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T | null) => void;
}

export interface AutocompleteMultipleProps<
  T extends string | number,
> extends AutocompleteBaseProps<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Nome da lista de pílulas: "{label} escolhidas". */
  list_label: string;
  /** Nome do "×" de cada pílula: "Remover {opção}". */
  remove_label: (label: string) => string;
}

export type AutocompleteProps<T extends string | number> =
  AutocompleteSingleProps<T> | AutocompleteMultipleProps<T>;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

// Sobrecargas: com a união `AutocompleteProps<T>` direta o TypeScript não infere `T` a partir de
// `value` e `options` e cai em `string | number`.
export function Autocomplete<T extends string | number>(
  props: AutocompleteSingleProps<T>,
): React.JSX.Element;
export function Autocomplete<T extends string | number>(
  // eslint-disable-next-line @typescript-eslint/unified-signatures -- unir as sobrecargas perde a inferência de T
  props: AutocompleteMultipleProps<T>,
): React.JSX.Element;
export function Autocomplete<T extends string | number>(props: AutocompleteProps<T>) {
  const { label, options, empty_text, placeholder, help, error, id, className, disabled, name } =
    props;
  const multiple = props.multiple === true;
  const generated = useId();
  const controlId = id ?? generated;
  const labelId = `${controlId}-label`;
  const listId = `${controlId}-list`;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ');

  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // `editing` é verdadeiro depois da primeira digitação: antes disso o campo ainda mostra o valor.
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);

  const chosen: readonly T[] = props.multiple
    ? props.value
    : props.value === null
      ? []
      : [props.value];
  const single = props.multiple ? undefined : options.find((o) => o.value === props.value);
  const filtered = editing
    ? options.filter((option) => normalize(option.label).includes(normalize(query)))
    : options;
  const hasList = open && filtered.length > 0;
  const activeId = hasList && filtered[active] ? `${listId}-${String(active)}` : undefined;
  const text = editing ? query : multiple ? '' : (single?.label ?? '');

  function close() {
    setOpen(false);
    setEditing(false);
    setQuery('');
  }

  function openList() {
    if (disabled) return;
    setActive(0);
    setOpen(true);
  }

  function choose(option: AutocompleteOption<T>) {
    if (props.multiple) {
      const next = props.value.includes(option.value)
        ? props.value.filter((v) => v !== option.value)
        : [...props.value, option.value];
      props.onChange(next);
      setEditing(false);
      setQuery('');
      setActive(Math.max(0, options.indexOf(option)));
    } else {
      if (option.value !== props.value) props.onChange(option.value);
      close();
    }
  }

  function remove(value: T) {
    if (!props.multiple) return;
    props.onChange(props.value.filter((v) => v !== value));
    input.current?.focus();
  }

  useLayoutEffect(() => {
    if (!hasList || !popup.current || !root.current) return;
    const box = root.current.getBoundingClientRect();
    const room = window.innerHeight - box.bottom;
    setAbove(room < popup.current.offsetHeight + 8 && box.top > room);
  }, [open, filtered.length, hasList]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${String(active)}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setEditing(true);
    setActive(0);
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openList();
      } else if (event.key === 'Backspace' && props.multiple && text === '' && chosen.length > 0) {
        props.onChange(props.value.slice(0, -1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
      }
      return;
    }
    const last = filtered.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(last, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = filtered[active];
        if (option) choose(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        close();
        break;
      case 'Backspace':
        if (props.multiple && text === '' && chosen.length > 0) {
          props.onChange(props.value.slice(0, -1));
        }
        break;
      default:
    }
  }

  const rootClasses = [styles.root, className].filter(Boolean).join(' ');
  const popupClasses = [styles.popup, above ? styles.above : ''].filter(Boolean).join(' ');
  return (
    <div className={rootClasses} ref={root}>
      <label id={labelId} htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          ref={input}
          id={controlId}
          type="text"
          role="combobox"
          autoComplete="off"
          className={styles.control}
          aria-autocomplete="list"
          aria-expanded={hasList}
          aria-controls={hasList ? listId : undefined}
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          placeholder={placeholder}
          disabled={disabled}
          value={text}
          onChange={onInputChange}
          onClick={() => {
            if (open || disabled) return;
            openList();
            input.current?.select();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!open) props.onBlur?.();
          }}
        />
        <span className={styles.chevron}>
          <Chevron />
        </span>
        {open ? (
          <div ref={popup} className={popupClasses}>
            {hasList ? (
              <ul
                id={listId}
                role="listbox"
                aria-labelledby={labelId}
                aria-multiselectable={multiple ? true : undefined}
                className={styles.list}
              >
                {filtered.map((option, index) => {
                  const selected = chosen.includes(option.value);
                  return (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <li
                      key={String(option.value)}
                      id={`${listId}-${String(index)}`}
                      role="option"
                      aria-selected={selected}
                      className={[styles.option, index === active ? styles.active : '']
                        .filter(Boolean)
                        .join(' ')}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onMouseMove={() => {
                        if (index !== active) setActive(index);
                      }}
                      onClick={() => {
                        choose(option);
                      }}
                    >
                      {option.label}
                      {multiple && selected ? (
                        <span className={styles.check}>
                          <Check />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p role="status" className={styles.empty}>
                {empty_text}
              </p>
            )}
          </div>
        ) : null}
      </div>
      {props.multiple && props.value.length > 0 ? (
        <ul aria-label={props.list_label} className={styles.pills}>
          {props.value.map((value) => {
            const optionLabel = options.find((o) => o.value === value)?.label ?? String(value);
            return (
              <li key={String(value)} className={styles.pill}>
                {optionLabel}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={props.remove_label(optionLabel)}
                  disabled={disabled}
                  onClick={() => {
                    remove(value);
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {name
        ? chosen.map((value) => (
            <input key={String(value)} type="hidden" name={name} value={String(value)} />
          ))
        : null}
      {name && !props.multiple && props.value === null ? (
        <input type="hidden" name={name} value="" />
      ) : null}
      {help ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
