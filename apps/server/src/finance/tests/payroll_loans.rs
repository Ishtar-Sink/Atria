//! Consignados descontados em folha (SPEC-006: RF-02 a RF-05, RF-13, RNF-02, CT-01, CT-02,
//! FA-04): cadastro na entrada avulsa ou recorrente com o prazo calculado, a categoria
//! "Empréstimo", as recusas, o isolamento entre pessoas, os campos da parcela na movimentação
//! e a migração sem mudar os dados existentes.
//! Projeção, liquidação e desfazer conjuntos (SPEC-006: RF-06 a RF-10, RNF-03, CT-03 a CT-07, CT-11, CT-12, CT-15, CB-01, CB-04, CB-05, CB-07).

use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use sqlx::types::Json;
use uuid::Uuid;

use super::{ALICE, FinanceTest, id_of, monthly_rule};
use crate::finance;
use crate::http::test_support::{TestContext, send};
use crate::shared::db::begin_for_user;

const MIGRATION_VERSION: i64 = 20261105010001;

/// Os seis consignados do holerite de exemplo (soma 374_670), usados também pela TASK-04.
fn six_loans() -> [(&'static str, i64, i16, i16); 6] {
    [
        ("Empréstimo 178176138", 293_723, 48, 12),
        ("Empréstimo 2", 26_491, 48, 12),
        ("Empréstimo 3", 4_527, 48, 12),
        ("Empréstimo 4", 16_047, 48, 12),
        ("Empréstimo 5", 16_941, 48, 12),
        ("Empréstimo 6", 16_941, 48, 12),
    ]
}

async fn salary(t: &FinanceTest, account: &str) -> String {
    let body = t
        .create_recurring(
            &t.alice,
            account,
            "income",
            1_066_988,
            monthly_rule("2026-11-05", 5),
        )
        .await;
    id_of(&body)
}

async fn create_loan(t: &FinanceTest, body: Value) -> Value {
    let (status, body) = t.post(&t.alice, "/payroll-loans", body).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body
}

fn loan_body(link: (&str, &str), name: &str, amount: i64, total: i16, current: i16) -> Value {
    let mut body = json!({
        "name": name,
        "contract_number": "178176138",
        "installment_amount": amount,
        "total_installments": total,
        "current_installment": current,
    });
    body[link.0] = json!(link.1);
    body
}

fn first_error(body: &Value) -> (String, String) {
    let error = &body["errors"][0];
    (
        error["field"].as_str().unwrap_or_default().to_owned(),
        error["code"].as_str().unwrap_or_default().to_owned(),
    )
}

async fn loan_count(t: &FinanceTest) -> i64 {
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let count = sqlx::query_scalar("SELECT count(*) FROM payroll_loans")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    count
}

async fn loan_categories(
    t: &FinanceTest,
    session: &crate::http::test_support::TestSession,
) -> Vec<Value> {
    t.items(session, "/categories?limit=100")
        .await
        .into_iter()
        .filter(|category| category["system_key"] == "loan")
        .collect()
}

#[tokio::test]
async fn pl_ct01_loan_on_salary_recurrence_is_saved_with_term() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;

    let loan = create_loan(
        &t,
        loan_body(
            ("income_recurrence_id", &salary),
            "Empréstimo 178176138",
            293_723,
            48,
            12,
        ),
    )
    .await;

    assert_eq!(loan["income_recurrence_id"], salary.as_str());
    assert!(loan["income_id"].is_null());
    assert_eq!(loan["name"], "Empréstimo 178176138");
    assert_eq!(loan["contract_number"], "178176138");
    assert_eq!(loan["installment_amount"], 293_723);
    assert_eq!(loan["currency"], "BRL");
    assert_eq!(loan["total_installments"], 48);
    assert_eq!(loan["current_installment"], 12);
    assert!(loan["ends_on"].is_null());
    assert_eq!(loan["status"], "active");
    assert_eq!(loan["starts_on"], "2026-11-05");
    assert_eq!(loan["next_installment_on"], "2026-11-05");
    assert_eq!(loan["last_installment_on"], "2029-11-05");
    assert_eq!(loan["remaining_installments"], 37);

    let id = id_of(&loan);
    let (status, read) = t.get(&t.alice, &format!("/payroll-loans/{id}")).await;
    assert_eq!(status, StatusCode::OK, "{read}");
    assert_eq!(read, loan);
    let listed = t
        .items(
            &t.alice,
            &format!("/payroll-loans?income_recurrence_id={salary}"),
        )
        .await;
    assert_eq!(listed.len(), 1);

    let categories = loan_categories(&t, &t.alice).await;
    assert_eq!(categories.len(), 1, "{categories:?}");
    assert_eq!(categories[0]["kind"], "expense");
    assert_eq!(categories[0]["name"], "Empréstimo");
    assert_eq!(categories[0]["id"], loan["category_id"]);
}

#[tokio::test]
async fn pl_ct02_loan_by_end_date_returns_last_installment() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;

    let loan = create_loan(
        &t,
        json!({
            "income_recurrence_id": salary,
            "name": "Empréstimo 2",
            "installment_amount": 26_491,
            "ends_on": "2027-03-20",
        }),
    )
    .await;

    assert!(loan["total_installments"].is_null());
    assert!(loan["current_installment"].is_null());
    assert_eq!(loan["ends_on"], "2027-03-20");
    assert_eq!(loan["last_installment_on"], "2027-03-05");
    assert_eq!(loan["remaining_installments"], 5);
}

#[tokio::test]
async fn pl_fa04_loan_on_one_off_income_has_single_installment() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let income = t
        .create_transaction(&t.alice, &account, "income", 1_066_988, "2026-11-20")
        .await;
    let income_id = id_of(&income);

    let loan = create_loan(
        &t,
        loan_body(
            ("income_id", &income_id),
            "Empréstimo 178176138",
            293_723,
            48,
            12,
        ),
    )
    .await;

    assert_eq!(loan["income_id"], income_id.as_str());
    assert_eq!(loan["next_installment_on"], "2026-11-20");
    assert_eq!(loan["last_installment_on"], "2026-11-20");
    assert_eq!(loan["remaining_installments"], 1);
    assert_eq!(loan["status"], "active");
    let listed = t
        .items(&t.alice, &format!("/payroll-loans?income_id={income_id}"))
        .await;
    assert_eq!(listed.len(), 1);
}

#[tokio::test]
async fn pl_loan_fields_and_income_are_validated() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;
    let expense = id_of(
        &t.create_transaction(&t.alice, &account, "expense", 5_000, "2026-11-10")
            .await,
    );
    let settled = id_of(
        &t.create_transaction(&t.alice, &account, "income", 5_000, "2026-11-10")
            .await,
    );
    let (status, body) = t.settle(&t.alice, &settled, 5_000, "2026-11-10").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let rent = id_of(
        &t.create_recurring(
            &t.alice,
            &account,
            "expense",
            150_000,
            monthly_rule("2026-11-10", 10),
        )
        .await,
    );
    let base = || {
        loan_body(
            ("income_recurrence_id", &salary),
            "Empréstimo",
            1_000,
            48,
            12,
        )
    };
    let with = |changes: Value| {
        let mut body = base();
        for (key, value) in changes.as_object().unwrap() {
            if value.is_null() {
                body.as_object_mut().unwrap().remove(key);
            } else {
                body[key] = value.clone();
            }
        }
        body
    };
    let cases = [
        (
            with(json!({ "current_installment": 49 })),
            "current_installment",
            "out_of_range",
        ),
        (
            with(
                json!({ "total_installments": null, "current_installment": null, "ends_on": "2026-11-04" }),
            ),
            "ends_on",
            "before_next_installment",
        ),
        (
            with(json!({ "ends_on": "2027-03-20" })),
            "ends_on",
            "fields_mismatch",
        ),
        (with(json!({ "name": "  " })), "name", "required"),
        (with(json!({ "name": "x".repeat(61) })), "name", "too_long"),
        (
            with(json!({ "installment_amount": 0 })),
            "installment_amount",
            "must_be_positive",
        ),
        (
            with(json!({ "income_id": settled })),
            "income_id",
            "fields_mismatch",
        ),
        (
            with(json!({ "income_recurrence_id": null })),
            "income_id",
            "fields_mismatch",
        ),
        (
            with(json!({ "income_recurrence_id": null, "income_id": expense })),
            "income_id",
            "not_income",
        ),
        (
            with(json!({ "income_recurrence_id": null, "income_id": settled })),
            "income_id",
            "already_settled",
        ),
        (
            with(json!({ "income_recurrence_id": rent })),
            "income_recurrence_id",
            "not_income",
        ),
        (with(json!({ "status": "ended" })), "body", "invalid"),
    ];

    for (body, field, code) in cases {
        let (status, response) = t.post(&t.alice, "/payroll-loans", body.clone()).await;
        assert_eq!(
            status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "{body}: {response}"
        );
        assert_eq!(
            first_error(&response),
            (field.to_owned(), code.to_owned()),
            "{body}: {response}"
        );
    }
    assert_eq!(loan_count(&t).await, 0);
    assert!(loan_categories(&t, &t.alice).await.is_empty());
}

#[tokio::test]
async fn pl_rf05_loan_category_is_created_once_and_adopts_existing() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;
    let mut category_ids = Vec::new();
    for (name, amount, total, current) in &six_loans()[..2] {
        let loan = create_loan(
            &t,
            loan_body(
                ("income_recurrence_id", &salary),
                name,
                *amount,
                *total,
                *current,
            ),
        )
        .await;
        category_ids.push(loan["category_id"].clone());
    }
    assert_eq!(category_ids[0], category_ids[1]);
    assert_eq!(loan_categories(&t, &t.alice).await.len(), 1);

    let existing = t
        .create_category(&t.bob, "Empréstimo", "expense", "#123456")
        .await;
    let bob_account = t.default_account(&t.bob).await;
    let bob_salary = id_of(
        &t.create_recurring(
            &t.bob,
            &bob_account,
            "income",
            500_000,
            monthly_rule("2026-11-05", 5),
        )
        .await,
    );
    let (status, loan) = t
        .post(
            &t.bob,
            "/payroll-loans",
            loan_body(
                ("income_recurrence_id", &bob_salary),
                "Empréstimo",
                10_000,
                10,
                1,
            ),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{loan}");
    assert_eq!(loan["category_id"], existing.as_str());
    let (status, category) = t.get(&t.bob, &format!("/categories/{existing}")).await;
    assert_eq!(status, StatusCode::OK, "{category}");
    assert_eq!(category["system_key"], "loan");
    assert_eq!(category["color"], "#123456");
}

#[tokio::test]
async fn pl_patch_current_installment_resets_start_and_delete_hides_loan() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;
    let loan = create_loan(
        &t,
        loan_body(
            ("income_recurrence_id", &salary),
            "Empréstimo 178176138",
            293_723,
            48,
            12,
        ),
    )
    .await;
    let uri = format!("/payroll-loans/{}", id_of(&loan));

    let (status, body) = t.skip_occurrence(&t.alice, &salary, "2026-11-05").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (_, skipped) = t.get(&t.alice, &uri).await;
    assert_eq!(skipped["current_installment"], 13);
    assert_eq!(skipped["next_installment_on"], "2026-12-05");

    let (status, reset) = t
        .patch(
            &t.alice,
            &uri,
            json!({ "total_installments": 48, "current_installment": 12 }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{reset}");
    assert_eq!(reset["starts_on"], "2026-12-05");
    assert_eq!(reset["current_installment"], 12);
    assert_eq!(reset["last_installment_on"], "2029-12-05");

    let (status, renamed) = t
        .patch(
            &t.alice,
            &uri,
            json!({ "name": "Consignado Banco", "contract_number": "", "installment_amount": 300_000 }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["name"], "Consignado Banco");
    assert!(renamed["contract_number"].is_null());
    assert_eq!(renamed["installment_amount"], 300_000);

    let (status, body) = t.delete(&t.alice, &uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    let (status, _) = t.get(&t.alice, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let listed = t
        .items(
            &t.alice,
            &format!("/payroll-loans?income_recurrence_id={salary}"),
        )
        .await;
    assert!(listed.is_empty());
}

#[tokio::test]
async fn pl_other_owner_gets_not_found() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;
    let income = id_of(
        &t.create_transaction(&t.alice, &account, "income", 1_066_988, "2026-11-20")
            .await,
    );
    let loan = create_loan(
        &t,
        loan_body(
            ("income_recurrence_id", &salary),
            "Empréstimo 178176138",
            293_723,
            48,
            12,
        ),
    )
    .await;
    let uri = format!("/payroll-loans/{}", id_of(&loan));

    let (status, _) = t.get(&t.bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = t.patch(&t.bob, &uri, json!({ "name": "X" })).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = t.delete(&t.bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let listed = t
        .items(
            &t.bob,
            &format!("/payroll-loans?income_recurrence_id={salary}"),
        )
        .await;
    assert!(listed.is_empty());
    for link in [
        ("income_recurrence_id", salary.as_str()),
        ("income_id", income.as_str()),
    ] {
        let (status, body) = t
            .post(
                &t.bob,
                "/payroll-loans",
                loan_body(link, "Empréstimo", 1_000, 48, 12),
            )
            .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    }

    let (_, unchanged) = t.get(&t.alice, &uri).await;
    assert_eq!(unchanged, loan);
}

#[tokio::test]
async fn pl_rf13_transactions_expose_installment_fields() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let income = id_of(
        &t.create_transaction(&t.alice, &account, "income", 1_066_988, "2026-11-20")
            .await,
    );
    salary(&t, &account).await;
    let fields = [
        "payroll_loan_id",
        "income_transaction_id",
        "installment_number",
    ];

    let (status, read) = t.get(&t.alice, &format!("/transactions/{income}")).await;
    assert_eq!(status, StatusCode::OK, "{read}");
    let items = t
        .items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await;
    let listed = items
        .iter()
        .find(|item| item["id"] == income.as_str())
        .expect("entrada avulsa na listagem");
    let virtual_item = items
        .iter()
        .find(|item| item["recurrence_id"].is_string())
        .expect("ocorrência virtual na listagem");
    for item in [&read, listed, virtual_item] {
        for field in fields {
            let value = item.get(field).unwrap_or_else(|| panic!("{field}: {item}"));
            assert!(value.is_null(), "{field}: {item}");
        }
    }
}

#[tokio::test]
async fn pl_settlement_amount_fields_are_validated() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let income = id_of(
        &t.create_transaction(&t.alice, &account, "income", 1_000, "2026-11-20")
            .await,
    );
    let salary = salary(&t, &account).await;
    let uri = format!("/transactions/{income}/settlement");
    let cases = [
        (
            json!({ "settled_at": "2026-11-20" }),
            "settled_amount",
            "required",
        ),
        (
            json!({ "settled_amount": 1_000, "account_amount": 1_000, "settled_at": "2026-11-20" }),
            "account_amount",
            "fields_mismatch",
        ),
        (
            json!({ "account_amount": 1_000, "settled_at": "2026-11-20" }),
            "account_amount",
            "fields_mismatch",
        ),
    ];
    for (body, field, code) in cases {
        let (status, response) = t.post(&t.alice, &uri, body.clone()).await;
        assert_eq!(
            status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "{body}: {response}"
        );
        assert_eq!(first_error(&response), (field.to_owned(), code.to_owned()));
    }
    let (status, response) = t
        .post(
            &t.alice,
            &format!("/recurring-transactions/{salary}/settlement"),
            json!({ "occurrence_date": "2026-11-05", "settled_at": "2026-11-05", "account_amount": 1_000 }),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{response}");
    assert_eq!(
        first_error(&response),
        ("account_amount".to_owned(), "fields_mismatch".to_owned())
    );
    assert_eq!(t.balance(&t.alice, &account).await, 0);
}

// Projeção, liquidação e desfazer conjuntos ------------------------------------

async fn salary_with_six_loans(t: &FinanceTest, account: &str) -> (String, Vec<String>) {
    let salary = salary(t, account).await;
    let mut ids = Vec::new();
    for (name, amount, total, current) in six_loans() {
        let loan = create_loan(
            t,
            loan_body(
                ("income_recurrence_id", &salary),
                name,
                amount,
                total,
                current,
            ),
        )
        .await;
        ids.push(id_of(&loan));
    }
    (salary, ids)
}

async fn settle_salary(t: &FinanceTest, salary: &str, account_amount: i64) -> (StatusCode, Value) {
    t.post(
        &t.alice,
        &format!("/recurring-transactions/{salary}/settlement"),
        json!({
            "occurrence_date": "2026-11-05",
            "settled_at": "2026-11-05",
            "account_amount": account_amount,
        }),
    )
    .await
}

fn installments(items: &[Value]) -> Vec<&Value> {
    items
        .iter()
        .filter(|item| !item["payroll_loan_id"].is_null())
        .collect()
}

async fn copies(t: &FinanceTest) -> i64 {
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let count = sqlx::query_scalar("SELECT count(*) FROM transactions WHERE deleted_at IS NULL")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    count
}

async fn november(t: &FinanceTest) -> Vec<Value> {
    t.items(&t.alice, "/transactions?from=2026-11-01&to=2026-11-30")
        .await
}

async fn loan(t: &FinanceTest, id: &str) -> Value {
    let (status, body) = t.get(&t.alice, &format!("/payroll-loans/{id}")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

fn amount_sum(items: &[&Value], field: &str) -> i64 {
    items
        .iter()
        .map(|item| item[field].as_i64().unwrap_or_default())
        .sum()
}

async fn one_off_with_loan(t: &FinanceTest, account: &str) -> (String, String) {
    let income = id_of(
        &t.create_transaction(&t.alice, account, "income", 1_066_988, "2026-11-20")
            .await,
    );
    let loan = create_loan(
        t,
        loan_body(
            ("income_id", &income),
            "Empréstimo 178176138",
            293_723,
            48,
            12,
        ),
    )
    .await;
    (income, id_of(&loan))
}

/// Liquida o salário com o valor do holerite (CT-04) e devolve a cópia.
async fn settled_salary(t: &FinanceTest, salary: &str) -> String {
    let (status, copy) = settle_salary(t, salary, 692_318).await;
    assert_eq!(status, StatusCode::CREATED, "{copy}");
    id_of(&copy)
}

#[tokio::test]
async fn pl_ct03_listing_and_summary_count_installments() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, loans) = salary_with_six_loans(&t, &account).await;

    let items = november(&t).await;

    assert_eq!(items.len(), 7, "{items:?}");
    let income: Vec<&Value> = items
        .iter()
        .filter(|item| item["kind"] == "income")
        .collect();
    assert_eq!(income.len(), 1);
    assert_eq!(income[0]["expected_amount"], 1_066_988);
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 6);
    let category = loan_category_id(&t).await;
    for parcel in &parcels {
        assert!(parcel["id"].is_null(), "{parcel}");
        assert_eq!(parcel["kind"], "expense");
        assert_eq!(parcel["category_id"], category.as_str());
        assert_eq!(parcel["account_id"], account.as_str());
        assert_eq!(parcel["recurrence_id"], salary.as_str());
        assert_eq!(parcel["installment_number"], 12);
        assert!(parcel["income_transaction_id"].is_null());
    }
    let mut parcel_loans: Vec<String> = parcels
        .iter()
        .map(|parcel| parcel["payroll_loan_id"].as_str().unwrap().to_owned())
        .collect();
    parcel_loans.sort();
    let mut expected_loans = loans.clone();
    expected_loans.sort();
    assert_eq!(parcel_loans, expected_loans);
    assert_eq!(amount_sum(&parcels, "expected_amount"), 374_670);

    let (status, summary) = t
        .get(
            &t.alice,
            "/financial-summaries?from=2026-11-01&to=2026-11-30",
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{summary}");
    assert_eq!(summary["totals"]["income"]["forecast"], 1_066_988);
    assert_eq!(summary["totals"]["expense"]["forecast"], 374_670);

    let only_income = t
        .items(
            &t.alice,
            "/transactions?from=2026-11-01&to=2026-11-30&kind=income",
        )
        .await;
    assert_eq!(only_income.len(), 1);
    assert_eq!(only_income[0]["kind"], "income");
    let one_off = t
        .items(
            &t.alice,
            "/transactions?from=2026-11-01&to=2026-11-30&repetition=one_off",
        )
        .await;
    assert!(installments(&one_off).is_empty(), "{one_off:?}");
    let by_category = t
        .items(
            &t.alice,
            &format!("/transactions?from=2026-11-01&to=2026-11-30&category_id={category}"),
        )
        .await;
    assert_eq!(by_category.len(), 6);
    assert_eq!(installments(&by_category).len(), 6);
    // O contrato, igual nos seis, não entra na busca: só o nome do consignado.
    let by_number = t
        .items(
            &t.alice,
            "/transactions?from=2026-11-01&to=2026-11-30&q=178176138",
        )
        .await;
    assert_eq!(by_number.len(), 1, "{by_number:?}");
    assert_eq!(by_number[0]["payroll_loan_id"], loans[0].as_str());
    let by_name = t
        .items(
            &t.alice,
            "/transactions?from=2026-11-01&to=2026-11-30&q=empr%C3%A9stimo%20178",
        )
        .await;
    assert_eq!(by_name.len(), 1, "{by_name:?}");
    assert_eq!(by_name[0]["payroll_loan_id"], loans[0].as_str());
    assert_eq!(by_name[0]["expected_amount"], 293_723);
}

async fn loan_category_id(t: &FinanceTest) -> String {
    let categories = loan_categories(t, &t.alice).await;
    assert_eq!(categories.len(), 1, "{categories:?}");
    id_of(&categories[0])
}

#[tokio::test]
async fn pl_ct04_joint_settlement_settles_income_and_installments() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, loans) = salary_with_six_loans(&t, &account).await;

    let (status, copy) = settle_salary(&t, &salary, 692_318).await;

    assert_eq!(status, StatusCode::CREATED, "{copy}");
    assert_eq!(copy["settled_amount"], 1_066_988);
    assert_eq!(copy["difference_amount"], 0);
    let copy_id = id_of(&copy);
    let items = november(&t).await;
    assert_eq!(items.len(), 7, "{items:?}");
    assert!(
        items
            .iter()
            .all(|item| item["id"].is_string() && item["status"] == "settled"),
        "{items:?}"
    );
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 6);
    for parcel in &parcels {
        assert_eq!(parcel["income_transaction_id"], copy_id.as_str());
        assert_eq!(parcel["settled_at"], "2026-11-05");
        assert_eq!(parcel["account_id"], account.as_str());
        assert_eq!(parcel["settled_amount"], parcel["expected_amount"]);
        assert!(parcel["generated_from"].is_null());
    }
    assert_eq!(amount_sum(&parcels, "settled_amount"), 374_670);
    let main = parcels
        .iter()
        .find(|parcel| parcel["payroll_loan_id"] == loans[0].as_str())
        .expect("parcela de 293_723");
    assert_eq!(main["settled_amount"], 293_723);
    assert_eq!(main["installment_number"], 12);
    assert_eq!(t.balance(&t.alice, &account).await, 692_318);
    let read = loan(&t, &loans[0]).await;
    assert_eq!(read["current_installment"], 13);
    assert_eq!(read["next_installment_on"], "2026-12-05");
    let december = t
        .items(&t.alice, "/transactions?from=2026-12-01&to=2026-12-31")
        .await;
    let next = installments(&december);
    assert_eq!(next.len(), 6);
    assert!(
        next.iter()
            .all(|parcel| parcel["id"].is_null() && parcel["installment_number"] == 13)
    );
}

#[tokio::test]
async fn pl_ct05_other_account_amount_keeps_installments_fixed() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, _) = salary_with_six_loans(&t, &account).await;

    let (status, copy) = settle_salary(&t, &salary, 700_000).await;

    assert_eq!(status, StatusCode::CREATED, "{copy}");
    assert_eq!(copy["settled_amount"], 1_074_670);
    assert_eq!(copy["difference_amount"], 7_682);
    assert_eq!(copy["difference_kind"], "gain");
    let items = november(&t).await;
    assert_eq!(amount_sum(&installments(&items), "settled_amount"), 374_670);
    assert_eq!(t.balance(&t.alice, &account).await, 700_000);
}

async fn assert_back_to_open(t: &FinanceTest, account: &str, main_loan: &str) {
    assert_eq!(copies(t).await, 0);
    let items = november(t).await;
    assert_eq!(items.len(), 7, "{items:?}");
    assert!(items.iter().all(|item| item["id"].is_null()), "{items:?}");
    assert_eq!(installments(&items).len(), 6);
    assert_eq!(t.balance(&t.alice, account).await, 0);
    assert_eq!(loan(t, main_loan).await["current_installment"], 12);
}

#[tokio::test]
async fn pl_ct06_undo_restores_income_installments_and_balance() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, loans) = salary_with_six_loans(&t, &account).await;
    let copy = settled_salary(&t, &salary).await;

    let (status, body) = t.undo_settlement(&t.alice, &copy).await;

    // Desfazer a cópia da recorrente a apaga, e a rota responde sem corpo (DEC-005).
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    assert_back_to_open(&t, &account, &loans[0]).await;

    let copy = settled_salary(&t, &salary).await;
    let (status, body) = t.delete(&t.alice, &format!("/transactions/{copy}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    assert_back_to_open(&t, &account, &loans[0]).await;
}

#[tokio::test]
async fn pl_ct07_last_installment_ends_loan() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let salary = salary(&t, &account).await;
    let last = id_of(
        &create_loan(
            &t,
            loan_body(
                ("income_recurrence_id", &salary),
                "Empréstimo 178176138",
                293_723,
                48,
                48,
            ),
        )
        .await,
    );

    let (status, copy) = settle_salary(&t, &salary, 773_265).await;

    assert_eq!(status, StatusCode::CREATED, "{copy}");
    assert_eq!(copy["settled_amount"], 1_066_988);
    let read = loan(&t, &last).await;
    assert_eq!(read["status"], "ended");
    assert_eq!(read["remaining_installments"], 0);
    assert!(read["next_installment_on"].is_null());
    let later = t
        .items(&t.alice, "/transactions?from=2026-12-01&to=2027-02-28")
        .await;
    assert!(
        later
            .iter()
            .all(|item| item["payroll_loan_id"] != last.as_str()),
        "{later:?}"
    );
}

#[tokio::test]
async fn pl_cb04_account_amount_below_installments_is_accepted() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, _) = salary_with_six_loans(&t, &account).await;
    let uri = format!("/recurring-transactions/{salary}/settlement");
    let refused = [
        (
            json!({ "occurrence_date": "2026-11-05", "settled_at": "2026-11-05", "settled_amount": 1_066_988 }),
            "fields_mismatch",
        ),
        (
            json!({ "occurrence_date": "2026-11-05", "settled_at": "2026-11-05" }),
            "required",
        ),
        (
            json!({ "occurrence_date": "2026-11-05", "settled_at": "2026-11-05", "account_amount": -1 }),
            "must_not_be_negative",
        ),
    ];
    for (body, code) in refused {
        let (status, response) = t.post(&t.alice, &uri, body.clone()).await;
        assert_eq!(
            status,
            StatusCode::UNPROCESSABLE_ENTITY,
            "{body}: {response}"
        );
        assert_eq!(
            first_error(&response),
            ("account_amount".to_owned(), code.to_owned())
        );
    }
    assert_eq!(copies(&t).await, 0);
    assert_eq!(t.balance(&t.alice, &account).await, 0);

    let (status, copy) = settle_salary(&t, &salary, 374_669).await;

    assert_eq!(status, StatusCode::CREATED, "{copy}");
    assert_eq!(copy["settled_amount"], 749_339);
    let copy_id = id_of(&copy);
    let items = november(&t).await;
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 6);
    assert!(parcels.iter().all(|parcel| parcel["status"] == "settled"
        && parcel["income_transaction_id"] == copy_id.as_str()));
    assert_eq!(amount_sum(&parcels, "settled_amount"), 374_670);
    assert_eq!(t.balance(&t.alice, &account).await, 374_669);
}

#[tokio::test]
async fn pl_cb05_installment_cannot_change_alone() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, _) = salary_with_six_loans(&t, &account).await;
    settled_salary(&t, &salary).await;
    let items = november(&t).await;
    let parcel = id_of(installments(&items)[0]);
    let uri = format!("/transactions/{parcel}");

    let attempts = [
        t.settle(&t.alice, &parcel, 1, "2026-11-05").await,
        t.undo_settlement(&t.alice, &parcel).await,
        t.delete(&t.alice, &uri).await,
        t.patch(&t.alice, &uri, json!({ "description": "x" })).await,
    ];

    for (status, problem) in attempts {
        assert_eq!(status, StatusCode::CONFLICT, "{problem}");
        assert_eq!(problem["code"], "installment_follows_income");
    }
    assert_eq!(t.balance(&t.alice, &account).await, 692_318);
}

#[tokio::test]
async fn pl_fa04_one_off_income_settles_jointly() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (income, loan_id) = one_off_with_loan(&t, &account).await;

    let items = november(&t).await;
    assert_eq!(items.len(), 2, "{items:?}");
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 1);
    assert!(parcels[0]["id"].is_null());
    assert_eq!(parcels[0]["income_transaction_id"], income.as_str());
    assert!(parcels[0]["recurrence_id"].is_null());
    assert_eq!(parcels[0]["installment_number"], 12);
    assert_eq!(parcels[0]["expected_date"], "2026-11-20");

    let (status, settled) = t
        .post(
            &t.alice,
            &format!("/transactions/{income}/settlement"),
            json!({ "account_amount": 773_265, "settled_at": "2026-11-20" }),
        )
        .await;

    assert_eq!(status, StatusCode::OK, "{settled}");
    assert_eq!(settled["settled_amount"], 1_066_988);
    assert_eq!(t.balance(&t.alice, &account).await, 773_265);
    assert_eq!(loan(&t, &loan_id).await["status"], "ended");
    let items = november(&t).await;
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 1);
    assert!(parcels[0]["id"].is_string());
    assert_eq!(parcels[0]["settled_amount"], 293_723);

    let (status, body) = t.undo_settlement(&t.alice, &income).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    let (_, reopened) = t.get(&t.alice, &format!("/transactions/{income}")).await;
    assert!(reopened["settled_amount"].is_null(), "{reopened}");
    let items = november(&t).await;
    let parcels = installments(&items);
    assert_eq!(parcels.len(), 1);
    assert!(parcels[0]["id"].is_null());
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    assert_eq!(loan(&t, &loan_id).await["status"], "active");
    assert_eq!(copies(&t).await, 1);
}

#[tokio::test]
async fn pl_cb07_open_installments_follow_income_account() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let other = t.create_account(&t.alice, "Outra").await;
    let (income, _) = one_off_with_loan(&t, &account).await;
    let (salary, _) = salary_with_six_loans(&t, &account).await;

    let (status, body) = t
        .patch(
            &t.alice,
            &format!("/transactions/{income}"),
            json!({ "account_id": other }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let items = november(&t).await;
    let one_off: Vec<&Value> = installments(&items)
        .into_iter()
        .filter(|parcel| parcel["income_transaction_id"] == income.as_str())
        .collect();
    assert_eq!(one_off.len(), 1);
    assert_eq!(one_off[0]["account_id"], other.as_str());

    let (status, body) = t
        .patch(
            &t.alice,
            &format!("/recurring-transactions/{salary}"),
            json!({ "account_id": other }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let items = november(&t).await;
    let recurring: Vec<&Value> = installments(&items)
        .into_iter()
        .filter(|parcel| parcel["recurrence_id"] == salary.as_str())
        .collect();
    assert_eq!(recurring.len(), 6);
    assert!(
        recurring
            .iter()
            .all(|parcel| parcel["account_id"] == other.as_str())
    );
}

#[tokio::test]
async fn pl_rn09_deleting_income_deletes_loans() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, loans) = salary_with_six_loans(&t, &account).await;
    let (income, one_off_loan) = one_off_with_loan(&t, &account).await;

    let (status, body) = t
        .delete(&t.alice, &format!("/recurring-transactions/{salary}"))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    for id in &loans {
        let (status, _) = t.get(&t.alice, &format!("/payroll-loans/{id}")).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
    let (status, body) = t.delete(&t.alice, &format!("/transactions/{income}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    let (status, _) = t
        .get(&t.alice, &format!("/payroll-loans/{one_off_loan}"))
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(installments(&november(&t).await).is_empty());
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let active: i64 =
        sqlx::query_scalar("SELECT count(*) FROM payroll_loans WHERE deleted_at IS NULL")
            .fetch_one(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(active, 0);
}

async fn refuse_installments(t: &FinanceTest, name: &str, condition: &str) {
    let function = format!(
        "CREATE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN \
         IF NEW.payroll_loan_id IS NOT NULL AND {condition} THEN \
         RAISE EXCEPTION 'falha simulada'; END IF; RETURN NEW; END $$;"
    );
    sqlx::raw_sql(&function).execute(t.pool()).await.unwrap();
    let trigger = format!(
        "CREATE TRIGGER {name} BEFORE INSERT OR UPDATE ON transactions \
         FOR EACH ROW EXECUTE FUNCTION {name}();"
    );
    sqlx::raw_sql(&trigger).execute(t.pool()).await.unwrap();
}

async fn drop_refusal(t: &FinanceTest, name: &str) {
    let sql = format!("DROP TRIGGER {name} ON transactions; DROP FUNCTION {name}();");
    sqlx::raw_sql(&sql).execute(t.pool()).await.unwrap();
}

#[tokio::test]
async fn pl_ct12_failed_installment_rolls_back_everything() {
    let t = FinanceTest::new().await;
    let account = t.default_account(&t.alice).await;
    let (salary, loans) = salary_with_six_loans(&t, &account).await;
    refuse_installments(
        &t,
        "pl_test_refuse_installment",
        "NEW.installment_number = 12 AND NEW.expected_amount = 16941",
    )
    .await;

    let (status, body) = settle_salary(&t, &salary, 692_318).await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert_eq!(copies(&t).await, 0);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    let (_, rule) = t
        .get(&t.alice, &format!("/recurring-transactions/{salary}"))
        .await;
    assert_eq!(rule["open_occurrence"]["occurrence_date"], "2026-11-05");
    for id in &loans {
        assert_eq!(loan(&t, id).await["current_installment"], 12);
    }

    let (income, _) = one_off_with_loan(&t, &account).await;
    refuse_installments(&t, "pl_test_refuse_one_off", "NEW.expected_amount = 293723").await;
    let (status, body) = t
        .post(
            &t.alice,
            &format!("/transactions/{income}/settlement"),
            json!({ "account_amount": 773_265, "settled_at": "2026-11-20" }),
        )
        .await;

    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    let (_, open) = t.get(&t.alice, &format!("/transactions/{income}")).await;
    assert!(open["settled_amount"].is_null(), "{open}");
    assert_eq!(copies(&t).await, 1);
    assert_eq!(t.balance(&t.alice, &account).await, 0);
    drop_refusal(&t, "pl_test_refuse_installment").await;
    drop_refusal(&t, "pl_test_refuse_one_off").await;
}

type AccountRow = (Uuid, i64);
type TransactionRow = (
    Uuid,
    String,
    i64,
    String,
    Option<i64>,
    Option<String>,
    Option<i64>,
    i64,
);
type RecurringRow = (Uuid, i64);
/// Id, tipo, previsto, data, liquidado, data da liquidação, diferença e tipo da diferença.
type SeedTransaction = (
    u128,
    &'static str,
    i64,
    &'static str,
    Option<i64>,
    Option<&'static str>,
    Option<i64>,
    Option<&'static str>,
);

#[derive(Debug, PartialEq)]
struct Snapshot {
    accounts: Vec<AccountRow>,
    transactions: Vec<TransactionRow>,
    recurring: Vec<RecurringRow>,
    categories: i64,
}

fn id(value: u128) -> Uuid {
    Uuid::from_u128(value)
}

async fn seed_before_payroll_loans(ctx: &TestContext) {
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
        "INSERT INTO accounts (id, owner_id, name, is_default, balance_amount, currency, \
         created_at, updated_at) \
         VALUES ($1, $2, 'Conta principal', true, 90000, 'BRL', now(), now())",
    )
    .bind(id(1))
    .bind(ALICE)
    .execute(&mut *tx)
    .await
    .unwrap();
    let rows: [SeedTransaction; 3] = [
        (
            11,
            "income",
            100_000,
            "2026-11-01",
            Some(100_000),
            Some("2026-11-01"),
            Some(0),
            None,
        ),
        (
            12,
            "expense",
            12_000,
            "2026-11-02",
            Some(10_000),
            Some("2026-11-02"),
            Some(-2_000),
            Some("saving"),
        ),
        (13, "expense", 5_000, "2026-11-20", None, None, None, None),
    ];
    for (row_id, kind, expected, date, settled, settled_at, difference, difference_kind) in rows {
        sqlx::query(
            "INSERT INTO transactions (id, owner_id, kind, account_id, expected_amount, \
             gross_amount, expected_date, settled_amount, settled_gross_amount, \
             settled_adjustments, settled_at, difference_amount, difference_kind, currency, \
             created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $5, $6::date, $7, $7, \
             CASE WHEN $7::bigint IS NULL THEN NULL ELSE '[]'::jsonb END, $8::date, $9, $10, \
             'BRL', now(), now())",
        )
        .bind(id(row_id))
        .bind(ALICE)
        .bind(kind)
        .bind(id(1))
        .bind(expected)
        .bind(date)
        .bind(settled)
        .bind(settled_at)
        .bind(difference)
        .bind(difference_kind)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO recurring_transactions (id, owner_id, kind, account_id, expected_amount, \
         gross_amount, currency, rule, created_at, updated_at) \
         VALUES ($1, $2, 'income', $3, 50000, 50000, 'BRL', $4, now(), now())",
    )
    .bind(id(21))
    .bind(ALICE)
    .bind(id(1))
    .bind(Json(monthly_rule("2026-11-25", 25)))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

async fn snapshot(ctx: &TestContext) -> Snapshot {
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let accounts = sqlx::query_as("SELECT id, balance_amount FROM accounts ORDER BY id")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    let transactions = sqlx::query_as(
        "SELECT id, kind, expected_amount, expected_date::text, settled_amount, \
         settled_at::text, difference_amount, gross_amount FROM transactions ORDER BY id",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    let recurring =
        sqlx::query_as("SELECT id, expected_amount FROM recurring_transactions ORDER BY id")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
    let categories = sqlx::query_scalar("SELECT count(*) FROM categories")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    Snapshot {
        accounts,
        transactions,
        recurring,
        categories,
    }
}

#[tokio::test]
async fn pl_rnf02_migration_keeps_balances_and_summary() {
    let ctx = TestContext::new().await;
    seed_before_payroll_loans(&ctx).await;
    let before = snapshot(&ctx).await;

    finance::migrator().run(&ctx.state.pool).await.unwrap();
    let after = snapshot(&ctx).await;
    assert_eq!(after, before);
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let linked: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM transactions \
         WHERE num_nonnulls(payroll_loan_id, income_transaction_id, installment_number) > 0",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let loans: i64 = sqlx::query_scalar("SELECT count(*) FROM payroll_loans")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!((linked, loans), (0, 0));

    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    let get = |uri: String| {
        let request = alice
            .request(Method::GET, &format!("/api/v1{uri}"))
            .body(Body::empty())
            .unwrap();
        let app = app.clone();
        async move {
            let (status, _, body) = send(&app, request).await;
            (status, body)
        }
    };
    let (status, summary) = get("/financial-summaries?from=2026-11-01&to=2026-11-30".into()).await;
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
    let (status, income) = get(format!("/transactions/{}", id(11))).await;
    assert_eq!(status, StatusCode::OK, "{income}");
    assert!(income["payroll_loan_id"].is_null());
    assert!(income.get("payroll_loan_id").is_some(), "{income}");
}
