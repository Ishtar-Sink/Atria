//! Gancho de exclusão para remover as ligações dos dois lados (CB-06).

use std::sync::{Arc, Mutex};

use axum::Extension;
use axum::http::StatusCode;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::{ALICE, FinanceTest, id_of, monthly_rule};
use crate::finance;
use crate::finance::application::ports::EntityDeletedHook;
use crate::shared::db::begin_for_user;

/// Chamada recebida pelo gancho e se a exclusão já estava gravada naquele momento.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Call {
    owner_id: Uuid,
    entity_type: &'static str,
    entity_id: Uuid,
    committed: bool,
}

type Calls = Arc<Mutex<Vec<Call>>>;

async fn is_deleted(pool: &PgPool, owner_id: Uuid, entity_type: &str, id: Uuid) -> bool {
    let table = match entity_type {
        "account" => "accounts",
        "transaction" => "transactions",
        "transfer" => "transfers",
        _ => return false,
    };
    // Outra conexão só enxerga a exclusão depois do commit.
    let mut tx = begin_for_user(pool, owner_id).await.unwrap();
    let deleted: Option<bool> = sqlx::query_scalar(&format!(
        "SELECT deleted_at IS NOT NULL FROM {table} WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .unwrap();
    deleted.unwrap_or(false)
}

fn recording_hook(pool: PgPool, calls: Calls) -> EntityDeletedHook {
    Arc::new(move |owner_id, entity_type, entity_id| {
        let pool = pool.clone();
        let calls = calls.clone();
        Box::pin(async move {
            let committed = is_deleted(&pool, owner_id, entity_type, entity_id).await;
            calls.lock().unwrap().push(Call {
                owner_id,
                entity_type,
                entity_id,
                committed,
            });
        })
    })
}

async fn with_hook() -> (FinanceTest, Calls) {
    let calls: Calls = Arc::default();
    let mut test = FinanceTest::new().await;
    let hook = recording_hook(test.pool().clone(), calls.clone());
    test.app = test.ctx.app(finance::router().layer(Extension(hook)));
    (test, calls)
}

fn call(entity_type: &'static str, id: &str) -> Call {
    Call {
        owner_id: ALICE,
        entity_type,
        entity_id: id.parse().unwrap(),
        committed: true,
    }
}

#[tokio::test]
async fn deleting_account_transaction_and_transfer_calls_entity_deleted_hook() {
    let (t, calls) = with_hook().await;
    let checking = t.default_account(&t.alice).await;
    let spare = t.create_account(&t.alice, "Sem uso").await;
    let target = t.create_account(&t.alice, "Destino").await;
    let item = t
        .create_transaction(&t.alice, &checking, "expense", 5_000, "2026-11-05")
        .await;
    let transfer = json!({
        "from_account_id": checking,
        "to_account_id": target,
        "amount": 1_000,
        "transferred_on": "2026-11-05",
    });
    let (_, transfer) = t.post(&t.alice, "/transfers", transfer).await;
    let rent = t
        .create_recurring(
            &t.alice,
            &checking,
            "expense",
            2_000,
            monthly_rule("2026-11-10", 10),
        )
        .await;
    let (_, copy) = t
        .settle_occurrence(&t.alice, &id_of(&rent), "2026-11-10", 2_000, "2026-11-10")
        .await;

    let (account_status, _) = t.delete(&t.alice, &format!("/accounts/{spare}")).await;
    let item_id = id_of(&item);
    let (item_status, _) = t
        .delete(&t.alice, &format!("/transactions/{item_id}"))
        .await;
    let transfer_id = id_of(&transfer);
    let (transfer_status, _) = t
        .delete(&t.alice, &format!("/transfers/{transfer_id}"))
        .await;
    let copy_id = id_of(&copy);
    let (copy_status, _) = t
        .delete(&t.alice, &format!("/transactions/{copy_id}"))
        .await;
    let (refused, _) = t.delete(&t.alice, &format!("/accounts/{checking}")).await;
    let (again, _) = t
        .delete(&t.alice, &format!("/transfers/{transfer_id}"))
        .await;

    assert_eq!(account_status, StatusCode::NO_CONTENT);
    assert_eq!(item_status, StatusCode::NO_CONTENT);
    assert_eq!(transfer_status, StatusCode::NO_CONTENT);
    assert_eq!(copy_status, StatusCode::NO_CONTENT);
    assert_eq!(refused, StatusCode::CONFLICT);
    assert_eq!(again, StatusCode::NOT_FOUND);
    assert_eq!(
        *calls.lock().unwrap(),
        [
            call("account", &spare),
            call("transaction", &item_id),
            call("transfer", &transfer_id),
            call("transaction", &copy_id),
        ]
    );
    assert_eq!(t.balance(&t.alice, &checking).await, 0);
    assert_eq!(t.balance(&t.alice, &target).await, 0);
}

#[tokio::test]
async fn deleting_settled_transaction_reverts_balance() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;
    let id = id_of(&item);
    t.settle(&t.alice, &id, 9_000, "2026-11-05").await;
    assert_eq!(t.balance(&t.alice, &account).await, -9_000);

    let (status, _) = t.delete(&t.alice, &format!("/transactions/{id}")).await;
    let (gone, _) = t.get(&t.alice, &format!("/transactions/{id}")).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(gone, StatusCode::NOT_FOUND);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let target = t.create_account(&t.alice, "Destino").await;
    let transfer = json!({
        "from_account_id": checking,
        "to_account_id": target,
        "amount": 1_000,
        "transferred_on": "2026-11-05",
    });
    let (_, transfer) = t.post(&t.alice, "/transfers", transfer).await;
    let item = t
        .create_transaction(&t.alice, &checking, "income", 5_000, "2026-11-05")
        .await;

    let (transfer_status, _) = t
        .delete(&t.alice, &format!("/transfers/{}", id_of(&transfer)))
        .await;
    let (item_status, _) = t
        .delete(&t.alice, &format!("/transactions/{}", id_of(&item)))
        .await;
    let (account_status, _) = t.delete(&t.alice, &format!("/accounts/{target}")).await;

    assert_eq!(transfer_status, StatusCode::NO_CONTENT);
    assert_eq!(item_status, StatusCode::NO_CONTENT);
    assert_eq!(account_status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn undo_settlement_of_recurring_copy_calls_entity_deleted_hook() {
    let (t, calls) = with_hook().await;
    let account = t.default_account(&t.alice).await;
    let rent = t
        .create_recurring(
            &t.alice,
            &account,
            "expense",
            2_000,
            monthly_rule("2026-11-10", 10),
        )
        .await;
    let (_, copy) = t
        .settle_occurrence(&t.alice, &id_of(&rent), "2026-11-10", 2_000, "2026-11-10")
        .await;
    let one_off = t
        .create_transaction(&t.alice, &account, "expense", 1_000, "2026-11-05")
        .await;
    t.settle(&t.alice, &id_of(&one_off), 1_000, "2026-11-05")
        .await;

    let (copy_status, _) = t.undo_settlement(&t.alice, &id_of(&copy)).await;
    let (one_off_status, _) = t.undo_settlement(&t.alice, &id_of(&one_off)).await;

    assert_eq!(copy_status, StatusCode::NO_CONTENT);
    assert_eq!(one_off_status, StatusCode::OK);
    assert_eq!(
        *calls.lock().unwrap(),
        [call("transaction", &id_of(&copy))],
        "só a cópia apagada chama o gancho"
    );
    assert_eq!(t.balance(&t.alice, &account).await, 0);
}
