//! Listagens por período livre, pela data efetiva, com os filtros de categoria e de
//! repetição (PD-52, PD-55, PD-58, DEC-004).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{FinanceTest, id_of, monthly_rule};

/// `(data efetiva, status)` de cada item.
fn dates(items: &[Value]) -> Vec<(String, String)> {
    items
        .iter()
        .map(|item| {
            (
                item["effective_date"].as_str().unwrap().to_owned(),
                item["status"].as_str().unwrap().to_owned(),
            )
        })
        .collect()
}

fn at(date: &str, status: &str) -> (String, String) {
    (date.to_owned(), status.to_owned())
}

#[tokio::test]
async fn transactions_filter_by_settlement_date_when_settled_and_expected_date_otherwise() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let late = t
        .create_transaction(&t.alice, &account, "expense", 1_000, "2026-10-28")
        .await;
    t.settle(&t.alice, &id_of(&late), 1_000, "2026-11-02").await;
    let early = t
        .create_transaction(&t.alice, &account, "expense", 2_000, "2026-11-30")
        .await;
    t.settle(&t.alice, &id_of(&early), 2_000, "2026-12-01")
        .await;
    let open = t
        .create_transaction(&t.alice, &account, "expense", 3_000, "2026-11-15")
        .await;
    let overdue = t
        .create_transaction(&t.alice, &account, "expense", 4_000, "2026-10-20")
        .await;

    let november = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;
    let december = t
        .items(&t.alice, "/transactions?from=2026-12-01&to=2026-12-31")
        .await;
    let october = t
        .items(&t.alice, "/transactions?from=2026-10-01&to=2026-10-31")
        .await;

    assert_eq!(
        dates(&november),
        [at("2026-11-02", "settled"), at("2026-11-15", "open")]
    );
    assert_eq!(november[0]["id"], late["id"]);
    assert_eq!(november[1]["id"], open["id"]);
    assert_eq!(dates(&december), [at("2026-12-01", "settled")]);
    assert_eq!(dates(&october), [at("2026-10-20", "overdue")]);
    assert_eq!(october[0]["id"], overdue["id"]);
}

#[tokio::test]
async fn transfers_filter_by_period() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    for day in ["2026-10-31", "2026-11-05", "2026-12-01"] {
        let body = json!({
            "from_account_id": checking,
            "to_account_id": savings,
            "amount": 1_000,
            "transferred_on": day,
        });
        let (status, _) = t.post(&t.alice, "/transfers", body).await;
        assert_eq!(status, StatusCode::CREATED);
    }
    let days = |items: Vec<Value>| {
        items
            .iter()
            .map(|item| item["transferred_on"].as_str().unwrap().to_owned())
            .collect::<Vec<_>>()
    };

    let november = days(
        t.items(&t.alice, "/transfers?from=2026-11-01&to=2026-11-30")
            .await,
    );
    let from_november = days(t.items(&t.alice, "/transfers?from=2026-11-01").await);
    let all = days(t.items(&t.alice, "/transfers").await);

    assert_eq!(november, ["2026-11-05"]);
    assert_eq!(from_november, ["2026-11-05", "2026-12-01"]);
    assert_eq!(all.len(), 3);
}

#[tokio::test]
async fn period_with_from_after_to_is_refused() {
    let t = FinanceTest::new().await;

    for uri in [
        "/transactions?from=2026-11-30&to=2026-11-01",
        "/transfers?from=2026-11-30&to=2026-11-01",
        "/financial-summaries?from=2026-11-30&to=2026-11-01",
    ] {
        let (status, problem) = t.get(&t.alice, uri).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}: {problem}");
        assert_eq!(problem["code"], "validation_failed");
    }
}

#[tokio::test]
async fn transactions_filter_by_category() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let market = t
        .create_category(&t.alice, "Mercado", "expense", "warning")
        .await;
    let fuel = t
        .create_category(&t.alice, "Combustível", "expense", "info")
        .await;
    for (category, amount) in [(&market, 1_000), (&fuel, 2_000), (&market, 3_000)] {
        let body = json!({
            "kind": "expense",
            "account_id": account,
            "category_id": category,
            "expected_amount": amount,
            "expected_date": "2026-11-05",
        });
        t.post(&t.alice, "/transactions", body).await;
    }
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "category_id": market,
        "expected_amount": 4_000,
        "rule": monthly_rule("2026-11-20", 20),
    });
    t.post(&t.alice, "/recurring-transactions", body).await;
    let amounts = |items: Vec<Value>| {
        items
            .iter()
            .map(|item| item["expected_amount"].as_i64().unwrap())
            .collect::<Vec<_>>()
    };

    let by_market = amounts(
        t.items(
            &t.alice,
            &format!("/transactions?from=2026-11-01&to=2026-11-30&category_id={market}"),
        )
        .await,
    );
    let by_fuel = amounts(
        t.items(
            &t.alice,
            &format!("/transactions?from=2026-11-01&to=2026-11-30&category_id={fuel}"),
        )
        .await,
    );

    assert_eq!(by_market, [1_000, 3_000, 4_000]);
    assert_eq!(by_fuel, [2_000]);
}

#[tokio::test]
async fn repetition_filter_separates_recurring_and_one_off() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let one_off = t
        .create_transaction(&t.alice, &account, "expense", 1_000, "2026-11-05")
        .await;
    let internet = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );
    let (_, copy) = t
        .settle_occurrence(&t.alice, &internet, "2026-11-10", 5_000, "2026-11-10")
        .await;
    let range = "/transactions?from=2026-11-01&to=2026-12-31";

    let all = t.items(&t.alice, &format!("{range}&repetition=all")).await;
    let default = t.items(&t.alice, range).await;
    let recurring = t
        .items(&t.alice, &format!("{range}&repetition=recurring"))
        .await;
    let single = t
        .items(&t.alice, &format!("{range}&repetition=one_off"))
        .await;
    let (invalid, _) = t
        .get(&t.alice, &format!("{range}&repetition=monthly"))
        .await;

    assert_eq!(
        dates(&all),
        [
            at("2026-11-05", "open"),
            at("2026-11-10", "settled"),
            at("2026-12-10", "open"),
        ]
    );
    assert_eq!(all, default);
    assert_eq!(dates(&recurring), [at("2026-12-10", "open")]);
    assert_eq!(recurring[0]["recurrence_id"], internet.as_str());
    assert_eq!(recurring[0]["id"], Value::Null);
    assert_eq!(
        dates(&single),
        [at("2026-11-05", "open"), at("2026-11-10", "settled")]
    );
    assert_eq!(single[0]["id"], one_off["id"]);
    assert_eq!(single[1]["id"], copy["id"]);
    assert_eq!(single[1]["generated_from"], internet.as_str());
    assert_eq!(invalid, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn listing_without_period_has_no_date_limit() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let old = t
        .create_transaction(&t.alice, &account, "expense", 1_000, "2020-01-01")
        .await;
    let far = t
        .create_transaction(&t.alice, &account, "income", 2_000, "2035-06-01")
        .await;
    let gym = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            9_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );

    let all = t.items(&t.alice, "/transactions").await;
    let mut paged: Vec<Value> = Vec::new();
    let mut uri = "/transactions?limit=1".to_owned();
    loop {
        let (status, page) = t.get(&t.alice, &uri).await;
        assert_eq!(status, StatusCode::OK, "{page}");
        paged.extend(page["items"].as_array().unwrap().iter().cloned());
        let Some(cursor) = page["next_cursor"].as_str() else {
            break;
        };
        uri = format!("/transactions?limit=1&cursor={cursor}");
        assert!(paged.len() <= 3, "a paginação não termina");
    }

    assert_eq!(
        dates(&all),
        [
            at("2020-01-01", "overdue"),
            at("2026-11-10", "open"),
            at("2035-06-01", "open"),
        ]
    );
    assert_eq!(all[0]["id"], old["id"]);
    assert_eq!(all[1]["recurrence_id"], gym.as_str());
    assert_eq!(all[2]["id"], far["id"]);
    assert_eq!(paged, all);
}

async fn described(t: &FinanceTest, account: &str, description: &str, day: &str) -> Value {
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "description": description,
        "expected_amount": 1_000,
        "expected_date": day,
    });
    let (status, body) = t.post(&t.alice, "/transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["items"][0].clone()
}

fn descriptions(items: &[Value]) -> Vec<String> {
    items
        .iter()
        .map(|item| item["description"].as_str().unwrap_or_default().to_owned())
        .collect()
}

#[tokio::test]
async fn search_matches_description_ignoring_case_and_accents() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    described(&t, &account, "Conta de Água", "2026-11-05").await;
    described(&t, &account, "Luz", "2026-11-06").await;
    described(&t, &account, "Desconto 50%", "2026-11-07").await;
    t.create_transaction(&t.alice, &account, "expense", 1_000, "2026-11-08")
        .await;

    let water = t.items(&t.alice, "/transactions?q=agua").await;
    let upper = t.items(&t.alice, "/transactions?q=%C3%81GUA").await;
    let percent = t.items(&t.alice, "/transactions?q=0%25").await;
    let wildcard = t.items(&t.alice, "/transactions?q=%25").await;
    let underscore = t.items(&t.alice, "/transactions?q=_").await;
    let padded = t.items(&t.alice, "/transactions?q=%20%20luz%20").await;

    assert_eq!(descriptions(&water), ["Conta de Água"]);
    assert_eq!(descriptions(&upper), ["Conta de Água"]);
    assert_eq!(descriptions(&percent), ["Desconto 50%"]);
    assert_eq!(descriptions(&wildcard), ["Desconto 50%"], "% é literal");
    assert!(underscore.is_empty(), "_ é literal");
    assert_eq!(descriptions(&padded), ["Luz"]);
}

#[tokio::test]
async fn search_also_filters_virtual_recurring_items() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    for description in ["Academia", "Aluguel"] {
        let body = json!({
            "kind": "expense",
            "account_id": account,
            "description": description,
            "expected_amount": 9_000,
            "rule": monthly_rule("2026-11-10", 10),
        });
        let (status, _) = t.post(&t.alice, "/recurring-transactions", body).await;
        assert_eq!(status, StatusCode::CREATED);
    }
    described(&t, &account, "Academia avulsa", "2026-11-05").await;

    let items = t
        .items(
            &t.alice,
            "/transactions?from=2026-11-01&to=2026-12-31&q=ACAD",
        )
        .await;

    assert_eq!(
        descriptions(&items),
        ["Academia avulsa", "Academia", "Academia"]
    );
    assert_eq!(
        dates(&items)[1..],
        [at("2026-11-10", "open"), at("2026-12-10", "forecast")]
    );
}

#[tokio::test]
async fn transfers_search_by_description() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.create_account(&t.alice, "Poupança").await;
    for description in ["Reserva de emergência", "Viagem"] {
        let body = json!({
            "from_account_id": checking,
            "to_account_id": savings,
            "amount": 1_000,
            "transferred_on": "2026-11-05",
            "description": description,
        });
        t.post(&t.alice, "/transfers", body).await;
    }

    let found = t.items(&t.alice, "/transfers?q=EMERGENCIA").await;
    let none = t.items(&t.alice, "/transfers?q=mercado").await;

    assert_eq!(descriptions(&found), ["Reserva de emergência"]);
    assert!(none.is_empty());
}

#[tokio::test]
async fn search_with_more_than_100_characters_is_refused() {
    let t = FinanceTest::new().await;
    let long = "a".repeat(101);
    let longest = "a".repeat(100);

    for uri in [
        format!("/transactions?q={long}"),
        format!("/transfers?q={long}"),
        "/transactions?q=%20%20".to_owned(),
    ] {
        let (status, problem) = t.get(&t.alice, &uri).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}: {problem}");
        assert_eq!(problem["code"], "validation_failed");
    }
    let (ok, _) = t.get(&t.alice, &format!("/transactions?q={longest}")).await;
    assert_eq!(ok, StatusCode::OK);
}
