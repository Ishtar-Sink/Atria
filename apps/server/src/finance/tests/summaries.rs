//! Painel do Financeiro por período livre (CT-22, RF-35, PD-55, PD-58, DEC-004).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{FinanceTest, id_of, monthly_rule};

fn flow(realized: i64, forecast: i64) -> Value {
    json!({ "realized": realized, "forecast": forecast })
}

async fn summary(t: &FinanceTest, query: &str) -> Value {
    let (status, body) = t
        .get(&t.alice, &format!("/financial-summaries{query}"))
        .await;
    assert_eq!(status, StatusCode::OK, "{query}: {body}");
    body
}

async fn expense_on(
    t: &FinanceTest,
    account: &str,
    category: Option<&str>,
    amount: i64,
    day: &str,
) {
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": category,
        "expected_amount": amount,
        "expected_date": day,
    });
    let (status, body) = t.post(&t.alice, "/transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
}

#[tokio::test]
async fn period_summary_matches_transactions() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    let settled = [
        ("income", 500_000, 520_000),
        ("expense", 150_000, 145_000),
        ("expense", 10_000, 12_500),
    ];
    for (kind, expected, amount) in settled {
        let item = t
            .create_transaction(&t.alice, &checking, kind, expected, "2026-11-05")
            .await;
        let (status, _) = t
            .settle(&t.alice, &id_of(&item), amount, "2026-11-06")
            .await;
        assert_eq!(status, StatusCode::OK);
    }
    t.create_transaction(&t.alice, &checking, "expense", 20_000, "2026-11-25")
        .await;
    t.create_transaction(&t.alice, &checking, "expense", 99_000, "2026-12-01")
        .await;
    let transfer = json!({
        "from_account_id": checking,
        "to_account_id": savings,
        "amount": 30_000,
        "transferred_on": "2026-11-20",
    });
    t.post(&t.alice, "/transfers", transfer).await;

    let body = summary(&t, "?from=2026-11-01&to=2026-11-30").await;
    let (invalid, _) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2026-13-01&to=2026-11-30",
        )
        .await;
    let (_, bob) = t
        .get(&t.bob, "/financial-summaries?from=2026-11-01&to=2026-11-30")
        .await;

    assert_eq!(
        body["period"],
        json!({ "from": "2026-11-01", "to": "2026-11-30" })
    );
    assert_eq!(body["currency"], "BRL");
    assert_eq!(
        body["totals"],
        json!({
            "income": flow(520_000, 520_000),
            "expense": flow(157_500, 177_500),
            "surplus": flow(362_500, 342_500),
        })
    );
    assert_eq!(
        body["expected_vs_settled"],
        json!({
            "income": { "expected_amount": 500_000, "settled_amount": 520_000 },
            "expense": { "expected_amount": 180_000, "settled_amount": 157_500 },
        })
    );
    assert_eq!(
        body["savings_and_losses"],
        json!({ "savings_amount": 5_000, "gains_amount": 20_000, "losses_amount": 2_500 })
    );
    let balances: Vec<(String, i64)> = body["balance"]["accounts"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| (id_of(a), a["balance_amount"].as_i64().unwrap()))
        .collect();
    assert_eq!(
        balances,
        [
            (checking, 520_000 - 145_000 - 12_500 - 30_000),
            (savings, 30_000)
        ]
    );
    assert_eq!(body["balance"]["current"], 362_500);
    assert_eq!(invalid, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(bob["totals"]["income"], flow(0, 0));
}

#[tokio::test]
async fn summary_compares_with_previous_period_of_same_length() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    for (amount, day) in [
        (10_000, "2026-10-21"),
        (20_000, "2026-10-22"),
        (30_000, "2026-10-31"),
        (40_000, "2026-11-01"),
        (50_000, "2026-11-11"),
    ] {
        expense_on(&t, &account, None, amount, day).await;
    }

    let body = summary(&t, "?from=2026-11-01&to=2026-11-10").await;

    assert_eq!(
        body["previous_period"],
        json!({ "from": "2026-10-22", "to": "2026-10-31" })
    );
    assert_eq!(body["totals"]["expense"], flow(0, 40_000));
    assert_eq!(body["previous_totals"]["expense"], flow(0, 50_000));
    assert_eq!(body["previous_totals"]["income"], flow(0, 0));
}

#[tokio::test]
async fn where_it_went_groups_top_six_categories_plus_others_with_color() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let colors = [
        "primary", "accent", "success", "warning", "danger", "info", "primary", "accent",
    ];
    let mut categories = Vec::new();
    for (index, color) in colors.iter().enumerate() {
        let name = format!("Categoria {index}");
        let id = t.create_category(&t.alice, &name, "expense", color).await;
        // A categoria 0 tem o maior valor; a 7, o menor.
        let amount = (8 - index as i64) * 1_000;
        expense_on(&t, &account, Some(&id), amount, "2026-11-05").await;
        categories.push((id, name, *color, amount));
    }
    expense_on(&t, &account, None, 500, "2026-11-06").await;
    let salary = t
        .create_category(&t.alice, "Salário", "income", "success")
        .await;
    let income = json!({
        "kind": "income",
        "account_id": account,
        "category_id": salary,
        "expected_amount": 900_000,
        "expected_date": "2026-11-05",
    });
    t.post(&t.alice, "/transactions", income).await;

    let body = summary(&t, "?from=2026-11-01&to=2026-11-30").await;

    let mut expected: Vec<Value> = categories[..6]
        .iter()
        .map(|(id, name, color, amount)| {
            json!({
                "category_id": id,
                "name": name,
                "color": color,
                "group": "category",
                "amount": amount,
            })
        })
        .collect();
    expected.push(json!({
        "category_id": null, "name": null, "color": null, "group": "others", "amount": 3_000,
    }));
    expected.push(json!({
        "category_id": null, "name": null, "color": null, "group": "uncategorized", "amount": 500,
    }));
    assert_eq!(body["where_it_went"], Value::Array(expected));
}

#[tokio::test]
async fn summary_balance_has_current_forecast_at_period_end_and_per_account() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let card = t.create_card(&t.alice, 10, 17).await;
    let salary = t
        .create_transaction(&t.alice, &checking, "income", 100_000, "2026-11-01")
        .await;
    t.settle(&t.alice, &id_of(&salary), 100_000, "2026-11-01")
        .await;
    let purchase = t
        .create_transaction(&t.alice, &card, "expense", 5_000, "2026-11-02")
        .await;
    t.settle(&t.alice, &id_of(&purchase), 5_000, "2026-11-02")
        .await;
    t.create_transaction(&t.alice, &checking, "expense", 30_000, "2026-11-20")
        .await;
    t.create_transaction(&t.alice, &checking, "income", 10_000, "2026-11-25")
        .await;
    t.create_transaction(&t.alice, &checking, "expense", 70_000, "2026-12-05")
        .await;
    t.create_recurring(
        &t.alice,
        &checking,
        "expense",
        5_000,
        monthly_rule("2026-10-15", 15),
    )
    .await;

    let body = summary(&t, "?from=2026-11-01&to=2026-11-30").await;
    let ended = summary(&t, "?from=2026-10-01&to=2026-10-31").await;

    let balance = &body["balance"];
    assert_eq!(balance["current"], 95_000);
    // Atual, menos a saída e mais a entrada previstas, menos a recorrente atrasada de
    // 15/10 e a prevista de 15/11; a saída de dezembro fica de fora.
    assert_eq!(
        balance["forecast_at_period_end"],
        95_000 - 30_000 + 10_000 - 5_000 - 5_000
    );
    let accounts = balance["accounts"].as_array().unwrap();
    assert_eq!(accounts.len(), 1, "só as contas comuns");
    assert_eq!(id_of(&accounts[0]), checking);
    assert_eq!(accounts[0]["balance_amount"], 100_000);
    assert_eq!(ended["balance"]["forecast_at_period_end"], Value::Null);
    assert_eq!(ended["balance"]["current"], 95_000);
}

#[tokio::test]
async fn summary_cards_show_open_statement_due_date_and_used_limit() {
    let t = FinanceTest::new().await;
    let card = t.create_card(&t.alice, 10, 17).await;
    t.create_transaction(&t.alice, &card, "expense", 10_000, "2026-10-05")
        .await;
    t.create_transaction(&t.alice, &card, "expense", 20_000, "2026-11-03")
        .await;
    let paid = t
        .create_transaction(&t.alice, &card, "expense", 30_000, "2026-11-08")
        .await;
    t.settle(&t.alice, &id_of(&paid), 30_000, "2026-11-08")
        .await;
    t.create_transaction(&t.alice, &card, "expense", 40_000, "2026-11-15")
        .await;

    let body = summary(&t, "?from=2026-01-01&to=2026-01-31").await;

    assert_eq!(
        body["credit_cards"],
        json!([{
            "account_id": card,
            "name": "Cartão",
            "statement_period": "2026-11",
            "open_statement_amount": 50_000,
            "due_date": "2026-11-17",
            "credit_limit_amount": 500_000,
            "used_limit_amount": 10_000 + 20_000 + 40_000 + 30_000,
        }])
    );
}

#[tokio::test]
async fn upcoming_bills_cover_next_30_days_regardless_of_period() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    for (amount, day) in [
        (1_000, "2026-10-20"),
        (2_000, "2026-11-15"),
        (3_000, "2026-12-01"),
        (4_000, "2026-12-02"),
    ] {
        expense_on(&t, &account, None, amount, day).await;
    }
    t.create_transaction(&t.alice, &account, "income", 9_000, "2026-11-10")
        .await;
    let settled = t
        .create_transaction(&t.alice, &account, "expense", 9_000, "2026-11-05")
        .await;
    t.settle(&t.alice, &id_of(&settled), 9_000, "2026-11-05")
        .await;
    let rent = t
        .create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-20", 20),
        )
        .await;

    let body = summary(&t, "?from=2026-01-01&to=2026-01-31").await;

    let bills: Vec<(String, i64, String)> = body["upcoming_bills"]
        .as_array()
        .unwrap()
        .iter()
        .map(|bill| {
            (
                bill["expected_date"].as_str().unwrap().to_owned(),
                bill["expected_amount"].as_i64().unwrap(),
                bill["status"].as_str().unwrap().to_owned(),
            )
        })
        .collect();
    assert_eq!(
        bills,
        [
            ("2026-10-20".to_owned(), 1_000, "overdue".to_owned()),
            ("2026-11-15".to_owned(), 2_000, "open".to_owned()),
            ("2026-11-20".to_owned(), 5_000, "open".to_owned()),
            ("2026-12-01".to_owned(), 3_000, "open".to_owned()),
        ]
    );
    assert_eq!(body["upcoming_bills"][2]["recurrence_id"], rent["id"]);
    assert_eq!(body["upcoming_bills"][2]["id"], Value::Null);
}

#[tokio::test]
async fn summary_without_period_goes_from_first_transaction_to_today_without_comparison() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    expense_on(&t, &account, None, 1_000, "2026-09-15").await;
    let income = t
        .create_transaction(&t.alice, &account, "income", 8_000, "2026-10-01")
        .await;
    t.settle(&t.alice, &id_of(&income), 8_000, "2026-10-01")
        .await;
    expense_on(&t, &account, None, 50_000, "2026-12-10").await;

    let body = summary(&t, "").await;
    let (_, empty) = t.get(&t.bob, "/financial-summaries").await;

    assert_eq!(
        body["period"],
        json!({ "from": "2026-09-15", "to": "2026-11-01" })
    );
    assert_eq!(body["previous_period"], Value::Null);
    assert_eq!(body["previous_totals"], Value::Null);
    assert_eq!(body["totals"]["expense"], flow(0, 1_000));
    assert_eq!(body["totals"]["income"], flow(8_000, 8_000));
    assert_eq!(
        empty["period"],
        json!({ "from": "2026-11-01", "to": "2026-11-01" })
    );
    assert_eq!(empty["totals"]["expense"], flow(0, 0));
}

#[tokio::test]
async fn period_with_more_than_3660_days_is_refused() {
    let t = FinanceTest::new().await;

    let (longest, _) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2020-01-01&to=2030-01-07",
        )
        .await;
    let (too_long, problem) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2020-01-01&to=2030-01-08",
        )
        .await;

    assert_eq!(longest, StatusCode::OK);
    assert_eq!(too_long, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
    assert_eq!(problem["code"], "validation_failed");
}
