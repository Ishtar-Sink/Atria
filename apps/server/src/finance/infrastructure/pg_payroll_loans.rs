//! Repositório dos consignados descontados em folha (SPEC-006), com a criação sob demanda da
//! categoria "Empréstimo" na mesma transação do cadastro (RF-05).

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{Outcome, PayrollLoanFilter, PayrollLoanRepository};
use crate::finance::domain::FinanceError;
use crate::finance::domain::category::{Category, SystemCategory};
use crate::finance::domain::payroll_loan::{IncomeLink, LoanTerm, PayrollLoan};
use crate::finance::domain::transaction::Transaction;
use crate::finance::infrastructure::{
    TransactionRow, Tx, begin, commit, corrupt, currency, storage,
};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct PgPayrollLoans {
    pool: PgPool,
}

impl PgPayrollLoans {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct PayrollLoanRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    income_id: Option<Uuid>,
    income_recurrence_id: Option<Uuid>,
    category_id: Uuid,
    name: String,
    contract_number: Option<String>,
    installment_amount: i64,
    currency: String,
    total_installments: Option<i16>,
    current_installment: Option<i16>,
    ends_on: Option<NaiveDate>,
    starts_on: NaiveDate,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl PayrollLoanRow {
    fn into_domain(self) -> Outcome<PayrollLoan> {
        let income = match (self.income_id, self.income_recurrence_id) {
            (Some(id), None) => IncomeLink::Transaction(id),
            (None, Some(id)) => IncomeLink::Recurrence(id),
            _ => return Err(corrupt("income_id")),
        };
        let term = match (
            self.total_installments,
            self.current_installment,
            self.ends_on,
        ) {
            (Some(total), Some(current), None) => LoanTerm::Installments { total, current },
            (None, None, Some(ends_on)) => LoanTerm::EndsOn(ends_on),
            _ => return Err(corrupt("total_installments")),
        };
        Ok(PayrollLoan {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            income,
            category_id: self.category_id,
            name: self.name,
            contract_number: self.contract_number,
            installment_amount: self.installment_amount,
            currency: currency(&self.currency)?,
            term,
            starts_on: self.starts_on,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

fn income_ids(income: IncomeLink) -> (Option<Uuid>, Option<Uuid>) {
    match income {
        IncomeLink::Transaction(id) => (Some(id), None),
        IncomeLink::Recurrence(id) => (None, Some(id)),
    }
}

fn term_columns(term: LoanTerm) -> (Option<i16>, Option<i16>, Option<NaiveDate>) {
    match term {
        LoanTerm::Installments { total, current } => (Some(total), Some(current), None),
        LoanTerm::EndsOn(ends_on) => (None, None, Some(ends_on)),
    }
}

/// Trava os consignados ativos da entrada, na ordem do id, para a liquidação conjunta
/// (RNF-03).
pub(crate) async fn lock_loans_for(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    link: IncomeLink,
) -> Outcome<Vec<PayrollLoan>> {
    let (income_id, income_recurrence_id) = income_ids(link);
    let rows: Vec<PayrollLoanRow> = sqlx::query_as!(PayrollLoanRow, "SELECT id, owner_id, visibility AS \"visibility: _\", income_id, income_recurrence_id, category_id, \
    name, contract_number, installment_amount, currency, total_installments, current_installment, \
    ends_on AS \"ends_on: _\", starts_on AS \"starts_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" \
             FROM payroll_loans WHERE owner_id = $1 AND deleted_at IS NULL \
             AND (income_id = $2 OR income_recurrence_id = $3) ORDER BY id FOR UPDATE", owner_id, income_id, income_recurrence_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(storage)?;
    rows.into_iter().map(PayrollLoanRow::into_domain).collect()
}

/// Trava as saídas das parcelas liquidadas com a entrada, para o desfazer e a exclusão
/// conjuntos (RF-09).
pub(crate) async fn lock_installments_of(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    income_transaction_id: Uuid,
) -> Outcome<Vec<Transaction>> {
    let rows: Vec<TransactionRow> = sqlx::query_as!(TransactionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, \
    category_id, description, expected_amount, gross_amount, adjustments AS \"adjustments: _\", expected_date AS \"expected_date: _\", \
    settled_amount, settled_at AS \"settled_at: _\", settled_gross_amount, settled_adjustments AS \"settled_adjustments: _\", \
    difference_amount, difference_kind, currency, generated_from, occurrence_date AS \"occurrence_date: _\", \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", payroll_loan_id, income_transaction_id, installment_number FROM transactions \
             WHERE owner_id = $1 AND income_transaction_id = $2 AND deleted_at IS NULL ORDER BY id FOR UPDATE", owner_id, income_transaction_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(storage)?;
    rows.into_iter().map(TransactionRow::into_domain).collect()
}

/// Exclusão lógica dos consignados da entrada excluída (RN-09).
pub(crate) async fn delete_loans_for(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    link: IncomeLink,
    now: DateTime<Utc>,
) -> Outcome<()> {
    let (income_id, income_recurrence_id) = income_ids(link);
    sqlx::query!(
        "UPDATE payroll_loans SET deleted_at = $4, updated_at = $4 \
         WHERE owner_id = $1 AND deleted_at IS NULL \
         AND (income_id = $2 OR income_recurrence_id = $3)",
        owner_id,
        income_id,
        income_recurrence_id,
        now as _
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

/// A "Empréstimo" da pessoa: a que já tem a chave, a de saída com esse nome adotada ou a
/// candidata gravada agora. O `categories_owner_loan_key` garante uma só.
pub(crate) async fn resolve_loan_category(tx: &mut Tx<'_>, candidate: &Category) -> Outcome<Uuid> {
    let existing = sqlx::query_scalar!(
        "SELECT id FROM categories WHERE owner_id = $1 AND system_key = 'loan' \
         AND deleted_at IS NULL",
        candidate.owner_id
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?;
    if let Some(id) = existing {
        return Ok(id);
    }
    // Uma categoria de saída "Empréstimo" criada pela pessoa é adotada: o
    // `categories_owner_kind_name_key` recusaria uma segunda com o mesmo nome.
    let adopted = sqlx::query_scalar!(
        "UPDATE categories SET system_key = 'loan', updated_at = $2 \
         WHERE owner_id = $1 AND kind = 'expense' AND lower(name) = lower($3) \
         AND system_key IS NULL AND deleted_at IS NULL RETURNING id",
        candidate.owner_id,
        candidate.updated_at as _,
        &candidate.name
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?;
    if let Some(id) = adopted {
        return Ok(id);
    }
    sqlx::query!(
        "INSERT INTO categories (id, owner_id, visibility, name, kind, color, system_key, \
         created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        candidate.id,
        candidate.owner_id,
        candidate.visibility as _,
        &candidate.name,
        candidate.kind.as_str(),
        candidate.color.as_str(),
        candidate.system_key.map(SystemCategory::key),
        candidate.created_at as _,
        candidate.updated_at as _
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(candidate.id)
}

impl PayrollLoanRepository for PgPayrollLoans {
    async fn insert(
        &self,
        loan: &PayrollLoan,
        candidate_category: &Category,
    ) -> Outcome<PayrollLoan> {
        let mut tx = begin(&self.pool, loan.owner_id).await?;
        let category_id = resolve_loan_category(&mut tx, candidate_category).await?;
        let (income_id, income_recurrence_id) = income_ids(loan.income);
        let (total, current, ends_on) = term_columns(loan.term);
        sqlx::query!(
            "INSERT INTO payroll_loans (id, owner_id, visibility, income_id, \
             income_recurrence_id, category_id, name, contract_number, installment_amount, \
             currency, total_installments, current_installment, ends_on, starts_on, \
             created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)",
            loan.id,
            loan.owner_id,
            loan.visibility as _,
            income_id,
            income_recurrence_id,
            category_id,
            &loan.name,
            loan.contract_number.as_deref(),
            loan.installment_amount,
            loan.currency.as_str(),
            total,
            current,
            ends_on as _,
            loan.starts_on as _,
            loan.created_at as _,
            loan.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        Ok(PayrollLoan {
            category_id,
            ..loan.clone()
        })
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<PayrollLoan> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<PayrollLoanRow> = sqlx::query_as!(PayrollLoanRow, "SELECT id, owner_id, visibility AS \"visibility: _\", income_id, income_recurrence_id, category_id, \
    name, contract_number, installment_amount, currency, total_installments, current_installment, \
    ends_on AS \"ends_on: _\", starts_on AS \"starts_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" \
             FROM payroll_loans WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn list(
        &self,
        owner_id: Uuid,
        filter: PayrollLoanFilter,
        after: Option<Uuid>,
        limit: u32,
    ) -> Outcome<Vec<PayrollLoan>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<PayrollLoanRow> = sqlx::query_as!(PayrollLoanRow, "SELECT id, owner_id, visibility AS \"visibility: _\", income_id, income_recurrence_id, category_id, \
    name, contract_number, installment_amount, currency, total_installments, current_installment, \
    ends_on AS \"ends_on: _\", starts_on AS \"starts_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" \
             FROM payroll_loans WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::uuid IS NULL OR income_id = $2) \
             AND ($3::uuid IS NULL OR income_recurrence_id = $3) \
             AND ($4::uuid IS NULL OR id > $4) ORDER BY id LIMIT $5", owner_id, filter.income_id, filter.income_recurrence_id, after, i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(PayrollLoanRow::into_domain).collect()
    }

    async fn update(&self, loan: &PayrollLoan) -> Outcome<()> {
        let mut tx = begin(&self.pool, loan.owner_id).await?;
        let (total, current, ends_on) = term_columns(loan.term);
        let result = sqlx::query!(
            "UPDATE payroll_loans SET name = $3, contract_number = $4, installment_amount = $5, \
             total_installments = $6, current_installment = $7, ends_on = $8, starts_on = $9, \
             updated_at = $10 WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            loan.id,
            loan.owner_id,
            &loan.name,
            loan.contract_number.as_deref(),
            loan.installment_amount,
            total,
            current,
            ends_on as _,
            loan.starts_on as _,
            loan.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if result.rows_affected() == 0 {
            return Err(FinanceError::NotFound);
        }
        commit(tx).await
    }

    async fn delete(&self, owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let result = sqlx::query!(
            "UPDATE payroll_loans SET deleted_at = $3, updated_at = $3 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            id,
            owner_id,
            now as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if result.rows_affected() == 0 {
            return Err(FinanceError::NotFound);
        }
        commit(tx).await
    }
}
