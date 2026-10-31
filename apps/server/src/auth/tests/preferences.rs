//! Preferências do usuário (CT-31, RNF-02).

use axum::http::{Method, StatusCode};
use serde_json::json;

use super::{Harness, request_without_csrf};
use crate::auth::domain::user::Role;
use crate::http::test_support::send;
use crate::shared::db::begin_for_user;

#[tokio::test]
async fn preferences_are_saved_and_read_back() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let session = h.sign_in("ana@example.com").await;

    let (status, _, defaults) = h.get(&session, "/api/v1/me/preferences").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(defaults["theme"], "system");
    assert_eq!(defaults["locale"], "pt-BR");
    assert_eq!(defaults["timezone"], "America/Sao_Paulo");
    assert_eq!(defaults["currency"], "BRL");
    assert_eq!(defaults["palette_shortcut"], "mod+k");
    assert_eq!(defaults["search_contexts"].as_array().unwrap().len(), 8);

    let change = json!({
        "theme": "dark",
        "locale": "en-US",
        "timezone": "Europe/Lisbon",
        "currency": "EUR",
        "palette_shortcut": "ctrl+k",
        "search_contexts": ["notes", "tasks"]
    });
    let (status, _, body) = h.patch(&session, "/api/v1/me/preferences", &change).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (_, _, stored) = h.get(&session, "/api/v1/me/preferences").await;
    assert_eq!(stored, change);
    let (status, _, body) = h
        .patch(
            &session,
            "/api/v1/me/preferences",
            &json!({"timezone": "Mars/Olympus"}),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["errors"][0]["field"], "timezone");
    let (_, _, unchanged) = h.get(&session, "/api/v1/me/preferences").await;
    assert_eq!(unchanged, change);
}

#[tokio::test]
async fn preferences_of_other_user_are_not_readable() {
    let h = Harness::new().await;
    let ana = h.seed_user("ana@example.com", Role::User).await;
    let bia = h.seed_user("bia@example.com", Role::User).await;
    let session = h.sign_in("ana@example.com").await;
    let (status, _, _) = h
        .patch(
            &session,
            "/api/v1/me/preferences",
            &json!({"theme": "dark"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let count_as = |user| {
        let pool = h.ctx.state.pool.clone();
        async move {
            let mut tx = begin_for_user(&pool, user).await.unwrap();
            sqlx::query_scalar::<_, i64>("SELECT count(*) FROM user_preferences")
                .fetch_one(&mut *tx)
                .await
                .unwrap()
        }
    };

    assert_eq!(count_as(ana).await, 1);
    assert_eq!(count_as(bia).await, 0);
}

#[tokio::test]
async fn preferences_require_authentication() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;

    let (status, _, _) = h.get(&anonymous, "/api/v1/me/preferences").await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn mutation_without_csrf_is_refused() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let session = h.sign_in("ana@example.com").await;

    let request = request_without_csrf(
        &session,
        Method::PATCH,
        "/api/v1/me/preferences",
        &json!({"theme": "dark"}),
    );
    let (status, _, body) = send(&h.app, request).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["code"], "csrf_invalid");
    let (_, _, stored) = h.get(&session, "/api/v1/me/preferences").await;
    assert_eq!(stored["theme"], "system");
}
