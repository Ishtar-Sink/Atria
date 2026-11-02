//! Repositório de movimentações: a liquidação e a exclusão mudam o saldo da conta na mesma transação ([project/database-03]). As listagens
//! usam a coluna gerada `effective_date`, a da liquidação ou a prevista (PD-55).

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use sqlx::types::Json;
use uuid::Uuid;

use crate::finance::application::ports::{
    Outcome, SettlementRequest, TransactionFilter, TransactionRepository, UndoneSettlement,
};
use crate::finance::domain::FinanceError;
use crate::finance::domain::payroll_loan::{
    IncomeLink, PayrollLoan, income_settled_amount, settled_installment,
};
use crate::finance::domain::transaction::{Transaction, TransactionEdit};
use crate::finance::infrastructure::pg_payroll_loans::{
    delete_loans_for, lock_installments_of, lock_loans_for,
};
use crate::finance::infrastructure::pg_recurring_transactions::{lock_recurring, save_last_closed};
use crate::finance::infrastructure::{
    TransactionRow, Tx, add_to_balance, adjustment_rows, begin, commit, escape_like,
    insert_transaction, lock_account, save_settlement, storage,
};
use crate::shared::ids::IdGenerator;

#[derive(Debug, Clone)]
pub struct PgTransactions {
    pool: PgPool,
}

impl PgTransactions {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

async fn lock_transaction(tx: &mut Tx<'_>, owner_id: Uuid, id: Uuid) -> Outcome<Transaction> {
    let row: Option<TransactionRow> = sqlx::query_as!(TransactionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, \
    category_id, description, expected_amount, gross_amount, adjustments AS \"adjustments: _\", expected_date AS \"expected_date: _\", \
    settled_amount, settled_at AS \"settled_at: _\", settled_gross_amount, settled_adjustments AS \"settled_adjustments: _\", \
    difference_amount, difference_kind, currency, generated_from, occurrence_date AS \"occurrence_date: _\", \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", payroll_loan_id, income_transaction_id, installment_number FROM transactions \
         WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE", id, owner_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?;
    row.ok_or(FinanceError::NotFound)?.into_domain()
}

/// Grava os campos da edição; o saldo não muda (RN-01).
async fn save_edit(tx: &mut Tx<'_>, item: &Transaction) -> Outcome<()> {
    sqlx::query!(
        "UPDATE transactions SET description = $1, expected_amount = $2, expected_date = $3, \
         account_id = $4, currency = $5, category_id = $6, visibility = $7, \
         updated_at = $8, gross_amount = $11, adjustments = $12 \
         WHERE id = $9 AND owner_id = $10",
        item.description.as_deref(),
        item.expected_amount,
        item.expected_date as _,
        item.account_id,
        item.currency.as_str(),
        item.category_id,
        item.visibility as _,
        item.updated_at as _,
        item.id,
        item.owner_id,
        item.gross_amount,
        Json(adjustment_rows(&item.adjustments)) as _
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

async fn soft_delete(tx: &mut Tx<'_>, item: &Transaction, now: DateTime<Utc>) -> Outcome<()> {
    sqlx::query!(
        "UPDATE transactions SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_id = $3",
        now as _,
        item.id,
        item.owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

/// Limpa os campos efetivos de uma movimentação que voltou a ficar prevista.
async fn clear_settlement(tx: &mut Tx<'_>, item: &Transaction) -> Outcome<()> {
    sqlx::query!(
        "UPDATE transactions SET settled_amount = NULL, settled_at = NULL, \
         difference_amount = NULL, difference_kind = NULL, settled_gross_amount = NULL, \
         settled_adjustments = NULL, updated_at = $1 \
         WHERE id = $2 AND owner_id = $3",
        item.updated_at as _,
        item.id,
        item.owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

/// A cópia do último fechamento de uma recorrente, ao ser excluída, reabre aquela
/// ocorrência (DEC-004); uma cópia mais antiga não muda a recorrente.
async fn reopen_occurrence(tx: &mut Tx<'_>, item: &Transaction, now: DateTime<Utc>) -> Outcome<()> {
    let (Some(recurrence_id), Some(occurrence_date)) = (item.generated_from, item.occurrence_date)
    else {
        return Ok(());
    };
    let mut recurring = match lock_recurring(tx, item.owner_id, recurrence_id).await {
        Ok(recurring) => recurring,
        Err(FinanceError::NotFound) => return Ok(()),
        Err(error) => return Err(error),
    };
    if recurring.reopen_after_copy_deleted(occurrence_date, now) {
        save_last_closed(tx, &recurring).await?;
    }
    Ok(())
}

/// Soma das parcelas, com o mesmo limite do valor liquidado.
pub(crate) fn installments_total<'a>(
    mut loans: impl Iterator<Item = &'a PayrollLoan>,
) -> Outcome<i64> {
    loans.try_fold(0i64, |sum, loan| {
        sum.checked_add(loan.installment_amount)
            .ok_or_else(|| FinanceError::invalid("account_amount", "too_large"))
    })
}

/// Exclusão lógica das parcelas liquidadas com a entrada; devolve a variação do saldo que
/// reverte o efeito delas (RF-09).
async fn delete_installments(
    tx: &mut Tx<'_>,
    income: &Transaction,
    now: DateTime<Utc>,
) -> Outcome<i64> {
    let mut revert = 0i64;
    for installment in lock_installments_of(tx, income.owner_id, income.id).await? {
        soft_delete(tx, &installment, now).await?;
        revert = revert
            .checked_sub(installment.applied_balance_delta())
            .ok_or_else(|| FinanceError::invalid("settled_amount", "too_large"))?;
    }
    Ok(revert)
}

impl TransactionRepository for PgTransactions {
    async fn insert_many(&self, items: &[Transaction]) -> Outcome<()> {
        let Some(first) = items.first() else {
            return Ok(());
        };
        let mut tx = begin(&self.pool, first.owner_id).await?;
        for item in items {
            insert_transaction(&mut tx, item).await?;
        }
        commit(tx).await
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<Transaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<TransactionRow> = sqlx::query_as!(TransactionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, \
    category_id, description, expected_amount, gross_amount, adjustments AS \"adjustments: _\", expected_date AS \"expected_date: _\", \
    settled_amount, settled_at AS \"settled_at: _\", settled_gross_amount, settled_adjustments AS \"settled_adjustments: _\", \
    difference_amount, difference_kind, currency, generated_from, occurrence_date AS \"occurrence_date: _\", \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", payroll_loan_id, income_transaction_id, installment_number FROM transactions \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn list(
        &self,
        owner_id: Uuid,
        filter: &TransactionFilter,
        after: Option<(NaiveDate, Uuid)>,
        limit: u32,
    ) -> Outcome<Vec<Transaction>> {
        let (after_date, after_id) = after.unzip();
        let mut tx = begin(&self.pool, owner_id).await?;
        // Filtros opcionais por parâmetro nulo: uma query literal checada na compilação.
        let rows = sqlx::query_as!(
            TransactionRow,
            "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, \
    category_id, description, expected_amount, gross_amount, adjustments AS \"adjustments: _\", expected_date AS \"expected_date: _\", \
    settled_amount, settled_at AS \"settled_at: _\", settled_gross_amount, settled_adjustments AS \"settled_adjustments: _\", \
    difference_amount, difference_kind, currency, generated_from, occurrence_date AS \"occurrence_date: _\", \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", payroll_loan_id, income_transaction_id, installment_number \
             FROM transactions WHERE deleted_at IS NULL AND owner_id = $1 \
             AND ($2::uuid IS NULL OR account_id = $2) \
             AND ($3::uuid IS NULL OR category_id = $3) \
             AND ($4::text IS NULL OR kind = $4) \
             AND ($5::date IS NULL OR effective_date >= $5) \
             AND ($6::date IS NULL OR effective_date <= $6) \
             AND ($7::text IS NULL OR finance_unaccent(lower(description)) LIKE '%' || \
                  finance_unaccent(lower($7)) || '%' ESCAPE '\\') \
             AND ($8::boolean IS NULL OR (settled_at IS NOT NULL) = $8) \
             AND ($9::date IS NULL OR (effective_date, id) > ($9, $10)) \
             ORDER BY effective_date, id LIMIT $11",
            owner_id,
            filter.account_id,
            filter.category_id,
            filter.kind.map(|kind| kind.as_str()),
            filter.from as _,
            filter.to as _,
            filter.q.as_deref().map(escape_like),
            filter.settled,
            after_date as _,
            after_id,
            i64::from(limit)
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(TransactionRow::into_domain).collect()
    }

    async fn settle(
        &self,
        owner_id: Uuid,
        id: Uuid,
        request: SettlementRequest,
        ids: &dyn IdGenerator,
        now: DateTime<Utc>,
    ) -> Outcome<Transaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let mut item = lock_transaction(&mut tx, owner_id, id).await?;
        item.ensure_not_installment()?;
        if item.is_settled() {
            return Err(FinanceError::TransactionAlreadySettled);
        }
        // Ordem das travas: entrada, consignados e conta (RNF-03).
        let dates = [item.expected_date];
        let installments: Vec<_> = lock_loans_for(&mut tx, owner_id, IncomeLink::Transaction(id))
            .await?
            .into_iter()
            .filter_map(|loan| {
                let installment = loan.installment_on(&dates, item.expected_date)?;
                Some((loan, installment.number))
            })
            .collect();
        let total = installments_total(installments.iter().map(|(loan, _)| loan))?;
        let settled_amount =
            income_settled_amount(request.settled_amount, request.account_amount, total)?;
        lock_account(&mut tx, owner_id, item.account_id).await?;
        let mut delta =
            item.settle_with(settled_amount, request.settled_at, request.adjustments, now)?;
        save_settlement(&mut tx, &item).await?;
        for (loan, number) in &installments {
            let installment = settled_installment(loan, &item, *number, ids.new_id(), now)?;
            insert_transaction(&mut tx, &installment).await?;
            save_settlement(&mut tx, &installment).await?;
            delta += installment.applied_balance_delta();
        }
        add_to_balance(&mut tx, owner_id, item.account_id, delta, now).await?;
        commit(tx).await?;
        Ok(item)
    }

    async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        edit: &TransactionEdit,
        now: DateTime<Utc>,
    ) -> Outcome<Transaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let mut item = lock_transaction(&mut tx, owner_id, id).await?;
        item.ensure_not_installment()?;
        let account_id = edit.account.map_or(item.account_id, |(account, _)| account);
        lock_account(&mut tx, owner_id, account_id).await?;
        item.apply_edit(edit, now)?;
        save_edit(&mut tx, &item).await?;
        commit(tx).await?;
        Ok(item)
    }

    async fn undo_settlement(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Outcome<UndoneSettlement> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let mut item = lock_transaction(&mut tx, owner_id, id).await?;
        item.ensure_not_installment()?;
        if !item.is_settled() {
            return Err(FinanceError::TransactionNotSettled);
        }
        // Mesma ordem de travas da exclusão: movimentação, recorrente, parcelas e conta.
        reopen_occurrence(&mut tx, &item, now).await?;
        let installments_revert = delete_installments(&mut tx, &item, now).await?;
        lock_account(&mut tx, owner_id, item.account_id).await?;
        let revert = item.undo_settlement(now)? + installments_revert;
        // A cópia só existe como histórico da liquidação (DEC-003): desfazer a apaga.
        let outcome = if item.generated_from.is_some() {
            soft_delete(&mut tx, &item, now).await?;
            UndoneSettlement::CopyDeleted(item.id)
        } else {
            clear_settlement(&mut tx, &item).await?;
            UndoneSettlement::Reopened(Box::new(item.clone()))
        };
        add_to_balance(&mut tx, owner_id, item.account_id, revert, now).await?;
        commit(tx).await?;
        Ok(outcome)
    }

    async fn delete(&self, owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let item = lock_transaction(&mut tx, owner_id, id).await?;
        item.ensure_not_installment()?;
        reopen_occurrence(&mut tx, &item, now).await?;
        let revert = delete_installments(&mut tx, &item, now).await? - item.applied_balance_delta();
        delete_loans_for(&mut tx, owner_id, IncomeLink::Transaction(id), now).await?;
        if revert != 0 {
            lock_account(&mut tx, owner_id, item.account_id).await?;
        }
        soft_delete(&mut tx, &item, now).await?;
        add_to_balance(&mut tx, owner_id, item.account_id, revert, now).await?;
        commit(tx).await
    }
}
