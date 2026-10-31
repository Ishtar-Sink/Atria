//! Recorrência financeira com ocorrência aberta única, cópia liquidada e previsão
//! virtual (CT-21, CB-02, CB-09, RF-31, RN-08, RN-09, PD-51, DEC-003, DEC-004).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{FinanceTest, id_of, monthly_rule};

/// `(data efetiva, valor previsto, status, tem id)` de cada item.
fn rows(items: &[Value]) -> Vec<(String, i64, String, bool)> {
    items
        .iter()
        .map(|item| {
            (
                item["effective_date"].as_str().unwrap().to_owned(),
                item["expected_amount"].as_i64().unwrap(),
                item["status"].as_str().unwrap().to_owned(),
                !item["id"].is_null(),
            )
        })
        .collect()
}

fn row(date: &str, amount: i64, status: &str, stored: bool) -> (String, i64, String, bool) {
    (date.to_owned(), amount, status.to_owned(), stored)
}

async fn open_occurrence(t: &FinanceTest, recurrence_id: &str) -> Value {
    let (status, body) = t
        .get(
            &t.alice,
            &format!("/recurring-transactions/{recurrence_id}"),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["open_occurrence"].clone()
}

async fn stored_transactions(t: &FinanceTest) -> i64 {
    let mut tx = crate::shared::db::begin_for_user(t.pool(), super::ALICE)
        .await
        .unwrap();
    sqlx::query_scalar("SELECT count(*) FROM transactions")
        .fetch_one(&mut *tx)
        .await
        .unwrap()
}

async fn rent(t: &FinanceTest, account: &str) -> String {
    let body = json!({
        "kind": "expense",
        "account_id": account,
        "expected_amount": 200_000,
        "description": "Aluguel",
        "rule": monthly_rule("2027-01-31", 31),
    });
    let (status, rent) = t.post(&t.alice, "/recurring-transactions", body).await;
    assert_eq!(status, StatusCode::CREATED, "{rent}");
    assert_eq!(rent["rule"]["timezone"], "America/Sao_Paulo");
    id_of(&rent)
}

#[tokio::test]
async fn monthly_rent_on_31_falls_on_last_day_and_change_from_third_month_affects_only_future() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let range = "/transactions?from=2027-01-01&to=2027-06-30";

    let before = t.items(&t.alice, range).await;
    assert_eq!(
        rows(&before),
        [
            row("2027-01-31", 200_000, "open", false),
            row("2027-02-28", 200_000, "forecast", false),
            row("2027-03-31", 200_000, "forecast", false),
            row("2027-04-30", 200_000, "forecast", false),
            row("2027-05-31", 200_000, "forecast", false),
            row("2027-06-30", 200_000, "forecast", false),
        ]
    );
    assert!(
        before
            .iter()
            .all(|item| item["recurrence_id"] == rent_id.as_str())
    );
    let (january, jan_copy) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    let (february, feb_copy) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-02-28", 200_000, "2027-02-28")
        .await;
    assert_eq!(january, StatusCode::CREATED, "{jan_copy}");
    assert_eq!(february, StatusCode::CREATED, "{feb_copy}");

    let change = json!({ "expected_amount": 210_000 });
    let (status, changed) = t
        .patch(
            &t.alice,
            &format!("/recurring-transactions/{rent_id}"),
            change,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{changed}");
    assert_eq!(changed["expected_amount"], 210_000);
    assert_eq!(changed["open_occurrence"]["occurrence_date"], "2027-03-31");

    let after = t
        .items(&t.alice, "/transactions?from=2027-01-01&to=2027-04-30")
        .await;
    assert_eq!(
        rows(&after),
        [
            row("2027-01-31", 200_000, "settled", true),
            row("2027-02-28", 200_000, "settled", true),
            row("2027-03-31", 210_000, "open", false),
            row("2027-04-30", 210_000, "forecast", false),
        ]
    );
    assert_eq!(after[0]["id"], jan_copy["id"]);
    assert_eq!(after[1]["id"], feb_copy["id"]);
    assert_eq!(after[1]["settled_amount"], 200_000);
    assert_eq!(after[1]["generated_from"], rent_id.as_str());
}

#[tokio::test]
async fn settling_recurring_creates_copy_linked_by_generated_from_and_advances() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let internet = t
        .create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await;
    let id = id_of(&internet);
    assert_eq!(
        internet["open_occurrence"],
        json!({ "occurrence_date": "2026-11-10", "status": "open" })
    );

    let (status, copy) = t
        .settle_occurrence(&t.alice, &id, "2026-11-10", 4_500, "2026-11-09")
        .await;

    assert_eq!(status, StatusCode::CREATED, "{copy}");
    assert!(!copy["id"].is_null());
    assert_eq!(copy["generated_from"], id.as_str());
    assert_eq!(copy["recurrence_id"], Value::Null);
    assert_eq!(copy["occurrence_date"], "2026-11-10");
    assert_eq!(copy["expected_date"], "2026-11-10");
    assert_eq!(copy["expected_amount"], 5_000);
    assert_eq!(copy["settled_amount"], 4_500);
    assert_eq!(copy["difference_kind"], "saving");
    assert_eq!(copy["status"], "settled");
    assert_eq!(copy["effective_date"], "2026-11-09");
    assert_eq!(t.balance(&t.alice, &account).await, -4_500);
    assert_eq!(stored_transactions(&t).await, 1);
    let (_, fetched) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&copy)))
        .await;
    assert_eq!(fetched["generated_from"], id.as_str());
    assert_eq!(
        open_occurrence(&t, &id).await,
        json!({ "occurrence_date": "2026-12-10", "status": "open" })
    );
    let (_, list) = t.get(&t.alice, "/recurring-transactions").await;
    assert_eq!(
        list["items"][0]["open_occurrence"]["occurrence_date"],
        "2026-12-10"
    );
    assert_eq!(list["items"][0]["last_closed_on"], "2026-11-10");
}

#[tokio::test]
async fn unsettled_occurrence_stays_open_and_overdue_until_settled_or_skipped() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let gym = t
        .create_recurring(
            &t.alice,
            &account,
            "expense",
            9_000,
            monthly_rule("2026-10-10", 10),
        )
        .await;
    let id = id_of(&gym);
    assert_eq!(
        gym["open_occurrence"],
        json!({ "occurrence_date": "2026-10-10", "status": "overdue" })
    );

    t.set_now("2026-12-15T12:00:00Z");
    let waiting = t
        .items(&t.alice, "/transactions?from=2026-10-01&to=2026-12-31")
        .await;
    assert_eq!(
        rows(&waiting),
        [
            row("2026-10-10", 9_000, "overdue", false),
            row("2026-11-10", 9_000, "forecast", false),
            row("2026-12-10", 9_000, "forecast", false),
        ]
    );
    assert_eq!(
        open_occurrence(&t, &id).await["occurrence_date"],
        "2026-10-10"
    );

    let (settled, _) = t
        .settle_occurrence(&t.alice, &id, "2026-10-10", 9_000, "2026-12-15")
        .await;
    assert_eq!(settled, StatusCode::CREATED);
    assert_eq!(
        open_occurrence(&t, &id).await,
        json!({ "occurrence_date": "2026-11-10", "status": "overdue" })
    );
    let (skipped, _) = t.skip_occurrence(&t.alice, &id, "2026-11-10").await;
    assert_eq!(skipped, StatusCode::OK);
    assert_eq!(
        open_occurrence(&t, &id).await,
        json!({ "occurrence_date": "2026-12-10", "status": "overdue" })
    );
    t.set_now("2026-12-10T12:00:00Z");
    assert_eq!(open_occurrence(&t, &id).await["status"], "open");
}

#[tokio::test]
async fn skipping_occurrence_advances_without_copy() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let id = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );

    let (status, skipped) = t.skip_occurrence(&t.alice, &id, "2026-11-10").await;
    let (again, problem) = t.skip_occurrence(&t.alice, &id, "2026-11-10").await;

    assert_eq!(status, StatusCode::OK, "{skipped}");
    assert_eq!(skipped["last_closed_on"], "2026-11-10");
    assert_eq!(
        skipped["open_occurrence"],
        json!({ "occurrence_date": "2026-12-10", "status": "open" })
    );
    assert_eq!(again, StatusCode::CONFLICT);
    assert_eq!(problem["code"], "occurrence_not_open");
    assert_eq!(stored_transactions(&t).await, 0);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    let november = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-12-31")
        .await;
    assert_eq!(rows(&november), [row("2026-12-10", 5_000, "open", false)]);
}

#[tokio::test]
async fn future_period_lists_virtual_forecast_without_persisting() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let id = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );

    let items = t
        .items(&t.alice, "/transactions?from=2027-01-01&to=2027-03-31")
        .await;

    assert_eq!(
        rows(&items),
        [
            row("2027-01-10", 5_000, "forecast", false),
            row("2027-02-10", 5_000, "forecast", false),
            row("2027-03-10", 5_000, "forecast", false),
        ]
    );
    assert!(items.iter().all(|item| item["recurrence_id"] == id.as_str()
        && item["occurrence_date"] == item["expected_date"]
        && item["settled_at"].is_null()));
    assert_eq!(stored_transactions(&t).await, 0);
}

#[tokio::test]
async fn settling_occurrence_that_is_not_open_is_refused() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rule = json!({
        "frequency": "monthly",
        "interval": 1,
        "month_day": 10,
        "time": "08:00",
        "timezone": "America/Sao_Paulo",
        "starts_on": "2026-11-10",
        "ends_on": "2026-11-30"
    });
    let id = id_of(
        &t.create_recurring(&t.alice, &account, "expense", 5_000, rule)
            .await,
    );

    let (future, problem) = t
        .settle_occurrence(&t.alice, &id, "2026-12-10", 5_000, "2026-11-10")
        .await;
    let (open, _) = t
        .settle_occurrence(&t.alice, &id, "2026-11-10", 5_000, "2026-11-10")
        .await;
    let (ended, ended_problem) = t
        .settle_occurrence(&t.alice, &id, "2026-12-10", 5_000, "2026-12-10")
        .await;

    assert_eq!(future, StatusCode::CONFLICT, "{problem}");
    assert_eq!(problem["code"], "occurrence_not_open");
    assert_eq!(open, StatusCode::CREATED);
    assert_eq!(ended, StatusCode::CONFLICT);
    assert_eq!(ended_problem["code"], "recurrence_ended");
    assert_eq!(open_occurrence(&t, &id).await, Value::Null);
    assert_eq!(t.balance(&t.alice, &account).await, -5_000);
}

#[tokio::test]
async fn duplicate_idempotency_key_on_occurrence_settlement_returns_same_copy() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let id = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            5_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );
    let uri = format!("/recurring-transactions/{id}/settlement");
    let body = json!({
        "occurrence_date": "2026-11-10",
        "settled_amount": 5_000,
        "settled_at": "2026-11-10",
    });

    let (first_status, first) = t.post_with_key(&t.alice, &uri, "liquida-01", &body).await;
    let (second_status, second) = t.post_with_key(&t.alice, &uri, "liquida-01", &body).await;
    let other = json!({
        "occurrence_date": "2026-12-10",
        "settled_amount": 5_000,
        "settled_at": "2026-12-10",
    });
    let (reused, problem) = t.post_with_key(&t.alice, &uri, "liquida-01", &other).await;

    assert_eq!(first_status, StatusCode::CREATED, "{first}");
    assert_eq!(second_status, StatusCode::CREATED);
    assert_eq!(first, second);
    assert_eq!(reused, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "idempotency_key_reused");
    assert_eq!(stored_transactions(&t).await, 1);
    assert_eq!(t.balance(&t.alice, &account).await, -5_000);
    assert_eq!(
        open_occurrence(&t, &id).await["occurrence_date"],
        "2026-12-10"
    );
}

#[tokio::test]
async fn deleting_last_settled_copy_reverts_balance_and_reopens_occurrence() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let (_, january) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    let (_, february) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-02-28", 200_000, "2027-02-28")
        .await;
    assert_eq!(t.balance(&t.alice, &account).await, -400_000);

    let (status, _) = t
        .delete(&t.alice, &format!("/transactions/{}", id_of(&february)))
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(t.balance(&t.alice, &account).await, -200_000);
    assert_eq!(
        open_occurrence(&t, &rent_id).await["occurrence_date"],
        "2027-02-28"
    );
    let (kept, _) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&january)))
        .await;
    assert_eq!(kept, StatusCode::OK);
    let (again, _) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-02-28", 190_000, "2027-02-27")
        .await;
    assert_eq!(
        again,
        StatusCode::CREATED,
        "a ocorrência reaberta liquida de novo"
    );
}

#[tokio::test]
async fn deleting_older_settled_copy_only_reverts_balance() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let (_, january) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    t.settle_occurrence(&t.alice, &rent_id, "2027-02-28", 200_000, "2027-02-28")
        .await;

    let (status, _) = t
        .delete(&t.alice, &format!("/transactions/{}", id_of(&january)))
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(t.balance(&t.alice, &account).await, -200_000);
    assert_eq!(
        open_occurrence(&t, &rent_id).await["occurrence_date"],
        "2027-03-31"
    );
}

#[tokio::test]
async fn undo_settlement_of_last_copy_deletes_copy_and_reopens_occurrence() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let (_, january) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    let (_, february) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-02-28", 200_000, "2027-02-28")
        .await;

    let (status, _) = t.undo_settlement(&t.alice, &id_of(&february)).await;
    let (gone, _) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&february)))
        .await;
    let (kept, _) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&january)))
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(gone, StatusCode::NOT_FOUND, "a cópia é apagada");
    assert_eq!(kept, StatusCode::OK);
    assert_eq!(t.balance(&t.alice, &account).await, -200_000);
    assert_eq!(
        open_occurrence(&t, &rent_id).await["occurrence_date"],
        "2027-02-28"
    );
}

#[tokio::test]
async fn undo_settlement_of_older_copy_deletes_copy_and_keeps_open_occurrence() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let (_, january) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    t.settle_occurrence(&t.alice, &rent_id, "2027-02-28", 200_000, "2027-02-28")
        .await;

    let (status, _) = t.undo_settlement(&t.alice, &id_of(&january)).await;
    let (gone, _) = t
        .get(&t.alice, &format!("/transactions/{}", id_of(&january)))
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(gone, StatusCode::NOT_FOUND);
    assert_eq!(t.balance(&t.alice, &account).await, -200_000);
    assert_eq!(
        open_occurrence(&t, &rent_id).await["occurrence_date"],
        "2027-03-31"
    );
}

#[tokio::test]
async fn lists_settled_copies_of_recurring_with_pagination() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let rent_id = rent(&t, &account).await;
    let (_, january) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-01-31", 200_000, "2027-01-31")
        .await;
    let (_, february) = t
        .settle_occurrence(&t.alice, &rent_id, "2027-02-28", 195_000, "2027-02-27")
        .await;
    t.create_transaction(&t.alice, &account, "expense", 1_000, "2027-01-15")
        .await;
    let uri = format!("/recurring-transactions/{rent_id}/settled-transactions");

    let (status, first) = t.get(&t.alice, &format!("{uri}?limit=1")).await;
    let cursor = first["next_cursor"].as_str().expect("cursor").to_owned();
    let (_, second) = t
        .get(&t.alice, &format!("{uri}?limit=1&cursor={cursor}"))
        .await;
    let (_, all) = t.get(&t.alice, &uri).await;

    assert_eq!(status, StatusCode::OK, "{first}");
    assert_eq!(first["items"].as_array().unwrap().len(), 1);
    assert_eq!(first["items"][0]["id"], february["id"]);
    assert_eq!(first["items"][0]["generated_from"], rent_id.as_str());
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert_eq!(second["items"][0]["id"], january["id"]);
    assert_eq!(second["next_cursor"], Value::Null);
    assert_eq!(all["items"].as_array().unwrap().len(), 2);
}
