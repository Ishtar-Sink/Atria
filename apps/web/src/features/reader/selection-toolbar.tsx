import { Button } from '@atria/ui';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { HIGHLIGHT_COLORS, type HighlightColor } from './use-highlights';

registerMessages('reader', messages);

export interface SelectionToolbarProps {
  can_highlight: boolean;
  onNote: () => void;
  onHighlight: (color: HighlightColor) => void;
}

/** Ações sobre o trecho selecionado; os botões não tiram a seleção (mousedown cancelado). */
export function SelectionToolbar({ can_highlight, onNote, onHighlight }: SelectionToolbarProps) {
  const t = useT();
  return (
    <div
      role="toolbar"
      aria-label={t('reader.selection_toolbar_label')}
      className={styles.selection}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <Button variant="primary" onClick={onNote}>
        {t('reader.create_note')}
      </Button>
      {can_highlight
        ? HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={styles.swatch}
              data-color={color}
              aria-label={t('reader.highlight_with', {
                color: t(`reader.highlight_color_${color}`),
              })}
              onClick={() => {
                onHighlight(color);
              }}
            />
          ))
        : null}
    </div>
  );
}
