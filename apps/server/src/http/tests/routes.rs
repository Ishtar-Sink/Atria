//! Rotas do servidor completo: `/healthz`, todas as rotas do OpenAPI, 404 e 405,
//! conta incompleta barrada e a política de Web Push.

use axum::http::{Method, StatusCode, header};
use serde_json::json;
use uuid::Uuid;

use super::support::Server;
use crate::http::contexts::web_push_policy;
use crate::http::openapi::api_doc;
use crate::shared::error::PROBLEM_JSON;

const METHODS: [(&str, Method); 5] = [
    ("get", Method::GET),
    ("post", Method::POST),
    ("put", Method::PUT),
    ("patch", Method::PATCH),
    ("delete", Method::DELETE),
];

/// Troca os parâmetros do caminho por valores válidos.
fn concrete_path(template: &str) -> String {
    let mut path = String::new();
    for segment in template.split('/').skip(1) {
        path.push('/');
        let value = match segment {
            "{report}" => "finance".to_owned(),
            "{period}" => "2026-11".to_owned(),
            "{token}" => Uuid::now_v7().simple().to_string(),
            s if s.starts_with('{') => Uuid::now_v7().to_string(),
            s => s.to_owned(),
        };
        path.push_str(&value);
    }
    path
}

fn content_type(headers: &axum::http::HeaderMap) -> &str {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
}

#[tokio::test]
async fn healthz_responds_ok_with_all_contexts() {
    let server = Server::new().await;
    let anonymous = server.anonymous().await;

    for uri in ["/healthz", "/api/v1/healthz"] {
        let (status, _, body) = server.get(&anonymous, uri).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
        assert_eq!(body["database"], "ok");
    }
}

#[tokio::test]
async fn every_openapi_path_is_routed() {
    let server = Server::new().await;
    let anonymous = server.anonymous().await;
    let doc = serde_json::to_value(api_doc()).unwrap();
    let paths = doc["paths"].as_object().unwrap();
    let mut unrouted = Vec::new();
    let mut checked = 0;

    for (template, item) in paths {
        for (name, method) in METHODS {
            if item.get(name).is_none() {
                continue;
            }
            checked += 1;
            let uri = concrete_path(template);
            let body = matches!(name, "post" | "put" | "patch").then(|| json!({}));
            let (status, _, reply) = server
                .request(&anonymous, method.clone(), &uri, body.as_ref())
                .await;
            if status == StatusCode::METHOD_NOT_ALLOWED || reply["code"] == "route_not_found" {
                unrouted.push(format!("{name} {template} -> {status}"));
            }
        }
    }

    assert!(
        checked > 50,
        "esperava as rotas de todos os contextos: {checked}"
    );
    assert!(
        unrouted.is_empty(),
        "rotas do OpenAPI sem handler: {unrouted:#?}"
    );
}

#[tokio::test]
async fn unknown_route_returns_route_not_found_problem() {
    let server = Server::new().await;
    let anonymous = server.anonymous().await;

    let (status, headers, body) = server.get(&anonymous, "/api/v1/does-not-exist").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(content_type(&headers), PROBLEM_JSON);
    assert_eq!(body["code"], "route_not_found");
}

#[tokio::test]
async fn wrong_method_returns_method_not_allowed_problem() {
    let server = Server::new().await;
    let anonymous = server.anonymous().await;

    let (status, headers, body) = server
        .request(&anonymous, Method::PUT, "/api/v1/goals", Some(&json!({})))
        .await;

    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(content_type(&headers), PROBLEM_JSON);
    assert_eq!(body["code"], "method_not_allowed");
}

#[tokio::test]
async fn admin_without_totp_is_blocked_on_every_context() {
    let server = Server::new().await;
    let admin = server.setup_admin().await;

    for uri in ["/api/v1/goals", "/api/v1/notes", "/api/v1/accounts"] {
        let (status, _, body) = server.get(&admin.session, uri).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{uri}: {body}");
        assert_eq!(body["code"], "totp_required", "{uri}");
    }
    for uri in ["/api/v1/me", "/api/v1/setup"] {
        let (status, _, body) = server.get(&admin.session, uri).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
    }
    let (_, _, me) = server.get(&admin.session, "/api/v1/me").await;
    assert!(me.to_string().contains(&admin.id.to_string()), "{me}");
    let (status, _, body) = server
        .post(&admin.session, "/api/v1/auth/totp", &json!({}))
        .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
}

#[tokio::test]
async fn web_push_policy_follows_instance_setting() {
    let server = Server::new().await;
    let users = server.users().await;
    let policy = web_push_policy(server.ctx.state.pool.clone());
    let settings = "/api/v1/admin/instance/settings";

    let (status, _, body) = server
        .patch(
            &users.admin.session,
            settings,
            &json!({"web_push_enabled": false}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(!policy.is_enabled().await);

    let (status, _, body) = server
        .patch(
            &users.admin.session,
            settings,
            &json!({"web_push_enabled": true}),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(policy.is_enabled().await);
}
