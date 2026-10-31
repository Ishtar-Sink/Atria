import type { ReactElement } from 'react';
import {
  createRoute,
  Outlet,
  useNavigate,
  useRouterState,
  type AnyRoute,
} from '@tanstack/react-router';
import { z } from 'zod';
import { registerMessages } from '../../shared/i18n/i18n';
import { FINANCE_TABS, FinanceShell, type FinanceTab } from './components/finance-shell';
import messages from './i18n/pt-br.json';
import { AccountDetailScreen } from './screens/account-detail-screen';
import { AccountFormScreen } from './screens/account-form-screen';
import { accountsSearchSchema, AccountsScreen } from './screens/accounts-screen';
import { CategoryDetailScreen } from './screens/category-detail-screen';
import { CategoryFormScreen } from './screens/category-form-screen';
import { FinancePanelScreen, panelSearchSchema } from './screens/finance-panel-screen';
import { FinanceSettingsScreen } from './screens/finance-settings-screen';
import { RecurrenceDetailScreen } from './screens/recurrence-detail-screen';
import { StatementPaymentScreen } from './screens/statement-payment-screen';
import { statementsSearchSchema, StatementsScreen } from './screens/statements-screen';
import { TransactionDetailScreen } from './screens/transaction-detail-screen';
import { TransactionFormScreen } from './screens/transaction-form-screen';
import { transactionsSearchSchema, TransactionsScreen } from './screens/transactions-screen';
import { TransferDetailScreen } from './screens/transfer-detail-screen';
import { TransferFormScreen } from './screens/transfer-form-screen';
import { transfersSearchSchema, TransfersScreen } from './screens/transfers-screen';

registerMessages('finance', messages);

type Schema = z.ZodObject<z.ZodRawShape>;

/** Parâmetro inválido some e volta ao padrão, sem derrubar os outros ([project/frontend-13]). */
function lenient<T extends Schema>(schema: T) {
  return (raw: Record<string, unknown>): z.output<T> => {
    const known = Object.fromEntries(Object.entries(raw).filter(([key]) => key in schema.shape));
    const parsed = schema.safeParse(known);
    if (parsed.success) return parsed.data;
    const invalid = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    const clean = Object.fromEntries(Object.entries(known).filter(([key]) => !invalid.has(key)));
    const second = schema.safeParse(clean);
    return second.success ? second.data : schema.parse({});
  };
}

const kind_search = z.object({ kind: z.enum(['income', 'expense']).catch('expense') });
const account_tab_search = z.object({
  tab: z.enum(['overview', 'transactions']).catch('overview'),
});
const recurrence_tab_search = z.object({
  tab: z.enum(['overview', 'settlements']).catch('overview'),
});

function meta(title_key: string) {
  return { title_key, breadcrumb_key: title_key };
}

/** O layout das sete abas: a aba aberta vem do caminho. */
function FinanceTabsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab: FinanceTab =
    FINANCE_TABS.find((item) => item.path === pathname.replace(/\/$/, ''))?.id ?? 'panel';
  return (
    <FinanceShell tab={tab}>
      <Outlet />
    </FinanceShell>
  );
}

/** Rotas do Financeiro; a TASK-35 as registra em `app/routes.ts`. */
export function createFinanceRoutes(parent: AnyRoute): AnyRoute[] {
  const tabs = createRoute({
    getParentRoute: () => parent,
    id: 'finance-tabs',
    component: FinanceTabsLayout,
    staticData: meta('finance.nav.title'),
  });

  const tab = <T extends Schema>(
    path: string,
    title_key: string,
    schema: T | null,
    component: () => ReactElement,
  ) =>
    createRoute({
      getParentRoute: () => tabs,
      path,
      ...(schema ? { validateSearch: lenient(schema) } : {}),
      component,
      staticData: meta(title_key),
    });

  const tab_routes = [
    tab('/finance', 'finance.tabs.panel', panelSearchSchema, () => <FinancePanelScreen />),
    tab('/finance/income', 'finance.tabs.income', transactionsSearchSchema, () => (
      <TransactionsScreen kind="income" />
    )),
    tab('/finance/expenses', 'finance.tabs.expenses', transactionsSearchSchema, () => (
      <TransactionsScreen kind="expense" />
    )),
    tab('/finance/transfers', 'finance.tabs.transfers', transfersSearchSchema, () => (
      <TransfersScreen />
    )),
    tab('/finance/statements', 'finance.tabs.statements', statementsSearchSchema, () => (
      <StatementsScreen />
    )),
    tab('/finance/accounts', 'finance.tabs.accounts', accountsSearchSchema, () => (
      <AccountsScreen />
    )),
    tab('/finance/settings', 'finance.tabs.settings', null, () => <FinanceSettingsScreen />),
  ];

  const page = (path: string, title_key: string, component: () => ReactElement) =>
    createRoute({
      getParentRoute: () => parent,
      path,
      component,
      staticData: meta(title_key),
    });

  const account_new = page('/finance/accounts/new', 'finance.account_form.new_title', () => (
    <AccountFormScreen />
  ));
  const account_detail = createRoute({
    getParentRoute: () => parent,
    path: '/finance/accounts/$accountId',
    validateSearch: lenient(account_tab_search),
    staticData: meta('finance.account_detail.eyebrow'),
    component: function AccountDetailRoute() {
      const { accountId } = account_detail.useParams() as unknown as { accountId: string };
      const { tab: current } = account_detail.useSearch() as unknown as z.output<
        typeof account_tab_search
      >;
      const navigate = useNavigate();
      return (
        <AccountDetailScreen
          account_id={accountId}
          tab={current}
          on_tab_change={(next) => {
            void navigate({ to: '.', replace: true, search: { tab: next } });
          }}
        />
      );
    },
  });
  const account_edit = createRoute({
    getParentRoute: () => parent,
    path: '/finance/accounts/$accountId/edit',
    staticData: meta('finance.account_form.edit_title'),
    component: function AccountEditRoute() {
      const { accountId } = account_edit.useParams() as unknown as { accountId: string };
      return <AccountFormScreen account_id={accountId} />;
    },
  });

  const transaction_new = createRoute({
    getParentRoute: () => parent,
    path: '/finance/transactions/new',
    validateSearch: lenient(kind_search),
    staticData: meta('finance.new_record.button'),
    component: function TransactionNewRoute() {
      const { kind } = transaction_new.useSearch() as unknown as z.output<typeof kind_search>;
      return <TransactionFormScreen key={kind} mode="create" kind={kind} />;
    },
  });
  const transaction_detail = createRoute({
    getParentRoute: () => parent,
    path: '/finance/transactions/$transactionId',
    staticData: meta('finance.transaction_detail.data'),
    component: function TransactionDetailRoute() {
      const { transactionId } = transaction_detail.useParams() as unknown as {
        transactionId: string;
      };
      return <TransactionDetailScreen transaction_id={transactionId} />;
    },
  });
  const transaction_edit = createRoute({
    getParentRoute: () => parent,
    path: '/finance/transactions/$transactionId/edit',
    staticData: meta('common.edit'),
    component: function TransactionEditRoute() {
      const { transactionId } = transaction_edit.useParams() as unknown as {
        transactionId: string;
      };
      return <TransactionFormScreen mode="edit" transaction_id={transactionId} />;
    },
  });

  const recurrence_detail = createRoute({
    getParentRoute: () => parent,
    path: '/finance/recurring-transactions/$recurrenceId',
    validateSearch: lenient(recurrence_tab_search),
    staticData: meta('finance.recurrence_detail.eyebrow'),
    component: function RecurrenceDetailRoute() {
      const { recurrenceId } = recurrence_detail.useParams() as unknown as {
        recurrenceId: string;
      };
      const { tab: current } = recurrence_detail.useSearch() as unknown as z.output<
        typeof recurrence_tab_search
      >;
      const navigate = useNavigate();
      return (
        <RecurrenceDetailScreen
          recurrence_id={recurrenceId}
          tab={current}
          on_tab_change={(next) => {
            void navigate({ to: '.', replace: true, search: { tab: next } });
          }}
        />
      );
    },
  });
  const recurrence_edit = createRoute({
    getParentRoute: () => parent,
    path: '/finance/recurring-transactions/$recurrenceId/edit',
    staticData: meta('finance.transaction_form.edit_recurrence'),
    component: function RecurrenceEditRoute() {
      const { recurrenceId } = recurrence_edit.useParams() as unknown as { recurrenceId: string };
      return <TransactionFormScreen mode="recurrence" recurrence_id={recurrenceId} />;
    },
  });

  const transfer_new = page('/finance/transfers/new', 'finance.transfer_form.title', () => (
    <TransferFormScreen />
  ));
  const transfer_detail = createRoute({
    getParentRoute: () => parent,
    path: '/finance/transfers/$transferId',
    staticData: meta('finance.transfer_detail.title'),
    component: function TransferDetailRoute() {
      const { transferId } = transfer_detail.useParams() as unknown as { transferId: string };
      return <TransferDetailScreen transfer_id={transferId} />;
    },
  });

  const category_new = createRoute({
    getParentRoute: () => parent,
    path: '/finance/categories/new',
    validateSearch: lenient(kind_search),
    staticData: meta('finance.category_form.new_title'),
    component: function CategoryNewRoute() {
      const { kind } = category_new.useSearch() as unknown as z.output<typeof kind_search>;
      return <CategoryFormScreen key={kind} kind={kind} />;
    },
  });
  const category_detail = createRoute({
    getParentRoute: () => parent,
    path: '/finance/categories/$categoryId',
    staticData: meta('finance.category_detail.eyebrow'),
    component: function CategoryDetailRoute() {
      const { categoryId } = category_detail.useParams() as unknown as { categoryId: string };
      return <CategoryDetailScreen category_id={categoryId} />;
    },
  });
  const category_edit = createRoute({
    getParentRoute: () => parent,
    path: '/finance/categories/$categoryId/edit',
    staticData: meta('finance.category_form.edit_title'),
    component: function CategoryEditRoute() {
      const { categoryId } = category_edit.useParams() as unknown as { categoryId: string };
      return <CategoryFormScreen category_id={categoryId} />;
    },
  });

  const statement_pay = createRoute({
    getParentRoute: () => parent,
    path: '/finance/credit-cards/$accountId/statements/$period/pay',
    staticData: meta('finance.statement_payment.title'),
    component: function StatementPayRoute() {
      const { accountId, period } = statement_pay.useParams() as unknown as {
        accountId: string;
        period: string;
      };
      return <StatementPaymentScreen card_id={accountId} period={period} />;
    },
  });

  return [
    tabs.addChildren(tab_routes),
    account_new,
    account_detail,
    account_edit,
    transaction_new,
    transaction_detail,
    transaction_edit,
    recurrence_detail,
    recurrence_edit,
    transfer_new,
    transfer_detail,
    category_new,
    category_detail,
    category_edit,
    statement_pay,
  ];
}
