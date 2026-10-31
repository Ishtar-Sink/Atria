import { Badge, Button, EmptyState, ErrorState, LoadingState, SelectField } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { formatDate, formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import { useListSearch } from '../../../shared/url-state/use-list-search';
import styles from '../components/finance.module.css';
import { DataCard, Facts } from '../components/record-card';
import { TransactionRow } from '../components/transaction-row';
import { useAccounts, type Account } from '../hooks/use-accounts';
import { searchText } from '../lib/finance-period';
import { useCategories } from '../hooks/use-categories';
import { useStatements, type Statement } from '../hooks/use-statements';
import { listItemKey, useTransactions } from '../hooks/use-transactions';

export const statementsSearchSchema = z.object({
  card_id: searchText(),
  statement: searchText(),
});

/** "2026-11" no locale do usuário ("novembro de 2026"). */
export function formatStatementPeriod(period: string, locale: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** A fatura aberta é a primeira ainda não paga; sem ela, a mais recente. */
function defaultStatement(statements: readonly Statement[]): Statement | undefined {
  return statements.find((item) => !item.paid) ?? statements[statements.length - 1];
}

function StatementTransactions({ card, period }: { card: Account; period: string }) {
  const t = useT();
  const list = useTransactions({ account_id: card.id, limit: 200 });
  const categories = useCategories('expense');
  const names = new Map((categories.data ?? []).map((item) => [item.id, item.name]));
  if (list.isError) {
    return (
      <ErrorState
        title={t('finance.list.error_title')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void list.refetch();
        }}
      />
    );
  }
  if (list.isPending) return <LoadingState label={t('common.loading')} rows={3} />;
  // As movimentações do cartão trazem o período da fatura calculado pelo servidor.
  const items = list.items.filter((item) => item.statement_period === period);
  if (items.length === 0)
    return <p className={styles.cardHelp}>{t('finance.statements.transactions_empty')}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <TransactionRow
          key={listItemKey(item)}
          item={item}
          account_name={
            item.installment
              ? t('finance.statements.installment', {
                  number: item.installment.number,
                  total: item.installment.total,
                })
              : undefined
          }
          category_name={item.category_id ? names.get(item.category_id) : undefined}
        />
      ))}
    </ul>
  );
}

/** Aba Faturas: a fatura por cartão e período, com o total e as movimentações (RF-34). */
export function StatementsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { locale } = usePreferences();
  const { search, setSearch } = useListSearch(statementsSearchSchema);
  const accounts = useAccounts();
  const cards = (accounts.data ?? []).filter((item) => item.kind === 'credit_card');
  const card = cards.find((item) => item.id === search.card_id) ?? cards[0];
  const statements = useStatements(card?.id);
  const list = statements.data ?? [];
  const statement = list.find((item) => item.period === search.statement) ?? defaultStatement(list);

  function retry() {
    void accounts.refetch();
    void statements.refetch();
  }

  function body() {
    if (accounts.isError || statements.isError) {
      return (
        <ErrorState
          title={t('finance.list.error_title')}
          description={t('finance.list.error_description')}
          retryLabel={t('common.retry')}
          onRetry={retry}
        />
      );
    }
    if (accounts.isPending) return <LoadingState label={t('common.loading')} />;
    if (!card) {
      return (
        <EmptyState
          title={t('finance.statements.no_card_title')}
          description={t('finance.statements.no_card_description')}
          action={
            <Link to="/finance/accounts/new" className={styles.inlineLink}>
              {t('finance.statements.create_card')}
            </Link>
          }
        />
      );
    }
    if (statements.isPending) return <LoadingState label={t('common.loading')} />;
    if (!statement) {
      return (
        <EmptyState
          title={t('finance.statements.empty_title')}
          description={t('finance.statements.empty_description')}
        />
      );
    }
    const money = (value: number) => (
      <span className={styles.num}>{formatMoney(value, card.currency, locale)}</span>
    );
    return (
      <>
        <DataCard title={formatStatementPeriod(statement.period, locale)}>
          <Facts
            items={[
              { label: t('finance.statements.total'), value: money(statement.total_amount) },
              {
                label: t('finance.statements.outstanding'),
                value: money(statement.outstanding_amount),
              },
              {
                label: t('finance.statements.closing'),
                value: formatDate(statement.closing_date, locale, 'UTC'),
              },
              {
                label: t('finance.statements.due'),
                value: formatDate(statement.due_date, locale, 'UTC'),
              },
              {
                label: t('finance.statements.statement'),
                value: (
                  <Badge tone={statement.paid ? 'success' : 'warning'}>
                    {t(statement.paid ? 'finance.statements.paid' : 'finance.statements.open')}
                  </Badge>
                ),
              },
            ]}
          />
          {statement.paid ? null : (
            <div className={styles.settleActions}>
              <Button
                variant="primary"
                onClick={() => {
                  void navigate({
                    to: '/finance/credit-cards/$accountId/statements/$period/pay',
                    params: { accountId: card.id, period: statement.period },
                  });
                }}
              >
                {t('finance.statements.pay')}
              </Button>
            </div>
          )}
        </DataCard>
        <DataCard title={t('finance.statements.transactions')}>
          <StatementTransactions card={card} period={statement.period} />
        </DataCard>
      </>
    );
  }

  return (
    <section className={styles.screen} aria-label={t('finance.tabs.statements')}>
      {cards.length > 0 ? (
        <div role="group" aria-label={t('finance.list.filters')} className={styles.filters}>
          <SelectField
            label={t('finance.statements.card')}
            value={card?.id ?? ''}
            onChange={(card_id) => {
              setSearch({ card_id, statement: '' });
            }}
            options={cards.map((item) => ({ value: item.id, label: item.name }))}
          />
          {list.length > 0 ? (
            <SelectField
              label={t('finance.statements.statement')}
              value={statement?.period ?? ''}
              onChange={(period) => {
                setSearch({ statement: period });
              }}
              options={list.map((item) => ({
                value: item.period,
                label: t('finance.statements.option', {
                  period: formatStatementPeriod(item.period, locale),
                  status: t(item.paid ? 'finance.statements.paid' : 'finance.statements.open'),
                }),
              }))}
            />
          ) : null}
        </div>
      ) : null}
      {body()}
    </section>
  );
}
