import type { ReactNode } from 'react';
import { TextField } from '../text-field/text-field';
import styles from './toolbar.module.css';

export interface ToolbarProps {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Campos de filtro da tela. */
  filters?: ReactNode;
  /** Normalmente o `ViewSwitcher`. */
  children?: ReactNode;
}

export function Toolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  children,
}: ToolbarProps) {
  return (
    <div className={styles.root}>
      <div role="search" className={styles.search}>
        <TextField
          type="search"
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
        />
      </div>
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      {children ? <div className={styles.trailing}>{children}</div> : null}
    </div>
  );
}
