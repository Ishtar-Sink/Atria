import type { ReactNode } from 'react';
import styles from './view-switcher.module.css';

export interface ViewOption {
  value: string;
  /** Nome acessível; também é o texto do botão quando não há ícone. */
  label: string;
  icon?: ReactNode;
}

export interface ViewSwitcherProps {
  label: string;
  options: readonly ViewOption[];
  value: string;
  onChange: (value: string) => void;
}

export function ViewSwitcher({ label, options, value, onChange }: ViewSwitcherProps) {
  return (
    <div role="group" aria-label={label} className={styles.root}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.icon ? option.label : undefined}
          className={styles.option}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.icon ? <span aria-hidden="true">{option.icon}</span> : option.label}
        </button>
      ))}
    </div>
  );
}
