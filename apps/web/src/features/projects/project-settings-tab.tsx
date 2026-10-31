import { Button, Checkbox, ErrorState, LoadingState } from '@atria/ui';
import { Link } from '@tanstack/react-router';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useT } from '../../shared/i18n/i18n';
import { DeleteLaneDialog } from './delete-lane-dialog';
import { HandleIcon, PlusIcon } from './icons';
import styles from './projects.module.css';
import { laneLabel, useCards, useLanes, useReorderLanes, useUpdateLane } from './use-kanban';
import type { Lane, Project } from './use-projects';

/** Mover a raia uma posição para cima ou para baixo; fora dos limites, a ordem não muda. */
function shifted(ids: readonly string[], id: string, offset: number): string[] | undefined {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return undefined;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Aba Configurações: a seção Raias (RF-56, PD-43, PD-47). */
export function ProjectSettingsTab({ project }: { project: Project }) {
  const t = useT();
  const lanes = useLanes(project.id);
  const cards = useCards(project.id);
  const update = useUpdateLane(project.id);
  const reorder = useReorderLanes(project.id);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const focus_id = useRef<string>(undefined);
  const [order, setOrder] = useState<string[]>();
  const [dragging_id, setDraggingId] = useState<string>();
  const [deleting, setDeleting] = useState<Lane>();
  const [announcement, setAnnouncement] = useState('');

  // Depois de reordenar pelo teclado, o foco volta ao puxador da raia que mudou de lugar.
  useEffect(() => {
    if (focus_id.current === undefined) return;
    handles.current.get(focus_id.current)?.focus();
    focus_id.current = undefined;
  }, [lanes.data]);

  if (lanes.isPending) return <LoadingState label={t('projects.settings.loading')} />;
  if (lanes.isError) {
    return (
      <ErrorState
        title={t('projects.settings.error_title')}
        description={t('projects.settings.error')}
        retryLabel={t('projects.list.retry')}
        onRetry={() => {
          void lanes.refetch();
        }}
      />
    );
  }

  const stored = lanes.data;
  const stored_ids = stored.map((lane) => lane.id);
  const shown = order ? order.flatMap((id) => stored.filter((lane) => lane.id === id)) : stored;
  const only = stored.length === 1;

  function commit(next: string[], moved: Lane) {
    setAnnouncement(
      t('projects.settings.moved', {
        lane: laneLabel(moved, t),
        position: next.indexOf(moved.id) + 1,
        total: next.length,
      }),
    );
    reorder.mutate(
      { lane_ids: next },
      {
        onSettled: () => {
          setOrder(undefined);
        },
      },
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, lane: Lane) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const next = shifted(stored_ids, lane.id, event.key === 'ArrowUp' ? -1 : 1);
    if (!next) return;
    focus_id.current = lane.id;
    commit(next, lane);
  }

  // Arrastar pelo puxador: a linha acompanha o ponteiro e as outras abrem espaço (PD-47).
  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, lane: Lane) {
    if (event.button !== 0) return;
    event.preventDefault();
    const row = rows.current.get(lane.id);
    if (!row) return;
    const start_y = event.clientY;
    const start_top = row.getBoundingClientRect().top;
    let current = stored_ids;
    let translate = 0;
    setDraggingId(lane.id);
    setOrder(current);

    const move = (pointer: PointerEvent) => {
      const others = current.filter((id) => id !== lane.id);
      const index = others.filter((id) => {
        const box = rows.current.get(id)?.getBoundingClientRect();
        return box !== undefined && box.top + box.height / 2 < pointer.clientY;
      }).length;
      const next = [...others];
      next.splice(index, 0, lane.id);
      if (next.join() !== current.join()) {
        current = next;
        setOrder(next);
      }
      const natural = row.getBoundingClientRect().top - translate;
      translate = start_top + (pointer.clientY - start_y) - natural;
      row.style.transform = `translateY(${String(translate)}px)`;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      row.style.transform = '';
      setDraggingId(undefined);
      if (current.join() === stored_ids.join()) setOrder(undefined);
      else commit(current, lane);
    };
    // Ouve na janela: mover a linha no DOM solta a captura do ponteiro e o `pointerup` se perderia.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  return (
    <section className={styles.stack} aria-labelledby="project-lanes-title">
      <div className={styles.actions}>
        <div>
          <h2 id="project-lanes-title" className={styles.cardTitle}>
            {t('projects.settings.lanes_title')}
          </h2>
          <p className={styles.hint}>{t('projects.settings.lanes_text')}</p>
        </div>
        <Link
          to={`/projects/${project.id}/lanes/new`}
          className={[styles.linkButton, styles.linkPrimary].join(' ')}
        >
          <PlusIcon />
          {t('projects.settings.new_lane')}
        </Link>
      </div>
      <p className={styles.hint}>{t('projects.settings.reorder_hint')}</p>
      <ul className={styles.laneRows}>
        {shown.map((lane, index) => {
          const name = laneLabel(lane, t);
          const count = (cards.data ?? []).filter((card) => card.lane_id === lane.id).length;
          return (
            <li
              key={lane.id}
              ref={(node) => {
                if (node) rows.current.set(lane.id, node);
                else rows.current.delete(lane.id);
              }}
              className={[styles.laneRow, dragging_id === lane.id ? styles.laneRowDragging : '']
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                ref={(node) => {
                  if (node) handles.current.set(lane.id, node);
                  else handles.current.delete(lane.id);
                }}
                className={styles.handle}
                style={{ background: `color-mix(in srgb, ${lane.color} 35%, var(--surface))` }}
                aria-label={t('projects.settings.reorder_handle', {
                  lane: name,
                  position: index + 1,
                  total: shown.length,
                })}
                onKeyDown={(event) => {
                  onKeyDown(event, lane);
                }}
                onPointerDown={(event) => {
                  onPointerDown(event, lane);
                }}
              >
                <HandleIcon />
              </button>
              <div className={styles.laneTitle}>
                {name}
                <span className={styles.hint}> · {t('projects.board.count', { count })}</span>
              </div>
              <span className={styles.laneColor}>
                <span className={styles.dot} style={{ background: lane.color }} />
                {lane.color}
              </span>
              <Checkbox
                label={t('projects.settings.counts_as_done')}
                aria-label={t('projects.settings.counts_as_done_of', { lane: name })}
                checked={lane.counts_as_done}
                onChange={(event) => {
                  update.mutate({
                    lane_id: lane.id,
                    patch: { counts_as_done: event.target.checked },
                  });
                }}
              />
              <div className={styles.actions}>
                <Link
                  to={`/projects/${project.id}/lanes/${lane.id}/edit`}
                  className={styles.linkButton}
                  aria-label={t('projects.settings.edit_lane', { lane: name })}
                >
                  {t('projects.settings.edit')}
                </Link>
                <Button
                  aria-label={t('projects.settings.delete_lane', { lane: name })}
                  disabled={only}
                  onClick={() => {
                    setDeleting(lane);
                  }}
                >
                  {t('projects.settings.delete')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {only ? <p className={styles.hint}>{t('projects.settings.last_lane_hint')}</p> : null}
      <p role="status" aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
      <DeleteLaneDialog
        key={deleting?.id ?? 'none'}
        project_id={project.id}
        lane={deleting}
        lanes={stored}
        card_count={(cards.data ?? []).filter((card) => card.lane_id === deleting?.id).length}
        onClose={() => {
          setDeleting(undefined);
        }}
      />
    </section>
  );
}
