//! Contas e conta padrão (CT-17, CB-01, RF-24, RF-25, RF-26), e a exclusão com conta de
//! destino (RF-05, RF-06, RN-03, RN-04, RN-05, CT-04, CT-05, CB-03, CB-04 da SPEC-003).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{ALICE, FinanceTest, id_of, monthly_rule};
use crate::shared::db::begin_for_user;

#[tokio::test]
async fn creates_renames_and_deletes_account() {
    let t = FinanceTest::new().await;

    let (status, created) = t
        .post(&t.alice, "/accounts", json!({ "name": " Poupança " }))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["name"], "Poupança");
    assert!(created.get("kind").is_none());
    assert_eq!(created["balance_amount"], 0);
    assert_eq!(created["currency"], "BRL");
    assert_eq!(created["visibility"], "personal");
    let id = id_of(&created);

    let (status, renamed) = t
        .patch(
            &t.alice,
            &format!("/accounts/{id}"),
            json!({ "name": "Reserva" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["name"], "Reserva");

    let (status, _) = t.delete(&t.alice, &format!("/accounts/{id}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = t.get(&t.alice, &format!("/accounts/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let names: Vec<String> = t
        .accounts(&t.alice)
        .await
        .iter()
        .map(|account| account["name"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(names, ["Conta principal"]);
    let (status, invalid) = t.post(&t.alice, "/accounts", json!({ "name": "  " })).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(invalid["code"], "validation_failed");
    assert_eq!(invalid["errors"][0]["field"], "name");
}

#[tokio::test]
async fn refuses_deleting_default_account_with_problem_json() {
    let t = FinanceTest::new().await;
    let id = t.default_account(&t.alice).await;

    let request = t
        .alice
        .request(
            axum::http::Method::DELETE,
            &format!("/api/v1/accounts/{id}"),
        )
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, headers, body) = crate::http::test_support::send(&t.app, request).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(
        headers.get("content-type").unwrap(),
        crate::shared::error::PROBLEM_JSON
    );
    assert_eq!(body["code"], "default_account_not_deletable");
    let (status, renamed) = t
        .patch(
            &t.alice,
            &format!("/accounts/{id}"),
            json!({ "name": "Conta do dia a dia" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["name"], "Conta do dia a dia");
    assert_eq!(renamed["is_default"], true);
}

#[tokio::test]
async fn default_account_is_created_once_per_user() {
    let t = FinanceTest::new().await;

    let (first, second) = tokio::join!(t.accounts(&t.alice), t.accounts(&t.alice));
    let again = t.accounts(&t.alice).await;
    t.create_account(&t.alice, "Poupança").await;
    let bob = t.accounts(&t.bob).await;

    for list in [&first, &second, &again] {
        let defaults: Vec<_> = list.iter().filter(|a| a["is_default"] == true).collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0]["name"], "Conta principal");
        assert_eq!(defaults[0]["currency"], "BRL");
    }
    assert_eq!(id_of(&first[0]), id_of(&again[0]));
    assert_eq!(bob.len(), 1);
    assert_ne!(id_of(&bob[0]), id_of(&first[0]));
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE is_default")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn database_refuses_deleting_default_account() {
    let t = FinanceTest::new().await;
    let id: uuid::Uuid = t.default_account(&t.alice).await.parse().unwrap();

    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let deleted = sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await;
    drop(tx);
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let soft_deleted = sqlx::query("UPDATE accounts SET deleted_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await;
    drop(tx);
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let second_default = sqlx::query(
        "INSERT INTO accounts (id, owner_id, name, kind, is_default, created_at, updated_at) \
         VALUES ($1, $2, 'Outra', 'standard', true, now(), now())",
    )
    .bind(uuid::Uuid::from_u128(77))
    .bind(ALICE)
    .execute(&mut *tx)
    .await;
    drop(tx);

    let error = deleted.unwrap_err().to_string();
    assert!(error.contains("default_account_not_deletable"), "{error}");
    assert!(soft_deleted.is_err());
    assert!(second_default.is_err());
    assert_eq!(t.accounts(&t.alice).await.len(), 1);
}

#[tokio::test]
async fn account_has_no_card_fields() {
    let t = FinanceTest::new().await;

    let (kind_status, _) = t
        .post(
            &t.alice,
            "/accounts",
            json!({ "name": "Cartão", "kind": "credit_card" }),
        )
        .await;
    let (limit_status, _) = t
        .post(
            &t.alice,
            "/accounts",
            json!({ "name": "Cartão", "credit_limit_amount": 100_000 }),
        )
        .await;
    let id = t.create_account(&t.alice, "Poupança").await;
    let (status, account) = t.get(&t.alice, &format!("/accounts/{id}")).await;

    assert_eq!(kind_status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(limit_status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(status, StatusCode::OK, "{account}");
    for removed in ["kind", "credit_limit_amount", "closing_day", "due_day"] {
        assert!(account.get(removed).is_none(), "{removed}");
    }
}

async fn delete_moving(t: &FinanceTest, id: &str, move_to: &str) -> (StatusCode, Value) {
    t.delete(&t.alice, &format!("/accounts/{id}?move_to={move_to}"))
        .await
}

async fn fetch(t: &FinanceTest, uri: &str) -> Value {
    let (status, body) = t.get(&t.alice, uri).await;
    assert_eq!(status, StatusCode::OK, "{uri}: {body}");
    body
}

async fn transfer(t: &FinanceTest, key: &str, from: &str, to: &str, amount: i64) -> String {
    let body = json!({
        "from_account_id": from,
        "to_account_id": to,
        "amount": amount,
        "transferred_on": "2026-11-03",
    });
    let (status, body) = t.post_with_key(&t.alice, "/transfers", key, &body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    id_of(&body)
}

async fn settled(t: &FinanceTest, account: &str, kind: &str, amount: i64, date: &str) -> String {
    let item = t
        .create_transaction(&t.alice, account, kind, amount, date)
        .await;
    let id = id_of(&item);
    let (status, body) = t.settle(&t.alice, &id, amount, date).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    id
}

async fn current_balance(t: &FinanceTest) -> Value {
    fetch(t, "/financial-summaries?from=2026-11-01&to=2026-11-30").await["balance"]["current"]
        .clone()
}

#[tokio::test]
async fn ct04_deleting_account_moves_transactions_transfers_and_recurring_to_destination() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let wallet = t.create_account(&t.alice, "Carteira").await;
    let income = settled(&t, &savings, "income", 100_000, "2026-11-01").await;
    let expense = settled(&t, &savings, "expense", 30_000, "2026-11-02").await;
    let planned = id_of(
        &t.create_transaction(&t.alice, &savings, "expense", 5_000, "2026-11-20")
            .await,
    );
    let recurring = id_of(
        &t.create_recurring(
            &t.alice,
            &savings,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );
    let moved = transfer(&t, "ct04-transfer", &savings, &wallet, 10_000).await;
    assert_eq!(t.balance(&t.alice, &savings).await, 60_000);
    assert_eq!(t.balance(&t.alice, &wallet).await, 10_000);
    assert_eq!(t.balance(&t.alice, &checking).await, 0);
    assert_eq!(current_balance(&t).await, 70_000);

    let (status, body) = delete_moving(&t, &savings, &checking).await;

    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    assert_eq!(t.balance(&t.alice, &checking).await, 60_000);
    assert_eq!(t.balance(&t.alice, &wallet).await, 10_000);
    let (status, _) = t.get(&t.alice, &format!("/accounts/{savings}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    for id in [&income, &expense, &planned] {
        let item = fetch(&t, &format!("/transactions/{id}")).await;
        assert_eq!(item["account_id"], checking.as_str(), "{item}");
    }
    let moved = fetch(&t, &format!("/transfers/{moved}")).await;
    assert_eq!(moved["from_account_id"], checking.as_str());
    assert_eq!(moved["to_account_id"], wallet.as_str());
    let recurring = fetch(&t, &format!("/recurring-transactions/{recurring}")).await;
    assert_eq!(recurring["account_id"], checking.as_str());
    assert_eq!(current_balance(&t).await, 70_000);
}

#[tokio::test]
async fn cb04_transfer_between_deleted_and_destination_account_is_deleted() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    settled(&t, &savings, "income", 50_000, "2026-11-01").await;
    let out = transfer(&t, "cb04-out", &savings, &checking, 20_000).await;
    let back = transfer(&t, "cb04-in", &checking, &savings, 5_000).await;
    assert_eq!(t.balance(&t.alice, &savings).await, 35_000);
    assert_eq!(t.balance(&t.alice, &checking).await, 15_000);

    let (status, body) = delete_moving(&t, &savings, &checking).await;

    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    assert_eq!(t.balance(&t.alice, &checking).await, 50_000);
    for id in [&out, &back] {
        let (status, body) = t.get(&t.alice, &format!("/transfers/{id}")).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    }
}

#[tokio::test]
async fn ct05_destination_in_other_currency_is_refused_with_currency_mismatch() {
    let t = FinanceTest::new().await;
    let dollar = t.create_account(&t.alice, "Dólar").await;
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    sqlx::query("UPDATE accounts SET currency = 'USD' WHERE id = $1")
        .bind(dollar.parse::<uuid::Uuid>().unwrap())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let savings = t.create_account(&t.alice, "Poupança").await;
    let item = id_of(
        &t.create_transaction(&t.alice, &savings, "expense", 1_000, "2026-11-20")
            .await,
    );

    let (status, body) = delete_moving(&t, &savings, &dollar).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert_eq!(body["code"], "currency_mismatch");
    fetch(&t, &format!("/accounts/{savings}")).await;
    let item = fetch(&t, &format!("/transactions/{item}")).await;
    assert_eq!(item["account_id"], savings.as_str());
}

#[tokio::test]
async fn ct05_default_account_is_refused_even_with_destination() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;

    let (status, body) = delete_moving(&t, &checking, &savings).await;

    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert_eq!(body["code"], "default_account_not_deletable");
    assert_eq!(t.accounts(&t.alice).await.len(), 2);
}

#[tokio::test]
async fn account_with_transactions_without_destination_is_refused() {
    let t = FinanceTest::new().await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    t.create_transaction(&t.alice, &savings, "expense", 1_000, "2026-11-20")
        .await;

    let (status, body) = t.delete(&t.alice, &format!("/accounts/{savings}")).await;

    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert_eq!(body["code"], "account_has_transactions");
}

#[tokio::test]
async fn destination_must_be_another_active_account_of_the_owner() {
    let t = FinanceTest::new().await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let item = id_of(
        &t.create_transaction(&t.alice, &savings, "expense", 1_000, "2026-11-20")
            .await,
    );
    let gone = t.create_account(&t.alice, "Antiga").await;
    let (status, body) = t.delete(&t.alice, &format!("/accounts/{gone}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    let bob_account = t.default_account(&t.bob).await;
    let balance = t.balance(&t.alice, &savings).await;

    let (status, body) = delete_moving(&t, &savings, &savings).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert_eq!(body["code"], "validation_failed");
    assert_eq!(body["errors"][0]["field"], "move_to");
    assert_eq!(body["errors"][0]["code"], "same_account");
    for destination in [&bob_account, &gone] {
        let (status, body) = delete_moving(&t, &savings, destination).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
        assert_eq!(body["code"], "validation_failed");
        assert_eq!(body["errors"][0]["field"], "move_to");
        assert_eq!(body["errors"][0]["code"], "not_found");
    }

    let item = fetch(&t, &format!("/transactions/{item}")).await;
    assert_eq!(item["account_id"], savings.as_str());
    assert_eq!(t.balance(&t.alice, &savings).await, balance);
}
