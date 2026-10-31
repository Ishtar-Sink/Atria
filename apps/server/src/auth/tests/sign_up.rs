//! Cadastro e convites (CT-04, CT-05).

use axum::http::StatusCode;
use chrono::Duration;

use super::Harness;
use crate::auth::domain::invite::hash_token;
use crate::auth::domain::user::Role;

#[tokio::test]
async fn sign_up_with_invite_works_once() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let token = h.invite_token(&admin).await;

    let (status, _, body) = h.sign_up("ana@example.com", Some(&token)).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert_eq!(body["role"], "user");

    let (status, _, body) = h.sign_up("bia@example.com", Some(&token)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "invite_invalid");
    let used_by: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT used_by FROM invites WHERE token_hash = $1")
            .bind(hash_token(&token))
            .fetch_one(&h.ctx.state.pool)
            .await
            .unwrap();
    assert!(used_by.is_some());
}

#[tokio::test]
async fn expired_invite_is_refused() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let token = h.invite_token(&admin).await;
    h.ctx.clock.advance(Duration::days(8));

    let (status, _, body) = h.sign_up("ana@example.com", Some(&token)).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "invite_invalid");
}

#[tokio::test]
async fn unknown_invite_leaves_no_account_behind() {
    let h = Harness::new().await;
    h.seed_user("someone@example.com", Role::User).await;

    let (status, _, body) = h.sign_up("ana@example.com", Some("not-a-real-token")).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "invite_invalid");
    let count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM users WHERE email = 'ana@example.com'")
            .fetch_one(&h.ctx.state.pool)
            .await
            .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn sign_up_without_invite_works_when_not_required() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let (status, _, body) = h
        .patch(
            &admin,
            "/api/v1/admin/instance/settings",
            &serde_json::json!({"invite_required": false}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (status, _, body) = h.sign_up("ana@example.com", None).await;

    assert_eq!(status, StatusCode::CREATED, "{body}");
}

#[tokio::test]
async fn sign_up_without_invite_is_refused_when_required() {
    let h = Harness::new().await;
    h.seed_user("someone@example.com", Role::User).await;

    let (status, _, body) = h.sign_up("ana@example.com", None).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["code"], "invite_required");
}

#[tokio::test]
async fn sign_up_refuses_duplicate_email() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    h.seed_user("ana@example.com", Role::User).await;
    let token = h.invite_token(&admin).await;

    let (status, _, body) = h.sign_up("ANA@example.com", Some(&token)).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "validation_failed");
    let used: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT used_at FROM invites WHERE token_hash = $1")
            .bind(hash_token(&token))
            .fetch_one(&h.ctx.state.pool)
            .await
            .unwrap();
    assert!(
        used.is_none(),
        "o convite não é gasto por um cadastro que falhou"
    );
}

#[tokio::test]
async fn elevated_generates_invite() {
    let h = Harness::new().await;
    h.seed_user("elevated@example.com", Role::Elevated).await;
    let session = h.sign_in("elevated@example.com").await;

    let token = h.invite_token(&session).await;

    let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM invites WHERE token_hash = $1")
        .bind(hash_token(&token))
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();
    assert_eq!(stored, 1, "o banco guarda só o hash do token");
    let (status, _, _) = h.sign_up("ana@example.com", Some(&token)).await;
    assert_eq!(status, StatusCode::CREATED);
}

#[tokio::test]
async fn successful_sign_up_resets_ip_failures() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;

    // Quatro convites inválidos, um cadastro certo e mais quatro inválidos: sem zerar a contagem
    // no sucesso, as oito falhas do mesmo IP travariam o próximo cadastro ([project/security-07]).
    for _ in 0..4 {
        let (status, _, _) = h.sign_up("ana@example.com", Some("not-a-real-token")).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let token = h.invite_token(&admin).await;
    let (status, _, body) = h.sign_up("ana@example.com", Some(&token)).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    for _ in 0..4 {
        let (status, _, _) = h.sign_up("bia@example.com", Some("not-a-real-token")).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }

    let token = h.invite_token(&admin).await;
    let (status, _, body) = h.sign_up("bia@example.com", Some(&token)).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
}
