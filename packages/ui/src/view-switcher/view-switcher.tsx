import type { ReactNode } from 'react';
import styles from './view-switcher.module.css';

export interface ViewOption {
  value: string;
  /** Nome acessível e dica do botão. */
  label: string;
  /** Obrigatório: o botão mostra só o ícone (RF-05). */
  icon: ReactNode;
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
          aria-label={option.label}
          title={option.label}
          className={styles.option}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
