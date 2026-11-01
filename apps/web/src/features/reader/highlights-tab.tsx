import {
  Badge,
  Button,
  ColorField,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@atria/ui';
import { useState, type CSSProperties } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import {
  HIGHLIGHT_PRESETS,
  highlightColorName,
  normalizeHex,
  useChangeHighlightColor,
  useDeleteHighlight,
  useHighlightColorLabels,
  useHighlights,
  type Highlight,
} from './use-highlights';
import type { ReaderItemType } from './use-pdf-document';

registerMessages('reader', messages);

export interface HighlightsTabProps {
  item_type: ReaderItemType;
  item_id: string;
}

/** Aba "Destaques" do livro ou do artigo; a TASK-35 a monta na tela do item (RF-69). */
export function HighlightsTab({ item_type, item_id }: HighlightsTabProps) {
  const t = useT();
  const highlights = useHighlights(item_type, item_id);
  const labels = useHighlightColorLabels();
  const change = useChangeHighlightColor(item_type, item_id);
  const remove = useDeleteHighlight(item_type, item_id);
  const [removing, setRemoving] = useState<Highlight>();

  if (highlights.isPending) return <LoadingState label={t('reader.highlights_loading')} />;
  if (highlights.isError) return <ErrorState title={t('reader.highlights_error')} />;
  const items = [...highlights.data.items].sort((a, b) => a.page - b.page);
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('reader.highlights_empty')}
        description={t('reader.highlights_empty_description')}
      />
    );
  }
  return (
    <>
      <ul aria-label={t('reader.highlights_list')} className={styles.highlightList}>
        {items.map((item) => {
          const pending = item.id.startsWith('temp-');
          return (
            <li key={item.id} className={styles.highlightItem}>
              <div className={styles.highlightMeta}>
                <span
                  className={styles.dot}
                  data-color={item.color}
                  style={{ '--swatch-color': item.color } as CSSProperties}
                  aria-hidden="true"
                />
                <span>{highlightColorName(item.color, t)}</span>
                <span>{t('reader.highlights_page', { page: item.page })}</span>
                {item.is_current_file ? null : (
                  <Badge tone="warning">{t('reader.highlights_other_file')}</Badge>
                )}
              </div>
              <p>{item.text}</p>
              <div className={styles.highlightActions}>
                <div
                  role="group"
                  aria-label={t('reader.highlight_color_group', { page: item.page })}
                  className={styles.highlightColors}
                >
                  <fieldset disabled={pending} className={styles.pickerFieldset}>
                    {HIGHLIGHT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={styles.swatch}
                        data-color={preset.hex}
                        style={{ '--swatch-color': preset.hex } as CSSProperties}
                        aria-pressed={item.color === preset.hex}
                        aria-label={t('reader.highlight_change_to', {
                          color: t(`reader.highlight_color_${preset.name}`),
                        })}
                        onClick={() => {
                          if (item.color !== preset.hex)
                            change.mutate({ highlight_id: item.id, color: preset.hex });
                        }}
                      />
                    ))}
                    <ColorField
                      label={t('reader.highlight_change_other')}
                      value={item.color}
                      labels={labels}
                      className={styles.highlightPicker}
                      onChange={(hex) => {
                        const color = normalizeHex(hex);
                        if (color !== item.color) change.mutate({ highlight_id: item.id, color });
                      }}
                    />
                  </fieldset>
                </div>
                <Button
                  variant="ghost"
                  disabled={pending}
                  aria-label={t('reader.highlight_delete_label', { page: item.page })}
                  onClick={() => {
                    setRemoving(item);
                  }}
                >
                  {t('reader.highlight_delete')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={removing !== undefined}
        title={t('reader.highlight_delete_title')}
        description={t('reader.highlight_delete_text')}
        confirmLabel={t('reader.highlight_delete_confirm')}
        cancelLabel={t('reader.highlight_delete_cancel')}
        onCancel={() => {
          setRemoving(undefined);
        }}
        onConfirm={() => {
          if (removing) remove.mutate({ highlight_id: removing.id });
          setRemoving(undefined);
        }}
      />
    </>
  );
}
