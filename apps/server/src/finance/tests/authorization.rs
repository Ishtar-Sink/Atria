//! Autorização: dado de outro usuário responde 404 em todo endpoint com id
//! ([project/testing-03]), a RLS esconde as linhas e as mutações exigem CSRF.

use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use serde_json::{Value, json};

use super::{ALICE, BOB, FinanceTest, id_of, monthly_rule};
use crate::http::test_support::send;
use crate::shared::db::begin_for_user;

const TABLES: [&str; 6] = [
    "accounts",
    "categories",
    "recurring_transactions",
    "transactions",
    "transfers",
    "finance_idempotency_keys",
];

/// Dados da Alice em todas as tabelas do contexto; devolve os ids.
async fn seed(t: &FinanceTest) -> Value {
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let card = t.create_card(&t.alice, 10, 17).await;
    let category = t
        .create_category(&t.alice, "Mercado", "expense", "warning")
        .await;
    let item = t
        .create_transaction(&t.alice, &checking, "expense", 10_000, "2026-11-05")
        .await;
    t.create_transaction(&t.alice, &card, "expense", 10_000, "2026-11-05")
        .await;
    let transfer = json!({
        "from_account_id": checking,
        "to_account_id": savings,
        "amount": 1_000,
        "transferred_on": "2026-11-05",
    });
    let (_, transfer) = t
        .post_with_key(&t.alice, "/transfers", "seed-transfer", &transfer)
        .await;
    let recurring = json!({
        "kind": "expense",
        "account_id": checking,
        "expected_amount": 5_000,
        "rule": monthly_rule("2026-11-10", 10),
    });
    let (_, recurring) = t.post(&t.alice, "/recurring-transactions", recurring).await;
    json!({
        "checking": checking,
        "savings": savings,
        "card": card,
        "category": category,
        "transaction": id_of(&item),
        "transfer": id_of(&transfer),
        "recurring": id_of(&recurring),
    })
}

#[tokio::test]
async fn other_user_resources_return_404() {
    let t = FinanceTest::new().await;
    let ids = seed(&t).await;
    let id = |name: &str| ids[name].as_str().unwrap().to_owned();
    let bob_account = t.default_account(&t.bob).await;
    let cases: Vec<(Method, String, Option<Value>)> = vec![
        (Method::GET, format!("/accounts/{}", id("savings")), None),
        (
            Method::PATCH,
            format!("/accounts/{}", id("savings")),
            Some(json!({ "name": "Invadida" })),
        ),
        (Method::DELETE, format!("/accounts/{}", id("savings")), None),
        (Method::GET, format!("/categories/{}", id("category")), None),
        (
            Method::PATCH,
            format!("/categories/{}", id("category")),
            Some(json!({ "name": "Invadida" })),
        ),
        (
            Method::DELETE,
            format!("/categories/{}", id("category")),
            None,
        ),
        (
            Method::GET,
            format!("/transactions/{}", id("transaction")),
            None,
        ),
        (
            Method::DELETE,
            format!("/transactions/{}", id("transaction")),
            None,
        ),
        (
            Method::POST,
            format!("/transactions/{}/settlement", id("transaction")),
            Some(json!({ "settled_amount": 1, "settled_at": "2026-11-05" })),
        ),
        (
            Method::PATCH,
            format!("/transactions/{}", id("transaction")),
            Some(json!({ "description": "Invadida" })),
        ),
        (
            Method::DELETE,
            format!("/transactions/{}/settlement", id("transaction")),
            None,
        ),
        (
            Method::GET,
            format!(
                "/recurring-transactions/{}/settled-transactions",
                id("recurring")
            ),
            None,
        ),
        (Method::GET, format!("/transfers/{}", id("transfer")), None),
        (
            Method::DELETE,
            format!("/transfers/{}", id("transfer")),
            None,
        ),
        (
            Method::GET,
            format!("/recurring-transactions/{}", id("recurring")),
            None,
        ),
        (
            Method::PATCH,
            format!("/recurring-transactions/{}", id("recurring")),
            Some(json!({ "expected_amount": 1 })),
        ),
        (
            Method::POST,
            format!("/recurring-transactions/{}/settlement", id("recurring")),
            Some(json!({
                "occurrence_date": "2026-11-10",
                "settled_amount": 1,
                "settled_at": "2026-11-10",
            })),
        ),
        (
            Method::POST,
            format!("/recurring-transactions/{}/skip", id("recurring")),
            Some(json!({ "occurrence_date": "2026-11-10" })),
        ),
        (
            Method::GET,
            format!("/credit-cards/{}/statements", id("card")),
            None,
        ),
        (
            Method::POST,
            format!("/credit-cards/{}/statements/2026-11/payment", id("card")),
            Some(json!({ "from_account_id": bob_account, "paid_on": "2026-11-17" })),
        ),
        (
            Method::POST,
            "/transactions".to_owned(),
            Some(json!({
                "kind": "expense",
                "account_id": id("checking"),
                "expected_amount": 1,
                "expected_date": "2026-11-05",
            })),
        ),
        (
            Method::POST,
            "/transfers".to_owned(),
            Some(json!({
                "from_account_id": bob_account,
                "to_account_id": id("savings"),
                "amount": 1,
                "transferred_on": "2026-11-05",
            })),
        ),
        (
            Method::POST,
            "/recurring-transactions".to_owned(),
            Some(json!({
                "kind": "expense",
                "account_id": id("checking"),
                "expected_amount": 1,
                "rule": monthly_rule("2026-11-10", 10),
            })),
        ),
    ];

    for (method, uri, body) in cases {
        let (status, problem) = t.call(&t.bob, method.clone(), &uri, body.as_ref()).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}: {problem}");
        assert_eq!(problem["code"], "not_found");
    }
    let (_, item) = t
        .get(&t.alice, &format!("/transactions/{}", id("transaction")))
        .await;
    assert_eq!(item["settled_at"], Value::Null);
    let (_, recurring) = t
        .get(
            &t.alice,
            &format!("/recurring-transactions/{}", id("recurring")),
        )
        .await;
    assert_eq!(
        recurring["open_occurrence"]["occurrence_date"],
        "2026-11-10"
    );
    assert_eq!(recurring["expected_amount"], 5_000);
    let (_, bob_list) = t
        .get(&t.bob, "/transactions?from=2026-01-01&to=2027-12-31")
        .await;
    assert_eq!(bob_list["items"], json!([]));
    assert_eq!(t.accounts(&t.alice).await.len(), 3);
}

#[tokio::test]
async fn row_level_security_hides_other_owner_rows() {
    let t = FinanceTest::new().await;
    seed(&t).await;

    for table in TABLES {
        let count_as = |user| {
            let pool = t.pool().clone();
            async move {
                let mut tx = begin_for_user(&pool, user).await.unwrap();
                let count: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {table}"))
                    .fetch_one(&mut *tx)
                    .await
                    .unwrap();
                count
            }
        };
        let anonymous: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {table}"))
            .fetch_one(t.pool())
            .await
            .unwrap();

        assert!(count_as(ALICE).await > 0, "{table} sem linhas da Alice");
        assert_eq!(count_as(BOB).await, 0, "{table} visível para o Bob");
        assert_eq!(anonymous, 0, "{table} visível sem usuário");
    }
    let mut tx = begin_for_user(t.pool(), BOB).await.unwrap();
    let foreign = sqlx::query(
        "INSERT INTO categories (id, owner_id, name, kind, color, created_at, updated_at) \
         VALUES ($1, $2, 'Invasão', 'expense', 'info', now(), now())",
    )
    .bind(uuid::Uuid::from_u128(99))
    .bind(ALICE)
    .execute(&mut *tx)
    .await;
    assert!(foreign.is_err(), "a política recusa gravar para outro dono");
}

#[tokio::test]
async fn mutation_without_csrf_is_refused() {
    let t = FinanceTest::new().await;
    let without_token = Request::builder()
        .method(Method::POST)
        .uri("/api/v1/accounts")
        .header(header::COOKIE, &t.alice.cookie)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "name": "Sem token" }).to_string()))
        .unwrap();
    let anonymous = t.ctx.anonymous().await;

    let (status, _, problem) = send(&t.app, without_token).await;
    let (unauthenticated, _) = t.get(&anonymous, "/accounts").await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(problem["code"], "csrf_invalid");
    assert_eq!(unauthenticated, StatusCode::UNAUTHORIZED);
    assert_eq!(t.accounts(&t.alice).await.len(), 1);
}
