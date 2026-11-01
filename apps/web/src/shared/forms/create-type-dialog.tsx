import { Button, Dialog } from '@atria/ui';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';
import { usePreferences } from '../preferences/preferences-context';
import styles from './create-type-dialog.module.css';

export interface CreateType {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  href: string;
}

export interface CreateTypeDialogProps {
  types: readonly CreateType[];
  /** Tipo da aba aberta: o cartão que começa com o foco. */
  focused_type?: string;
  open: boolean;
  on_close: () => void;
  /** Título do módulo ("O que você quer registrar?"). */
  title: string;
  description?: string;
  /** Escolha de um tipo; com ela a tela navega pelo roteador em vez do `href`. */
  on_select?: (type: CreateType) => void;
}

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

/**
 * Diálogo centralizado de escolha do tipo ao criar (PD-09), com um cartão por tipo,
 * em grade ou em lista conforme a preferência `create_layout` (PD-10).
 */
export function CreateTypeDialog({
  types,
  focused_type,
  open,
  on_close,
  title,
  description,
  on_select,
}: CreateTypeDialogProps) {
  const t = useT();
  const { create_layout } = usePreferences();
  const base = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const cards = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-create-type]') ?? [],
    );
    (cards.find((card) => card.dataset.createType === focused_type) ?? cards[0])?.focus();
  }, [open, focused_type]);

  function onArrowKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!ARROWS.includes(event.key)) return;
    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-create-type]'),
    );
    const current = cards.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    event.preventDefault();
    const first_top = cards[0]?.getBoundingClientRect().top;
    const columns =
      create_layout === 'list'
        ? 1
        : Math.max(1, cards.filter((c) => c.getBoundingClientRect().top === first_top).length);
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cards.length - 1;
    else if (event.key === 'ArrowRight') next = current + (create_layout === 'list' ? 0 : 1);
    else if (event.key === 'ArrowLeft') next = current - (create_layout === 'list' ? 0 : 1);
    else if (event.key === 'ArrowDown') next = current + columns;
    else next = current - columns;
    cards[Math.min(cards.length - 1, Math.max(0, next))]?.focus();
  }

  return (
    <Dialog
      open={open}
      title={title}
      onClose={on_close}
      size="wide"
      close_on_backdrop
      {...(description ? { described_by: `${base}-description` } : {})}
      actions={<Button onClick={on_close}>{t('common.cancel')}</Button>}
    >
      {description ? (
        <p id={`${base}-description`} className={styles.description}>
          {description}
        </p>
      ) : null}
      {/* Setas, Home e End movem o foco entre os cartões; os cartões são os links. */}
      <div role="presentation" onKeyDown={onArrowKeys}>
        <ul ref={listRef} className={styles.choices} data-layout={create_layout}>
          {types.map((type) => (
            <li key={type.id}>
              <a
                href={type.href}
                className={styles.card}
                data-create-type={type.id}
                onClick={(event) => {
                  if (!on_select) return;
                  event.preventDefault();
                  on_select(type);
                  on_close();
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {type.icon}
                </span>
                <span className={styles.card_title}>{type.label}</span>
                <span className={styles.card_description}>{type.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
