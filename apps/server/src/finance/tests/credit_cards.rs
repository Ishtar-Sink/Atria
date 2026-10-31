//! Cartão, parcelas e fatura (CT-19, CB-10, RF-26, RF-28, RF-34, RN-06, RN-07).

use axum::http::StatusCode;
use serde_json::{Value, json};

use super::{FinanceTest, id_of};

fn by_period<'a>(statements: &'a Value, period: &str) -> &'a Value {
    statements["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|statement| statement["period"] == period)
        .unwrap_or_else(|| panic!("sem fatura {period}"))
}

#[tokio::test]
async fn installments_land_on_right_statements_and_payment_settles() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let card = t.create_card(&t.alice, 10, 17).await;
    let purchase = |date: &str| {
        json!({
            "kind": "expense",
            "account_id": card,
            "description": "Compra parcelada",
            "expected_amount": 30_000,
            "expected_date": date,
            "installments": 3,
        })
    };

    let (status, before) = t
        .post(&t.alice, "/transactions", purchase("2026-11-05"))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{before}");
    let (_, after) = t
        .post(&t.alice, "/transactions", purchase("2026-11-15"))
        .await;

    let periods = |created: &Value| -> Vec<(String, String, i64, i64)> {
        created["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| {
                (
                    item["statement_period"].as_str().unwrap().to_owned(),
                    item["expected_date"].as_str().unwrap().to_owned(),
                    item["installment"]["number"].as_i64().unwrap(),
                    item["expected_amount"].as_i64().unwrap(),
                )
            })
            .collect()
    };
    assert_eq!(
        periods(&before),
        [
            ("2026-11".into(), "2026-11-17".into(), 1, 10_000),
            ("2026-12".into(), "2026-12-17".into(), 2, 10_000),
            ("2027-01".into(), "2027-01-17".into(), 3, 10_000),
        ]
    );
    // Depois do fechamento, a primeira parcela vai para a fatura seguinte (CB-10).
    assert_eq!(
        periods(&after)
            .iter()
            .map(|p| p.0.as_str())
            .collect::<Vec<_>>(),
        ["2026-12", "2027-01", "2027-02"]
    );
    assert_eq!(before["items"][0]["installment"]["total"], 3);

    let (_, statements) = t
        .get(&t.alice, &format!("/credit-cards/{card}/statements"))
        .await;
    assert_eq!(by_period(&statements, "2026-11")["total_amount"], 10_000);
    assert_eq!(by_period(&statements, "2026-12")["total_amount"], 20_000);
    assert_eq!(by_period(&statements, "2027-02")["total_amount"], 10_000);
    assert_eq!(by_period(&statements, "2026-11")["due_date"], "2026-11-17");
    assert_eq!(
        by_period(&statements, "2026-11")["closing_date"],
        "2026-11-10"
    );
    assert_eq!(by_period(&statements, "2026-11")["paid"], false);

    let payment = json!({ "from_account_id": checking, "paid_on": "2026-11-17" });
    let (status, paid) = t
        .post(
            &t.alice,
            &format!("/credit-cards/{card}/statements/2026-11/payment"),
            payment.clone(),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{paid}");
    assert_eq!(paid["transfer"]["amount"], 10_000);
    assert_eq!(paid["transfer"]["from_account_id"], checking.as_str());
    assert_eq!(paid["transfer"]["to_account_id"], card.as_str());
    assert_eq!(paid["transfer"]["statement_period"], "2026-11");
    assert_eq!(
        paid["settled_transaction_ids"],
        json!([before["items"][0]["id"]])
    );

    let (_, statements) = t
        .get(&t.alice, &format!("/credit-cards/{card}/statements"))
        .await;
    assert_eq!(by_period(&statements, "2026-11")["paid"], true);
    assert_eq!(by_period(&statements, "2026-11")["outstanding_amount"], 0);
    assert_eq!(
        by_period(&statements, "2026-12")["outstanding_amount"],
        20_000
    );
    let first = id_of(&before["items"][0]);
    let (_, settled) = t.get(&t.alice, &format!("/transactions/{first}")).await;
    assert_eq!(settled["settled_amount"], 10_000);
    assert_eq!(settled["settled_at"], "2026-11-17");
    assert_eq!(t.balance(&t.alice, &checking).await, -10_000);
    assert_eq!(t.balance(&t.alice, &card).await, 0);
    let (_, transfers) = t.get(&t.alice, "/transfers").await;
    assert_eq!(transfers["items"].as_array().unwrap().len(), 1);

    let (again, problem) = t
        .post(
            &t.alice,
            &format!("/credit-cards/{card}/statements/2026-11/payment"),
            payment,
        )
        .await;
    assert_eq!(again, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["code"], "nothing_to_pay");
}

#[tokio::test]
async fn installments_require_a_credit_card() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;

    let body = json!({
        "kind": "expense",
        "account_id": checking,
        "expected_amount": 30_000,
        "expected_date": "2026-11-05",
        "installments": 3,
    });
    let (status, problem) = t.post(&t.alice, "/transactions", body).await;
    let (statements, _) = t
        .get(&t.alice, &format!("/credit-cards/{checking}/statements"))
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["code"], "requires_credit_card");
    assert_eq!(statements, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn undo_settlement_of_installment_in_paid_statement_is_refused() {
    let t = FinanceTest::new().await;
    let checking = t.default_account(&t.alice).await;
    let card = t.create_card(&t.alice, 10, 17).await;
    let purchase = json!({
        "kind": "expense",
        "account_id": card,
        "expected_amount": 30_000,
        "expected_date": "2026-11-05",
        "installments": 3,
    });
    let (_, created) = t.post(&t.alice, "/transactions", purchase).await;
    let first = id_of(&created["items"][0]);
    let second = id_of(&created["items"][1]);
    let (paid, payment) = t
        .post(
            &t.alice,
            &format!("/credit-cards/{card}/statements/2026-11/payment"),
            json!({ "from_account_id": checking, "paid_on": "2026-11-17" }),
        )
        .await;
    assert_eq!(paid, StatusCode::CREATED, "{payment}");

    let (status, problem) = t.undo_settlement(&t.alice, &first).await;
    let (edit, edit_problem) = t
        .patch(
            &t.alice,
            &format!("/transactions/{second}"),
            json!({ "expected_date": "2026-12-20" }),
        )
        .await;
    let (_, item) = t.get(&t.alice, &format!("/transactions/{first}")).await;

    assert_eq!(status, StatusCode::CONFLICT, "{problem}");
    assert_eq!(problem["code"], "statement_already_paid");
    assert_eq!(item["settled_amount"], 10_000);
    assert_eq!(edit, StatusCode::CONFLICT, "{edit_problem}");
    assert_eq!(edit_problem["code"], "installment_not_editable");
    assert_eq!(t.balance(&t.alice, &checking).await, -10_000);
}
