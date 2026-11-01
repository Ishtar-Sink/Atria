//! Contas e conta padrão (CT-17, CB-01, RF-24, RF-25, RF-26).

use axum::http::StatusCode;
use serde_json::json;

use super::{ALICE, FinanceTest, id_of};
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
