import { useT } from '../../shared/i18n/i18n';
import { SEARCH_CONTEXTS } from './palette-actions';

export interface ContextChipsProps {
  /** Contextos em vigor; vazio é "tudo". */
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

/** Escolha dos contextos da busca (RF-16): botões alternáveis, "Tudo" limpa a escolha. */
export function ContextChips({ selected, onChange }: ContextChipsProps) {
  const t = useT();
  function toggle(context: string) {
    onChange(
      selected.includes(context)
        ? selected.filter((item) => item !== context)
        : [...selected, context],
    );
  }
  return (
    <div
      role="group"
      aria-label={t('command_palette.contexts_label')}
      className="command-palette-chips"
    >
      <button
        type="button"
        className="command-palette-chip"
        aria-pressed={selected.length === 0}
        onClick={() => {
          onChange([]);
        }}
      >
        {t('command_palette.all_contexts')}
      </button>
      {SEARCH_CONTEXTS.map((context) => (
        <button
          key={context}
          type="button"
          className="command-palette-chip"
          aria-pressed={selected.includes(context)}
          onClick={() => {
            toggle(context);
          }}
        >
          {t(`command_palette.context.${context}`)}
        </button>
      ))}
    </div>
  );
}
