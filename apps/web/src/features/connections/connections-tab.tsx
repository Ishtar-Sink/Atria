import {
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  Toolbar,
  ViewSwitcher,
} from '@atria/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useT } from '../../shared/i18n/i18n';
import { ConnectionItem } from './connection-item';
import styles from './connections.module.css';
import { CATEGORIES } from './entity-categories';
import { RemoveConnectionDialog } from './remove-connection-dialog';
import { useRemoveConnection } from './use-connection-mutations';
import { GROUPINGS, useConnections, type ConnectionItem as Item } from './use-connections';

const GROUP_LABELS = {
  category: 'group_by_category',
  date: 'group_by_date',
  none: 'group_none',
} as const;

export interface ConnectionsTabProps {
  entity_type: string;
  entity_id: string;
}

/** Aba "Conexões" de qualquer entidade: só recebe o tipo e o id (RF-19). */
export function ConnectionsTab({ entity_type, entity_id }: ConnectionsTabProps) {
  const t = useT();
  const connections = useConnections(entity_type, entity_id);
  const remove = useRemoveConnection();
  const [removing, setRemoving] = useState<Item | null>(null);
  const { query, groups, category, text, grouping } = connections;

  let body;
  if (query.isPending) {
    body = <LoadingState label={t('connections.loading')} />;
  } else if (query.isError) {
    body = (
      <ErrorState
        title={t('connections.error_title')}
        description={t('connections.error')}
        retryLabel={t('connections.retry')}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else if (connections.total === 0) {
    body = (
      <EmptyState title={t('connections.empty_title')} description={t('connections.empty_text')} />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        title={t('connections.no_results_title')}
        description={t('connections.no_results')}
      />
    );
  } else {
    body = groups.map((group) => (
      <section key={group.key} className={styles.group}>
        {group.label === null ? null : <h2 className={styles.groupTitle}>{group.label}</h2>}
        <ul className={styles.list}>
          {group.items.map((item) => (
            <ConnectionItem key={item.id} item={item} onRemove={setRemoving} />
          ))}
        </ul>
      </section>
    ));
  }

  return (
    <div className={styles.stack}>
      <Toolbar
        searchLabel={t('connections.search_label')}
        searchPlaceholder={t('connections.search_placeholder')}
        searchValue={text ?? ''}
        onSearchChange={connections.set_text}
        filters={
          <div role="group" aria-label={t('connections.filters_label')} className={styles.filters}>
            <SelectField
              label={t('connections.filter_category')}
              value={category ?? ''}
              options={[
                { value: '', label: t('connections.filter_category_all') },
                ...CATEGORIES.map((item) => ({
                  value: item,
                  label: t(`connections.category.${item}`),
                })),
              ]}
              onChange={(value) => {
                connections.set_category(CATEGORIES.find((item) => item === value));
              }}
            />
          </div>
        }
      >
        <div className={styles.trailing}>
          <ViewSwitcher
            label={t('connections.view_label')}
            value={grouping}
            options={GROUPINGS.map((value) => ({
              value,
              label: t(`connections.${GROUP_LABELS[value]}`),
            }))}
            onChange={(value) => {
              connections.set_grouping(GROUPINGS.find((item) => item === value) ?? 'category');
            }}
          />
          <Link
            to="/connections/new"
            search={{ source_type: entity_type, source_id: entity_id }}
            className={[styles.linkButton, styles.linkPrimary].join(' ')}
          >
            {t('connections.add')}
          </Link>
        </div>
      </Toolbar>
      {body}
      <RemoveConnectionDialog
        item={removing}
        onCancel={() => {
          setRemoving(null);
        }}
        onConfirm={(item) => {
          setRemoving(null);
          remove.mutate({ id: item.id });
        }}
      />
    </div>
  );
}
