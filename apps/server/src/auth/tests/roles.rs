//! Papéis e configurações da instância (CT-10, CT-32).

use axum::http::StatusCode;
use serde_json::json;

use super::{Harness, PASSWORD};
use crate::auth::domain::user::Role;

#[tokio::test]
async fn elevated_manages_users_but_not_instance() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let elevated_id = h.seed_user("elevated@example.com", Role::User).await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;

    let (status, _, body) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{elevated_id}"),
            &json!({"role": "elevated"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["role"], "elevated");
    let elevated = h.sign_in("elevated@example.com").await;

    h.invite_token(&elevated).await;
    let (status, _, body) = h.get(&elevated, "/api/v1/admin/users?limit=2").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["items"].as_array().unwrap().len(), 2);
    assert!(body["next_cursor"].is_string());
    for item in body["items"].as_array().unwrap() {
        let keys: Vec<&String> = item.as_object().unwrap().keys().collect();
        assert!(keys.iter().all(|k| {
            [
                "id",
                "email",
                "role",
                "is_active",
                "totp_enabled",
                "created_at",
            ]
            .contains(&k.as_str())
        }));
    }
    let (status, _, body) = h
        .patch(
            &elevated,
            &format!("/api/v1/admin/users/{user_id}"),
            &json!({"is_active": false}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["is_active"], false);
    let (status, _, body) = h.get(&elevated, "/api/v1/admin/instance").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["version"].is_string());
    assert!(body["database_bytes"].as_i64().unwrap() > 0);
    assert_eq!(body["healthy"], true);

    let (status, _, _) = h
        .patch(
            &elevated,
            "/api/v1/admin/instance/settings",
            &json!({"invite_required": false}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, _) = h.get(&elevated, "/api/v1/admin/instance/settings").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, _) = h
        .patch(
            &elevated,
            &format!("/api/v1/admin/users/{user_id}"),
            &json!({"role": "elevated"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _, body) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{elevated_id}"),
            &json!({"role": "user"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, _, _) = h.get(&elevated, "/api/v1/admin/users").await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "o papel retirado vale no mesmo instante"
    );
}

#[tokio::test]
async fn elevated_cannot_deactivate_another_elevated_or_the_admin() {
    let h = Harness::new().await;
    let (admin_id, _) = h.admin_session().await;
    let other = h.seed_user("other@example.com", Role::Elevated).await;
    h.seed_user("elevated@example.com", Role::Elevated).await;
    let elevated = h.sign_in("elevated@example.com").await;

    for target in [other, admin_id] {
        let (status, _, body) = h
            .patch(
                &elevated,
                &format!("/api/v1/admin/users/{target}"),
                &json!({"is_active": false}),
            )
            .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    }
}

#[tokio::test]
async fn admin_cannot_demote_self_or_create_second_admin() {
    let h = Harness::new().await;
    let (admin_id, admin) = h.admin_session().await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;

    let (status, _, _) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{admin_id}"),
            &json!({"role": "user"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, _) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{user_id}"),
            &json!({"role": "admin"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, body) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{user_id}"),
            &json!({"role": "root"}),
        )
        .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
}

#[tokio::test]
async fn user_role_gets_403_on_admin_routes() {
    let h = Harness::new().await;
    h.seed_user("ana@example.com", Role::User).await;
    let session = h.sign_in("ana@example.com").await;

    for uri in [
        "/api/v1/admin/users",
        "/api/v1/admin/instance",
        "/api/v1/admin/instance/settings",
    ] {
        let (status, _, body) = h.get(&session, uri).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{uri}");
        assert_eq!(body["code"], "forbidden");
    }
    let (status, _, _) = h.post(&session, "/api/v1/admin/invites", &json!({})).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn admin_routes_require_authentication() {
    let h = Harness::new().await;
    let anonymous = h.anonymous().await;

    let (status, _, body) = h.get(&anonymous, "/api/v1/admin/users").await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "unauthenticated");
}

#[tokio::test]
async fn user_list_filters_by_role_and_email() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    h.seed_user("ana@example.com", Role::User).await;
    h.seed_user("bia@example.com", Role::Elevated).await;
    h.seed_user("an_a@example.com", Role::User).await;

    let (_, _, body) = h.get(&admin, "/api/v1/admin/users?role=elevated").await;
    assert_eq!(body["items"].as_array().unwrap().len(), 1);
    let (_, _, body) = h.get(&admin, "/api/v1/admin/users?q=an_a").await;
    let items = body["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "o _ da busca é literal");
    assert_eq!(items[0]["email"], "an_a@example.com");

    let (_, _, first) = h.get(&admin, "/api/v1/admin/users?limit=2").await;
    let cursor = first["next_cursor"].as_str().unwrap();
    let (_, _, second) = h
        .get(
            &admin,
            &format!("/api/v1/admin/users?limit=2&cursor={cursor}"),
        )
        .await;
    assert_eq!(second["items"].as_array().unwrap().len(), 2);
    assert!(second["next_cursor"].is_null());
}

#[tokio::test]
async fn instance_settings_apply_to_everyone() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    h.seed_user("someone@example.com", Role::User).await;
    let (status, _, _) = h.sign_up("early@example.com", None).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "o convite é obrigatório por padrão"
    );

    let (status, _, body) = h
        .patch(
            &admin,
            "/api/v1/admin/instance/settings",
            &json!({
                "web_push_enabled": true,
                "smtp_host": "smtp.example.com",
                "smtp_port": 587,
                "smtp_user": "mailer",
                "smtp_from": "atria@example.com",
                "invite_required": false
            }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, _, stored) = h.get(&admin, "/api/v1/admin/instance/settings").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(stored["web_push_enabled"], true);
    assert_eq!(stored["smtp_host"], "smtp.example.com");
    assert_eq!(stored["invite_required"], false);
    assert!(stored.get("smtp_password").is_none());

    let (status, _, body) = h.sign_up("late@example.com", None).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
}

#[tokio::test]
async fn smtp_password_is_never_accepted_by_the_api() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;

    let (status, _, body) = h
        .patch(
            &admin,
            "/api/v1/admin/instance/settings",
            &json!({"smtp_password": "segredo"}),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "validation_failed");
}

#[tokio::test]
async fn deactivated_user_cannot_sign_in() {
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let user_id = h.seed_user("ana@example.com", Role::User).await;
    let live = h.sign_in("ana@example.com").await;

    let (status, _, body) = h
        .patch(
            &admin,
            &format!("/api/v1/admin/users/{user_id}"),
            &json!({"is_active": false}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let ((status, _, body), _) = h.try_sign_in("ana@example.com", PASSWORD, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "invalid_credentials");
    let (status, _, _) = h.get(&live, "/api/v1/me").await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "a sessão aberta também cai"
    );
}

#[tokio::test]
async fn instance_settings_report_web_push_configured() {
    // Com o Web Push desligado, a chave pública responde 404: a tela só sabe se a chave VAPID
    // existe por este campo, para habilitar o interruptor.
    let h = Harness::new().await;
    let (_, admin) = h.admin_session().await;
    let (status, _, body) = h.get(&admin, "/api/v1/admin/instance/settings").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["web_push_configured"], false);

    let h = Harness::with_vapid_key_file().await;
    let (_, admin) = h.admin_session().await;
    let (_, _, body) = h.get(&admin, "/api/v1/admin/instance/settings").await;
    assert_eq!(body["web_push_enabled"], false);
    assert_eq!(body["web_push_configured"], true);
    let (status, _, body) = h
        .patch(
            &admin,
            "/api/v1/admin/instance/settings",
            &json!({"web_push_enabled": true}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["web_push_configured"], true);
}
