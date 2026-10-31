//! Isolamento entre usuários: 404 para dado de outro dono, RLS forçada e CSRF.

use std::net::SocketAddr;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Method, Request, StatusCode, header};
use serde_json::json;

use super::{ALICE, BOB, TestApp, daily_rule};
use crate::http::test_support::send;

#[tokio::test]
async fn other_user_reminder_and_subscription_return_404() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let bob = app.sign_in(BOB).await;
    let reminder = app
        .create(
            &alice,
            json!({ "title": "Segredo", "rule": daily_rule("08:00", "UTC", "2026-11-02") }),
        )
        .await;
    let subscription = app
        .subscribe(&alice, "https://push.example.test/send/alice")
        .await;
    let uri = format!("/api/v1/reminders/{}", reminder["id"].as_str().unwrap());

    let (get, problem) = app.get(&bob, &uri).await;
    let (patch, _) = app
        .json(&bob, Method::PATCH, &uri, &json!({ "title": "Meu" }))
        .await;
    let delete = app.delete(&bob, &uri).await;
    let delete_subscription = app
        .delete(
            &bob,
            &format!(
                "/api/v1/push-subscriptions/{}",
                subscription["id"].as_str().unwrap()
            ),
        )
        .await;
    let (_, list) = app.get(&bob, "/api/v1/reminders").await;
    let (_, upcoming) = app
        .get(
            &bob,
            "/api/v1/reminders/upcoming?from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z",
        )
        .await;

    assert_eq!(get, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "not_found");
    assert_eq!(patch, StatusCode::NOT_FOUND);
    assert_eq!(delete, StatusCode::NOT_FOUND);
    assert_eq!(delete_subscription, StatusCode::NOT_FOUND);
    assert_eq!(list["items"], json!([]));
    assert_eq!(upcoming["items"], json!([]));
    let (still, fetched) = app.get(&alice, &uri).await;
    assert_eq!(still, StatusCode::OK);
    assert_eq!(fetched["title"], "Segredo");
    assert_eq!(
        app.count_as(ALICE, "SELECT count(*) FROM push_subscriptions")
            .await,
        1
    );
}

#[tokio::test]
async fn row_level_security_hides_other_owner_rows() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    app.subscribe(&alice, "https://push.example.test/send/alice")
        .await;
    app.create(
        &alice,
        json!({ "title": "Agora", "timezone": "UTC", "remind_at": "2026-11-01T12:00:00Z" }),
    )
    .await;
    app.dispatch().await;

    for table in ["reminders", "reminder_deliveries", "push_subscriptions"] {
        let (enabled, forced): (bool, bool) = sqlx::query_as(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
        )
        .bind(table)
        .fetch_one(&app.ctx.state.pool)
        .await
        .unwrap();
        let sql = format!("SELECT count(*) FROM {table}");
        let anonymous: i64 = sqlx::query_scalar(&sql)
            .fetch_one(&app.ctx.state.pool)
            .await
            .unwrap();

        assert!(enabled && forced, "RLS forçada em {table}");
        assert_eq!(app.count_as(ALICE, &sql).await, 1, "{table} da alice");
        assert_eq!(app.count_as(BOB, &sql).await, 0, "{table} escondida do bob");
        assert_eq!(anonymous, 0, "{table} sem usuário");
    }
}

#[tokio::test]
async fn mutation_without_csrf_is_refused() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let body =
        json!({ "title": "Sem CSRF", "timezone": "UTC", "remind_at": "2026-11-10T10:00:00Z" });

    let request = Request::builder()
        .method(Method::POST)
        .uri("/api/v1/reminders")
        .header(header::COOKIE, &alice.cookie)
        .header(header::CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(SocketAddr::from(([203, 0, 113, 10], 40000))))
        .body(Body::from(body.to_string()))
        .unwrap();
    let (status, _, problem) = send(&app.app(), request).await;
    let subscription = Request::builder()
        .method(Method::POST)
        .uri("/api/v1/push-subscriptions")
        .header(header::COOKIE, &alice.cookie)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            super::subscription_body("https://push.example.test/send/a").to_string(),
        ))
        .unwrap();
    let (subscription_status, _, _) = send(&app.app(), subscription).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(problem["code"], "csrf_invalid");
    assert_eq!(subscription_status, StatusCode::FORBIDDEN);
    assert_eq!(
        app.count_as(ALICE, "SELECT count(*) FROM reminders").await,
        0
    );
}
