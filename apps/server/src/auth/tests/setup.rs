//! Assistente de primeira execução (CT-03, CT-07).

use axum::http::StatusCode;
use serde_json::json;

use super::{Harness, PASSWORD, merge_cookies};

#[tokio::test]
async fn setup_creates_admin_once_and_then_disappears() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;

    let (status, _, body) = h.get(&anonymous, "/api/v1/setup").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({"required": true}));

    let (status, headers, body) = h
        .post(
            &anonymous,
            "/api/v1/setup",
            &json!({"email": "Admin@Example.com", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["role"], "admin");
    assert_eq!(body["email"], "admin@example.com");
    let session = merge_cookies(&anonymous, &headers);

    let (_, _, body) = h.get(&session, "/api/v1/setup").await;
    assert_eq!(body, json!({"required": false}));
    let (status, _, body) = h
        .post(
            &session,
            "/api/v1/setup",
            &json!({"email": "other@example.com", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "setup_already_done");
}

#[tokio::test]
async fn setup_validates_email_and_password() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;

    let (status, _, body) = h
        .post(
            &anonymous,
            "/api/v1/setup",
            &json!({"email": "not-an-email", "password": "short"}),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "validation_failed");
    let (_, _, body) = h.get(&anonymous, "/api/v1/setup").await;
    assert_eq!(body["required"], true);
}

#[tokio::test]
async fn admin_without_totp_is_blocked_until_activation() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;
    let (_, headers, _) = h
        .post(
            &anonymous,
            "/api/v1/setup",
            &json!({"email": "admin@example.com", "password": PASSWORD}),
        )
        .await;
    let session = merge_cookies(&anonymous, &headers);

    let (status, _, body) = h.get(&session, "/api/v1/admin/instance").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["code"], "totp_required");
    let (status, _, body) = h.get(&session, "/api/v1/me").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["account_complete"], false);

    h.enable_totp(&session).await;

    let (status, _, body) = h.get(&session, "/api/v1/admin/instance").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (_, _, body) = h.get(&session, "/api/v1/me").await;
    assert_eq!(body["account_complete"], true);
}

#[tokio::test]
async fn totp_activation_refuses_wrong_code_and_missing_start() {
    let h = Harness::new().await;
    h.seed_user("user@example.com", crate::auth::domain::user::Role::User)
        .await;
    let session = h.sign_in("user@example.com").await;

    let (status, _, body) = h
        .post(
            &session,
            "/api/v1/auth/totp/activation",
            &json!({"code": "123456"}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "totp_not_started");

    let (status, _, _) = h.post(&session, "/api/v1/auth/totp", &json!({})).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _, body) = h
        .post(
            &session,
            "/api/v1/auth/totp/activation",
            &json!({"code": "000000"}),
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_totp_code");
}
