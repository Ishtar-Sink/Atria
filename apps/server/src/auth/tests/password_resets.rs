//! Redefinição de senha (CT-08, CT-09).

use axum::http::StatusCode;
use chrono::Duration;
use serde_json::json;

use super::{Harness, NEW_PASSWORD, PASSWORD};
use crate::auth::domain::user::Role;

fn token_of(link: &str) -> String {
    link.split("reset-password/").nth(1).unwrap().to_owned()
}

async fn configure_smtp(h: &Harness, admin: &crate::http::test_support::TestSession) {
    let (status, _, body) = h
        .patch(
            admin,
            "/api/v1/admin/instance/settings",
            &json!({"smtp_host": "smtp.example.com", "smtp_port": 587, "smtp_from": "atria@example.com"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

#[tokio::test]
async fn email_reset_reaches_only_existing_user_with_same_response() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    configure_smtp(&h, &admin).await;
    h.seed_user("ana@example.com", Role::User).await;
    let anonymous = h.anonymous().await;

    let known = h
        .post(
            &anonymous,
            "/api/v1/auth/password-resets",
            &json!({"email": "Ana@example.com"}),
        )
        .await;
    let unknown = h
        .post(
            &anonymous,
            "/api/v1/auth/password-resets",
            &json!({"email": "ghost@example.com"}),
        )
        .await;

    assert_eq!(known.0, StatusCode::ACCEPTED);
    assert_eq!((known.0, &known.2), (unknown.0, &unknown.2));
    let sent = h.mailer.sent();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].to, "ana@example.com");
    let link = sent[0]
        .body
        .lines()
        .find(|line| line.contains("reset-password/"))
        .unwrap();
    let token = token_of(link);

    let (status, _, _) = h
        .put(
            &anonymous,
            &format!("/api/v1/auth/password-resets/{token}"),
            &json!({"password": NEW_PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let ((status, _, _), _) = h.try_sign_in("ana@example.com", NEW_PASSWORD, None).await;
    assert_eq!(status, StatusCode::OK);
    let ((status, _, _), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn reset_without_smtp_sends_nothing() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let anonymous = h.anonymous().await;

    let (status, _, body) = h
        .post(
            &anonymous,
            "/api/v1/auth/password-resets",
            &json!({"email": "ana@example.com"}),
        )
        .await;

    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(body["status"], "accepted");
    assert!(h.mailer.sent().is_empty());
    let tokens: i64 = sqlx::query_scalar("SELECT count(*) FROM password_reset_tokens")
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();
    assert_eq!(tokens, 0);
}

#[tokio::test]
async fn email_reset_token_expires_after_30_minutes() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    configure_smtp(&h, &admin).await;
    h.seed_user("ana@example.com", Role::User).await;
    let anonymous = h.anonymous().await;
    h.post(
        &anonymous,
        "/api/v1/auth/password-resets",
        &json!({"email": "ana@example.com"}),
    )
    .await;
    let sent = h.mailer.sent();
    let token = token_of(
        sent[0]
            .body
            .lines()
            .find(|l| l.contains("reset-password/"))
            .unwrap(),
    );
    h.ctx.clock.advance(Duration::minutes(31));

    let (status, _, body) = h
        .put(
            &anonymous,
            &format!("/api/v1/auth/password-resets/{token}"),
            &json!({"password": NEW_PASSWORD}),
        )
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "reset_token_invalid");
}

#[tokio::test]
async fn admin_reset_link_works_once() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;
    let live = h.sign_in("ana@example.com").await;

    let (status, _, body) = h
        .post(
            &admin,
            "/api/v1/admin/password-resets",
            &json!({"user_id": user_id}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    let token = token_of(body["link"].as_str().unwrap());
    let anonymous = h.anonymous().await;
    let uri = format!("/api/v1/auth/password-resets/{token}");

    let (status, _, _) = h
        .put(&anonymous, &uri, &json!({"password": NEW_PASSWORD}))
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _, body) = h
        .put(&anonymous, &uri, &json!({"password": NEW_PASSWORD}))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "reset_token_invalid");

    let (status, _, _) = h.get(&live, "/api/v1/me").await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "trocar a senha encerra as sessões abertas"
    );
    let ((status, _, _), _) = h.try_sign_in("ana@example.com", NEW_PASSWORD, None).await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn admin_reset_token_is_stored_only_as_hash() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;
    let (_, _, body) = h
        .post(
            &admin,
            "/api/v1/admin/password-resets",
            &json!({"user_id": user_id}),
        )
        .await;
    let token = token_of(body["link"].as_str().unwrap());

    let hash = crate::auth::domain::invite::hash_token(&token);
    let found: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM password_reset_tokens WHERE token_hash = $1 AND origin = 'admin'",
    )
    .bind(hash)
    .fetch_one(&h.ctx.state.pool)
    .await
    .unwrap();

    assert_eq!(found, 1);
}

#[tokio::test]
async fn elevated_cannot_generate_reset_link() {
    let h = Harness::new().await;
    h.seed_user("elevated@example.com", Role::Elevated).await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;
    let session = h.sign_in("elevated@example.com").await;

    let (status, _, body) = h
        .post(
            &session,
            "/api/v1/admin/password-resets",
            &json!({"user_id": user_id}),
        )
        .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["code"], "forbidden");
}

#[tokio::test]
async fn repeated_reset_requests_are_throttled() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;
    let body = json!({"email": "ghost@example.com"});
    for _ in 0..5 {
        let (status, _, _) = h
            .post(&anonymous, "/api/v1/auth/password-resets", &body)
            .await;
        assert_eq!(status, StatusCode::ACCEPTED);
    }

    let (status, _, body) = h
        .post(&anonymous, "/api/v1/auth/password-resets", &body)
        .await;

    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(body["code"], "too_many_attempts");
}
