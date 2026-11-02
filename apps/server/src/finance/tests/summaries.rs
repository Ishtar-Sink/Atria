//! Painel do Financeiro por período livre (CT-22, RF-35, PD-55, PD-58, DEC-004) e a
//! série "Mês a mês" (RF-17, CT-11, CB-08 da SPEC-003).
//! Descontos e acréscimos do período por nome (SPEC-004: RF-14, CT-12 e CB-07).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{ALICE, FinanceTest, id_of, monthly_rule};
use crate::shared::db::begin_for_user;

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
        "#6d28d9", "#0e7490", "#047857", "#92400e", "#be123c", "#0369a1", "#6d28d9", "#0e7490",
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
        .create_category(&t.alice, "Salário", "income", "#047857")
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
    let savings = t.create_account(&t.alice, "Poupança").await;
    let salary = t
        .create_transaction(&t.alice, &checking, "income", 100_000, "2026-11-01")
        .await;
    t.settle(&t.alice, &id_of(&salary), 100_000, "2026-11-01")
        .await;
    let purchase = t
        .create_transaction(&t.alice, &savings, "expense", 5_000, "2026-11-02")
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
    assert_eq!(accounts.len(), 2, "todas as contas");
    assert_eq!(id_of(&accounts[0]), checking);
    assert_eq!(accounts[0]["balance_amount"], 100_000);
    assert_eq!(id_of(&accounts[1]), savings);
    assert_eq!(accounts[1]["balance_amount"], -5_000);
    assert!(body.get("credit_cards").is_none());
    assert_eq!(ended["balance"]["forecast_at_period_end"], Value::Null);
    assert_eq!(ended["balance"]["current"], 95_000);
}

#[tokio::test]
async fn upcoming_movements_cover_income_and_expense_of_next_30_days() {
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
            ("2026-11-10".to_owned(), 9_000, "open".to_owned()),
            ("2026-11-15".to_owned(), 2_000, "open".to_owned()),
            ("2026-11-20".to_owned(), 5_000, "open".to_owned()),
            ("2026-12-01".to_owned(), 3_000, "open".to_owned()),
        ]
    );
    assert_eq!(body["upcoming_bills"][1]["kind"], "income");
    assert_eq!(body["upcoming_bills"][3]["recurrence_id"], rent["id"]);
    assert_eq!(body["upcoming_bills"][3]["id"], Value::Null);
}

#[tokio::test]
async fn ct14_recurring_income_in_7_days_is_upcoming() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = t
        .create_recurring(
            &t.alice,
            &account,
            "income",
            650_000,
            monthly_rule("2026-11-08", 8),
        )
        .await;

    let body = summary(&t, "").await;

    let upcoming = body["upcoming_bills"].as_array().unwrap();
    let income = upcoming
        .iter()
        .find(|item| item["recurrence_id"] == salary["id"])
        .unwrap_or_else(|| panic!("entrada recorrente fora das próximas: {body}"));
    assert_eq!(income["kind"], "income");
    assert_eq!(income["expected_date"], "2026-11-08");
    assert_eq!(income["expected_amount"], 650_000);
    assert_eq!(income["id"], Value::Null);
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

fn month(month: &str, income: i64, expense: i64, balance: i64, projected: bool) -> Value {
    json!({
        "month": month,
        "income": income,
        "expense": expense,
        "balance": balance,
        "projected": projected,
    })
}

async fn stored_transactions(t: &FinanceTest) -> i64 {
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    sqlx::query_scalar("SELECT count(*) FROM transactions")
        .fetch_one(&mut *tx)
        .await
        .unwrap()
}

#[tokio::test]
async fn ct11_summary_monthly_series_has_6_realized_and_6_projected_months() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = t
        .create_transaction(&t.alice, &account, "income", 300_000, "2026-08-05")
        .await;
    let (status, body) = t
        .settle(&t.alice, &id_of(&salary), 300_000, "2026-08-05")
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let market = t
        .create_transaction(&t.alice, &account, "expense", 50_000, "2026-10-10")
        .await;
    let (status, body) = t
        .settle(&t.alice, &id_of(&market), 45_000, "2026-10-12")
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    t.create_transaction(&t.alice, &account, "expense", 20_000, "2027-01-15")
        .await;
    t.create_recurring(
        &t.alice,
        &account,
        "expense",
        10_000,
        monthly_rule("2026-12-05", 5),
    )
    .await;
    assert_eq!(stored_transactions(&t).await, 3);

    let body = summary(&t, "").await;

    assert_eq!(stored_transactions(&t).await, 3);
    assert_eq!(
        body["monthly"],
        json!([
            month("2026-06", 0, 0, 0, false),
            month("2026-07", 0, 0, 0, false),
            month("2026-08", 300_000, 0, 300_000, false),
            month("2026-09", 0, 0, 300_000, false),
            month("2026-10", 0, 45_000, 255_000, false),
            month("2026-11", 0, 0, 255_000, false),
            month("2026-12", 0, 10_000, 245_000, true),
            month("2027-01", 0, 30_000, 215_000, true),
            month("2027-02", 0, 10_000, 205_000, true),
            month("2027-03", 0, 10_000, 195_000, true),
            month("2027-04", 0, 10_000, 185_000, true),
            month("2027-05", 0, 10_000, 175_000, true),
        ])
    );
    assert_eq!(
        summary(&t, "?from=2026-01-01&to=2026-01-31").await["monthly"],
        body["monthly"]
    );
}

#[tokio::test]
async fn monthly_series_without_movements_has_12_zero_months() {
    let t = FinanceTest::new().await;

    let body = summary(&t, "").await;

    let months = [
        "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01",
        "2027-02", "2027-03", "2027-04", "2027-05",
    ];
    let expected: Vec<Value> = months
        .iter()
        .enumerate()
        .map(|(index, name)| month(name, 0, 0, 0, index >= 6))
        .collect();
    assert_eq!(body["monthly"], json!(expected));
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

async fn create_gross(
    t: &FinanceTest,
    account: &str,
    kind: &str,
    gross: i64,
    adjustments: Value,
    day: &str,
) -> String {
    let body = json!({
        "kind": kind,
        "account_id": account,
        "gross_amount": gross,
        "adjustments": adjustments,
        "expected_date": day,
    });
    let (status, body) = t.post(&t.alice, "/transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    id_of(&body["items"][0])
}

#[tokio::test]
async fn adj_ct12_summary_sums_adjustments_by_name_ignoring_case() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = create_gross(
        &t,
        &account,
        "income",
        800_000,
        json!([percent("INSS", "deduction", 1100, None)]),
        "2026-11-05",
    )
    .await;
    let (status, _) = t.settle(&t.alice, &salary, 712_000, "2026-11-05").await;
    assert_eq!(status, StatusCode::OK);
    create_gross(
        &t,
        &account,
        "income",
        300_000,
        json!([fixed("inss", "deduction", 33_000)]),
        "2026-11-20",
    )
    .await;
    create_gross(
        &t,
        &account,
        "expense",
        20_000,
        json!([fixed("Juros", "addition", 1_500)]),
        "2026-11-10",
    )
    .await;
    create_gross(
        &t,
        &account,
        "income",
        100_000,
        json!([fixed("INSS", "deduction", 11_000)]),
        "2026-12-05",
    )
    .await;

    let body = summary(&t, "?from=2026-11-01&to=2026-11-30").await;

    assert_eq!(
        body["adjustments_by_name"],
        json!([
            { "name": "INSS", "direction": "deduction", "expected": 121_000, "settled": 88_000 },
            { "name": "Juros", "direction": "addition", "expected": 1_500, "settled": 0 },
        ])
    );
}

#[tokio::test]
async fn adj_summary_without_adjustments_has_empty_list() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    t.create_transaction(&t.alice, &account, "expense", 10_000, "2026-11-10")
        .await;

    let body = summary(&t, "?from=2026-11-01&to=2026-11-30").await;

    assert_eq!(body["adjustments_by_name"], json!([]));
}
