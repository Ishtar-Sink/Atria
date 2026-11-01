//! Tarefas pontuais e recorrentes pela API (CT-24, RF-38, RF-39).

use axum::http::{Method, StatusCode};
use chrono::Duration;
use serde_json::{Value, json};

use super::{ALICE, TestApp, daily_rule, id_of};
use crate::shared::db::begin_for_user;

fn completions_of(items: &[Value], task_id: &str) -> Vec<(String, bool)> {
    items
        .iter()
        .filter(|item| item["task_id"] == task_id)
        .map(|item| {
            (
                item["occurrence_date"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
                item["completed"].as_bool().unwrap_or_default(),
            )
        })
        .collect()
}

fn pairs(expected: &[(&str, bool)]) -> Vec<(String, bool)> {
    expected
        .iter()
        .map(|(date, completed)| ((*date).to_owned(), *completed))
        .collect()
}

#[tokio::test]
async fn one_off_task_completes_and_reopens_via_api() {
    let t = TestApp::new().await;
    let task = t
        .create(
            &t.alice,
            json!({ "title": "Pagar a conta de luz", "due_on": "2026-11-05" }),
        )
        .await;
    let id = id_of(&task);
    assert_eq!(task["is_recurring"], false);
    assert_eq!(task["completed_at"], Value::Null);
    assert_eq!(task["due_on"], "2026-11-05");

    let completion = format!("/api/v1/tasks/{id}/completion");
    let (status, done) = t
        .call(&t.alice, Method::POST, &completion, Some(json!({})))
        .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["completed"], true);
    let (_, fetched) = t
        .call(&t.alice, Method::GET, &format!("/api/v1/tasks/{id}"), None)
        .await;
    assert_eq!(fetched["completed_at"], "2026-11-01T12:00:00Z");

    let (status, reopened) = t.call(&t.alice, Method::DELETE, &completion, None).await;
    assert_eq!(status, StatusCode::OK, "{reopened}");
    assert_eq!(reopened["completed"], false);
    let (_, fetched) = t
        .call(&t.alice, Method::GET, &format!("/api/v1/tasks/{id}"), None)
        .await;
    assert_eq!(fetched["completed_at"], Value::Null);

    let (status, problem) = t
        .call(
            &t.alice,
            Method::POST,
            &completion,
            Some(json!({ "occurrence_date": "2026-11-05" })),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}

#[tokio::test]
async fn daily_task_completes_only_today_occurrence() {
    let t = TestApp::new().await;
    let task = t
        .create(
            &t.alice,
            json!({ "title": "Alongamento", "recurrence": daily_rule("2026-11-01") }),
        )
        .await;
    let id = id_of(&task);
    assert_eq!(task["is_recurring"], true);
    assert_eq!(task["recurrence"]["frequency"], "daily");

    let (status, done) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/tasks/{id}/completion"),
            Some(json!({ "occurrence_date": "2026-11-01" })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["occurrence_date"], "2026-11-01");

    let items = t.occurrences(&t.alice, "2026-11-01", "2026-11-03").await;
    assert_eq!(
        completions_of(&items, &id),
        pairs(&[
            ("2026-11-01", true),
            ("2026-11-02", false),
            ("2026-11-03", false)
        ])
    );
    let (status, problem) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/tasks/{id}/completion"),
            Some(json!({})),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "occurrence_date_required");
}

#[tokio::test]
async fn reopening_occurrence_keeps_others() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Regar as plantas", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    let completion = format!("/api/v1/tasks/{id}/completion");
    for date in ["2026-11-01", "2026-11-02", "2026-11-03"] {
        let (status, _) = t
            .call(
                &t.alice,
                Method::POST,
                &completion,
                Some(json!({ "occurrence_date": date })),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
    }

    let (status, reopened) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("{completion}?occurrence_date=2026-11-02"),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::OK, "{reopened}");
    assert_eq!(reopened["completed"], false);
    let items = t.occurrences(&t.alice, "2026-11-01", "2026-11-03").await;
    assert_eq!(
        completions_of(&items, &id),
        pairs(&[
            ("2026-11-01", true),
            ("2026-11-02", false),
            ("2026-11-03", true)
        ])
    );
    let (status, problem) = t.call(&t.alice, Method::DELETE, &completion, None).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "occurrence_date_required");
}

#[tokio::test]
async fn rule_change_affects_only_future_occurrences() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Treino", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    let completion = format!("/api/v1/tasks/{id}/completion");
    t.call(
        &t.alice,
        Method::POST,
        &completion,
        Some(json!({ "occurrence_date": "2026-11-04" })),
    )
    .await;
    let mut weekly = daily_rule("2026-11-01");
    weekly["frequency"] = json!("weekly");
    weekly["weekdays"] = json!(["mon"]);

    let (status, updated) = t
        .call(
            &t.alice,
            Method::PATCH,
            &format!("/api/v1/tasks/{id}"),
            Some(json!({ "recurrence": weekly, "effective_from": "2026-11-03" })),
        )
        .await;

    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["recurrence"]["frequency"], "weekly");
    let items = t.occurrences(&t.alice, "2026-11-01", "2026-11-10").await;
    assert_eq!(
        completions_of(&items, &id),
        pairs(&[
            ("2026-11-01", false),
            ("2026-11-02", false),
            ("2026-11-04", true),
            ("2026-11-09", false)
        ])
    );
    let (status, problem) = t
        .call(
            &t.alice,
            Method::PATCH,
            &format!("/api/v1/tasks/{id}"),
            Some(json!({ "recurrence": daily_rule("2026-11-01"), "effective_from": "2026-10-31" })),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["field"], "effective_from");
}

#[tokio::test]
async fn monthly_task_on_31_lists_last_day_of_february() {
    let t = TestApp::new().await;
    let mut monthly = daily_rule("2026-12-31");
    monthly["frequency"] = json!("monthly");
    monthly["month_day"] = json!(31);
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Fechar o mês", "recurrence": monthly }),
        )
        .await,
    );

    let items = t.occurrences(&t.alice, "2027-02-01", "2027-03-31").await;

    assert_eq!(
        completions_of(&items, &id),
        pairs(&[("2027-02-28", false), ("2027-03-31", false)])
    );
}

#[tokio::test]
async fn task_list_filters_paginates_and_searches() {
    let t = TestApp::new().await;
    let first = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Comprar pão", "due_on": "2026-11-02" }),
        )
        .await,
    );
    let second = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Comprar café", "due_on": "2026-11-10" }),
        )
        .await,
    );
    let recurring = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Meditar", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    t.call(
        &t.alice,
        Method::POST,
        &format!("/api/v1/tasks/{first}/completion"),
        Some(json!({})),
    )
    .await;
    let ids = |json: &Value| -> Vec<String> {
        json["items"]
            .as_array()
            .map(|items| items.iter().map(id_of).collect())
            .unwrap_or_default()
    };

    let (_, page) = t
        .call(&t.alice, Method::GET, "/api/v1/tasks?limit=2", None)
        .await;
    assert_eq!(ids(&page), [recurring.as_str(), second.as_str()]);
    let cursor = page["next_cursor"].as_str().unwrap().to_owned();
    let (_, next) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/tasks?limit=2&cursor={cursor}"),
            None,
        )
        .await;
    assert_eq!(ids(&next), [first.as_str()]);
    assert_eq!(next["next_cursor"], Value::Null);

    let query = |uri: &'static str| t.call(&t.alice, Method::GET, uri, None);
    assert_eq!(
        ids(&query("/api/v1/tasks?status=completed").await.1),
        [first.as_str()]
    );
    assert_eq!(
        ids(&query("/api/v1/tasks?status=open&recurring=false").await.1),
        [second.as_str()]
    );
    assert_eq!(
        ids(&query("/api/v1/tasks?recurring=true").await.1),
        [recurring.as_str()]
    );
    assert_eq!(
        ids(
            &query("/api/v1/tasks?due_from=2026-11-05&due_to=2026-11-30")
                .await
                .1
        ),
        [second.as_str()]
    );
    assert_eq!(
        ids(&query("/api/v1/tasks?q=COMPRAR").await.1),
        [second.as_str(), first.as_str()]
    );
    let (status, problem) = query("/api/v1/tasks?cursor=nao-e-cursor").await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}

#[tokio::test]
async fn visibility_is_saved() {
    let t = TestApp::new().await;
    let task = t
        .create(
            &t.alice,
            json!({ "title": "Planejar a viagem", "visibility": "shared" }),
        )
        .await;
    let id = id_of(&task);
    assert_eq!(task["visibility"], "shared");
    assert_eq!(task["owner_id"], ALICE.to_string());

    let (status, updated) = t
        .call(
            &t.alice,
            Method::PATCH,
            &format!("/api/v1/tasks/{id}"),
            Some(json!({ "visibility": "personal", "title": "Planejar as férias" })),
        )
        .await;

    assert_eq!(status, StatusCode::OK, "{updated}");
    let (_, fetched) = t
        .call(&t.alice, Method::GET, &format!("/api/v1/tasks/{id}"), None)
        .await;
    assert_eq!(fetched["visibility"], "personal");
    assert_eq!(fetched["title"], "Planejar as férias");
    let default = t.create(&t.alice, json!({ "title": "Sem marcação" })).await;
    assert_eq!(default["visibility"], "personal");
}

#[tokio::test]
async fn duplicate_completion_is_idempotent() {
    let t = TestApp::new().await;
    let recurring = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Beber água", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    let one_off = id_of(&t.create(&t.alice, json!({ "title": "Ligar" })).await);

    for _ in 0..2 {
        let (status, done) = t
            .call(
                &t.alice,
                Method::POST,
                &format!("/api/v1/tasks/{recurring}/completion"),
                Some(json!({ "occurrence_date": "2026-11-01" })),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{done}");
        let (status, done) = t
            .call(
                &t.alice,
                Method::POST,
                &format!("/api/v1/tasks/{one_off}/completion"),
                Some(json!({})),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{done}");
    }

    let mut tx = begin_for_user(&t.ctx.state.pool, ALICE).await.unwrap();
    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM task_completions")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(rows, 1);
}

#[tokio::test]
async fn occurrences_start_today_without_history() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Ler 10 páginas", "recurrence": daily_rule("2026-10-01") }),
        )
        .await,
    );
    t.call(
        &t.alice,
        Method::POST,
        &format!("/api/v1/tasks/{id}/completion"),
        Some(json!({ "occurrence_date": "2026-11-01" })),
    )
    .await;

    t.ctx.clock.advance(Duration::days(1));
    let items = t.occurrences(&t.alice, "2026-10-26", "2026-11-04").await;

    assert_eq!(
        completions_of(&items, &id),
        pairs(&[
            ("2026-11-02", false),
            ("2026-11-03", false),
            ("2026-11-04", false)
        ])
    );
    let mut tx = begin_for_user(&t.ctx.state.pool, ALICE).await.unwrap();
    let kept: i64 = sqlx::query_scalar("SELECT count(*) FROM task_completions")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(kept, 0, "a conclusão de ontem é descartada");
}

#[tokio::test]
async fn completing_yesterday_occurrence_is_refused() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Caminhar", "recurrence": daily_rule("2026-10-01") }),
        )
        .await,
    );

    let (status, problem) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/tasks/{id}/completion"),
            Some(json!({ "occurrence_date": "2026-10-31" })),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "occurrence_in_past");
    let (status, problem) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/tasks/{id}/completion"),
            Some(json!({ "occurrence_date": "2026-11-01T10:00:00Z" })),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}

#[tokio::test]
async fn overdue_one_off_task_is_kept() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Renovar o documento", "due_on": "2026-10-31" }),
        )
        .await,
    );

    t.ctx.clock.advance(Duration::days(3));
    let (status, page) = t.call(&t.alice, Method::GET, "/api/v1/tasks", None).await;

    assert_eq!(status, StatusCode::OK);
    let items = page["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(id_of(&items[0]), id);
    assert_eq!(items[0]["completed_at"], Value::Null);
    let occurrences = t.occurrences(&t.alice, "2026-10-01", "2026-11-30").await;
    assert_eq!(
        completions_of(&occurrences, &id),
        pairs(&[("2026-10-31", false)])
    );
}

#[tokio::test]
async fn occurrence_range_is_limited() {
    let t = TestApp::new().await;

    let (status, problem) = t
        .call(
            &t.alice,
            Method::GET,
            "/api/v1/tasks/occurrences?from=2026-11-01&to=2027-12-01",
            None,
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
    let (status, _) = t
        .call(
            &t.alice,
            Method::GET,
            "/api/v1/tasks/occurrences?from=2026-11-10&to=2026-11-01",
            None,
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status, problem) = t
        .call(
            &t.alice,
            Method::POST,
            "/api/v1/tasks",
            Some(json!({ "title": "   " })),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["field"], "title");
}

fn ids_of(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .map(|items| items.iter().map(id_of).collect())
        .unwrap_or_default()
}

#[tokio::test]
async fn task_labels_are_saved_and_replaced() {
    let t = TestApp::new().await;
    let tagged = t
        .create(
            &t.alice,
            json!({ "title": "Consertar a pia", "labels": [" casa ", "obra"] }),
        )
        .await;
    assert_eq!(tagged["labels"], json!(["casa", "obra"]));
    let untagged = t.create(&t.alice, json!({ "title": "Sem etiqueta" })).await;
    assert_eq!(untagged["labels"], json!([]));

    let id = id_of(&tagged);
    let uri = format!("/api/v1/tasks/{id}");
    let (status, replaced) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "labels": ["leitura"] })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{replaced}");
    assert_eq!(replaced["labels"], json!(["leitura"]));
    let (status, kept) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "title": "Consertar a pia da cozinha" })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{kept}");
    assert_eq!(kept["labels"], json!(["leitura"]));
    let (_, fetched) = t.call(&t.alice, Method::GET, &uri, None).await;
    assert_eq!(fetched["labels"], json!(["leitura"]));

    let recurring = t
        .create(
            &t.alice,
            json!({
                "title": "Caminhar",
                "recurrence": daily_rule("2026-11-01"),
                "labels": ["saude"]
            }),
        )
        .await;
    assert_eq!(recurring["labels"], json!(["saude"]));
    let recurring_id = id_of(&recurring);
    let (status, changed) = t
        .call(
            &t.alice,
            Method::PATCH,
            &format!("/api/v1/tasks/{recurring_id}"),
            Some(json!({ "recurrence": daily_rule("2026-11-03"), "effective_from": "2026-11-03" })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{changed}");
    assert_eq!(changed["labels"], json!(["saude"]));

    let (_, page) = t.call(&t.alice, Method::GET, "/api/v1/tasks", None).await;
    let labels_by_id: Vec<(String, Value)> = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| (id_of(item), item["labels"].clone()))
        .collect();
    assert_eq!(
        labels_by_id,
        [
            (recurring_id, json!(["saude"])),
            (id_of(&untagged), json!([])),
            (id, json!(["leitura"])),
        ]
    );
}

#[tokio::test]
async fn task_labels_out_of_limits_return_422() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(&t.alice, json!({ "title": "Pintar a parede" }))
            .await,
    );
    let invalid = [
        json!(["casa", "CASA"]),
        json!((0..21).map(|i| format!("l{i}")).collect::<Vec<_>>()),
        json!(["a".repeat(51)]),
    ];

    for labels in invalid {
        let (status, problem) = t
            .call(
                &t.alice,
                Method::POST,
                "/api/v1/tasks",
                Some(json!({ "title": "Outra", "labels": labels })),
            )
            .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "POST {labels}");
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "labels");

        let (status, problem) = t
            .call(
                &t.alice,
                Method::PATCH,
                &format!("/api/v1/tasks/{id}"),
                Some(json!({ "labels": labels })),
            )
            .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "PATCH {labels}");
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "labels");
    }
    let (_, page) = t.call(&t.alice, Method::GET, "/api/v1/tasks", None).await;
    assert_eq!(ids_of(&page), [id.as_str()]);
    assert_eq!(page["items"][0]["labels"], json!([]));
}

#[tokio::test]
async fn task_label_filter_lists_only_tagged_tasks() {
    let t = TestApp::new().await;
    let home = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Trocar a lâmpada", "labels": ["casa"] }),
        )
        .await,
    );
    let untagged = id_of(
        &t.create(&t.alice, json!({ "title": "Ligar para o banco" }))
            .await,
    );
    let works = id_of(
        &t.create(
            &t.alice,
            json!({
                "title": "Vistoriar a obra",
                "recurrence": daily_rule("2026-11-01"),
                "labels": ["casa", "obra"]
            }),
        )
        .await,
    );
    t.call(
        &t.alice,
        Method::POST,
        &format!("/api/v1/tasks/{home}/completion"),
        Some(json!({})),
    )
    .await;
    let app = &t;
    let list = |uri: String| async move {
        let (status, page) = app.call(&app.alice, Method::GET, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{uri} {page}");
        page
    };

    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=casa".to_owned()).await),
        [works.as_str(), home.as_str()]
    );
    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=obra".to_owned()).await),
        [works.as_str()]
    );
    assert!(ids_of(&list("/api/v1/tasks?label=nada".to_owned()).await).is_empty());
    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=casa&status=open".to_owned()).await),
        [works.as_str()]
    );
    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=casa&status=completed".to_owned()).await),
        [home.as_str()]
    );
    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=casa&recurring=false".to_owned()).await),
        [home.as_str()]
    );
    assert_eq!(
        ids_of(&list("/api/v1/tasks?label=casa&recurring=true".to_owned()).await),
        [works.as_str()]
    );

    let first = list("/api/v1/tasks?label=casa&limit=1".to_owned()).await;
    assert_eq!(ids_of(&first), [works.as_str()]);
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let second = list(format!("/api/v1/tasks?label=casa&limit=1&cursor={cursor}")).await;
    assert_eq!(ids_of(&second), [home.as_str()]);
    assert_eq!(second["next_cursor"], Value::Null);
    assert!(!ids_of(&second).contains(&untagged));
}

#[tokio::test]
async fn task_label_filter_rejects_invalid_value_with_422() {
    let t = TestApp::new().await;
    t.create(&t.alice, json!({ "title": "Qualquer", "labels": ["casa"] }))
        .await;
    let too_long = format!("/api/v1/tasks?label={}", "a".repeat(51));

    for uri in [
        "/api/v1/tasks?label=",
        "/api/v1/tasks?label=%20%20",
        &too_long,
    ] {
        let (status, problem) = t.call(&t.alice, Method::GET, uri, None).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}");
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "label");
    }
    let fifty = format!("/api/v1/tasks?label={}", "a".repeat(50));
    let (status, page) = t.call(&t.alice, Method::GET, &fifty, None).await;
    assert_eq!(status, StatusCode::OK, "{page}");
    assert_eq!(page["items"], json!([]));
}

fn rule_without_time(frequency: &str, weekdays: &[&str], starts_on: &str) -> Value {
    json!({
        "frequency": frequency,
        "interval": 1,
        "weekdays": weekdays,
        "month_day": null,
        "timezone": "America/Sao_Paulo",
        "starts_on": starts_on,
        "ends_on": null
    })
}

async fn list_tasks(t: &TestApp, query: &str) -> Vec<Value> {
    let (status, json) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/tasks{query}"),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{json}");
    json["items"].as_array().cloned().unwrap_or_default()
}

fn next_of_title(items: &[Value], title: &str) -> Value {
    items
        .iter()
        .find(|item| item["title"] == title)
        .unwrap_or_else(|| panic!("{title}"))["next_occurrence"]
        .clone()
}

#[tokio::test]
async fn ct34_recurring_task_without_time_is_saved() {
    let t = TestApp::new().await;

    let task = t
        .create(
            &t.alice,
            json!({
                "title": "Regar as plantas",
                "recurrence": rule_without_time("daily", &[], "2026-11-01")
            }),
        )
        .await;
    let id = id_of(&task);

    assert!(task["recurrence"].get("time").is_none(), "{task}");
    assert_eq!(task["next_occurrence"], "2026-11-01");
    let items = t.occurrences(&t.alice, "2026-11-01", "2026-11-03").await;
    assert_eq!(
        completions_of(&items, &id),
        pairs(&[
            ("2026-11-01", false),
            ("2026-11-02", false),
            ("2026-11-03", false)
        ])
    );
    let (status, updated) = t
        .call(
            &t.alice,
            Method::PATCH,
            &format!("/api/v1/tasks/{id}"),
            Some(json!({ "recurrence": rule_without_time("daily", &[], "2026-11-01") })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
}

#[tokio::test]
async fn ct37_list_has_one_row_per_task_with_next_occurrence() {
    let t = TestApp::new().await;
    t.create(
        &t.alice,
        json!({ "title": "Diária", "recurrence": rule_without_time("daily", &[], "2026-11-01") }),
    )
    .await;
    t.create(
        &t.alice,
        json!({
            "title": "Semanal",
            "recurrence": rule_without_time("weekly", &["wed"], "2026-11-01")
        }),
    )
    .await;
    t.create(
        &t.alice,
        json!({ "title": "Pontual", "due_on": "2026-11-02" }),
    )
    .await;

    let items = list_tasks(&t, "").await;

    assert_eq!(items.len(), 3);
    assert_eq!(next_of_title(&items, "Diária"), "2026-11-01");
    assert_eq!(next_of_title(&items, "Semanal"), "2026-11-04");
    assert_eq!(next_of_title(&items, "Pontual"), "2026-11-02");
}

#[tokio::test]
async fn ct37_completing_today_moves_next_occurrence() {
    let t = TestApp::new().await;
    let task = t
        .create(
            &t.alice,
            json!({ "title": "Diária", "recurrence": rule_without_time("daily", &[], "2026-11-01") }),
        )
        .await;
    let id = id_of(&task);

    let (status, done) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/tasks/{id}/completion"),
            Some(json!({ "occurrence_date": "2026-11-01" })),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{done}");

    let items = list_tasks(&t, "").await;
    assert_eq!(next_of_title(&items, "Diária"), "2026-11-02");
}

#[tokio::test]
async fn cb05_weekly_task_without_occurrence_in_seven_days_shows_next() {
    let t = TestApp::new().await;
    t.create(
        &t.alice,
        json!({
            "title": "Semanal distante",
            "recurrence": rule_without_time("weekly", &["wed"], "2026-11-11")
        }),
    )
    .await;

    let items = list_tasks(&t, "").await;

    assert_eq!(next_of_title(&items, "Semanal distante"), "2026-11-11");
}

#[tokio::test]
async fn cb06_ended_recurring_task_is_not_open() {
    let t = TestApp::new().await;
    let mut rule = rule_without_time("daily", &[], "2026-10-20");
    rule["ends_on"] = json!("2026-10-31");
    let (status, created) = t
        .call(
            &t.alice,
            Method::POST,
            "/api/v1/tasks",
            Some(json!({ "title": "Terminada", "recurrence": rule })),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");

    let all = list_tasks(&t, "").await;
    let open = list_tasks(&t, "?status=open").await;

    assert_eq!(all.len(), 1);
    assert!(all[0]["next_occurrence"].is_null(), "{all:?}");
    assert!(open.is_empty(), "{open:?}");
}
