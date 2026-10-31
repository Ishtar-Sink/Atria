import {
  Button,
  MenuButton,
  PeriodField,
  type PeriodFieldLabels,
  type PeriodPreset,
} from '@atria/ui';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { CreateTypeDialog, type CreateType } from '../../../shared/forms/create-type-dialog';
import { registerMessages, useT, type Translate } from '../../../shared/i18n/i18n';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import messages from '../i18n/pt-br.json';
import {
  FINANCE_PERIOD_PRESETS,
  fromPeriodValue,
  periodSearch,
  todayInTimeZone,
  toPeriodValue,
  type FinancePeriodSearch,
} from '../lib/finance-period';
import styles from './finance.module.css';

registerMessages('finance', messages);

export type FinanceTab =
  'panel' | 'income' | 'expenses' | 'transfers' | 'statements' | 'accounts' | 'settings';

interface TabDef {
  id: FinanceTab;
  path: string;
  label_key: string;
  /** A aba segue o período global (PD-55). */
  with_period: boolean;
  create_type: string;
}

export const FINANCE_TABS: readonly TabDef[] = [
  {
    id: 'panel',
    path: '/finance',
    label_key: 'finance.tabs.panel',
    with_period: true,
    create_type: 'expense',
  },
  {
    id: 'income',
    path: '/finance/income',
    label_key: 'finance.tabs.income',
    with_period: true,
    create_type: 'income',
  },
  {
    id: 'expenses',
    path: '/finance/expenses',
    label_key: 'finance.tabs.expenses',
    with_period: true,
    create_type: 'expense',
  },
  {
    id: 'transfers',
    path: '/finance/transfers',
    label_key: 'finance.tabs.transfers',
    with_period: true,
    create_type: 'transfer',
  },
  {
    id: 'statements',
    path: '/finance/statements',
    label_key: 'finance.tabs.statements',
    with_period: false,
    create_type: 'expense',
  },
  {
    id: 'accounts',
    path: '/finance/accounts',
    label_key: 'finance.tabs.accounts',
    with_period: false,
    create_type: 'account',
  },
  {
    id: 'settings',
    path: '/finance/settings',
    label_key: 'finance.tabs.settings',
    with_period: false,
    create_type: 'category',
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/** Os cinco tipos do "Novo registro" (PD-09, PD-50), na ordem do protótipo. */
export const FINANCE_CREATE_TYPES = [
  { id: 'income', href: '/finance/transactions/new?kind=income', icon: 'M12 19V5M5 12l7-7 7 7' },
  {
    id: 'expense',
    href: '/finance/transactions/new?kind=expense',
    icon: 'M12 5v14M19 12l-7 7-7-7',
  },
  { id: 'transfer', href: '/finance/transfers/new', icon: 'M4 7h16l-4-4M20 17H4l4 4' },
  {
    id: 'category',
    href: '/finance/categories/new?kind=expense',
    icon: 'M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7zM4 13h7v7H4z',
  },
  { id: 'account', href: '/finance/accounts/new', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
] as const;

/** Os tipos com os textos do i18n, para o `types` do `CreateTypeDialog` da base (DEC-008). */
export function createTypes(t: Translate): CreateType[] {
  return FINANCE_CREATE_TYPES.map((type) => ({
    id: type.id,
    label: t(`finance.new_record.${type.id}`),
    description: t(`finance.new_record.${type.id}_description`),
    icon: <Icon d={type.icon} />,
    href: type.href,
  }));
}

export const FINANCE_REPORTS = ['fin-flow', 'fin-cat', 'fin-diff'] as const;

export function reportKey(id: (typeof FINANCE_REPORTS)[number]): string {
  return `finance.reports.${id.replace('-', '_')}`;
}

/** Rótulos que a feature passa ao `PeriodField` (PD-55, PD-57). */
export function usePeriodLabels(): PeriodFieldLabels {
  const t = useT();
  return {
    presets: Object.fromEntries(
      FINANCE_PERIOD_PRESETS.map((preset) => [preset, t(`finance.period.${preset}`)]),
    ) as Record<PeriodPreset, string>,
    title: t('finance.period.title'),
    custom: t('finance.period.custom'),
    apply: t('finance.period.apply'),
    first_day: t('finance.period.first_day'),
    last_day: t('finance.period.last_day'),
    first_day_error: t('finance.period.first_day_error'),
    previous: t('common.previous_month'),
    next: t('common.next_month'),
    today_marker: t('common.today_marker'),
  };
}

export interface FinanceShellProps {
  tab: FinanceTab;
  children: ReactNode;
}

/** Cabeçalho do módulo e as sete abas (PD-20, PD-48, PD-55, PD-61). */
export function FinanceShell({ tab, children }: FinanceShellProps) {
  const t = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const { locale, time_zone } = usePreferences();
  const labels = usePeriodLabels();
  const [creating, setCreating] = useState(false);
  const search = useRouterState({
    select: (state) => state.location.search as Partial<FinancePeriodSearch>,
  });
  const current = FINANCE_TABS.find((item) => item.id === tab) ?? FINANCE_TABS[0];
  const period = periodSearch(search);

  return (
    <div className={styles.shell}>
      <StickyPageHeader
        eyebrow={t('finance.shell.eyebrow')}
        title={t('finance.shell.title')}
        subtitle={t('finance.shell.subtitle')}
        actions={
          <div className={styles.actions}>
            <MenuButton
              label={t('finance.reports.button')}
              trigger={t('finance.reports.button')}
              items={FINANCE_REPORTS.map((id) => ({
                id,
                label: t(reportKey(id)),
                href: `/reports/${id}?from_module=finance`,
              }))}
            />
            {current?.with_period ? (
              <PeriodField
                label={t('finance.period.label')}
                placement="toolbar"
                presets={FINANCE_PERIOD_PRESETS}
                allow_custom
                value={toPeriodValue(search)}
                today={todayInTimeZone(new Date(), time_zone)}
                locale={locale}
                labels={labels}
                onChange={(value) => {
                  void navigate({
                    to: '.',
                    replace: true,
                    // As datas antigas saem da URL quando o período deixa de ser personalizado.
                    search: (previous: Record<string, unknown>) => ({
                      ...previous,
                      from: undefined,
                      to: undefined,
                      ...fromPeriodValue(value),
                    }),
                  });
                }}
              />
            ) : null}
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              {t('finance.new_record.button')}
            </Button>
          </div>
        }
      />
      <nav aria-label={t('finance.tabs.label')} className={styles.tabs}>
        <ul className={styles.tabList}>
          {FINANCE_TABS.map((item) => (
            <li key={item.id}>
              <Link
                to={item.path}
                search={item.with_period ? period : {}}
                className={styles.tab}
                aria-current={item.id === tab ? 'page' : undefined}
                activeOptions={{ exact: true, includeSearch: false }}
              >
                {t(item.label_key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
      <CreateTypeDialog
        types={createTypes(t)}
        {...(current ? { focused_type: current.create_type } : {})}
        open={creating}
        on_close={() => {
          setCreating(false);
        }}
        title={t('finance.new_record.title')}
        description={t('finance.new_record.description')}
        on_select={(type) => {
          router.history.push(type.href);
        }}
      />
    </div>
  );
}
