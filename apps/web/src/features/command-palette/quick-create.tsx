import { Button, TextField } from '@atria/ui';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import type { QuickKind } from './palette-actions';
import { useQuickCreate } from './use-quick-create';

export interface QuickCreateProps {
  kind: QuickKind;
  /** Leva à tela própria da entidade criada ("abrir para completar"). */
  onOpenToComplete: (kind: QuickKind, id: string) => void;
  onBack: () => void;
}

/** Criação rápida: só o título; sem abrir, a entidade fica salva com os campos mínimos (FA-05). */
export function QuickCreate({ kind, onOpenToComplete, onBack }: QuickCreateProps) {
  const t = useT();
  const [title, setTitle] = useState('');
  const { create, created, saving } = useQuickCreate(kind);
  const root = useRef<HTMLDivElement>(null);

  // Foco no título e, depois de criar, no painel, para o teclado não se perder fora da paleta.
  const has_created = created !== null;
  useEffect(() => {
    if (has_created) root.current?.focus();
    else root.current?.querySelector('input')?.focus();
  }, [has_created]);

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    create(title);
  }

  return (
    <div ref={root} tabIndex={-1} className="command-palette-quick">
      <p className="command-palette-group">{t(`command_palette.kind.${kind}`)}</p>
      {created === null ? (
        <form onSubmit={onSubmit} className="command-palette-quick-form">
          <TextField
            label={t('command_palette.quick_create_title_label')}
            help={t('command_palette.quick_create_hint')}
            value={title}
            autoComplete="off"
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
          <div className="command-palette-quick-actions">
            <Button type="submit" variant="primary" disabled={title.trim() === ''}>
              {t('command_palette.quick_create_save')}
            </Button>
            <Button variant="ghost" onClick={onBack}>
              {t('command_palette.quick_create_back')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="command-palette-quick-form">
          <p role="status">{t('command_palette.created_notice', { title: created.title })}</p>
          <div className="command-palette-quick-actions">
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => {
                onOpenToComplete(created.kind, created.id);
              }}
            >
              {t('command_palette.open_to_complete')}
            </Button>
            <Button variant="ghost" onClick={onBack}>
              {t('command_palette.quick_create_back')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
