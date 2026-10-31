import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
  /** Nome acessível do botão. Sem ele, o botão é nomeado pelo próprio conteúdo visível. */
  label?: string;
  /** Rótulo do menu aberto. Padrão: `label`. */
  menuLabel?: string;
  /** Conteúdo visível do botão. */
  trigger: ReactNode;
  items: readonly MenuItem[];
  placement?: 'bottom-end' | 'right-end';
  className?: string;
  /** Classe extra do menu aberto, para quem precisa de um visual próprio (ex.: menu da conta). */
  menuClassName?: string;
  /** Classe do botão. */
  triggerClassName?: string;
}

export function MenuButton({
  label,
  menuLabel,
  trigger,
  items,
  placement = 'bottom-end',
  className,
  menuClassName,
  triggerClassName,
}: MenuButtonProps) {
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [alignStart, setAlignStart] = useState(false);

  // Ancorado à direita do gatilho; se vazar pela borda esquerda da janela, alinha à esquerda.
  useLayoutEffect(() => {
    if (!open) {
      setAlignStart(false);
      return;
    }
    if (placement === 'bottom-end' && (menu.current?.getBoundingClientRect().left ?? 0) < 0) {
      setAlignStart(true);
    }
  }, [open, placement]);

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
          aria-label={menuLabel ?? label}
          className={[
            styles.menu,
            placement === 'right-end' ? styles.right : styles.bottom,
            alignStart ? styles.alignStart : '',
            menuClassName,
          ]
            .filter(Boolean)
            .join(' ')}
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
