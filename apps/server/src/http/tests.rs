use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Method, Request, StatusCode, header};
use axum::routing::{get, post};
use serde_json::json;
use tower_sessions::Session;
use uuid::Uuid;

use crate::http::client_ip::ClientIp;
use crate::http::config::ConfigError;
use crate::http::csrf::CSRF_COOKIE;
use crate::http::session::SESSION_COOKIE;
use crate::http::test_support::{
    TEST_INSTANT, TestContext, send, set_cookie_header, set_cookie_value,
};
use crate::http::{AppState, Config, CurrentUser, end_user_session};
use crate::shared::error::{ApiError, PROBLEM_JSON};
use crate::shared::test_support::unreachable_pool;

mod api_doc;
mod isolation;
mod migrations;
mod routes;
mod support;

async fn me(user: CurrentUser) -> String {
    user.user_id.to_string()
}

async fn sign_out(session: Session) -> Result<StatusCode, ApiError> {
    end_user_session(&session).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn echo() -> &'static str {
    "ok"
}

async fn ip(ClientIp(ip): ClientIp) -> String {
    ip.to_string()
}

fn api() -> Router<AppState> {
    Router::new()
        .route("/me", get(me))
        .route("/sign-out", post(sign_out))
        .route("/echo", post(echo))
        .route("/ip", get(ip))
}

fn get_request(uri: &str) -> Request<Body> {
    Request::get(uri).body(Body::empty()).unwrap()
}

fn with_config(ctx: &mut TestContext, change: impl FnOnce(&mut Config)) {
    let mut config = (*ctx.state.config).clone();
    change(&mut config);
    ctx.state.config = Arc::new(config);
}

#[tokio::test]
async fn healthz_returns_ok_with_database() {
    let ctx = TestContext::new().await;

    let (status, _, body) = send(&ctx.app(api()), get_request("/healthz")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({"status": "ok", "version": env!("CARGO_PKG_VERSION"), "database": "ok"})
    );
}

#[tokio::test]
async fn healthz_returns_503_without_database() {
    let mut ctx = TestContext::new().await;
    ctx.state.pool = unreachable_pool();

    let (status, _, body) = send(&ctx.app(api()), get_request("/healthz")).await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["database"], "unavailable");
}

#[tokio::test]
async fn healthz_is_also_served_under_api_v1() {
    let ctx = TestContext::new().await;

    let (status, _, body) = send(&ctx.app(api()), get_request("/api/v1/healthz")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["database"], "ok");
}

#[tokio::test]
async fn security_headers_are_present() {
    let ctx = TestContext::new().await;

    let (_, headers, _) = send(&ctx.app(api()), get_request("/api/v1/healthz")).await;

    let csp = headers[header::CONTENT_SECURITY_POLICY].to_str().unwrap();
    for directive in [
        "default-src 'self'",
        "script-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'none'",
    ] {
        assert!(csp.contains(directive), "CSP sem {directive}: {csp}");
    }
    assert!(!csp.contains("unsafe-inline"));
    assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(headers[header::REFERRER_POLICY], "same-origin");
    assert!(headers.contains_key("x-request-id"));
}

#[tokio::test]
async fn hsts_only_with_https_public_url() {
    let mut ctx = TestContext::new().await;
    let (_, https_headers, _) = send(&ctx.app(api()), get_request("/healthz")).await;

    with_config(&mut ctx, |config| {
        config.public_url = "http://atria.lan".to_owned()
    });
    let (_, http_headers, _) = send(&ctx.app(api()), get_request("/healthz")).await;

    assert_eq!(
        https_headers[header::STRICT_TRANSPORT_SECURITY],
        "max-age=31536000; includeSubDomains"
    );
    assert!(!http_headers.contains_key(header::STRICT_TRANSPORT_SECURITY));
}

#[tokio::test]
async fn session_cookie_is_http_only_secure_same_site() {
    let ctx = TestContext::new().await;

    let (_, headers, _) = send(&ctx.app(api()), get_request("/")).await;

    let cookie = set_cookie_header(&headers, SESSION_COOKIE).expect("cookie de sessão");
    for attribute in ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"] {
        assert!(
            cookie.contains(attribute),
            "cookie sem {attribute}: {cookie}"
        );
    }
}

#[tokio::test]
async fn start_user_session_rotates_session_id() {
    let ctx = TestContext::new().await;
    let app = ctx.app(api());
    let anonymous = ctx.anonymous().await;
    let user_id = Uuid::from_u128(7);

    let request = anonymous
        .request(Method::POST, &format!("/__test/sessions/{user_id}"))
        .body(Body::empty())
        .unwrap();
    let (status, headers, _) = send(&app, request).await;
    let old_id = anonymous.cookie.split(';').next().unwrap().to_owned();
    let new_id = set_cookie_value(&headers, SESSION_COOKIE).expect("novo id de sessão");
    let new_csrf = set_cookie_value(&headers, CSRF_COOKIE).expect("novo token CSRF");
    let (old_status, _, _) = send(
        &app,
        anonymous
            .request(Method::GET, "/api/v1/me")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_ne!(old_id, format!("{SESSION_COOKIE}={new_id}"));
    assert_ne!(new_csrf, anonymous.csrf_token);
    assert_eq!(
        old_status,
        StatusCode::UNAUTHORIZED,
        "o id antigo não autentica"
    );
}

#[tokio::test]
async fn end_user_session_invalidates_session() {
    let ctx = TestContext::new().await;
    let app = ctx.app(api());
    let session = ctx.sign_in_as(Uuid::from_u128(8)).await;

    let request = session
        .request(Method::POST, "/api/v1/sign-out")
        .body(Body::empty())
        .unwrap();
    let (status, _, _) = send(&app, request).await;
    let request = session
        .request(Method::GET, "/api/v1/me")
        .body(Body::empty())
        .unwrap();
    let (after, _, body) = send(&app, request).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(after, StatusCode::UNAUTHORIZED);
    assert_eq!(body["code"], "unauthenticated");
}

#[tokio::test]
async fn current_user_rejects_anonymous_with_401_problem() {
    let ctx = TestContext::new().await;
    let anonymous = ctx.anonymous().await;

    let request = anonymous
        .request(Method::GET, "/api/v1/me")
        .body(Body::empty())
        .unwrap();
    let (status, headers, body) = send(&ctx.app(api()), request).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(headers[header::CONTENT_TYPE], PROBLEM_JSON);
    assert_eq!(body["code"], "unauthenticated");
}

#[tokio::test]
async fn get_issues_csrf_cookie() {
    let ctx = TestContext::new().await;

    let (_, headers, _) = send(&ctx.app(api()), get_request("/")).await;

    let cookie = set_cookie_header(&headers, CSRF_COOKIE).expect("cookie do CSRF");
    assert!(
        !cookie.contains("HttpOnly"),
        "o frontend precisa ler: {cookie}"
    );
    for attribute in ["Secure", "SameSite=Strict", "Path=/"] {
        assert!(
            cookie.contains(attribute),
            "cookie sem {attribute}: {cookie}"
        );
    }
    let token = set_cookie_value(&headers, CSRF_COOKIE).unwrap();
    assert_eq!(token.len(), 43, "32 bytes em base64url");
}

#[tokio::test]
async fn mutation_without_csrf_token_is_rejected_with_403_problem() {
    let ctx = TestContext::new().await;
    let session = ctx.sign_in_as(Uuid::from_u128(9)).await;

    let request = Request::post("/api/v1/echo")
        .header(header::COOKIE, &session.cookie)
        .body(Body::empty())
        .unwrap();
    let (status, headers, body) = send(&ctx.app(api()), request).await;
    let wrong = Request::post("/api/v1/echo")
        .header(header::COOKIE, &session.cookie)
        .header("x-csrf-token", "outro-token")
        .body(Body::empty())
        .unwrap();
    let (wrong_status, _, _) = send(&ctx.app(api()), wrong).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(headers[header::CONTENT_TYPE], PROBLEM_JSON);
    assert_eq!(body["code"], "csrf_invalid");
    assert_eq!(wrong_status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn mutation_with_valid_csrf_token_passes() {
    let ctx = TestContext::new().await;
    let session = ctx.anonymous().await;

    let request = session
        .request(Method::POST, "/api/v1/echo")
        .body(Body::empty())
        .unwrap();
    let (status, _, _) = send(&ctx.app(api()), request).await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn mutation_with_foreign_origin_is_rejected() {
    let ctx = TestContext::new().await;
    let session = ctx.sign_in_as(Uuid::from_u128(10)).await;

    let mut request = session
        .request(Method::POST, "/api/v1/echo")
        .body(Body::empty())
        .unwrap();
    request
        .headers_mut()
        .insert(header::ORIGIN, "https://evil.test".parse().unwrap());
    let (status, _, body) = send(&ctx.app(api()), request).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["code"], "csrf_invalid");
}

fn ip_request(peer: [u8; 4], forwarded_for: &str) -> Request<Body> {
    Request::get("/api/v1/ip")
        .header("x-forwarded-for", forwarded_for)
        .extension(ConnectInfo(SocketAddr::from((peer, 40000))))
        .body(Body::empty())
        .unwrap()
}

async fn body_text(app: &Router, request: Request<Body>) -> String {
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let response = app.clone().oneshot(request).await.unwrap();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[tokio::test]
async fn forwarded_for_is_ignored_from_untrusted_peer() {
    let mut ctx = TestContext::new().await;
    with_config(&mut ctx, |config| {
        config.trusted_proxies = vec!["10.0.0.0/8".parse().unwrap()]
    });

    let ip = body_text(
        &ctx.app(api()),
        ip_request([203, 0, 113, 10], "198.51.100.7"),
    )
    .await;

    assert_eq!(ip, "203.0.113.10");
}

#[tokio::test]
async fn forwarded_for_is_used_from_trusted_proxy() {
    let mut ctx = TestContext::new().await;
    with_config(&mut ctx, |config| {
        config.trusted_proxies = vec!["10.0.0.0/8".parse().unwrap()]
    });

    let ip = body_text(
        &ctx.app(api()),
        ip_request([10, 0, 0, 5], "192.0.2.1, 198.51.100.7, 10.0.0.9"),
    )
    .await;

    assert_eq!(
        ip, "198.51.100.7",
        "o último endereço fora dos proxies confiáveis"
    );
}

fn vars(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
    let pairs: Vec<(String, String)> = pairs
        .iter()
        .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
        .collect();
    move |name| {
        pairs
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.clone())
    }
}

const BASE_VARS: [(&str, &str); 3] = [
    (
        "ATRIA_DATABASE_URL",
        "postgres://atria:senha-do-banco@db:5432/atria",
    ),
    ("ATRIA_PUBLIC_URL", "https://atria.example.com"),
    ("ATRIA_ENCRYPTION_KEY_FILE", "/run/secrets/atria_key"),
];

#[test]
fn config_requires_public_url_and_key_file() {
    let without_url = vars(&[BASE_VARS[0], BASE_VARS[2]]);
    let without_key = vars(&[BASE_VARS[0], BASE_VARS[1]]);
    let invalid_url = vars(&[
        BASE_VARS[0],
        ("ATRIA_PUBLIC_URL", "atria.example.com"),
        BASE_VARS[2],
    ]);

    assert_eq!(
        Config::from_vars(without_url),
        Err(ConfigError::Missing("ATRIA_PUBLIC_URL"))
    );
    assert_eq!(
        Config::from_vars(without_key),
        Err(ConfigError::Missing("ATRIA_ENCRYPTION_KEY_FILE"))
    );
    assert_eq!(
        Config::from_vars(invalid_url),
        Err(ConfigError::Invalid("ATRIA_PUBLIC_URL"))
    );
    let config = Config::from_vars(vars(&BASE_VARS)).unwrap();
    assert_eq!(config.bind_address.to_string(), "0.0.0.0:8080");
    assert_eq!(config.storage_path.to_str(), Some("/data/files"));
    assert!(config.trusted_proxies.is_empty());
    assert_eq!(config.log_level, "info");
    assert!(config.smtp.is_none());
    assert_eq!(config.public_origin(), "https://atria.example.com");
    assert!(config.is_https());
}

#[test]
fn config_debug_redacts_secrets() {
    let mut password_file = tempfile::NamedTempFile::new().unwrap();
    std::io::Write::write_all(&mut password_file, b"senha-do-smtp\n").unwrap();
    let path = password_file.path().to_str().unwrap().to_owned();
    let mut pairs = BASE_VARS.to_vec();
    pairs.extend([
        ("ATRIA_SMTP_HOST", "smtp.example.com"),
        ("ATRIA_SMTP_USER", "atria"),
        ("ATRIA_SMTP_PASSWORD_FILE", path.as_str()),
        ("ATRIA_TRUSTED_PROXIES", "10.0.0.0/8, 192.168.1.1"),
    ]);

    let config = Config::from_vars(vars(&pairs)).unwrap();
    let debug = format!("{config:?}");

    let smtp = config.smtp.as_ref().unwrap();
    assert_eq!(smtp.port, 587);
    assert_eq!(smtp.password.as_deref(), Some("senha-do-smtp"));
    assert_eq!(config.trusted_proxies.len(), 2);
    assert!(!debug.contains("senha-do-banco"), "{debug}");
    assert!(!debug.contains("senha-do-smtp"), "{debug}");
    assert!(debug.contains("smtp.example.com"));
}

#[tokio::test]
async fn test_support_sign_in_as_creates_authenticated_session() {
    let ctx = TestContext::new().await;
    let user_id = Uuid::from_u128(11);
    let session = ctx.sign_in_as(user_id).await;

    let request = session
        .request(Method::GET, "/api/v1/me")
        .body(Body::empty())
        .unwrap();
    let (status, _, _) = send(&ctx.app(api()), request).await;
    let text = body_text(
        &ctx.app(api()),
        session
            .request(Method::GET, "/api/v1/me")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let json_request = session.json(Method::POST, "/api/v1/echo", &json!({"a": 1}));
    let (echo_status, _, _) = send(&ctx.app(api()), json_request).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(text, user_id.to_string());
    assert_eq!(echo_status, StatusCode::OK);
    assert!(session.cookie.contains(SESSION_COOKIE));
    let expected: chrono::DateTime<chrono::Utc> = TEST_INSTANT.parse().unwrap();
    assert_eq!(ctx.state.clock.now(), expected);
    ctx.clock.advance(chrono::Duration::hours(1));
    assert_eq!(ctx.state.clock.now(), expected + chrono::Duration::hours(1));
}

/// O hyper descarta o handler quando o cliente desconecta. No meio de uma transação, a
/// conexão podia voltar ao pool com ela aberta, e as escritas seguintes ficavam invisíveis
/// ou se perdiam (TASK-35, ajuste 9). A requisição agora roda até o fim.
#[tokio::test]
async fn request_runs_to_completion_after_client_disconnects() {
    use std::time::Duration;
    use tokio::sync::Notify;
    use tower::ServiceExt;

    let ctx = TestContext::new().await;
    let pool = ctx.state.pool.clone();
    sqlx::query("CREATE TABLE run_to_completion_probe (id int)")
        .execute(&pool)
        .await
        .unwrap();
    let started = Arc::new(Notify::new());
    let handler_pool = pool.clone();
    let handler_started = started.clone();
    let slow = Router::new().route(
        "/slow-write",
        post(move || {
            let pool = handler_pool.clone();
            let started = handler_started.clone();
            async move {
                let mut tx = pool.begin().await.unwrap();
                started.notify_one();
                tokio::time::sleep(Duration::from_millis(200)).await;
                sqlx::query("INSERT INTO run_to_completion_probe VALUES (1)")
                    .execute(&mut *tx)
                    .await
                    .unwrap();
                tx.commit().await.unwrap();
                StatusCode::NO_CONTENT
            }
        }),
    );
    let session = ctx.anonymous().await;
    let app = ctx.app(slow);
    let request = session
        .request(Method::POST, "/api/v1/slow-write")
        .body(Body::empty())
        .unwrap();

    // O cliente desconecta com a transação aberta: o hyper descarta o futuro da requisição.
    let client = tokio::spawn(app.oneshot(request));
    started.notified().await;
    client.abort();
    tokio::time::sleep(Duration::from_millis(600)).await;

    let written: i64 = sqlx::query_scalar("SELECT count(*) FROM run_to_completion_probe")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        written, 1,
        "a requisição cancelada não terminou a transação"
    );
}
