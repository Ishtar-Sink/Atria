//! Disparo dos lembretes e Web Push (CT-25, RF-42, CB-04, CB-14).

use chrono::Duration;
use serde_json::json;

use super::{ALICE, TestApp, daily_rule};

const ENDPOINT: &str = "https://push.example.test/send/alice";

async fn push_status(app: &TestApp, fire_at: &str) -> String {
    let mut tx = crate::shared::db::begin_for_user(&app.ctx.state.pool, ALICE)
        .await
        .unwrap();
    let status: String = sqlx::query_scalar(
        "SELECT push_status FROM reminder_deliveries WHERE fire_at = $1::timestamptz",
    )
    .bind(fire_at)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    status
}

#[tokio::test]
async fn recurring_reminder_due_in_one_minute_is_pushed_once() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    app.subscribe(&alice, ENDPOINT).await;
    // Agora são 12:00 UTC: o lembrete recorrente é para daqui a 1 minuto.
    let reminder = app
        .create(
            &alice,
            json!({ "title": "Beber água", "rule": daily_rule("12:01", "UTC", "2026-11-01") }),
        )
        .await;

    app.dispatch().await;
    assert!(app.sender.sent().is_empty(), "ainda não venceu");
    app.ctx.clock.advance(Duration::minutes(1));
    app.dispatch().await;
    app.dispatch().await;

    let sent = app.sender.sent();
    assert_eq!(sent.len(), 1, "uma única mensagem por ocorrência");
    assert_eq!(sent[0].endpoint, ENDPOINT);
    assert_eq!(
        sent[0].payload,
        json!({
            "reminder_id": reminder["id"],
            "title": "Beber água",
            "fire_at": "2026-11-01T12:01:00Z",
        })
    );
    assert_eq!(sent[0].ttl_seconds, 15 * 60);
    assert_eq!(push_status(&app, "2026-11-01T12:01:00Z").await, "sent");
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());
    let (_, fetched) = app.get(&alice, &uri).await;
    assert_eq!(fetched["next_fire_at"], "2026-11-02T12:01:00Z");
}

#[tokio::test]
async fn push_is_not_sent_when_admin_disabled() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    app.subscribe(&alice, ENDPOINT).await;
    app.create(
        &alice,
        json!({ "title": "Beber água", "rule": daily_rule("12:01", "UTC", "2026-11-01") }),
    )
    .await;
    app.policy.set(false);

    app.ctx.clock.advance(Duration::minutes(1));
    app.dispatch().await;

    assert!(app.sender.sent().is_empty());
    assert_eq!(push_status(&app, "2026-11-01T12:01:00Z").await, "skipped");
    let (status, problem) = app.get(&alice, "/api/v1/web-push/public-key").await;
    assert_eq!(status, axum::http::StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "web_push_disabled");
}

#[tokio::test]
async fn push_is_not_sent_without_subscription() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    app.create(
        &alice,
        json!({ "title": "Beber água", "rule": daily_rule("12:01", "UTC", "2026-11-01") }),
    )
    .await;

    app.ctx.clock.advance(Duration::minutes(1));
    app.dispatch().await;
    let (_, upcoming) = app
        .get(
            &alice,
            "/api/v1/reminders/upcoming?from=2026-11-01T12:00:00Z&to=2026-11-02T12:00:00Z",
        )
        .await;

    assert!(app.sender.sent().is_empty());
    assert_eq!(push_status(&app, "2026-11-01T12:01:00Z").await, "skipped");
    // O lembrete continua aparecendo no app, para a aba aberta (CB-14).
    assert_eq!(upcoming["items"][0]["fire_at"], "2026-11-01T12:01:00Z");
}

#[tokio::test]
async fn dst_gap_reminder_is_dispatched_once() {
    let app = TestApp::new().await;
    app.ctx.clock.set("2027-03-14T07:00:00Z".parse().unwrap());
    let alice = app.sign_in(ALICE).await;
    app.subscribe(&alice, ENDPOINT).await;
    // 02:30 não existe em 14/03/2027 em Nova York: vale 03:30 EDT, 07:30 UTC.
    let reminder = app
        .create(
            &alice,
            json!({
                "title": "Regar",
                "rule": daily_rule("02:30", "America/New_York", "2027-03-14"),
            }),
        )
        .await;
    assert_eq!(reminder["next_fire_at"], "2027-03-14T07:30:00Z");

    app.ctx.clock.set("2027-03-14T07:31:00Z".parse().unwrap());
    app.dispatch().await;
    app.dispatch().await;

    let sent = app.sender.sent();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].payload["fire_at"], "2027-03-14T07:30:00Z");
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());
    let (_, fetched) = app.get(&alice, &uri).await;
    assert_eq!(fetched["next_fire_at"], "2027-03-15T06:30:00Z");
}

#[tokio::test]
async fn gone_subscription_is_removed() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let gone = "https://push.example.test/send/old-browser";
    app.subscribe(&alice, gone).await;
    app.subscribe(&alice, ENDPOINT).await;
    app.sender.mark_gone(gone);
    app.create(
        &alice,
        json!({ "title": "Beber água", "rule": daily_rule("12:01", "UTC", "2026-11-01") }),
    )
    .await;

    app.ctx.clock.advance(Duration::minutes(1));
    app.dispatch().await;

    let endpoints: Vec<String> = app.sender.sent().into_iter().map(|p| p.endpoint).collect();
    assert_eq!(endpoints, [ENDPOINT]);
    assert_eq!(
        app.count_as(ALICE, "SELECT count(*) FROM push_subscriptions")
            .await,
        1
    );
    assert_eq!(
        app.count_as(
            ALICE,
            &format!("SELECT count(*) FROM push_subscriptions WHERE endpoint = '{gone}'")
        )
        .await,
        0
    );
    assert_eq!(push_status(&app, "2026-11-01T12:01:00Z").await, "sent");
}

#[tokio::test]
async fn missed_occurrences_older_than_15_minutes_are_skipped() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    app.subscribe(&alice, ENDPOINT).await;
    let reminder = app
        .create(
            &alice,
            json!({ "title": "Beber água", "rule": daily_rule("12:01", "UTC", "2026-11-01") }),
        )
        .await;

    // O servidor ficou fora três dias: só a ocorrência mais velha é registrada,
    // como pulada, e o disparo segue da próxima ainda futura.
    app.ctx.clock.set("2026-11-04T12:00:00Z".parse().unwrap());
    app.dispatch().await;

    assert!(app.sender.sent().is_empty());
    assert_eq!(push_status(&app, "2026-11-01T12:01:00Z").await, "skipped");
    assert_eq!(
        app.count_as(ALICE, "SELECT count(*) FROM reminder_deliveries")
            .await,
        1
    );
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());
    let (_, fetched) = app.get(&alice, &uri).await;
    assert_eq!(fetched["next_fire_at"], "2026-11-04T12:01:00Z");

    // Dentro do atraso máximo, a ocorrência ainda é enviada.
    app.ctx.clock.set("2026-11-04T12:10:00Z".parse().unwrap());
    app.dispatch().await;
    assert_eq!(app.sender.sent().len(), 1);
}
