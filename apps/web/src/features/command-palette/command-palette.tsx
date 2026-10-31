import { useNavigate } from '@tanstack/react-router';
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import './command-palette.css';
import { hasMessage, useT } from '../../shared/i18n/i18n';
import { ContextChips } from './context-chips';
import {
  CREATE_ACTIONS,
  GO_ACTIONS,
  contextPath,
  editPath,
  entityPath,
  type PaletteAction,
  type QuickKind,
} from './palette-actions';
import { parseQuery } from './parse-query';
import { QuickCreate } from './quick-create';
import { useCommandPalette, useRestoreFocus } from './use-command-palette';
import { usePaletteSearch, usePaletteSettings } from './use-palette-search';
import { useRecentItems } from './use-recent-items';

interface Row {
  id: string;
  group: string;
  label: string;
  hint: string;
  run: () => void;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Diálogo da paleta de comandos: busca, recentes, ações e criação rápida (RF-15 a RF-17). */
export function CommandPalette() {
  const t = useT();
  const navigate = useNavigate();
  const { close } = useCommandPalette();
  useRestoreFocus();
  const settings = usePaletteSettings();
  const recents = useRecentItems();
  const base_id = useId();
  const list_id = `${base_id}-list`;
  const title_id = `${base_id}-title`;
  const box = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [quick, setQuick] = useState<QuickKind | null>(null);

  // Foco no campo ao abrir e ao voltar da criação rápida.
  useEffect(() => {
    if (quick === null) input.current?.focus();
  }, [quick]);

  // Teclado e mouse fora do diálogo: Esc fecha mesmo com o foco fora (por exemplo, depois de
  // criar), Tab fica preso no diálogo e o clique no fundo fecha.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || box.current === null) return;
      const focusable = Array.from(
        box.current.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const current = document.activeElement;
      const inside = current !== null && box.current.contains(current);
      if (!inside || (event.shiftKey && current === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function onMouseDown(event: MouseEvent) {
      if (event.target instanceof Node && event.target === overlay.current) close();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [close]);

  const contexts = chosen ?? settings.search_contexts;
  const parsed = parseQuery(text);
  const search = usePaletteSearch({ text, contexts, enabled: settings.ready });

  function go(path: string) {
    close();
    void navigate({ to: path });
  }

  function actionRow(action: PaletteAction, group: string): Row {
    if (action.type === 'create') {
      return {
        id: action.id,
        group,
        label: t(action.label_key),
        hint: t('command_palette.actions_title'),
        run: () => {
          setQuick(action.kind);
        },
      };
    }
    const module = t(`command_palette.context.${action.context}`);
    return {
      id: action.id,
      group,
      label: t(action.label_key, { module }),
      hint: module,
      run: () => {
        go(contextPath(action.context));
      },
    };
  }

  const actions_group = t('command_palette.actions_title');
  const all_actions = [...CREATE_ACTIONS, ...GO_ACTIONS];
  const matching_actions = (limit: number) =>
    all_actions
      .map((action) => actionRow(action, actions_group))
      .filter((row) => normalize(row.label).includes(normalize(parsed.term)))
      .slice(0, limit);

  const rows: Row[] = [];
  if (parsed.mode === 'actions') {
    rows.push(...matching_actions(all_actions.length));
  } else if (text.trim() === '') {
    for (const item of recents.items) {
      rows.push({
        id: `recent_${item.id}`,
        group: t('command_palette.recent_title'),
        label: item.title,
        hint: item.type,
        run: () => {
          go(entityPath(item.type, item.id));
        },
      });
    }
    const create_group = t('command_palette.create_title');
    rows.push(...CREATE_ACTIONS.map((action) => actionRow(action, create_group)));
  } else {
    for (const group of search.groups) {
      const key = `command_palette.context.${group.context}`;
      const label = hasMessage(key) ? t(key) : group.context;
      for (const hit of group.items) {
        rows.push({
          id: `hit_${hit.entity_type}_${hit.id}`,
          group: label,
          label: hit.title,
          hint: hit.snippet ?? '',
          run: () => {
            recents.add({ id: hit.id, type: hit.entity_type, title: hit.title });
            go(
              hit.entity_type === 'project_card' && hit.project_id
                ? `/projects/${hit.project_id}/cards/${hit.id}`
                : entityPath(hit.entity_type, hit.id),
            );
          },
        });
      }
    }
    if (parsed.mode === 'all') rows.push(...matching_actions(4));
  }

  const active = rows.length === 0 ? 0 : Math.min(selected, rows.length - 1);
  const option_id = (index: number) => `${base_id}-opt-${String(index)}`;

  let status: { kind: 'loading' | 'error' | 'empty'; key: string } | null = null;
  if (search.failed) status = { kind: 'error', key: 'command_palette.error' };
  else if (search.loading && rows.length === 0)
    status = { kind: 'loading', key: 'command_palette.loading' };
  else if (rows.length === 0 && text.trim() !== '')
    status = { kind: 'empty', key: 'command_palette.no_results' };

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelected((active + step + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      rows[active]?.run();
    }
  }

  let last_group: string | null = null;
  return (
    <div ref={overlay} className="command-palette-overlay">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title_id}
        className="command-palette-box"
      >
        <h2 id={title_id} className="command-palette-sr">
          {t('command_palette.dialog_label')}
        </h2>
        {quick !== null ? (
          <QuickCreate
            kind={quick}
            onBack={() => {
              setQuick(null);
            }}
            onOpenToComplete={(kind, id) => {
              go(editPath(kind, id));
            }}
          />
        ) : (
          <>
            <input
              type="text"
              role="combobox"
              className="command-palette-input"
              aria-label={t('command_palette.input_label')}
              aria-expanded={rows.length > 0}
              aria-controls={rows.length > 0 ? list_id : undefined}
              aria-activedescendant={rows.length > 0 ? option_id(active) : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder={t('command_palette.input_placeholder')}
              value={text}
              ref={input}
              onChange={(event) => {
                setText(event.target.value);
                setSelected(0);
              }}
              onKeyDown={onInputKeyDown}
            />
            <ContextChips
              selected={contexts}
              onChange={(next) => {
                setChosen(next);
                setSelected(0);
              }}
            />
            {parsed.mode === 'tags' && rows.length > 0 ? (
              <p className="command-palette-group">{t('command_palette.tags_title')}</p>
            ) : null}
            {rows.length > 0 ? (
              <ul
                id={list_id}
                role="listbox"
                aria-label={t('command_palette.results_title')}
                className="command-palette-list"
              >
                {rows.map((row, index) => {
                  const heading = row.group !== last_group;
                  last_group = row.group;
                  return (
                    <Fragment key={row.id}>
                      {heading ? (
                        <li role="presentation" className="command-palette-group">
                          {row.group}
                        </li>
                      ) : null}
                      {/* O teclado é tratado no campo (combobox); o clique é só do mouse. */}
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                      <li
                        id={option_id(index)}
                        role="option"
                        aria-selected={index === active}
                        className="command-palette-option"
                        onMouseEnter={() => {
                          setSelected(index);
                        }}
                        onClick={row.run}
                      >
                        <span>{row.label}</span>
                        <span className="command-palette-hint">{row.hint}</span>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            ) : null}
            {status !== null ? (
              <p
                className="command-palette-state"
                role={status.kind === 'error' ? 'alert' : 'status'}
              >
                {t(status.key)}
              </p>
            ) : null}
            <p className="command-palette-foot">
              <span role="status">
                {rows.length > 0 && text.trim() !== ''
                  ? t('command_palette.result_count', { count: rows.length })
                  : ''}
              </span>{' '}
              {t('command_palette.navigate_hint')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
