import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import styles from './menu-button.module.css';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'danger';
  href?: string;
  onSelect?: () => void;
}

export interface MenuButtonProps {
  /** Nome acessível do botão. */
  label: string;
  /** Conteúdo visível do botão. */
  trigger: ReactNode;
  items: readonly MenuItem[];
  placement?: 'bottom-end' | 'right-end';
  className?: string;
  /** Classe do botão. */
  triggerClassName?: string;
}

export function MenuButton({
  label,
  trigger,
  items,
  placement = 'bottom-end',
  className,
  triggerClassName,
}: MenuButtonProps) {
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const entries = () =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function close(focus: boolean) {
    setOpen(false);
    if (focus) button.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = entries();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        list[(index + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        list[0]?.focus();
        break;
      case 'End':
        list[list.length - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  function select(item: MenuItem) {
    close(true);
    item.onSelect?.();
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} ref={root}>
      <button
        ref={button}
        type="button"
        className={triggerClassName ?? styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={label}
          className={[styles.menu, placement === 'right-end' ? styles.right : styles.bottom].join(
            ' ',
          )}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => {
            const props = {
              role: 'menuitem',
              tabIndex: -1,
              className: [styles.item, item.tone === 'danger' ? styles.danger : '']
                .filter(Boolean)
                .join(' '),
              ...(item.tone ? { 'data-tone': item.tone } : {}),
            };
            const content = (
              <>
                {item.icon ? (
                  <span aria-hidden="true" className={styles.icon}>
                    {item.icon}
                  </span>
                ) : null}
                <span>{item.label}</span>
              </>
            );
            return item.href ? (
              <a
                key={item.id}
                {...props}
                href={item.href}
                onClick={(event) => {
                  if (item.onSelect && !event.metaKey && !event.ctrlKey) {
                    event.preventDefault();
                    select(item);
                  } else {
                    setOpen(false);
                  }
                }}
              >
                {content}
              </a>
            ) : (
              <button
                key={item.id}
                type="button"
                {...props}
                onClick={() => {
                  select(item);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
