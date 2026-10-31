//! Casos de uso de transferências (RF-29, RN-05).

use chrono::NaiveDate;
use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{
    AccountRepository, Outcome, TransferFilter, TransferRepository,
};
use crate::finance::domain::optional_text;
use crate::finance::domain::transaction::DESCRIPTION_MAX_CHARS;
use crate::finance::domain::transfer::{Transfer, TransferEnd, validate_transfer};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewTransfer {
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub amount: i64,
    pub transferred_on: NaiveDate,
    pub description: Option<String>,
    pub visibility: Visibility,
}

pub async fn create<A: AccountRepository, T: TransferRepository>(
    accounts: &A,
    transfers: &T,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewTransfer,
) -> Outcome<Transfer> {
    let description = optional_text(input.description, "description", DESCRIPTION_MAX_CHARS)?;
    let from = accounts.get(owner_id, input.from_account_id).await?;
    let to = accounts.get(owner_id, input.to_account_id).await?;
    validate_transfer(
        TransferEnd {
            account_id: from.id,
            currency: from.currency,
        },
        TransferEnd {
            account_id: to.id,
            currency: to.currency,
        },
        input.amount,
    )?;
    let now = env.clock.now();
    let transfer = Transfer {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        from_account_id: from.id,
        to_account_id: to.id,
        amount: input.amount,
        currency: from.currency,
        transferred_on: input.transferred_on,
        description,
        statement_period: None,
        created_at: now,
        updated_at: now,
    };
    transfers.insert(&transfer).await?;
    Ok(transfer)
}

/// Transferências com `transferred_on` no intervalo e a busca na descrição.
pub async fn list<T: TransferRepository>(
    transfers: &T,
    owner_id: Uuid,
    filter: &TransferFilter,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<Transfer>> {
    transfers.list(owner_id, filter, after, limit).await
}

pub async fn delete<T: TransferRepository>(
    transfers: &T,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<()> {
    transfers.delete(owner_id, id, env.clock.now()).await
}
