//! Movimentações, liquidação e idempotência (CT-18, CB-09, RN-01 a RN-03, PD-49).

use axum::http::StatusCode;
use serde_json::json;

use super::{FinanceTest, id_of};

#[tokio::test]
async fn balance_changes_only_on_settlement() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let category = t
        .create_category(&t.alice, "Moradia", "expense", "primary")
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
        .create_category(&t.alice, "Salário", "income", "success")
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
async fn updates_unsettled_transaction_fields() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let card = t.create_card(&t.alice, 10, 17).await;
    let rent = t
        .create_category(&t.alice, "Moradia", "expense", "primary")
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
    let (card_status, on_card) = t
        .patch(
            &t.alice,
            &format!("/transactions/{id}"),
            json!({ "account_id": card, "expected_date": "2026-11-15" }),
        )
        .await;
    let (_, fetched) = t.get(&t.alice, &format!("/transactions/{id}")).await;

    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["description"], "Conta de luz");
    assert_eq!(updated["expected_amount"], 12_000);
    assert_eq!(updated["expected_date"], "2026-11-10");
    assert_eq!(updated["account_id"], savings.as_str());
    assert_eq!(updated["category_id"], rent.as_str());
    assert_eq!(updated["visibility"], "shared");
    assert_eq!(updated["statement_period"], serde_json::Value::Null);
    assert_eq!(card_status, StatusCode::OK, "{on_card}");
    assert_eq!(
        on_card["statement_period"], "2026-12",
        "fatura pela data nova"
    );
    assert_eq!(fetched, on_card);
    for account in [&checking, &savings, &card] {
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
        .create_category(&t.alice, "Mercado", "expense", "warning")
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
        .create_category(&t.alice, "Salário", "income", "success")
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
