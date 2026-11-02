//! Casos de uso dos consignados descontados em folha (SPEC-006, RF-02 a RF-05). O consignado
//! guarda só o prazo informado; o status, a parcela atual, a próxima, a última e as restantes
//! são calculados na leitura sobre as datas atuais da entrada (CT-01, CT-02).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::application::ports::{
    Outcome, PayrollLoanFilter, PayrollLoanRepository, RecurringTransactionRepository,
    TransactionRepository,
};
use crate::finance::application::{Env, SCAN_PAGE};
use crate::finance::domain::FinanceError;
use crate::finance::domain::category::loan_category;
use crate::finance::domain::forecast::{
    VirtualInstallment, one_off_installment, project, recurring_installments,
};
use crate::finance::domain::payroll_loan::{
    IncomeLink, IncomeSource, PayrollLoan, PayrollLoanStatus, income_dates, validate_fields,
    validate_term,
};
use crate::finance::domain::transaction::TransactionKind;

/// Um consignado com a entrada de origem e as datas dela, para as projeções (RF-06).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoanSource {
    pub loan: PayrollLoan,
    pub source: IncomeSource,
    pub dates: Vec<NaiveDate>,
}

/// Todos os consignados do dono, página a página, cada um com a entrada e as datas dela.
/// Um consignado cuja entrada não existe mais não tem parcelas a projetar.
pub async fn loan_sources<L, T, R>(
    loans: &L,
    transactions: &T,
    recurring: &R,
    owner_id: Uuid,
) -> Outcome<Vec<LoanSource>>
where
    L: PayrollLoanRepository,
    T: TransactionRepository,
    R: RecurringTransactionRepository,
{
    let mut all: Vec<PayrollLoan> = Vec::new();
    loop {
        let after = all.last().map(|loan| loan.id);
        let page = loans
            .list(owner_id, PayrollLoanFilter::default(), after, SCAN_PAGE)
            .await?;
        let done = page.len() < SCAN_PAGE as usize;
        all.extend(page);
        if done {
            break;
        }
    }
    let mut items = Vec::with_capacity(all.len());
    for loan in all {
        let source = match source(transactions, recurring, owner_id, loan.income).await {
            Ok(source) => source,
            Err(FinanceError::NotFound) => continue,
            Err(error) => return Err(error),
        };
        let dates = income_dates(&loan, &source);
        items.push(LoanSource {
            loan,
            source,
            dates,
        });
    }
    Ok(items)
}

/// As parcelas abertas do consignado em `[from, to]`: as das ocorrências projetadas da
/// recorrente ou a da avulsa ainda aberta (RF-06, FA-04).
pub fn project_loan(
    item: &LoanSource,
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
    now: DateTime<Utc>,
    max_items: usize,
) -> Vec<VirtualInstallment> {
    match &item.source {
        IncomeSource::Recurring(rule) => {
            let occurrences = project(rule, from, to, now, max_items);
            recurring_installments(&item.loan, &item.dates, &occurrences)
        }
        IncomeSource::OneOff(income) => one_off_installment(&item.loan, income, now.date_naive())
            .filter(|installment| {
                max_items > 0
                    && from.is_none_or(|start| installment.date >= start)
                    && to.is_none_or(|end| installment.date <= end)
            })
            .into_iter()
            .collect(),
    }
}

/// O consignado com o prazo calculado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PayrollLoanView {
    pub loan: PayrollLoan,
    pub status: PayrollLoanStatus,
    pub current_installment: Option<i16>,
    pub next_installment_on: Option<NaiveDate>,
    pub last_installment_on: Option<NaiveDate>,
    pub remaining_installments: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewPayrollLoan {
    pub income_id: Option<Uuid>,
    pub income_recurrence_id: Option<Uuid>,
    pub name: String,
    pub contract_number: Option<String>,
    pub installment_amount: i64,
    pub total_installments: Option<i16>,
    pub current_installment: Option<i16>,
    pub ends_on: Option<NaiveDate>,
}

/// Campos ausentes ficam como estão; `contract_number` vazio apaga o contrato.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PayrollLoanPatch {
    pub name: Option<String>,
    pub contract_number: Option<String>,
    pub installment_amount: Option<i64>,
    pub total_installments: Option<i16>,
    pub current_installment: Option<i16>,
    pub ends_on: Option<NaiveDate>,
}

pub fn view(loan: PayrollLoan, source: &IncomeSource) -> PayrollLoanView {
    let dates = income_dates(&loan, source);
    let open = source.open_date();
    let status = loan.status_at(&dates, open);
    let installments = loan.installments(&dates);
    let last_installment_on = installments.last().map(|item| item.date);
    let (current_installment, next_installment_on, remaining_installments) = match (status, open) {
        (PayrollLoanStatus::Active, Some(open)) => (
            loan.installment_on(&dates, open)
                .and_then(|item| item.number),
            Some(open),
            installments.iter().filter(|item| item.date >= open).count(),
        ),
        _ => (None, None, 0),
    };
    PayrollLoanView {
        loan,
        status,
        current_installment,
        next_installment_on,
        last_installment_on,
        remaining_installments,
    }
}

/// A entrada de origem do dono; a de outra pessoa não existe para ele.
pub async fn source<T: TransactionRepository, R: RecurringTransactionRepository>(
    transactions: &T,
    recurring: &R,
    owner_id: Uuid,
    link: IncomeLink,
) -> Outcome<IncomeSource> {
    match link {
        IncomeLink::Transaction(id) => transactions
            .get(owner_id, id)
            .await
            .map(IncomeSource::OneOff),
        IncomeLink::Recurrence(id) => recurring
            .get(owner_id, id)
            .await
            .map(IncomeSource::Recurring),
    }
}

fn link_of(income_id: Option<Uuid>, income_recurrence_id: Option<Uuid>) -> Outcome<IncomeLink> {
    match (income_id, income_recurrence_id) {
        (Some(id), None) => Ok(IncomeLink::Transaction(id)),
        (None, Some(id)) => Ok(IncomeLink::Recurrence(id)),
        _ => Err(FinanceError::invalid("income_id", "fields_mismatch")),
    }
}

/// Só uma entrada ainda aberta recebe consignado (RF-02).
fn ensure_open_income(source: &IncomeSource) -> Outcome<NaiveDate> {
    match source {
        IncomeSource::OneOff(item) if item.kind != TransactionKind::Income => {
            Err(FinanceError::invalid("income_id", "not_income"))
        }
        IncomeSource::OneOff(item) if item.is_settled() => {
            Err(FinanceError::invalid("income_id", "already_settled"))
        }
        IncomeSource::Recurring(rule) if rule.kind != TransactionKind::Income => {
            Err(FinanceError::invalid("income_recurrence_id", "not_income"))
        }
        _ => source.open_date().ok_or(FinanceError::RecurrenceEnded),
    }
}

pub async fn create<L, T, R>(
    loans: &L,
    transactions: &T,
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewPayrollLoan,
) -> Outcome<PayrollLoanView>
where
    L: PayrollLoanRepository,
    T: TransactionRepository,
    R: RecurringTransactionRepository,
{
    let link = link_of(input.income_id, input.income_recurrence_id)?;
    let source = source(transactions, recurring, owner_id, link).await?;
    let open = ensure_open_income(&source)?;
    let fields = validate_fields(&input.name, input.contract_number, input.installment_amount)?;
    let term = validate_term(
        input.total_installments,
        input.current_installment,
        input.ends_on,
        open,
    )?;
    let (visibility, currency) = match &source {
        IncomeSource::OneOff(item) => (item.visibility, item.currency),
        IncomeSource::Recurring(rule) => (rule.visibility, rule.currency),
    };
    let now = env.clock.now();
    let candidate = loan_category(owner_id, env.ids.new_id(), now);
    let loan = PayrollLoan {
        id: env.ids.new_id(),
        owner_id,
        visibility,
        income: link,
        category_id: candidate.id,
        name: fields.name,
        contract_number: fields.contract_number,
        installment_amount: fields.installment_amount,
        currency,
        term,
        starts_on: open,
        created_at: now,
        updated_at: now,
    };
    let saved = loans.insert(&loan, &candidate).await?;
    Ok(view(saved, &source))
}

pub async fn get<L, T, R>(
    loans: &L,
    transactions: &T,
    recurring: &R,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<PayrollLoanView>
where
    L: PayrollLoanRepository,
    T: TransactionRepository,
    R: RecurringTransactionRepository,
{
    let loan = loans.get(owner_id, id).await?;
    let source = source(transactions, recurring, owner_id, loan.income).await?;
    Ok(view(loan, &source))
}

pub async fn list<L, T, R>(
    loans: &L,
    transactions: &T,
    recurring: &R,
    owner_id: Uuid,
    filter: PayrollLoanFilter,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<PayrollLoanView>>
where
    L: PayrollLoanRepository,
    T: TransactionRepository,
    R: RecurringTransactionRepository,
{
    let page = loans.list(owner_id, filter, after, limit).await?;
    let mut views = Vec::with_capacity(page.len());
    for loan in page {
        let source = source(transactions, recurring, owner_id, loan.income).await?;
        views.push(view(loan, &source));
    }
    Ok(views)
}

pub async fn update<L, T, R>(
    loans: &L,
    transactions: &T,
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    patch: PayrollLoanPatch,
) -> Outcome<PayrollLoanView>
where
    L: PayrollLoanRepository,
    T: TransactionRepository,
    R: RecurringTransactionRepository,
{
    let mut loan = loans.get(owner_id, id).await?;
    let source = source(transactions, recurring, owner_id, loan.income).await?;
    let fields = validate_fields(
        patch.name.as_deref().unwrap_or(&loan.name),
        patch
            .contract_number
            .or_else(|| loan.contract_number.clone()),
        patch.installment_amount.unwrap_or(loan.installment_amount),
    )?;
    loan.name = fields.name;
    loan.contract_number = fields.contract_number;
    loan.installment_amount = fields.installment_amount;
    let term_changed = patch.total_installments.is_some()
        || patch.current_installment.is_some()
        || patch.ends_on.is_some();
    if term_changed {
        // A parcela atual informada vale para a entrada aberta agora, então o início é
        // regravado nela.
        let open = source.open_date().ok_or(match source {
            IncomeSource::OneOff(_) => FinanceError::invalid("income_id", "already_settled"),
            IncomeSource::Recurring(_) => FinanceError::RecurrenceEnded,
        })?;
        loan.term = validate_term(
            patch.total_installments,
            patch.current_installment,
            patch.ends_on,
            open,
        )?;
        loan.starts_on = open;
    }
    loan.updated_at = env.clock.now();
    loans.update(&loan).await?;
    Ok(view(loan, &source))
}

pub async fn delete<L: PayrollLoanRepository>(
    loans: &L,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<()> {
    loans.delete(owner_id, id, env.clock.now()).await
}
