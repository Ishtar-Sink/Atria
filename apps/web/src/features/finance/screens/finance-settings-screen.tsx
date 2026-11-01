import { Button, Card, ErrorState, LoadingState } from '@atria/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useT } from '../../../shared/i18n/i18n';
import styles from '../components/finance.module.css';
import type { TransactionKind } from '../hooks/finance-cache';
import { useCategories } from '../hooks/use-categories';

function CategoryGroup({ kind }: { kind: TransactionKind }) {
  const t = useT();
  const categories = useCategories(kind);
  const title = t(
    kind === 'income' ? 'finance.settings.group_income' : 'finance.settings.group_expense',
  );
  const id = `finance-categories-${kind}`;
  function body() {
    if (categories.isError) {
      return (
        <ErrorState
          title={t('finance.list.error_title')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void categories.refetch();
          }}
        />
      );
    }
    if (categories.isPending) return <LoadingState label={t('common.loading')} rows={2} />;
    if (categories.data.length === 0) {
      return <p className={styles.cardHelp}>{t('finance.settings.group_empty')}</p>;
    }
    return (
      <ul className={styles.list}>
        {categories.data.map((category) => (
          <li key={category.id} className={styles.row}>
            <div className={styles.rowMain}>
              <span
                className={styles.dot}
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              <div className={styles.rowText}>
                <Link
                  to="/finance/categories/$categoryId"
                  params={{ categoryId: category.id }}
                  className={styles.rowTitle}
                >
                  {category.name}
                </Link>
                <span className={styles.rowSub}>{category.color}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className={styles.cardTitle}>
        {title}
      </h3>
      {body()}
    </section>
  );
}

/** Aba Configurações: as categorias agrupadas em Entradas e Saídas (PD-49). */
export function FinanceSettingsScreen() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Card as="section" aria-labelledby="finance-settings-categories">
      <div className={`${styles.actions ?? ''} ${styles.spread ?? ''}`}>
        <h2 id="finance-settings-categories" className={styles.cardTitle}>
          {t('finance.settings.categories')}
        </h2>
        <Button
          onClick={() => {
            void navigate({ to: '/finance/categories/new', search: { kind: 'expense' } });
          }}
        >
          {t('finance.settings.new_category')}
        </Button>
      </div>
      <p className={styles.cardHelp}>{t('finance.settings.categories_help')}</p>
      <div className={styles.screen}>
        <CategoryGroup kind="income" />
        <CategoryGroup kind="expense" />
      </div>
    </Card>
  );
}
