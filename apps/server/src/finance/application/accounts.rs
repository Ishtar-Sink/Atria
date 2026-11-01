//! Casos de uso de contas (RF-24, RF-25, RF-26). Toda chamada garante,
//! antes, a "Conta principal" do usuário, criada uma única vez. A exclusão de uma
//! conta com movimentações leva tudo para uma conta de destino (RF-05, RF-06).

use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{AccountRepository, Outcome};
use crate::finance::domain::FinanceError;
use crate::finance::domain::account::{Account, validate_name};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewAccount {
    pub name: String,
    pub visibility: Visibility,
}

/// Campos ausentes ficam como estão.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AccountPatch {
    pub name: Option<String>,
    pub visibility: Option<Visibility>,
}

pub async fn ensure_default<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
) -> Outcome<()> {
    let candidate = Account::default_for(owner_id, env.ids.new_id(), env.clock.now());
    repo.ensure_default(owner_id, &candidate).await
}

pub async fn list<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<Account>> {
    ensure_default(repo, env, owner_id).await?;
    repo.list(owner_id, after, limit).await
}

/// Todas as contas do dono, página a página.
pub async fn list_all<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
) -> Outcome<Vec<Account>> {
    ensure_default(repo, env, owner_id).await?;
    let mut all = Vec::new();
    loop {
        let after = all.last().map(|account: &Account| account.id);
        let page = repo.list(owner_id, after, super::SCAN_PAGE).await?;
        let done = page.len() < super::SCAN_PAGE as usize;
        all.extend(page);
        if done {
            return Ok(all);
        }
    }
}

pub async fn get<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<Account> {
    ensure_default(repo, env, owner_id).await?;
    repo.get(owner_id, id).await
}

pub async fn create<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewAccount,
) -> Outcome<Account> {
    ensure_default(repo, env, owner_id).await?;
    let name = validate_name(&input.name)?;
    let now = env.clock.now();
    let account = Account {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        name,
        is_default: false,
        balance_amount: 0,
        currency: Currency::default(),
        created_at: now,
        updated_at: now,
    };
    repo.insert(&account).await?;
    Ok(account)
}

pub async fn update<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    patch: AccountPatch,
) -> Outcome<Account> {
    let mut account = get(repo, env, owner_id, id).await?;
    let now = env.clock.now();
    if let Some(name) = patch.name.as_deref() {
        account.rename(name, now)?;
    }
    if let Some(visibility) = patch.visibility {
        account.visibility = visibility;
    }
    account.updated_at = now;
    repo.update(&account).await?;
    Ok(account)
}

/// O destino de uma exclusão é sempre outra conta (RN-04).
pub fn check_destination(account_id: Uuid, move_to: Option<Uuid>) -> Outcome<()> {
    if move_to == Some(account_id) {
        return Err(FinanceError::invalid("move_to", "same_account"));
    }
    Ok(())
}

/// Devolve os ids das transferências entre a conta e o destino, excluídas junto (RN-05).
pub async fn delete<R: AccountRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    move_to: Option<Uuid>,
) -> Outcome<Vec<Uuid>> {
    ensure_default(repo, env, owner_id).await?;
    check_destination(id, move_to)?;
    repo.delete(owner_id, id, move_to, env.clock.now()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destination_must_differ_from_deleted_account() {
        let id = Uuid::from_u128(1);

        assert!(matches!(
            check_destination(id, Some(id)),
            Err(FinanceError::Validation(issues))
                if issues[0].field == "move_to" && issues[0].code == "same_account"
        ));
        assert!(check_destination(id, None).is_ok());
        assert!(check_destination(id, Some(Uuid::from_u128(2))).is_ok());
    }
}
