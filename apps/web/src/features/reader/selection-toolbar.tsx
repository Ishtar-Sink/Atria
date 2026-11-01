import { Button, ColorField } from '@atria/ui';
import { useState, type CSSProperties } from 'react';
import { registerMessages, useT } from '../../shared/i18n/i18n';
import messages from './i18n/pt-br.json';
import styles from './reader.module.css';
import { HIGHLIGHT_PRESETS, normalizeHex, useHighlightColorLabels } from './use-highlights';

registerMessages('reader', messages);

export interface SelectionToolbarProps {
  can_highlight: boolean;
  onNote: () => void;
  onHighlight: (hex: string) => void;
  onPickColor: () => void;
}

/** Ações sobre o trecho selecionado; os botões não tiram a seleção (mousedown cancelado). */
export function SelectionToolbar({
  can_highlight,
  onNote,
  onHighlight,
  onPickColor,
}: SelectionToolbarProps) {
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
      {can_highlight ? (
        <>
          {HIGHLIGHT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={styles.swatch}
              data-color={preset.hex}
              style={{ '--swatch-color': preset.hex } as CSSProperties}
              aria-label={t('reader.highlight_with', {
                color: t(`reader.highlight_color_${preset.name}`),
              })}
              onClick={() => {
                onHighlight(preset.hex);
              }}
            />
          ))}
          <Button
            variant="ghost"
            aria-label={t('reader.highlight_other_label')}
            onClick={onPickColor}
          >
            {t('reader.highlight_other')}
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** Painel para destacar o trecho guardado numa cor livre, escolhida no color picker (RF-19). */
export function HighlightColorPanel({
  value,
  onApply,
  onCancel,
}: {
  value: string;
  onApply: (hex: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const labels = useHighlightColorLabels();
  const [draft, setDraft] = useState(value);
  return (
    <div role="group" aria-label={t('reader.highlight_panel_label')} className={styles.selection}>
      <ColorField
        label={t('reader.highlight_panel_color')}
        value={draft}
        onChange={setDraft}
        labels={labels}
      />
      <Button
        variant="primary"
        onClick={() => {
          onApply(normalizeHex(draft));
        }}
      >
        {t('reader.highlight_panel_apply')}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        {t('reader.highlight_panel_cancel')}
      </Button>
    </div>
  );
}
