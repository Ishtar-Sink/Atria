//! Migração do fim do cartão sobre dados existentes (CT-06, CB-05, CB-06, RNF-01): o
//! cartão vira conta comum, as parcelas viram saídas independentes e a transferência
//! da fatura paga continua, sem mudar contagens, valores, datas, liquidações e saldos.

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::Value;
use sqlx::types::Json;
use uuid::Uuid;

use super::{ALICE, id_of, monthly_rule};
use crate::finance;
use crate::http::test_support::{TestContext, TestSession, send};
use crate::shared::db::begin_for_user;

const MIGRATION_VERSION: i64 = 20261103010001;
const MAIN_ACCOUNT: u128 = 1;
const CARD_ACCOUNT: u128 = 2;
const PAID_STATEMENT_TRANSFER: u128 = 21;

type AccountRow = (Uuid, i64);
type TransactionRow = (Uuid, String, Uuid, i64, String, Option<i64>, Option<String>);
type TransferRow = (Uuid, Uuid, Uuid, i64, String);

#[derive(Debug, PartialEq)]
struct Snapshot {
    counts: Vec<i64>,
    accounts: Vec<AccountRow>,
    transactions: Vec<TransactionRow>,
    transfers: Vec<TransferRow>,
}

fn id(value: u128) -> Uuid {
    Uuid::from_u128(value)
}

async fn seed_before_migration(ctx: &TestContext) {
    let mut before = finance::migrator();
    before.migrations = std::borrow::Cow::Owned(
        before
            .migrations
            .iter()
            .filter(|migration| migration.version < MIGRATION_VERSION)
            .cloned()
            .collect(),
    );
    before.run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    sqlx::query(
        "INSERT INTO accounts (id, owner_id, name, kind, is_default, balance_amount, currency, \
         created_at, updated_at) \
         VALUES ($1, $2, 'Conta principal', 'standard', true, 90000, 'BRL', now(), now())",
    )
    .bind(id(MAIN_ACCOUNT))
    .bind(ALICE)
    .execute(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO accounts (id, owner_id, name, kind, is_default, balance_amount, currency, \
         credit_limit_amount, closing_day, due_day, created_at, updated_at) \
         VALUES ($1, $2, 'Cartão', 'credit_card', false, 0, 'BRL', 500000, 10, 17, now(), now())",
    )
    .bind(id(CARD_ACCOUNT))
    .bind(ALICE)
    .execute(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO transactions (id, owner_id, kind, account_id, expected_amount, \
         expected_date, settled_amount, settled_at, difference_amount, difference_kind, \
         currency, created_at, updated_at) \
         VALUES ($1, $2, 'income', $3, 100000, '2026-11-01', 100000, '2026-11-01', 0, NULL, \
         'BRL', now(), now())",
    )
    .bind(id(14))
    .bind(ALICE)
    .bind(id(MAIN_ACCOUNT))
    .execute(&mut *tx)
    .await
    .unwrap();
    for (number, expected_date, period) in [
        (1i16, "2026-11-17", "2026-11"),
        (2, "2026-12-17", "2026-12"),
        (3, "2027-01-17", "2027-01"),
    ] {
        let settled = number == 1;
        sqlx::query(
            "INSERT INTO transactions (id, owner_id, kind, account_id, expected_amount, \
             expected_date, settled_amount, settled_at, difference_amount, currency, \
             installment_number, installment_total, installment_group_id, statement_period, \
             created_at, updated_at) \
             VALUES ($1, $2, 'expense', $3, 10000, $4::date, $5, $6::date, $7, 'BRL', $8, 3, \
             $9, $10, now(), now())",
        )
        .bind(id(10 + number as u128))
        .bind(ALICE)
        .bind(id(CARD_ACCOUNT))
        .bind(expected_date)
        .bind(settled.then_some(10000i64))
        .bind(settled.then_some("2026-11-17"))
        .bind(settled.then_some(0i64))
        .bind(number)
        .bind(id(11))
        .bind(period)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO transfers (id, owner_id, from_account_id, to_account_id, amount, currency, \
         transferred_on, statement_period, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, 10000, 'BRL', '2026-11-17', '2026-11', now(), now())",
    )
    .bind(id(PAID_STATEMENT_TRANSFER))
    .bind(ALICE)
    .bind(id(MAIN_ACCOUNT))
    .bind(id(CARD_ACCOUNT))
    .execute(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO recurring_transactions (id, owner_id, kind, account_id, expected_amount, \
         currency, rule, created_at, updated_at) \
         VALUES ($1, $2, 'expense', $3, 5000, 'BRL', $4, now(), now())",
    )
    .bind(id(31))
    .bind(ALICE)
    .bind(id(CARD_ACCOUNT))
    .bind(Json(monthly_rule("2026-11-25", 25)))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

async fn snapshot(ctx: &TestContext) -> Snapshot {
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let mut counts = Vec::new();
    for table in [
        "accounts",
        "transactions",
        "transfers",
        "recurring_transactions",
    ] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {table}"))
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        counts.push(count);
    }
    let accounts = sqlx::query_as("SELECT id, balance_amount FROM accounts ORDER BY id")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    let transactions = sqlx::query_as(
        "SELECT id, kind, account_id, expected_amount, expected_date::text, settled_amount, \
         settled_at::text FROM transactions ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    let transfers = sqlx::query_as(
        "SELECT id, from_account_id, to_account_id, amount, transferred_on::text \
         FROM transfers ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    Snapshot {
        counts,
        accounts,
        transactions,
        transfers,
    }
}

async fn migrated() -> (TestContext, Router, TestSession) {
    let ctx = TestContext::new().await;
    seed_before_migration(&ctx).await;
    finance::migrator().run(&ctx.state.pool).await.unwrap();
    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    (ctx, app, alice)
}

async fn get(app: &Router, session: &TestSession, uri: &str) -> (StatusCode, Value) {
    let request = session
        .request(Method::GET, &format!("/api/v1{uri}"))
        .body(Body::empty())
        .unwrap();
    let (status, _, body) = send(app, request).await;
    (status, body)
}

async fn columns(ctx: &TestContext, table: &str) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT column_name::text FROM information_schema.columns \
         WHERE table_schema = current_schema() AND table_name = $1",
    )
    .bind(table)
    .fetch_all(&ctx.state.pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn ct06_rnf01_card_migration_keeps_counts_and_balances() {
    let ctx = TestContext::new().await;
    seed_before_migration(&ctx).await;
    let before = snapshot(&ctx).await;

    finance::migrator().run(&ctx.state.pool).await.unwrap();
    let after = snapshot(&ctx).await;
    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    let (accounts_status, accounts) = get(&app, &alice, "/accounts").await;
    let (summary_status, summary) = get(
        &app,
        &alice,
        "/financial-summaries?from=2026-11-01&to=2026-11-30",
    )
    .await;

    assert_eq!(before.counts, [2, 4, 1, 1]);
    assert_eq!(after, before);
    let account_columns = columns(&ctx, "accounts").await;
    for removed in ["kind", "credit_limit_amount", "closing_day", "due_day"] {
        assert!(!account_columns.iter().any(|c| c == removed), "{removed}");
    }
    for table in ["transactions", "transfers"] {
        let table_columns = columns(&ctx, table).await;
        for removed in [
            "installment_number",
            "installment_total",
            "installment_group_id",
            "statement_period",
        ] {
            assert!(
                !table_columns.iter().any(|c| c == removed),
                "{table}.{removed}"
            );
        }
    }
    assert_eq!(accounts_status, StatusCode::OK, "{accounts}");
    let items = accounts["items"].as_array().expect("contas");
    assert_eq!(items.len(), 2);
    let card_id = id(CARD_ACCOUNT).to_string();
    let card = items
        .iter()
        .find(|account| id_of(account) == card_id)
        .expect("ex-cartão");
    assert_eq!(card["balance_amount"], 0);
    assert!(card.get("kind").is_none());
    assert!(card.get("credit_limit_amount").is_none());
    assert_eq!(summary_status, StatusCode::OK, "{summary}");
    assert_eq!(summary["balance"]["current"], 90000);
    assert_eq!(
        summary["balance"]["accounts"]
            .as_array()
            .expect("saldos")
            .len(),
        2
    );
    assert!(summary.get("credit_cards").is_none());
}

#[tokio::test]
async fn cb05_installments_become_independent_expenses() {
    let (_ctx, app, alice) = migrated().await;

    let uri = format!(
        "/transactions?account_id={}&repetition=one_off&from=2026-11-01&to=2027-01-31",
        id(CARD_ACCOUNT)
    );
    let (status, body) = get(&app, &alice, &uri).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    let mut items = body["items"].as_array().cloned().expect("itens");
    items.sort_by_key(|item| item["expected_date"].as_str().map(str::to_owned));
    let dates: Vec<&str> = items
        .iter()
        .map(|item| item["expected_date"].as_str().expect("data"))
        .collect();
    assert_eq!(dates, ["2026-11-17", "2026-12-17", "2027-01-17"]);
    for item in &items {
        assert_eq!(item["kind"], "expense");
        assert_eq!(item["expected_amount"], 10000);
        assert!(item.get("installment").is_none());
    }
    assert_eq!(items[0]["settled_amount"], 10000);
    assert_eq!(items[0]["settled_at"], "2026-11-17");
    assert!(items[1]["settled_at"].is_null());
    assert!(items[2]["settled_at"].is_null());
}

#[tokio::test]
async fn cb06_paid_statement_transfer_keeps_amount_without_period() {
    let (_ctx, app, alice) = migrated().await;

    let uri = format!("/transfers/{}", id(PAID_STATEMENT_TRANSFER));
    let (status, body) = get(&app, &alice, &uri).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["amount"], 10000);
    assert_eq!(body["from_account_id"], id(MAIN_ACCOUNT).to_string());
    assert_eq!(body["to_account_id"], id(CARD_ACCOUNT).to_string());
    assert!(body.get("statement_period").is_none());
}
