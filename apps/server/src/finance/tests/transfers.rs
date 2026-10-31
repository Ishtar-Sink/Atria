//! Transferências e categorias (CT-20, CB-15, RF-29, RF-30, RN-05, PD-49).

use axum::http::StatusCode;
use serde_json::json;

use super::{FinanceTest, id_of};

#[tokio::test]
async fn transfer_moves_both_balances_and_stays_out_of_totals() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;

    let body = json!({
        "from_account_id": checking,
        "to_account_id": savings,
        "amount": 50_000,
        "transferred_on": "2026-11-10",
    });
    let (status, transfer) = t.post(&t.alice, "/transfers", body).await;
    let same = json!({
        "from_account_id": checking,
        "to_account_id": checking,
        "amount": 50_000,
        "transferred_on": "2026-11-10",
    });
    let (same_status, problem) = t.post(&t.alice, "/transfers", same).await;
    let (_, summary) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2026-11-01&to=2026-11-30",
        )
        .await;

    assert_eq!(status, StatusCode::CREATED, "{transfer}");
    assert_eq!(transfer["amount"], 50_000);
    assert_eq!(transfer["currency"], "BRL");
    assert_eq!(t.balance(&t.alice, &checking).await, -50_000);
    assert_eq!(t.balance(&t.alice, &savings).await, 50_000);
    assert_eq!(same_status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["code"], "same_account");
    let zero = json!({ "realized": 0, "forecast": 0 });
    assert_eq!(
        summary["totals"],
        json!({ "income": zero, "expense": zero, "surplus": zero }),
        "{summary}"
    );
    assert_eq!(summary["where_it_went"], json!([]));
    assert_eq!(summary["balance"]["current"], 0);
}

#[tokio::test]
async fn deleting_category_in_use_requires_replacement() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let market = t
        .create_category(&t.alice, "Mercado", "expense", "warning")
        .await;
    let food = t
        .create_category(&t.alice, "Alimentação", "expense", "accent")
        .await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": market,
        "expected_amount": 25_000,
        "expected_date": "2026-11-08",
    });
    let (_, created) = t.post(&t.alice, "/transactions", body).await;
    let transaction = id_of(&created["items"][0]);

    let (required, problem) = t.delete(&t.alice, &format!("/categories/{market}")).await;
    let (itself, _) = t
        .delete(
            &t.alice,
            &format!("/categories/{market}?replacement_id={market}"),
        )
        .await;
    let (replaced, _) = t
        .delete(
            &t.alice,
            &format!("/categories/{market}?replacement_id={food}"),
        )
        .await;
    let (_, moved) = t
        .get(&t.alice, &format!("/transactions/{transaction}"))
        .await;
    let (gone, _) = t.get(&t.alice, &format!("/categories/{market}")).await;

    assert_eq!(required, StatusCode::CONFLICT);
    assert_eq!(problem["code"], "category_replacement_required");
    assert_eq!(itself, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(replaced, StatusCode::NO_CONTENT);
    assert_eq!(moved["category_id"], food.as_str());
    assert_eq!(gone, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn creates_renames_and_deletes_category() {
    let t = FinanceTest::new().await;
    let category = |name: &str| json!({ "name": name, "kind": "expense", "color": "info" });

    let id = t
        .create_category(&t.alice, "Lazer", "expense", "info")
        .await;
    let (renamed_status, renamed) = t
        .patch(
            &t.alice,
            &format!("/categories/{id}"),
            json!({ "name": "Viagens", "color": "danger" }),
        )
        .await;
    let (duplicate, problem) = t.post(&t.alice, "/categories", category("viagens")).await;
    let (other_kind, _) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Viagens", "kind": "income", "color": "info" }),
        )
        .await;
    let (bob_same_name, _) = t.post(&t.bob, "/categories", category("Viagens")).await;
    let (deleted, _) = t.delete(&t.alice, &format!("/categories/{id}")).await;
    let list = t.items(&t.alice, "/categories?kind=expense").await;
    let (recreated, _) = t.post(&t.alice, "/categories", category("Viagens")).await;

    assert_eq!(renamed_status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["name"], "Viagens");
    assert_eq!(renamed["color"], "danger");
    assert_eq!(renamed["kind"], "expense");
    assert_eq!(duplicate, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        problem["errors"][0],
        json!({ "field": "name", "code": "taken" })
    );
    assert_eq!(other_kind, StatusCode::CREATED, "nome único por tipo");
    assert_eq!(bob_same_name, StatusCode::CREATED);
    assert_eq!(deleted, StatusCode::NO_CONTENT);
    assert!(list.is_empty());
    assert_eq!(recreated, StatusCode::CREATED);
}

#[tokio::test]
async fn category_has_kind_and_color() {
    let t = FinanceTest::new().await;

    let (status, created) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Salário", "kind": "income", "color": "success" }),
        )
        .await;
    let (missing_kind, _) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Sem tipo", "color": "success" }),
        )
        .await;
    let (hex_color, _) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Hex", "kind": "expense", "color": "#ff0000" }),
        )
        .await;
    let id = id_of(&created);
    let (kind_change, _) = t
        .patch(
            &t.alice,
            &format!("/categories/{id}"),
            json!({ "kind": "expense" }),
        )
        .await;
    let (_, fetched) = t.get(&t.alice, &format!("/categories/{id}")).await;

    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["kind"], "income");
    assert_eq!(created["color"], "success");
    assert_eq!(missing_kind, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(hex_color, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        kind_change,
        StatusCode::UNPROCESSABLE_ENTITY,
        "tipo imutável"
    );
    assert_eq!(fetched["kind"], "income");
}

#[tokio::test]
async fn categories_list_filters_by_kind() {
    let t = FinanceTest::new().await;
    let salary = t
        .create_category(&t.alice, "Salário", "income", "success")
        .await;
    let rent = t
        .create_category(&t.alice, "Moradia", "expense", "primary")
        .await;
    let market = t
        .create_category(&t.alice, "Mercado", "expense", "warning")
        .await;
    let ids = |items: Vec<serde_json::Value>| items.iter().map(id_of).collect::<Vec<_>>();

    let income = ids(t.items(&t.alice, "/categories?kind=income").await);
    let expense = ids(t.items(&t.alice, "/categories?kind=expense").await);
    let all = ids(t.items(&t.alice, "/categories").await);
    let (invalid, _) = t.get(&t.alice, "/categories?kind=transfer").await;

    assert_eq!(income, std::slice::from_ref(&salary));
    assert_eq!(expense, [rent.clone(), market.clone()]);
    assert_eq!(all, [salary, rent, market]);
    assert_eq!(invalid, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn replacement_category_of_other_kind_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let market = t
        .create_category(&t.alice, "Mercado", "expense", "warning")
        .await;
    let salary = t
        .create_category(&t.alice, "Salário", "income", "success")
        .await;
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": market,
        "expected_amount": 25_000,
        "expected_date": "2026-11-08",
    });
    t.post(&t.alice, "/transactions", body).await;

    let (status, problem) = t
        .delete(
            &t.alice,
            &format!("/categories/{market}?replacement_id={salary}"),
        )
        .await;
    let (still_there, _) = t.get(&t.alice, &format!("/categories/{market}")).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
    assert_eq!(problem["code"], "category_kind_mismatch");
    assert_eq!(still_there, StatusCode::OK);
}
