//! Login, 2FA e bloqueio (CT-06, RNF-01).

use axum::http::StatusCode;
use chrono::Duration;
use serde_json::json;

use super::{Harness, PASSWORD};
use crate::auth::domain::user::Role;
use crate::http::session::SESSION_COOKIE;
use crate::http::test_support::set_cookie_header;

#[tokio::test]
async fn sign_in_with_totp_requires_code() {
    let h = Harness::new().await;
    let (_, secret) = h.seed_user_with_totp("ana@example.com", Role::User).await;

    let ((status, _, body), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "totp_required");

    let ((status, _, body), _) = h
        .try_sign_in("ana@example.com", PASSWORD, Some("000000"))
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_totp_code");

    let code = secret.code_at(h.now());
    let ((status, _, body), session) = h
        .try_sign_in("ana@example.com", PASSWORD, Some(&code))
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["totp_enabled"], true);
    let (status, _, _) = h.get(&session, "/api/v1/me").await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn password_is_stored_as_argon2id() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;
    let (status, _, _) = h
        .post(
            &anonymous,
            "/api/v1/setup",
            &json!({"email": "admin@example.com", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);

    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users")
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();

    assert!(hash.starts_with("$argon2id$"), "{hash}");
    assert!(!hash.contains(PASSWORD));
}

#[tokio::test]
async fn wrong_password_and_unknown_email_get_the_same_answer() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;

    let ((s1, _, b1), _) = h
        .try_sign_in("ana@example.com", "wrong password here", None)
        .await;
    let ((s2, _, b2), _) = h.try_sign_in("nobody@example.com", PASSWORD, None).await;

    assert_eq!(s1, StatusCode::UNAUTHORIZED);
    assert_eq!((s1, &b1), (s2, &b2));
    assert_eq!(b1["code"], "invalid_credentials");
}

#[tokio::test]
async fn repeated_failures_lock_sign_in() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    for _ in 0..5 {
        let ((status, _, _), _) = h
            .try_sign_in("ana@example.com", "wrong password here", None)
            .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }

    let ((status, _, body), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(body["code"], "too_many_attempts");

    h.ctx.clock.advance(Duration::seconds(61));
    let ((status, _, _), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::OK);
    let ((status, _, _), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::OK, "o sucesso zera as falhas");
}

#[tokio::test]
async fn sign_out_ends_session() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let session = h.sign_in("ana@example.com").await;
    let (status, _, _) = h.get(&session, "/api/v1/me").await;
    assert_eq!(status, StatusCode::OK);

    let (status, _, _) = h.post(&session, "/api/v1/auth/sign-out", &json!({})).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, _, body) = h.get(&session, "/api/v1/me").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "unauthenticated");
}

#[tokio::test]
async fn session_cookie_is_http_only_secure_same_site() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let anonymous = h.anonymous().await;

    let (status, headers, _) = h
        .post(
            &anonymous,
            "/api/v1/auth/sign-in",
            &json!({"email": "ana@example.com", "password": PASSWORD}),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    let cookie = set_cookie_header(&headers, SESSION_COOKIE).unwrap();
    assert!(cookie.contains("HttpOnly"), "{cookie}");
    assert!(cookie.contains("Secure"), "{cookie}");
    assert!(cookie.contains("SameSite"), "{cookie}");
}
