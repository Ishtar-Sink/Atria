//! Isolamento entre usuários: 404 para dado alheio ([project/testing-03]), RLS
//! forçada ([project/database-09]) e CSRF nas mutações ([project/security-03]).

use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use serde_json::json;

use super::{ALICE, BOB, TestApp, daily_rule, id_of};
use crate::http::test_support::send;
use crate::shared::db::begin_for_user;

const TABLES: [&str; 3] = ["tasks", "task_recurrence_segments", "task_completions"];

#[tokio::test]
async fn other_user_task_returns_404() {
    let t = TestApp::new().await;
    let one_off = id_of(&t.create(&t.alice, json!({ "title": "Da Alice" })).await);
    let recurring = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Rotina da Alice", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    let attempts = [
        (Method::GET, format!("/api/v1/tasks/{one_off}"), None),
        (
            Method::PATCH,
            format!("/api/v1/tasks/{one_off}"),
            Some(json!({ "title": "Do Bob" })),
        ),
        (
            Method::POST,
            format!("/api/v1/tasks/{one_off}/completion"),
            Some(json!({})),
        ),
        (
            Method::POST,
            format!("/api/v1/tasks/{recurring}/completion"),
            Some(json!({ "occurrence_date": "2026-11-01" })),
        ),
        (
            Method::DELETE,
            format!("/api/v1/tasks/{recurring}/completion?occurrence_date=2026-11-01"),
            None,
        ),
        (Method::DELETE, format!("/api/v1/tasks/{one_off}"), None),
        (Method::GET, "/api/v1/tasks/not-a-uuid".to_owned(), None),
    ];

    for (method, uri, body) in attempts {
        let (status, problem) = t.call(&t.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
        assert_eq!(problem["code"], "not_found");
    }

    let (_, bob_list) = t.call(&t.bob, Method::GET, "/api/v1/tasks", None).await;
    assert_eq!(bob_list["items"], json!([]));
    assert!(
        t.occurrences(&t.bob, "2026-11-01", "2026-11-07")
            .await
            .is_empty()
    );
    let (status, still_there) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/tasks/{one_off}"),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(still_there["title"], "Da Alice");
    assert_eq!(still_there["completed_at"], serde_json::Value::Null);
}

#[tokio::test]
async fn row_level_security_hides_other_owner_rows() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Rotina", "recurrence": daily_rule("2026-11-01") }),
        )
        .await,
    );
    t.call(
        &t.alice,
        Method::POST,
        &format!("/api/v1/tasks/{id}/completion"),
        Some(json!({ "occurrence_date": "2026-11-01" })),
    )
    .await;
    let pool = &t.ctx.state.pool;

    for table in TABLES {
        let count = format!("SELECT count(*) FROM {table}");
        let mut alice = begin_for_user(pool, ALICE).await.unwrap();
        let seen_by_alice: i64 = sqlx::query_scalar(&count)
            .fetch_one(&mut *alice)
            .await
            .unwrap();
        let mut bob = begin_for_user(pool, BOB).await.unwrap();
        let seen_by_bob: i64 = sqlx::query_scalar(&count)
            .fetch_one(&mut *bob)
            .await
            .unwrap();
        let anonymous: i64 = sqlx::query_scalar(&count).fetch_one(pool).await.unwrap();
        let forced: bool = sqlx::query_scalar(
            "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname = $1",
        )
        .bind(table)
        .fetch_one(pool)
        .await
        .unwrap();

        assert_eq!(seen_by_alice, 1, "{table}");
        assert_eq!(seen_by_bob, 0, "{table}");
        assert_eq!(anonymous, 0, "{table}");
        assert!(forced, "{table}");
    }
    let mut bob = begin_for_user(pool, BOB).await.unwrap();
    let foreign_insert = sqlx::query(
        "INSERT INTO tasks (id, owner_id, title, created_at, updated_at) \
         VALUES (gen_random_uuid(), $1, 'Intrusa', now(), now())",
    )
    .bind(ALICE)
    .execute(&mut *bob)
    .await;
    assert!(foreign_insert.is_err());
}

#[tokio::test]
async fn mutation_without_csrf_is_refused() {
    let t = TestApp::new().await;
    let request = Request::post("/api/v1/tasks")
        .header(header::COOKIE, &t.alice.cookie)
        .header(header::ORIGIN, crate::http::test_support::TEST_PUBLIC_URL)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "title": "Sem CSRF" }).to_string()))
        .unwrap();

    let (status, _, problem) = send(&t.app, request).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(problem["code"], "csrf_invalid");
    let (_, list) = t.call(&t.alice, Method::GET, "/api/v1/tasks", None).await;
    assert_eq!(list["items"], json!([]));
    let anonymous = t.ctx.anonymous().await;
    let (status, problem) = t.call(&anonymous, Method::GET, "/api/v1/tasks", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(problem["code"], "unauthenticated");
}

#[tokio::test]
async fn task_label_filter_ignores_other_user_tasks() {
    let t = TestApp::new().await;
    let id = id_of(
        &t.create(
            &t.alice,
            json!({ "title": "Arrumar a garagem", "labels": ["casa"] }),
        )
        .await,
    );

    let (status, bob_page) = t
        .call(&t.bob, Method::GET, "/api/v1/tasks?label=casa", None)
        .await;
    assert_eq!(status, StatusCode::OK, "{bob_page}");
    assert_eq!(bob_page["items"], json!([]));
    assert_eq!(bob_page["next_cursor"], serde_json::Value::Null);
    let (_, alice_page) = t
        .call(&t.alice, Method::GET, "/api/v1/tasks?label=casa", None)
        .await;
    assert_eq!(alice_page["items"][0]["id"], id);
}
