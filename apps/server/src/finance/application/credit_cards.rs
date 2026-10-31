//! Fatura do cartão por período e o pagamento como transferência que liquida a
//! fatura (RF-34, RN-06, RN-07).

use std::collections::BTreeMap;

use chrono::NaiveDate;
use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{
    AccountRepository, Outcome, StatementPayment, TransactionRepository,
};
use crate::finance::domain::FinanceError;
use crate::finance::domain::account::{Account, CreditCardTerms};
use crate::finance::domain::credit_card::{StatementPeriod, outstanding_amount};
use crate::finance::domain::transaction::{Transaction, TransactionKind};
use crate::finance::domain::transfer::{Transfer, TransferEnd, validate_transfer};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Statement {
    pub period: StatementPeriod,
    pub closing_date: NaiveDate,
    pub due_date: NaiveDate,
    /// Saídas menos entradas do período, pelo valor previsto.
    pub total_amount: i64,
    /// O que ainda não foi liquidado.
    pub outstanding_amount: i64,
    pub transaction_count: usize,
    pub paid: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatementPaymentInput {
    pub from_account_id: Uuid,
    pub paid_on: NaiveDate,
}

async fn card<A: AccountRepository>(
    accounts: &A,
    owner_id: Uuid,
    card_id: Uuid,
) -> Outcome<(Account, CreditCardTerms)> {
    let account = accounts.get(owner_id, card_id).await?;
    match account.card {
        Some(terms) => Ok((account, terms)),
        None => Err(FinanceError::NotFound),
    }
}

pub async fn statements<A, T>(
    accounts: &A,
    transactions: &T,
    owner_id: Uuid,
    card_id: Uuid,
) -> Outcome<Vec<Statement>>
where
    A: AccountRepository,
    T: TransactionRepository,
{
    let (_, terms) = card(accounts, owner_id, card_id).await?;
    let items = transactions.statement_items(owner_id, card_id).await?;
    let paid = transactions.paid_periods(owner_id, card_id).await?;
    let mut by_period: BTreeMap<StatementPeriod, Vec<Transaction>> = BTreeMap::new();
    for item in items {
        if let Some(period) = item.statement_period {
            by_period.entry(period).or_default().push(item);
        }
    }
    Ok(by_period
        .into_iter()
        .map(|(period, items)| Statement {
            period,
            closing_date: terms.cycle.closing_date(period),
            due_date: terms.cycle.due_date(period),
            total_amount: items.iter().map(signed_expected).sum(),
            outstanding_amount: outstanding_amount(&items),
            transaction_count: items.len(),
            paid: paid.contains(&period),
        })
        .collect())
}

fn signed_expected(item: &Transaction) -> i64 {
    match item.kind {
        TransactionKind::Expense => item.expected_amount,
        TransactionKind::Income => -item.expected_amount,
    }
}

pub async fn pay<A, T>(
    accounts: &A,
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    card_id: Uuid,
    period: StatementPeriod,
    input: StatementPaymentInput,
) -> Outcome<StatementPayment>
where
    A: AccountRepository,
    T: TransactionRepository,
{
    let (card, _) = card(accounts, owner_id, card_id).await?;
    let from = accounts.get(owner_id, input.from_account_id).await?;
    // O valor real sai das movimentações em aberto, dentro da transação do banco.
    validate_transfer(
        TransferEnd {
            account_id: from.id,
            currency: from.currency,
        },
        TransferEnd {
            account_id: card.id,
            currency: card.currency,
        },
        1,
    )?;
    let now = env.clock.now();
    let draft = Transfer {
        id: env.ids.new_id(),
        owner_id,
        visibility: Visibility::Personal,
        from_account_id: from.id,
        to_account_id: card.id,
        amount: 0,
        currency: card.currency,
        transferred_on: input.paid_on,
        description: None,
        statement_period: Some(period),
        created_at: now,
        updated_at: now,
    };
    transactions.pay_statement(draft, period, now).await
}
