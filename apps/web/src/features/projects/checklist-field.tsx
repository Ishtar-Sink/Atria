import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '@atria/ui';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { HandleIcon } from './icons';
import styles from './projects.module.css';
import {
  appendChecklistItem,
  CHECKLIST_TEXT_MAX_CHARS,
  moveChecklistItem,
  removeChecklistItem,
  updateChecklistItem,
  type ChecklistDraft,
} from './use-kanban';

const RemoveIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export interface ChecklistFieldProps {
  label: string;
  help: string;
  items: readonly ChecklistDraft[];
  onChange: (items: ChecklistDraft[]) => void;
  error?: string | undefined;
}

export function ChecklistField({ label, help, items, onChange, error }: ChecklistFieldProps) {
  const t = useT();
  const help_id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const new_input = useRef<HTMLInputElement>(null);
  const focus_key = useRef<string>(undefined);
  const [announcement, setAnnouncement] = useState('');
  const [draft, setDraft] = useState('');

  // Depois de reordenar pelo teclado, o foco volta à alça do item que mudou de lugar.
  useEffect(() => {
    if (focus_key.current === undefined) return;
    handles.current.get(focus_key.current)?.focus();
    focus_key.current = undefined;
  }, [items]);

  function nameOf(item: ChecklistDraft | undefined, position: number) {
    const text = item?.text.trim() ?? '';
    return text === '' ? t('projects.checklist.untitled', { position }) : text;
  }
  function indexOf(id: string | number) {
    return items.findIndex((item) => item.key === id);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const index = indexOf(active.id);
      return t('projects.checklist.drag_start', { item: nameOf(items[index], index + 1) });
    },
    onDragOver: ({ active, over }) => {
      if (!over) return undefined;
      const index = indexOf(active.id);
      return t('projects.checklist.drag_over', {
        item: nameOf(items[index], index + 1),
        position: indexOf(over.id) + 1,
      });
    },
    onDragEnd: ({ active, over }) => {
      const index = indexOf(active.id);
      return t('projects.checklist.moved', {
        item: nameOf(items[index], index + 1),
        position: (over ? indexOf(over.id) : index) + 1,
        total: items.length,
      });
    },
    onDragCancel: () => t('projects.checklist.drag_cancel'),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(moveChecklistItem(items, indexOf(active.id), indexOf(over.id)));
  }

  function commitDraft() {
    const next = appendChecklistItem(items, draft);
    if (next.length !== items.length) onChange(next);
    setDraft('');
  }

  function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: ChecklistDraft) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const index = indexOf(item.key);
    const target = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (target < 0 || target > items.length - 1) return;
    focus_key.current = item.key;
    setAnnouncement(
      t('projects.checklist.moved', {
        item: nameOf(item, index + 1),
        position: target + 1,
        total: items.length,
      }),
    );
    onChange(moveChecklistItem(items, index, target));
  }

  function onItemKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = items[index + 1];
    if (next) inputs.current.get(next.key)?.focus();
    else new_input.current?.focus();
  }

  function remove(item: ChecklistDraft, index: number) {
    setAnnouncement(t('projects.checklist.removed', { item: nameOf(item, index + 1) }));
    onChange(removeChecklistItem(items, item.key));
    new_input.current?.focus();
  }

  return (
    <fieldset className={styles.checklist} data-span="full">
      <legend className={styles.textareaLabel}>{label}</legend>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: t('projects.checklist.drag_instructions') },
          announcements,
        }}
      >
        <ul className={styles.checklistList}>
          <SortableContext
            items={items.map((item) => item.key)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => (
              <ChecklistRow
                key={item.key}
                item={item}
                index={index}
                total={items.length}
                name={nameOf(item, index + 1)}
                setHandle={(node) => {
                  if (node) handles.current.set(item.key, node);
                  else handles.current.delete(item.key);
                }}
                setInput={(node) => {
                  if (node) inputs.current.set(item.key, node);
                  else inputs.current.delete(item.key);
                }}
                onText={(text) => {
                  onChange(updateChecklistItem(items, item.key, { text }));
                }}
                onDone={(done) => {
                  onChange(updateChecklistItem(items, item.key, { done }));
                }}
                onRemove={() => {
                  remove(item, index);
                }}
                onHandleKeyDown={(event) => {
                  onHandleKeyDown(event, item);
                }}
                onInputKeyDown={(event) => {
                  onItemKeyDown(event, index);
                }}
              />
            ))}
          </SortableContext>
          <li className={styles.checklistNew}>
            <input
              ref={new_input}
              type="text"
              className={styles.checklistInput}
              aria-label={t('projects.checklist.new_item')}
              placeholder={t('projects.checklist.new_item_placeholder')}
              aria-describedby={help_id}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitDraft();
              }}
              onBlur={commitDraft}
            />
          </li>
        </ul>
      </DndContext>
      <p id={help_id} className={styles.hint}>
        {help}
      </p>
      <p role="status" aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

interface ChecklistRowProps {
  item: ChecklistDraft;
  index: number;
  total: number;
  name: string;
  setHandle: (node: HTMLButtonElement | null) => void;
  setInput: (node: HTMLInputElement | null) => void;
  onText: (text: string) => void;
  onDone: (done: boolean) => void;
  onRemove: () => void;
  onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function ChecklistRow(props: ChecklistRowProps) {
  const {
    item,
    index,
    total,
    name,
    setHandle,
    setInput,
    onText,
    onDone,
    onRemove,
    onHandleKeyDown,
    onInputKeyDown,
  } = props;
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useSortable({ id: item.key, transition: null });
  const position = index + 1;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={[styles.checklistRow, isDragging ? styles.checklistRowDragging : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        ref={(node) => {
          setActivatorNodeRef(node);
          setHandle(node);
        }}
        className={styles.handle}
        {...attributes}
        {...listeners}
        aria-label={t('projects.checklist.handle', { item: name, position, total })}
        onKeyDown={onHandleKeyDown}
      >
        <HandleIcon />
      </button>
      <input
        type="checkbox"
        className={styles.checklistCheck}
        checked={item.done}
        aria-label={t('projects.checklist.done', { item: name })}
        onChange={(event) => {
          onDone(event.target.checked);
        }}
      />
      <input
        ref={setInput}
        type="text"
        className={styles.checklistInput}
        value={item.text}
        aria-label={t('projects.checklist.item', { position })}
        maxLength={CHECKLIST_TEXT_MAX_CHARS + 1}
        onChange={(event) => {
          onText(event.target.value);
        }}
        onKeyDown={onInputKeyDown}
      />
      <IconButton
        aria-label={t('projects.checklist.remove', { item: name })}
        icon={<RemoveIcon />}
        onClick={onRemove}
      />
    </li>
  );
}
