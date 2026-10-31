import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  TextField,
} from '@atria/ui';
import { useState, type SyntheticEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { StickyPageHeader } from '../../shared/layout/sticky-page-header';
import { BackLink } from '../../shared/navigation/back-link';
import styles from './emotions-page.module.css';
import {
  emotionLabel,
  useCreateEmotion,
  useEmotions,
  useRemoveEmotion,
  useRenameEmotion,
  type Emotion,
} from './use-emotions';

const MAX_NAME = 50;

/** Valida o nome e devolve a chave do erro, ou `null` se estiver certo. */
function nameError(name: string, others: readonly string[]): string | null {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_NAME) return 'journal.emotions.name_required';
  const lowered = trimmed.toLowerCase();
  return others.some((other) => other.toLowerCase() === lowered)
    ? 'journal.emotions.name_duplicate'
    : null;
}

export function EmotionsPage() {
  const t = useT();
  const query = useEmotions();
  const create = useCreateEmotion();
  const rename = useRenameEmotion();
  const remove = useRemoveEmotion();
  const [new_name, setNewName] = useState('');
  const [add_error, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [edit_error, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Emotion | null>(null);

  const items = query.data?.items ?? [];
  const labels = items.map((item) => emotionLabel(item, t));

  function add(event: SyntheticEvent) {
    event.preventDefault();
    const error = nameError(new_name, labels);
    setAddError(error);
    if (error !== null) return;
    create.mutate(new_name.trim());
    setNewName('');
  }

  function saveRename(event: SyntheticEvent, emotion: Emotion) {
    event.preventDefault();
    if (editing === null) return;
    const others = items
      .filter((item) => item.id !== emotion.id)
      .map((item) => emotionLabel(item, t));
    const error = nameError(editing.name, others);
    setEditError(error);
    if (error !== null) return;
    rename.mutate({ id: emotion.id, name: editing.name.trim() });
    setEditing(null);
  }

  function renderBody() {
    if (query.isPending) return <LoadingState label={t('journal.emotions.loading')} />;
    if (query.isError) {
      return (
        <ErrorState
          title={t('journal.emotions.error')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void query.refetch();
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('journal.emotions.title')}
          description={t('journal.emotions.empty_text')}
        />
      );
    }
    return (
      <ul className={styles.list} aria-label={t('journal.emotions.list_label')}>
        {items.map((emotion) => {
          const name = emotionLabel(emotion, t);
          return (
            <li key={emotion.id} className={styles.row}>
              {editing?.id === emotion.id ? (
                <form
                  className={styles.edit}
                  noValidate
                  onSubmit={(event) => {
                    saveRename(event, emotion);
                  }}
                >
                  <TextField
                    label={t('journal.emotions.name_label')}
                    value={editing.name}
                    onChange={(event) => {
                      setEditing({ id: emotion.id, name: event.target.value });
                    }}
                    {...(edit_error ? { error: t(edit_error) } : {})}
                  />
                  <div className={styles.actions}>
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setEditError(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button variant="primary" type="submit">
                      {t('journal.emotions.save')}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.actions}>
                    <Button
                      aria-label={t('journal.emotions.rename_item', { name })}
                      onClick={() => {
                        setEditError(null);
                        setEditing({ id: emotion.id, name });
                      }}
                    >
                      {t('journal.emotions.rename')}
                    </Button>
                    <Button
                      aria-label={t('journal.emotions.remove_item', { name })}
                      onClick={() => {
                        setRemoving(emotion);
                      }}
                    >
                      {t('journal.emotions.remove')}
                    </Button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={styles.screen}>
      <StickyPageHeader
        back={<BackLink module="journal" fallback_to="/journal" />}
        eyebrow={t('journal.emotions.eyebrow')}
        title={t('journal.emotions.title')}
        subtitle={t('journal.emotions.subtitle')}
      />
      <Card>
        <form className={styles.add} noValidate onSubmit={add}>
          <TextField
            label={t('journal.emotions.add_label')}
            value={new_name}
            onChange={(event) => {
              setNewName(event.target.value);
            }}
            {...(add_error ? { error: t(add_error) } : {})}
          />
          <Button variant="primary" type="submit">
            {t('journal.emotions.add')}
          </Button>
        </form>
      </Card>
      {renderBody()}
      <ConfirmDialog
        open={removing !== null}
        title={t('journal.emotions.remove_title')}
        description={t('journal.emotions.remove_confirm')}
        confirmLabel={t('journal.emotions.remove')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setRemoving(null);
        }}
        onConfirm={() => {
          if (removing !== null) remove.mutate(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
