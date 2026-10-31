//! Cadastro de lembretes e próximos disparos (RF-40, RF-41, RF-21).

use axum::http::{Method, StatusCode};
use serde_json::json;

use super::{ALICE, TestApp, daily_rule};

#[tokio::test]
async fn creates_one_off_and_recurring_reminders() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;

    let one_off = app
        .create(
            &alice,
            json!({
                "title": "Consulta",
                "notes": "Levar exames",
                "timezone": "America/Sao_Paulo",
                "remind_at": "2026-11-05T09:00:00-03:00",
            }),
        )
        .await;
    let recurring = app
        .create(
            &alice,
            json!({
                "title": "Remédio",
                "rule": daily_rule("08:00", "America/Sao_Paulo", "2026-11-02"),
            }),
        )
        .await;

    assert_eq!(one_off["kind"], "one_off");
    assert_eq!(one_off["remind_at"], "2026-11-05T12:00:00Z");
    assert_eq!(one_off["timezone"], "America/Sao_Paulo");
    assert_eq!(one_off["next_fire_at"], "2026-11-05T12:00:00Z");
    assert_eq!(one_off["notes"], "Levar exames");
    assert_eq!(one_off["owner_id"], ALICE.to_string());
    assert_eq!(one_off["visibility"], "personal");
    assert!(one_off.get("completed_at").is_none());
    assert_eq!(recurring["kind"], "recurring");
    assert_eq!(recurring["timezone"], "America/Sao_Paulo");
    assert_eq!(recurring["rule"]["time"], "08:00");
    assert_eq!(recurring["remind_at"], serde_json::Value::Null);
    assert_eq!(recurring["next_fire_at"], "2026-11-02T11:00:00Z");

    let id = recurring["id"].as_str().unwrap();
    let uri = format!("/api/v1/reminders/{id}");
    let (status, fetched) = app.get(&alice, &uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(fetched["title"], "Remédio");
    let (status, edited) = app
        .json(&alice, Method::PATCH, &uri, &json!({ "title": "Vitamina" }))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(edited["title"], "Vitamina");
    assert_eq!(app.delete(&alice, &uri).await, StatusCode::NO_CONTENT);
    let (status, problem) = app.get(&alice, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "not_found");
}

#[tokio::test]
async fn invalid_reminder_returns_problem_json() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;

    let (status, problem) = app
        .json(
            &alice,
            Method::POST,
            "/api/v1/reminders",
            &json!({
                "title": "",
                "timezone": "America/Sao_Paulo",
                "remind_at": "2026-11-05T12:00:00Z",
                "rule": daily_rule("08:00", "America/Sao_Paulo", "2026-11-02"),
            }),
        )
        .await;
    let (malformed, malformed_problem) = app
        .json(
            &alice,
            Method::POST,
            "/api/v1/reminders",
            &json!({ "title": "x", "completed": true }),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
    let fields: Vec<&str> = problem["errors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|error| error["field"].as_str().unwrap())
        .collect();
    assert_eq!(fields, ["title", "schedule"]);
    assert_eq!(malformed, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(malformed_problem["code"], "validation_failed");
}

#[tokio::test]
async fn upcoming_fires_list_next_occurrences_for_open_tab() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    // Agora são 12:00 UTC de 01/11/2026; o das 08:00 de hoje (11:00 UTC) já passou.
    let daily = app
        .create(
            &alice,
            json!({
                "title": "Remédio",
                "rule": daily_rule("08:00", "America/Sao_Paulo", "2026-11-01"),
            }),
        )
        .await;
    let one_off = app
        .create(
            &alice,
            json!({
                "title": "Consulta",
                "timezone": "America/Sao_Paulo",
                "remind_at": "2026-11-02T15:00:00Z",
            }),
        )
        .await;

    let (status, upcoming) = app
        .get(
            &alice,
            "/api/v1/reminders/upcoming?from=2026-11-01T12:00:00Z&to=2026-11-03T12:00:00Z",
        )
        .await;
    let (too_long, problem) = app
        .get(
            &alice,
            "/api/v1/reminders/upcoming?from=2026-11-01T00:00:00Z&to=2026-12-15T00:00:00Z",
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        upcoming["items"],
        json!([
            { "reminder_id": daily["id"], "title": "Remédio", "fire_at": "2026-11-02T11:00:00Z" },
            { "reminder_id": one_off["id"], "title": "Consulta", "fire_at": "2026-11-02T15:00:00Z" },
            { "reminder_id": daily["id"], "title": "Remédio", "fire_at": "2026-11-03T11:00:00Z" },
        ])
    );
    assert_eq!(too_long, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}

#[tokio::test]
async fn rule_change_recomputes_next_fire_only() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    // 09:00 em São Paulo é 12:00 UTC, o instante atual do relógio de teste.
    let reminder = app
        .create(
            &alice,
            json!({
                "title": "Alongar",
                "rule": daily_rule("09:00", "America/Sao_Paulo", "2026-11-01"),
            }),
        )
        .await;
    assert_eq!(reminder["next_fire_at"], "2026-11-01T12:00:00Z");
    app.dispatch().await;
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());

    let (status, edited) = app
        .json(
            &alice,
            Method::PATCH,
            &uri,
            &json!({ "rule": daily_rule("20:00", "America/Sao_Paulo", "2026-11-01") }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(edited["rule"]["time"], "20:00");
    assert_eq!(edited["next_fire_at"], "2026-11-01T23:00:00Z");
    assert_eq!(
        app.count_as(
            ALICE,
            "SELECT count(*) FROM reminder_deliveries WHERE fire_at = '2026-11-01T12:00:00Z'"
        )
        .await,
        1,
        "a entrega já feita fica como está"
    );
}

#[tokio::test]
async fn reminder_list_filters_paginates_and_searches() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    for title in ["Pagar conta de luz", "Meta 100%", "Beber água"] {
        app.create(
            &alice,
            json!({
                "title": title,
                "timezone": "UTC",
                "remind_at": "2026-11-10T10:00:00Z",
            }),
        )
        .await;
    }
    app.create(
        &alice,
        json!({
            "title": "Caminhar",
            "visibility": "shared",
            "rule": daily_rule("07:00", "UTC", "2026-11-02"),
        }),
    )
    .await;

    let titles = |page: &serde_json::Value| -> Vec<String> {
        page["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["title"].as_str().unwrap().to_owned())
            .collect()
    };
    let (_, recurring) = app.get(&alice, "/api/v1/reminders?kind=recurring").await;
    let (_, one_off) = app.get(&alice, "/api/v1/reminders?kind=one_off").await;
    let (_, shared) = app.get(&alice, "/api/v1/reminders?visibility=shared").await;
    let (_, search) = app.get(&alice, "/api/v1/reminders?q=CONTA").await;
    let (_, literal) = app.get(&alice, "/api/v1/reminders?q=%25").await;
    let (_, first) = app.get(&alice, "/api/v1/reminders?limit=3").await;
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let (_, second) = app
        .get(
            &alice,
            &format!("/api/v1/reminders?limit=3&cursor={cursor}"),
        )
        .await;
    let (bad_cursor, problem) = app.get(&alice, "/api/v1/reminders?cursor=x!").await;

    assert_eq!(titles(&recurring), ["Caminhar"]);
    assert_eq!(titles(&one_off).len(), 3);
    assert_eq!(titles(&shared), ["Caminhar"]);
    assert_eq!(titles(&search), ["Pagar conta de luz"]);
    assert_eq!(titles(&literal), ["Meta 100%"]);
    assert_eq!(
        titles(&first),
        ["Caminhar", "Beber água", "Meta 100%"],
        "mais novos primeiro"
    );
    assert_eq!(titles(&second), ["Pagar conta de luz"]);
    assert_eq!(second["next_cursor"], serde_json::Value::Null);
    assert_eq!(bad_cursor, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}

#[tokio::test]
async fn visibility_is_saved() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let reminder = app
        .create(
            &alice,
            json!({
                "title": "Reunião",
                "visibility": "shared",
                "timezone": "UTC",
                "remind_at": "2026-11-10T10:00:00Z",
            }),
        )
        .await;
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());

    let (_, fetched) = app.get(&alice, &uri).await;
    let (_, edited) = app
        .json(
            &alice,
            Method::PATCH,
            &uri,
            &json!({ "visibility": "personal" }),
        )
        .await;
    let (invalid, _) = app
        .json(
            &alice,
            Method::PATCH,
            &uri,
            &json!({ "visibility": "public" }),
        )
        .await;

    assert_eq!(reminder["visibility"], "shared");
    assert_eq!(fetched["visibility"], "shared");
    assert_eq!(edited["visibility"], "personal");
    assert_eq!(invalid, StatusCode::UNPROCESSABLE_ENTITY);
}
