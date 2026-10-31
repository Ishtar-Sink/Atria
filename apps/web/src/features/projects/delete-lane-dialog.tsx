import { Button, SelectField } from '@atria/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiProblem } from '../../shared/api/problem';
import { useT } from '../../shared/i18n/i18n';
import styles from './projects.module.css';
import { laneLabel, useDeleteLane } from './use-kanban';
import type { Lane } from './use-projects';

export interface DeleteLaneDialogProps {
  project_id: string;
  /** A raia a excluir; sem ela o diálogo fica fechado. */
  lane: Lane | undefined;
  lanes: readonly Lane[];
  /** Quantos cartões a raia tem. */
  card_count: number;
  onClose: () => void;
}

/**
 * Confirmação da exclusão de uma raia (CB-07, CB-08): com cartões, a pessoa escolhe a raia que os
 * recebe; a última raia não pode ser excluída. É uma confirmação, não um formulário
 * ([project/architecture-10]).
 */
export function DeleteLaneDialog({
  project_id,
  lane,
  lanes,
  card_count,
  onClose,
}: DeleteLaneDialogProps) {
  const t = useT();
  const title_id = useId();
  const text_id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const remove = useDeleteLane(project_id);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string>();
  const open = lane !== undefined;
  const others = lanes.filter((item) => item.id !== lane?.id);
  const last = others.length === 0;
  const needs_target = card_count > 0;

  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => {
      element.close();
      trigger?.focus();
    };
  }, [open]);

  if (!lane) return null;

  async function confirm() {
    if (!lane) return;
    if (needs_target && target === '') {
      setError(t('projects.delete_lane.target_required'));
      return;
    }
    setError(undefined);
    try {
      await remove.mutateAsync({
        lane_id: lane.id,
        ...(needs_target ? { move_cards_to: target } : {}),
      });
      onClose();
    } catch (failure) {
      const code = failure instanceof ApiProblem ? failure.code : '';
      setError(
        code === 'last_lane'
          ? t('projects.delete_lane.last_refused')
          : code === 'lane_has_cards'
            ? t('projects.delete_lane.target_required')
            : t('projects.delete_lane.failed'),
      );
    }
  }

  const name = laneLabel(lane, t);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={title_id}
      aria-describedby={text_id}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={title_id} className={styles.dialogTitle}>
        {t('projects.delete_lane.title', { lane: name })}
      </h2>
      <p id={text_id} className={styles.dialogText}>
        {last
          ? t('projects.delete_lane.last_refused')
          : needs_target
            ? t('projects.delete_lane.with_cards', { count: card_count })
            : t('projects.delete_lane.empty')}
      </p>
      {!last && needs_target ? (
        <SelectField
          label={t('projects.delete_lane.target')}
          placeholder={t('projects.delete_lane.target_placeholder')}
          value={target}
          options={others.map((item) => ({ value: item.id, label: laneLabel(item, t) }))}
          onChange={(value) => {
            setTarget(value);
            setError(undefined);
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.dialogActions}>
        <Button variant="ghost" onClick={onClose}>
          {last ? t('projects.delete_lane.close') : t('projects.delete_lane.cancel')}
        </Button>
        {last ? null : (
          <Button
            variant="primary"
            loading={remove.isPending}
            onClick={() => {
              void confirm();
            }}
          >
            {t('projects.delete_lane.confirm')}
          </Button>
        )}
      </div>
    </dialog>
  );
}
