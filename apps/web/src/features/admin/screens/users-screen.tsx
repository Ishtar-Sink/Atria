import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  Toolbar,
  ViewSwitcher,
  type BadgeTone,
} from '@atria/ui';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../../shared/i18n/i18n';
import { formatDate } from '../../../shared/format/intl';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import {
  useChangeRole,
  useMe,
  useToggleActive,
  usersSearchSchema,
  useUsers,
  type AdminUser,
  type Me,
} from '../hooks/use-users';
import { canChangeRole, canResetPassword, canToggleActive } from '../permissions';
import { AdminSections } from './admin-sections';
import styles from './users-screen.module.css';

const SEARCH_DEBOUNCE_MS = 250;

const ROLE_TONE: Record<string, BadgeTone> = {
  admin: 'primary',
  elevated: 'accent',
  user: 'neutral',
};

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </svg>
  );
}

interface RowActionsProps {
  user: AdminUser;
  viewer: Me | undefined;
  on_grant: (user: AdminUser) => void;
  on_deactivate: (user: AdminUser) => void;
  on_reactivate: (user: AdminUser) => void;
  on_reset: (user: AdminUser) => void;
}

function RowActions({
  user,
  viewer,
  on_grant,
  on_deactivate,
  on_reactivate,
  on_reset,
}: RowActionsProps) {
  const t = useT();
  const label = (action: string) => t('admin.users.action_for', { action, email: user.email });
  const can_role = canChangeRole(viewer) && user.role !== 'admin' && viewer?.id !== user.id;
  const elevated = user.role === 'elevated';
  const grant = t(elevated ? 'admin.users.revoke_elevated' : 'admin.users.grant_elevated');
  const toggle = t(user.is_active ? 'admin.users.deactivate' : 'admin.users.reactivate');
  const reset = t('admin.users.reset_link');
  return (
    <div className={styles.actions}>
      {can_role ? (
        <Button
          variant="secondary"
          aria-label={label(grant)}
          onClick={() => {
            on_grant(user);
          }}
        >
          {grant}
        </Button>
      ) : null}
      {canToggleActive(viewer, user) ? (
        <Button
          variant="muted"
          aria-label={label(toggle)}
          onClick={() => {
            if (user.is_active) on_deactivate(user);
            else on_reactivate(user);
          }}
        >
          {toggle}
        </Button>
      ) : null}
      {canResetPassword(viewer) ? (
        <Button
          variant="muted"
          aria-label={label(reset)}
          onClick={() => {
            on_reset(user);
          }}
        >
          {reset}
        </Button>
      ) : null}
    </div>
  );
}

export function UsersScreen() {
  const t = useT();
  const router = useRouter();
  const { locale, time_zone } = usePreferences();
  const { search, setSearch } = useListSearch(usersSearchSchema, { view_key: 'admin:users' });
  const filters = useMemo(() => ({ role: search.role, q: search.q }), [search.role, search.q]);

  const me = useMe();
  const users = useUsers(filters);
  const change_role = useChangeRole(filters);
  const toggle_active = useToggleActive(filters);
  const [pending, setPending] = useState<AdminUser | undefined>(undefined);

  // O texto digitado vale até a URL alcançá-lo; mudança de `q` vinda de fora (voltar) o substitui.
  const [typed, setTyped] = useState<{ text: string; base: string } | undefined>(undefined);
  const draft = typed !== undefined && typed.base === search.q ? typed.text : search.q;
  useEffect(() => {
    if (typed === undefined || typed.base !== search.q) return;
    const timer = setTimeout(() => {
      setSearch({ q: typed.text === '' ? undefined : typed.text });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [typed, search.q, setSearch]);

  const items = useMemo(() => users.data?.pages.flatMap((page) => page.items) ?? [], [users.data]);
  const viewer = me.data;

  const role_options = [
    { value: 'all', label: t('admin.users.all_roles') },
    { value: 'admin', label: t('admin.roles.admin') },
    { value: 'elevated', label: t('admin.roles.elevated') },
    { value: 'user', label: t('admin.roles.user') },
  ];

  function grant(user: AdminUser) {
    change_role.mutate({ id: user.id, role: user.role === 'elevated' ? 'user' : 'elevated' });
  }

  function reactivate(user: AdminUser) {
    toggle_active.mutate({ id: user.id, is_active: true });
  }

  function reset(user: AdminUser) {
    router.history.push(`/admin/users/${user.id}/password-reset`);
  }

  const actions = (user: AdminUser) => (
    <RowActions
      user={user}
      viewer={viewer}
      on_grant={grant}
      on_deactivate={setPending}
      on_reactivate={reactivate}
      on_reset={reset}
    />
  );

  const status = (user: AdminUser) => (
    <Badge tone={user.is_active ? 'success' : 'neutral'}>
      {t(user.is_active ? 'admin.users.status_active' : 'admin.users.status_inactive')}
    </Badge>
  );

  const role_badge = (user: AdminUser) => (
    <Badge tone={ROLE_TONE[user.role] ?? 'neutral'}>{t(`admin.roles.${user.role}`)}</Badge>
  );

  function body() {
    if (users.isPending) return <LoadingState label={t('admin.users.loading')} rows={4} />;
    if (users.isError) {
      return (
        <ErrorState
          title={t('admin.users.error_title')}
          description={t('admin.users.error_description')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void users.refetch();
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('admin.users.empty_title')}
          description={t('admin.users.empty_description')}
        />
      );
    }
    if (search.view === 'table') {
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t('admin.users.list_label')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.users.col_email')}</th>
                <th scope="col">{t('admin.users.col_role')}</th>
                <th scope="col">{t('admin.users.col_status')}</th>
                <th scope="col">{t('admin.users.col_created')}</th>
                <th scope="col">{t('admin.users.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id} className={user.is_active ? undefined : styles.inactive}>
                  <td className={styles.cellEmail}>{user.email}</td>
                  <td data-label={t('admin.users.col_role')}>{role_badge(user)}</td>
                  <td data-label={t('admin.users.col_status')}>{status(user)}</td>
                  <td data-label={t('admin.users.col_created')}>
                    {formatDate(user.created_at, locale, time_zone)}
                  </td>
                  <td data-label={t('admin.users.col_actions')}>{actions(user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul aria-label={t('admin.users.list_label')} className={styles.list}>
        {items.map((user) => (
          <li
            key={user.id}
            className={[styles.row, user.is_active ? '' : styles.inactive]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.identity}>
              <p className={styles.email}>{user.email}</p>
              <div className={styles.meta}>
                {role_badge(user)}
                {status(user)}
                {user.totp_enabled ? <span>{t('admin.users.two_factor')}</span> : null}
                <span>
                  {t('admin.users.col_created')}: {formatDate(user.created_at, locale, time_zone)}
                </span>
              </div>
            </div>
            {actions(user)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <StickyPageHeader
        eyebrow={t('admin.nav.title')}
        title={t('admin.users.title')}
        subtitle={t('admin.users.subtitle')}
      />
      <AdminSections />
      <Toolbar
        searchLabel={t('common.search')}
        searchPlaceholder={t('admin.users.search_placeholder')}
        searchValue={draft}
        onSearchChange={(text) => {
          setTyped({ text, base: search.q });
        }}
        filters={
          <div role="group" aria-label={t('common.filters')}>
            <SelectField
              label={t('admin.users.filter_role')}
              options={role_options}
              value={search.role}
              onChange={(value) => {
                setSearch({ role: value === 'all' ? undefined : (value as typeof search.role) });
              }}
            />
          </div>
        }
      >
        <ViewSwitcher
          label={t('common.view')}
          value={search.view}
          options={[
            { value: 'list', label: t('admin.users.view_list'), icon: <ListIcon /> },
            { value: 'table', label: t('admin.users.view_table'), icon: <TableIcon /> },
          ]}
          onChange={(view) => {
            setSearch({ view: view as typeof search.view });
          }}
        />
      </Toolbar>
      {body()}
      {users.hasNextPage ? (
        <div className={styles.more}>
          <Button
            loading={users.isFetchingNextPage}
            onClick={() => {
              void users.fetchNextPage();
            }}
          >
            {t('admin.users.load_more')}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={pending !== undefined}
        title={t('admin.users.confirm_title')}
        description={t('admin.users.confirm_description', { email: pending?.email ?? '' })}
        confirmLabel={t('admin.users.confirm_yes')}
        cancelLabel={t('admin.users.confirm_no')}
        onCancel={() => {
          setPending(undefined);
        }}
        onConfirm={() => {
          if (pending) toggle_active.mutate({ id: pending.id, is_active: false });
          setPending(undefined);
        }}
      />
    </>
  );
}
