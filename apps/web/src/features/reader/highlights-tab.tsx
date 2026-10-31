import { Badge, EmptyState, ErrorState, LoadingState } from '@atria/ui';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { useHighlights } from './use-highlights';
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
    <ul aria-label={t('reader.highlights_list')} className={styles.highlightList}>
      {items.map((item) => (
        <li key={item.id} className={styles.highlightItem}>
          <div className={styles.highlightMeta}>
            <span className={styles.dot} data-color={item.color} aria-hidden="true" />
            <span>{t(`reader.highlight_color_${item.color}`)}</span>
            <span>{t('reader.highlights_page', { page: item.page })}</span>
            {item.is_current_file ? null : (
              <Badge tone="warning">{t('reader.highlights_other_file')}</Badge>
            )}
          </div>
          <p>{item.text}</p>
        </li>
      ))}
    </ul>
  );
}
