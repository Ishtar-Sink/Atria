//! Movimentações, liquidação e idempotência (CT-18, CB-09, RN-01 a RN-03, PD-49).
//! Bruto, descontos e acréscimos (SPEC-004: RF-01, RF-08, RF-09, RF-15, RNF-03, CT-03,
//! CT-05, CT-08, CT-09, CT-14, CB-01, CB-02, CB-06 e CB-08): o líquido continua sendo o
//! valor que afeta o saldo, e a liquidação pelo líquido recalcula o bruto e os percentuais.

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use sqlx::types::Json;
use uuid::Uuid;

use super::{ALICE, FinanceTest, id_of, monthly_rule};
use crate::finance;
use crate::http::test_support::{TestContext, TestSession, send};
use crate::shared::db::begin_for_user;

#[tokio::test]
async fn balance_changes_only_on_settlement() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let category = t
        .create_category(&t.alice, "Moradia", "expense", "#6d28d9")
        .await;

    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": category,
        "description": "Conta de luz",
        "expected_amount": 10_000,
        "expected_date": "2026-11-05",
    });
    let (status, created) = t.post(&t.alice, "/transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let item = &created["items"][0];
    assert_eq!(item["category_id"], category.as_str());
    assert_eq!(item["settled_amount"], serde_json::Value::Null);
    assert_eq!(item["difference_kind"], serde_json::Value::Null);
    assert_eq!(item["currency"], "BRL");
    assert_eq!(t.balance(&t.alice, &account).await, 0);

    let (status, settled) = t.settle(&t.alice, &id_of(item), 9_000, "2026-11-04").await;

    assert_eq!(status, StatusCode::OK, "{settled}");
    assert_eq!(settled["settled_at"], "2026-11-04");
    assert_eq!(t.balance(&t.alice, &account).await, -9_000);
}

#[tokio::test]
async fn settlement_records_saving_loss_gain_and_loss() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let cases = [
        ("expense", 150_000, 145_000, -5_000, "saving"),
        ("expense", 10_000, 12_500, 2_500, "loss"),
        ("income", 500_000, 520_000, 20_000, "gain"),
        ("income", 100_000, 90_000, -10_000, "loss"),
    ];

    for (kind, expected, settled, difference, difference_kind) in cases {
        let item = t
            .create_transaction(&t.alice, &account, kind, expected, "2026-11-10")
            .await;
        let (status, body) = t
            .settle(&t.alice, &id_of(&item), settled, "2026-11-10")
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        assert_eq!(body["settled_amount"], settled);
        assert_eq!(body["difference_amount"], difference);
        assert_eq!(body["difference_kind"], difference_kind);
    }
    let exact = t
        .create_transaction(&t.alice, &account, "expense", 8_000, "2026-11-10")
        .await;
    let (_, body) = t
        .settle(&t.alice, &id_of(&exact), 8_000, "2026-11-10")
        .await;

    assert_eq!(body["difference_amount"], 0);
    assert_eq!(body["difference_kind"], serde_json::Value::Null);
    assert_eq!(
        t.balance(&t.alice, &account).await,
        -145_000 - 12_500 + 520_000 + 90_000 - 8_000
    );
}

#[tokio::test]
async fn duplicate_idempotency_key_returns_same_transaction() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "expected_amount": 4_990,
        "expected_date": "2026-11-12",
    });

    let (first_status, first) = t
        .post_with_key(&t.alice, "/transactions", "envio-0001", &body)
        .await;
    let (second_status, second) = t
        .post_with_key(&t.alice, "/transactions", "envio-0001", &body)
        .await;
    // A mesma chave de outro usuário é outra chave.
    let bob_account = t.default_account(&t.bob).await;
    let bob_body = json!({
        "kind": "expense",
        "account_id": bob_account,
        "expected_amount": 4_990,
        "expected_date": "2026-11-12",
    });
    let (bob_status, _) = t
        .post_with_key(&t.bob, "/transactions", "envio-0001", &bob_body)
        .await;
    let (_, list) = t
        .get(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;

    assert_eq!(first_status, StatusCode::CREATED, "{first}");
    assert_eq!(second_status, StatusCode::CREATED);
    assert_eq!(first, second);
    assert_eq!(bob_status, StatusCode::CREATED);
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
    assert_eq!(list["items"][0]["id"], first["items"][0]["id"]);
}

#[tokio::test]
async fn reused_idempotency_key_with_other_body_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let body = |amount: i64| {
        json!({
            "kind": "expense",
            "account_id": account,
            "expected_amount": amount,
            "expected_date": "2026-11-12",
        })
    };

    let (first, _) = t
        .post_with_key(&t.alice, "/transactions", "envio-0002", &body(4_990))
        .await;
    let (status, problem) = t
        .post_with_key(&t.alice, "/transactions", "envio-0002", &body(5_990))
        .await;

    assert_eq!(first, StatusCode::CREATED);
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "idempotency_key_reused");
}

#[tokio::test]
async fn settling_twice_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;

    let (first, _) = t
        .settle(&t.alice, &id_of(&item), 10_000, "2026-11-05")
        .await;
    let (second, problem) = t
        .settle(&t.alice, &id_of(&item), 10_000, "2026-11-05")
        .await;
    let (negative, _) = t
        .settle(
            &t.alice,
            &id_of(
                &t.create_transaction(&t.alice, &account, "expense", 1_000, "2026-11-05")
                    .await,
            ),
            -1,
            "2026-11-05",
        )
        .await;

    assert_eq!(first, StatusCode::OK);
    assert_eq!(second, StatusCode::CONFLICT);
    assert_eq!(problem["code"], "transaction_already_settled");
    assert_eq!(negative, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(t.balance(&t.alice, &account).await, -10_000);
}

#[tokio::test]
async fn transaction_with_category_of_other_kind_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = t
        .create_category(&t.alice, "Salário", "income", "#047857")
        .await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": salary,
        "expected_amount": 10_000,
        "expected_date": "2026-11-05",
    });
    let recurring = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": salary,
        "expected_amount": 10_000,
        "rule": super::monthly_rule("2026-11-05", 5),
    });

    let (status, problem) = t.post(&t.alice, "/transactions", body).await;
    let (recurring_status, recurring_problem) =
        t.post(&t.alice, "/recurring-transactions", recurring).await;
    let list = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
    assert_eq!(problem["code"], "category_kind_mismatch");
    assert_eq!(recurring_status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(recurring_problem["code"], "category_kind_mismatch");
    assert!(list.is_empty());
}

#[tokio::test]
async fn installments_are_no_longer_accepted() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "expected_amount": 30_000,
        "expected_date": "2026-11-05",
        "installments": 3,
    });

    let (status, problem) = t.post(&t.alice, "/transactions", body).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
}

#[tokio::test]
async fn updates_unsettled_transaction_fields() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let rent = t
        .create_category(&t.alice, "Moradia", "expense", "#6d28d9")
        .await;
    let item = t
        .create_transaction(&t.alice, &checking, "expense", 10_000, "2026-11-05")
        .await;
    let id = id_of(&item);
    let change = json!({
        "description": "Conta de luz",
        "expected_amount": 12_000,
        "expected_date": "2026-11-10",
        "account_id": savings,
        "category_id": rent,
        "visibility": "shared",
    });

    let (status, updated) = t
        .patch(&t.alice, &format!("/transactions/{id}"), change)
        .await;
    let (_, fetched) = t.get(&t.alice, &format!("/transactions/{id}")).await;

    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["description"], "Conta de luz");
    assert_eq!(updated["expected_amount"], 12_000);
    assert_eq!(updated["expected_date"], "2026-11-10");
    assert_eq!(updated["account_id"], savings.as_str());
    assert_eq!(updated["category_id"], rent.as_str());
    assert_eq!(updated["visibility"], "shared");
    assert!(updated.get("statement_period").is_none());
    assert!(updated.get("installment").is_none());
    assert_eq!(fetched, updated);
    for account in [&checking, &savings] {
        assert_eq!(
            t.balance(&t.alice, account).await,
            0,
            "a edição não mexe no saldo"
        );
    }
}

#[tokio::test]
async fn settled_transaction_accepts_only_description_category_and_visibility() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let other = t.create_account(&t.alice, "Outra").await;
    let market = t
        .create_category(&t.alice, "Mercado", "expense", "#92400e")
        .await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;
    let id = id_of(&item);
    t.settle(&t.alice, &id, 9_000, "2026-11-04").await;
    let uri = format!("/transactions/{id}");

    let (status, updated) = t
        .patch(
            &t.alice,
            &uri,
            json!({ "description": "Feira", "category_id": market, "visibility": "shared" }),
        )
        .await;
    let refused = [
        json!({ "expected_amount": 1 }),
        json!({ "expected_date": "2026-11-06" }),
        json!({ "account_id": other }),
    ];
    for body in refused {
        let (status, problem) = t.patch(&t.alice, &uri, body.clone()).await;
        assert_eq!(status, StatusCode::CONFLICT, "{body}: {problem}");
        assert_eq!(problem["code"], "transaction_already_settled");
    }

    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["description"], "Feira");
    assert_eq!(updated["category_id"], market.as_str());
    assert_eq!(updated["settled_amount"], 9_000);
    assert_eq!(updated["expected_amount"], 10_000);
    assert_eq!(t.balance(&t.alice, &account).await, -9_000);
}

#[tokio::test]
async fn update_with_category_of_other_kind_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = t
        .create_category(&t.alice, "Salário", "income", "#047857")
        .await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;
    let id = id_of(&item);

    let (status, problem) = t
        .patch(
            &t.alice,
            &format!("/transactions/{id}"),
            json!({ "category_id": salary }),
        )
        .await;
    let (_, fetched) = t.get(&t.alice, &format!("/transactions/{id}")).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
    assert_eq!(problem["code"], "category_kind_mismatch");
    assert_eq!(fetched["category_id"], serde_json::Value::Null);
}

#[tokio::test]
async fn undo_settlement_reverts_balance_and_clears_difference() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;
    let id = id_of(&item);
    t.settle(&t.alice, &id, 9_000, "2026-11-04").await;
    assert_eq!(t.balance(&t.alice, &account).await, -9_000);

    let (status, undone) = t.undo_settlement(&t.alice, &id).await;
    let (again, _) = t.settle(&t.alice, &id, 10_500, "2026-11-06").await;

    assert_eq!(status, StatusCode::OK, "{undone}");
    assert_eq!(undone["id"], id.as_str());
    assert_eq!(undone["status"], "open");
    for field in [
        "settled_amount",
        "settled_at",
        "difference_amount",
        "difference_kind",
    ] {
        assert_eq!(undone[field], serde_json::Value::Null, "{field}");
    }
    assert_eq!(undone["effective_date"], "2026-11-05");
    assert_eq!(again, StatusCode::OK, "liquida de novo");
    assert_eq!(t.balance(&t.alice, &account).await, -10_500);
}

#[tokio::test]
async fn undo_settlement_of_unsettled_transaction_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;

    let (status, problem) = t.undo_settlement(&t.alice, &id_of(&item)).await;

    assert_eq!(status, StatusCode::CONFLICT, "{problem}");
    assert_eq!(problem["code"], "transaction_not_settled");
    assert_eq!(t.balance(&t.alice, &account).await, 0);
}

fn percent(name: &str, direction: &str, rate_bp: i64, base_amount: Option<i64>) -> Value {
    let mut item = json!({
        "name": name,
        "direction": direction,
        "mode": "percent",
        "rate_bp": rate_bp,
    });
    if let Some(base) = base_amount {
        item["base_amount"] = json!(base);
    }
    item
}

fn fixed(name: &str, direction: &str, amount: i64) -> Value {
    json!({ "name": name, "direction": direction, "mode": "fixed", "amount": amount })
}

fn ct02_items() -> Value {
    json!([
        percent("INSS", "deduction", 1100, None),
        percent("IRPF", "deduction", 1500, Some(712_000)),
    ])
}

fn payroll_items() -> Value {
    json!([
        percent("INSS", "deduction", 1100, None),
        fixed("Sindical", "deduction", 4_000),
    ])
}

async fn create_gross(
    t: &FinanceTest,
    account: &str,
    kind: &str,
    gross: i64,
    adjustments: Value,
    day: &str,
) -> Value {
    let body = json!({
        "kind": kind,
        "account_id": account,
        "gross_amount": gross,
        "adjustments": adjustments,
        "expected_date": day,
    });
    let (status, body) = t.post(&t.alice, "/transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["items"][0].clone()
}

async fn settle_items(
    t: &FinanceTest,
    id: &str,
    net: i64,
    adjustments: Option<Value>,
) -> (StatusCode, Value) {
    let mut body = json!({ "settled_amount": net, "settled_at": "2026-11-05" });
    if let Some(items) = adjustments {
        body["adjustments"] = items;
    }
    t.post(&t.alice, &format!("/transactions/{id}/settlement"), body)
        .await
}

fn computed(items: &Value) -> Vec<i64> {
    items
        .as_array()
        .expect("itens")
        .iter()
        .map(|item| item["computed_amount"].as_i64().expect("computed_amount"))
        .collect()
}

async fn transaction_count(t: &FinanceTest) -> i64 {
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let count = sqlx::query_scalar("SELECT count(*) FROM transactions")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    count
}

fn first_error(body: &Value) -> (String, String) {
    let error = &body["errors"][0];
    (
        error["field"].as_str().unwrap_or_default().to_owned(),
        error["code"].as_str().unwrap_or_default().to_owned(),
    )
}

fn error_is(body: &Value, field: &str, code: &str) -> bool {
    first_error(body) == (field.to_owned(), code.to_owned())
}

#[tokio::test]
async fn adj_rf01_income_with_adjustments_stores_gross_items_and_net() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;

    let item = create_gross(
        &t,
        &account,
        "income",
        800_000,
        payroll_items(),
        "2026-11-05",
    )
    .await;

    for body in [
        item.clone(),
        t.get(&t.alice, &format!("/transactions/{}", id_of(&item)))
            .await
            .1,
    ] {
        assert_eq!(body["gross_amount"], 800_000, "{body}");
        assert_eq!(body["expected_amount"], 708_000);
        assert_eq!(body["adjustments"][0]["name"], "INSS");
        assert_eq!(body["adjustments"][0]["rate_bp"], 1100);
        assert_eq!(body["adjustments"][0]["base_amount"], Value::Null);
        assert_eq!(body["adjustments"][0]["computed_amount"], 88_000);
        assert_eq!(body["adjustments"][1]["amount"], 4_000);
        assert_eq!(body["adjustments"][1]["computed_amount"], 4_000);
        assert_eq!(body["settled_gross_amount"], Value::Null);
        assert_eq!(body["settled_adjustments"], Value::Null);
    }
    let listed = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;
    assert_eq!(listed[0]["expected_amount"], 708_000);
    assert_eq!(listed[0]["gross_amount"], 800_000);
    assert_eq!(computed(&listed[0]["adjustments"]), [88_000, 4_000]);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
}

#[tokio::test]
async fn adj_rn09_transaction_without_adjustments_keeps_gross_equal_to_net() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;

    let item = t
        .create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-05")
        .await;
    let (status, settled) = t.settle(&t.alice, &id_of(&item), 9_000, "2026-11-04").await;

    assert_eq!(item["gross_amount"], 10_000);
    assert_eq!(item["adjustments"], json!([]));
    assert_eq!(status, StatusCode::OK, "{settled}");
    assert_eq!(settled["settled_gross_amount"], 9_000);
    assert_eq!(settled["settled_adjustments"], json!([]));
}

#[tokio::test]
async fn adj_amount_fields_are_validated() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let base = json!({ "kind": "expense", "account_id": account, "expected_date": "2026-11-05" });
    let with = |extra: Value| {
        let mut body = base.clone();
        for (key, value) in extra.as_object().unwrap() {
            body[key] = value.clone();
        }
        body
    };
    let cases = [
        (
            with(json!({ "expected_amount": 10_000, "gross_amount": 10_000 })),
            "expected_amount",
            "conflicts_with_gross_amount",
        ),
        (
            with(
                json!({ "expected_amount": 10_000, "adjustments": [fixed("Taxa", "addition", 500)] }),
            ),
            "gross_amount",
            "required",
        ),
        (with(json!({})), "gross_amount", "required"),
        (
            with(
                json!({ "gross_amount": 1_000, "adjustments": [fixed("Tudo", "deduction", 1_000)] }),
            ),
            "adjustments",
            "net_not_positive",
        ),
    ];

    for (body, field, code) in cases {
        let (status, response) = t.post(&t.alice, "/transactions", body).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{response}");
        assert!(
            error_is(&response, field, code),
            "{field}/{code}: {response}"
        );
    }
    assert_eq!(transaction_count(&t).await, 0);
}

#[tokio::test]
async fn adj_cb08_twenty_adjustments_are_accepted_and_twenty_one_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let items = |count: usize| Value::Array(vec![fixed("Item", "deduction", 100); count]);

    let item = create_gross(&t, &account, "expense", 100_000, items(20), "2026-11-05").await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "gross_amount": 100_000,
        "adjustments": items(21),
        "expected_date": "2026-11-05",
    });
    let (status, refused) = t.post(&t.alice, "/transactions", body).await;

    assert_eq!(item["expected_amount"], 98_000);
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{refused}");
    assert!(error_is(&refused, "adjustments", "too_many"), "{refused}");
    assert_eq!(transaction_count(&t).await, 1);
}

#[tokio::test]
async fn adj_ct03_expense_settles_net_with_deduction_and_addition() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let items = json!([
        percent("Desconto à vista", "deduction", 1000, None),
        fixed("Taxa", "addition", 500),
    ]);

    let item = create_gross(&t, &account, "expense", 20_000, items, "2026-11-05").await;
    let (status, body) = settle_items(&t, &id_of(&item), 18_500, None).await;

    assert_eq!(item["expected_amount"], 18_500);
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_gross_amount"], 20_000);
    assert_eq!(computed(&body["settled_adjustments"]), [2_000, 500]);
    assert_eq!(body["difference_amount"], 0);
    assert_eq!(t.balance(&t.alice, &account).await, -18_500);
}

#[tokio::test]
async fn adj_ct05_settlement_by_net_recalculates_gross_and_percentages() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;

    let item = create_gross(&t, &account, "income", 800_000, ct02_items(), "2026-11-05").await;
    let (status, body) = settle_items(&t, &id_of(&item), 650_000, None).await;

    assert_eq!(item["expected_amount"], 605_200);
    assert_eq!(computed(&item["adjustments"]), [88_000, 106_800]);
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_amount"], 650_000);
    assert_eq!(body["settled_gross_amount"], 859_220);
    let settled = computed(&body["settled_adjustments"]);
    assert_eq!(settled, [94_514, 114_706]);
    assert_eq!(body["settled_adjustments"][1]["base_amount"], 764_706);
    assert_eq!(body["settled_adjustments"][0]["base_amount"], Value::Null);
    assert_eq!(body["difference_amount"], 44_800);
    assert_eq!(body["difference_kind"], "gain");
    let gross = body["settled_gross_amount"].as_i64().unwrap();
    assert_eq!(gross - settled.iter().sum::<i64>(), 650_000);
    assert_eq!(body["gross_amount"], 800_000);
    assert_eq!(body["adjustments"][1]["base_amount"], 712_000);
    assert_eq!(computed(&body["adjustments"]), [88_000, 106_800]);
    assert_eq!(t.balance(&t.alice, &account).await, 650_000);
}

#[tokio::test]
async fn adj_settlement_with_edited_adjustments_recalculates_gross_and_absorbs_cent() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = create_gross(&t, &account, "income", 800_000, ct02_items(), "2026-11-05").await;
    let edited = json!([
        percent("INSS", "deduction", 1100, None),
        percent("IRPF", "deduction", 2250, Some(712_000)),
    ]);

    let (status, body) = settle_items(&t, &id_of(&item), 650_000, Some(edited)).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_gross_amount"], 942_370);
    assert_eq!(computed(&body["settled_adjustments"]), [103_661, 188_709]);
    assert_eq!(body["settled_adjustments"][1]["base_amount"], 838_709);
    assert_eq!(body["settled_adjustments"][1]["rate_bp"], 2250);
    assert_eq!(body["adjustments"][1]["rate_bp"], 1500);
}

#[tokio::test]
async fn adj_ct08_difference_is_between_settled_and_expected_net() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = create_gross(
        &t,
        &account,
        "income",
        800_000,
        payroll_items(),
        "2026-11-05",
    )
    .await;

    let (status, body) = settle_items(&t, &id_of(&item), 700_000, None).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["difference_amount"], -8_000);
    assert_eq!(body["difference_kind"], "loss");
    assert_eq!(body["settled_gross_amount"], 791_011);
    assert_eq!(computed(&body["settled_adjustments"]), [87_011, 4_000]);
}

#[tokio::test]
async fn adj_ct09_undo_settlement_returns_items_and_gross_to_expected() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = create_gross(&t, &account, "income", 800_000, ct02_items(), "2026-11-05").await;
    let id = id_of(&item);
    let (status, _) = settle_items(&t, &id, 650_000, None).await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = t.undo_settlement(&t.alice, &id).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_amount"], Value::Null);
    assert_eq!(body["settled_gross_amount"], Value::Null);
    assert_eq!(body["settled_adjustments"], Value::Null);
    assert_eq!(body["gross_amount"], 800_000);
    assert_eq!(body["expected_amount"], 605_200);
    assert_eq!(computed(&body["adjustments"]), [88_000, 106_800]);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    let (status, again) = settle_items(&t, &id, 605_200, None).await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["settled_gross_amount"], 800_000);
}

#[tokio::test]
async fn adj_cb01_zero_net_settlement_uses_fixed_items_or_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let income = create_gross(
        &t,
        &account,
        "income",
        50_000,
        json!([fixed("Sindical", "deduction", 4_000)]),
        "2026-11-05",
    )
    .await;
    let expense = create_gross(
        &t,
        &account,
        "expense",
        10_000,
        json!([fixed("Taxa", "addition", 500)]),
        "2026-11-05",
    )
    .await;

    let (status, body) = settle_items(&t, &id_of(&income), 0, None).await;
    let (refused_status, refused) = settle_items(&t, &id_of(&expense), 0, None).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_gross_amount"], 4_000);
    assert_eq!(computed(&body["settled_adjustments"]), [4_000]);
    assert_eq!(body["difference_amount"], -46_000);
    assert_eq!(body["difference_kind"], "loss");
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    assert_eq!(
        refused_status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "{refused}"
    );
    assert!(
        error_is(&refused, "adjustments", "no_gross_for_net"),
        "{refused}"
    );
    let (_, unchanged) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&expense)))
        .await;
    assert_eq!(unchanged["settled_at"], Value::Null);
}

#[tokio::test]
async fn adj_cb02_fixed_only_settlement_adds_fixed_deductions_to_net() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = create_gross(
        &t,
        &account,
        "income",
        100_000,
        json!([fixed("Sindical", "deduction", 4_000)]),
        "2026-11-05",
    )
    .await;

    let (status, body) = settle_items(&t, &id_of(&item), 100_000, None).await;

    assert_eq!(item["expected_amount"], 96_000);
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settled_gross_amount"], 104_000);
    assert_eq!(computed(&body["settled_adjustments"]), [4_000]);
    assert_eq!(body["difference_amount"], 4_000);
}

#[tokio::test]
async fn adj_preview_calculates_gross_for_net_without_writing() {
    let t = FinanceTest::new().await;
    let preview = |body: Value| async {
        t.post(&t.alice, "/transactions/settlement-preview", body)
            .await
    };

    let (status, body) = preview(json!({
        "settled_amount": 650_000,
        "expected_gross_amount": 800_000,
        "adjustments": ct02_items(),
    }))
    .await;
    let (empty_status, empty) = preview(json!({
        "settled_amount": 12_345,
        "expected_gross_amount": 12_345,
        "adjustments": [],
    }))
    .await;
    let refusals = [
        (
            json!({ "settled_amount": -1, "expected_gross_amount": 800_000, "adjustments": [] }),
            "settled_amount",
            "must_not_be_negative",
        ),
        (
            json!({ "settled_amount": 1_000, "expected_gross_amount": 0, "adjustments": [] }),
            "expected_gross_amount",
            "must_be_positive",
        ),
        (
            json!({
                "settled_amount": 0,
                "expected_gross_amount": 10_000,
                "adjustments": [fixed("Taxa", "addition", 500)],
            }),
            "adjustments",
            "no_gross_for_net",
        ),
    ];

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["gross_amount"], 859_220);
    assert_eq!(body["net_amount"], 650_000);
    assert_eq!(computed(&body["adjustments"]), [94_514, 114_706]);
    assert_eq!(body["adjustments"][1]["base_amount"], 764_706);
    assert_eq!(empty_status, StatusCode::OK, "{empty}");
    assert_eq!(empty["gross_amount"], 12_345);
    assert_eq!(empty["net_amount"], 12_345);
    for (request, field, code) in refusals {
        let (status, response) = preview(request).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{response}");
        assert!(
            error_is(&response, field, code),
            "{field}/{code}: {response}"
        );
    }
    assert_eq!(transaction_count(&t).await, 0);
}

#[tokio::test]
async fn adj_patch_recomputes_net_and_settled_refuses_adjustment_change() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let item = create_gross(
        &t,
        &account,
        "income",
        800_000,
        payroll_items(),
        "2026-11-05",
    )
    .await;
    let uri = format!("/transactions/{}", id_of(&item));

    let (status, fewer) = t
        .patch(
            &t.alice,
            &uri,
            json!({ "adjustments": [percent("INSS", "deduction", 1100, None)] }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{fewer}");
    assert_eq!(fewer["expected_amount"], 712_000);
    let (status, raised) = t
        .patch(&t.alice, &uri, json!({ "gross_amount": 900_000 }))
        .await;
    assert_eq!(status, StatusCode::OK, "{raised}");
    assert_eq!(raised["expected_amount"], 801_000);
    assert_eq!(computed(&raised["adjustments"]), [99_000]);
    let (status, refused) = t
        .patch(&t.alice, &uri, json!({ "expected_amount": 5_000 }))
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{refused}");
    assert!(
        error_is(&refused, "expected_amount", "has_adjustments"),
        "{refused}"
    );

    let (status, _) = settle_items(&t, &id_of(&item), 801_000, None).await;
    assert_eq!(status, StatusCode::OK);
    for body in [
        json!({ "adjustments": [] }),
        json!({ "gross_amount": 1_000 }),
    ] {
        let (status, response) = t.patch(&t.alice, &uri, body).await;
        assert_eq!(status, StatusCode::CONFLICT, "{response}");
        assert_eq!(
            response["code"], "transaction_already_settled",
            "{response}"
        );
    }
}

#[tokio::test]
async fn adj_rf08_listing_and_summary_use_net() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    create_gross(
        &t,
        &account,
        "expense",
        20_000,
        json!([
            percent("Desconto à vista", "deduction", 1000, None),
            fixed("Taxa", "addition", 500),
        ]),
        "2026-11-10",
    )
    .await;
    let income = create_gross(
        &t,
        &account,
        "income",
        800_000,
        payroll_items(),
        "2026-11-05",
    )
    .await;
    let (status, _) = settle_items(&t, &id_of(&income), 708_000, None).await;
    assert_eq!(status, StatusCode::OK);

    let (status, summary) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2026-11-01&to=2026-11-30",
        )
        .await;
    let listed = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;

    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(summary["totals"]["income"]["realized"], 708_000);
    assert_eq!(summary["totals"]["expense"]["forecast"], 18_500);
    assert_eq!(summary["balance"]["current"], 708_000);
    let mut amounts: Vec<i64> = listed
        .iter()
        .map(|item| item["expected_amount"].as_i64().unwrap())
        .collect();
    amounts.sort_unstable();
    assert_eq!(amounts, [18_500, 708_000]);
}

const ADJUSTMENTS_MIGRATION: i64 = 20261104010001;

fn uid(value: u128) -> Uuid {
    Uuid::from_u128(value)
}

type BalanceRow = (Uuid, i64);
type MovementRow = (
    Uuid,
    String,
    i64,
    String,
    Option<i64>,
    Option<String>,
    Option<i64>,
);
type RecurringRow = (Uuid, i64);
type SettledBreakdownRow = (Uuid, Option<i64>, Option<i64>, Option<Json<Value>>);

async fn seed_before_adjustments(ctx: &TestContext) {
    let mut before = finance::migrator();
    before.migrations = std::borrow::Cow::Owned(
        before
            .migrations
            .iter()
            .filter(|migration| migration.version < ADJUSTMENTS_MIGRATION)
            .cloned()
            .collect(),
    );
    before.run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    sqlx::query(
        "INSERT INTO accounts (id, owner_id, name, is_default, balance_amount, currency, \
         created_at, updated_at) \
         VALUES ($1, $2, 'Conta principal', true, 90000, 'BRL', now(), now())",
    )
    .bind(uid(1))
    .bind(ALICE)
    .execute(&mut *tx)
    .await
    .unwrap();
    for (id, kind, expected, day, settled, difference, difference_kind) in [
        (
            11,
            "income",
            100_000i64,
            "2026-11-01",
            Some(100_000i64),
            Some(0i64),
            None,
        ),
        (
            12,
            "expense",
            12_000,
            "2026-11-02",
            Some(10_000),
            Some(-2_000),
            Some("saving"),
        ),
        (13, "expense", 5_000, "2026-11-20", None, None, None),
    ] {
        sqlx::query(
            "INSERT INTO transactions (id, owner_id, kind, account_id, expected_amount, \
             expected_date, settled_amount, settled_at, difference_amount, difference_kind, \
             currency, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8::date, $9, $10, 'BRL', now(), now())",
        )
        .bind(uid(id))
        .bind(ALICE)
        .bind(kind)
        .bind(uid(1))
        .bind(expected)
        .bind(day)
        .bind(settled)
        .bind(settled.map(|_| day))
        .bind(difference)
        .bind(difference_kind)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO recurring_transactions (id, owner_id, kind, account_id, expected_amount, \
         currency, rule, created_at, updated_at) \
         VALUES ($1, $2, 'income', $3, 50000, 'BRL', $4, now(), now())",
    )
    .bind(uid(21))
    .bind(ALICE)
    .bind(uid(1))
    .bind(Json(monthly_rule("2026-11-25", 25)))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

async fn adjustments_snapshot(
    ctx: &TestContext,
) -> (Vec<BalanceRow>, Vec<MovementRow>, Vec<RecurringRow>) {
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let accounts = sqlx::query_as("SELECT id, balance_amount FROM accounts ORDER BY id")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    let movements = sqlx::query_as(
        "SELECT id, kind, expected_amount, expected_date::text, settled_amount, \
         settled_at::text, difference_amount FROM transactions ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    let recurring =
        sqlx::query_as("SELECT id, expected_amount FROM recurring_transactions ORDER BY id")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();
    (accounts, movements, recurring)
}

async fn call(
    app: &Router,
    session: &TestSession,
    method: Method,
    uri: &str,
) -> (StatusCode, Value) {
    let request = session
        .request(method, &format!("/api/v1{uri}"))
        .body(Body::empty())
        .unwrap();
    let (status, _, body) = send(app, request).await;
    (status, body)
}

#[tokio::test]
async fn adj_ct14_migration_keeps_balances_summary_and_settled_history() {
    let ctx = TestContext::new().await;
    seed_before_adjustments(&ctx).await;
    let before = adjustments_snapshot(&ctx).await;

    finance::migrator().run(&ctx.state.pool).await.unwrap();

    assert_eq!(adjustments_snapshot(&ctx).await, before);
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let wrong: i64 = sqlx::query_scalar(
        "SELECT (SELECT count(*) FROM transactions \
                 WHERE gross_amount <> expected_amount OR adjustments <> '[]'::jsonb) \
              + (SELECT count(*) FROM recurring_transactions \
                 WHERE gross_amount <> expected_amount OR adjustments <> '[]'::jsonb)",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let settled: Vec<SettledBreakdownRow> = sqlx::query_as(
        "SELECT id, settled_amount, settled_gross_amount, settled_adjustments \
         FROM transactions ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(wrong, 0);
    for (id, settled_amount, settled_gross, settled_items) in settled {
        assert_eq!(settled_gross, settled_amount, "{id}");
        let items = settled_items.map(|items| items.0);
        if settled_amount.is_some() {
            assert_eq!(items, Some(json!([])), "{id}");
        } else {
            assert_eq!(items, None, "{id}");
        }
    }

    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    let (status, summary) = call(
        &app,
        &alice,
        Method::GET,
        "/financial-summaries?from=2026-11-01&to=2026-11-30",
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(summary["balance"]["current"], 90_000);
    assert_eq!(
        summary["totals"]["income"],
        json!({ "realized": 100_000, "forecast": 150_000 })
    );
    assert_eq!(
        summary["totals"]["expense"],
        json!({ "realized": 10_000, "forecast": 15_000 })
    );
    assert_eq!(summary["savings_and_losses"]["savings_amount"], 2_000);
    let settled_uri = format!("/transactions/{}", uid(11));
    let (status, body) = call(&app, &alice, Method::GET, &settled_uri).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["gross_amount"], 100_000);
    assert_eq!(body["adjustments"], json!([]));
    assert_eq!(body["settled_gross_amount"], 100_000);
    assert_eq!(body["settled_adjustments"], json!([]));
    let (status, undone) = call(
        &app,
        &alice,
        Method::DELETE,
        &format!("{settled_uri}/settlement"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{undone}");
    let (_, account) = call(&app, &alice, Method::GET, &format!("/accounts/{}", uid(1))).await;
    assert_eq!(account["balance_amount"], -10_000);
}
