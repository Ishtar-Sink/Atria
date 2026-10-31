//! Isolamento entre usuários: 404 para dado alheio, RLS ativa e CSRF (RNF-01, RNF-02).

use axum::body::Body;
use axum::http::{Method, Request, StatusCode, header};
use serde_json::json;
use uuid::Uuid;

use super::{ALICE, BOB, TestApp};
use crate::http::csrf::CSRF_HEADER;
use crate::http::test_support::{TEST_PUBLIC_URL, send};
use crate::shared::db::begin_for_user;

#[tokio::test]
async fn other_user_goal_and_milestones_return_404() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(&t.alice, json!({ "title": "Da Alice" }))
        .await;
    let goal_id = goal["id"].as_str().unwrap();
    let milestone = t.create_milestone(&t.alice, goal_id, "Marco").await;
    let milestone_id = milestone["id"].as_str().unwrap();
    let goal_uri = format!("/api/v1/goals/{goal_id}");
    let milestones_uri = format!("{goal_uri}/milestones");
    let milestone_uri = format!("{milestones_uri}/{milestone_id}");
    let goal_patch = Some(json!({ "title": "Invasão" }));
    let milestone_patch = Some(json!({ "title": "Invasão", "completed": true }));
    let cases = [
        (Method::GET, goal_uri.clone(), None),
        (Method::PATCH, goal_uri.clone(), goal_patch),
        (Method::DELETE, goal_uri.clone(), None),
        (Method::GET, milestones_uri.clone(), None),
        (
            Method::POST,
            milestones_uri,
            Some(json!({ "title": "Invasão" })),
        ),
        (Method::PATCH, milestone_uri.clone(), milestone_patch),
        (Method::DELETE, milestone_uri, None),
    ];

    for (method, uri, body) in cases {
        let (status, problem) = t.call(&t.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
        assert_eq!(problem["code"], "not_found");
    }

    let intact = t.get_goal(&t.alice, goal_id).await;
    let (_, bobs) = t.call(&t.bob, Method::GET, "/api/v1/goals", None).await;
    assert_eq!(intact["title"], "Da Alice");
    assert_eq!(intact["milestone_count"], 1);
    assert_eq!(intact["completed_milestone_count"], 0);
    assert!(bobs["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn unauthenticated_request_returns_401() {
    let t = TestApp::new().await;
    let anonymous = t.ctx.anonymous().await;

    let (status, problem) = t.call(&anonymous, Method::GET, "/api/v1/goals", None).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(problem["code"], "unauthenticated");
}

#[tokio::test]
async fn row_level_security_hides_other_owner_rows() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(&t.alice, json!({ "title": "Da Alice" }))
        .await;
    t.create_milestone(&t.alice, goal["id"].as_str().unwrap(), "Marco")
        .await;
    let pool = &t.ctx.state.pool;

    let forced: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT relname::text, relrowsecurity, relforcerowsecurity FROM pg_class \
         WHERE relname IN ('goals', 'milestones') ORDER BY relname",
    )
    .fetch_all(pool)
    .await
    .unwrap();
    let count = |table: &'static str, user: Option<Uuid>| async move {
        let sql = format!("SELECT count(*) FROM {table}");
        match user {
            Some(user) => {
                let mut tx = begin_for_user(pool, user).await.unwrap();
                sqlx::query_scalar::<_, i64>(&sql)
                    .fetch_one(&mut *tx)
                    .await
                    .unwrap()
            }
            None => sqlx::query_scalar::<_, i64>(&sql)
                .fetch_one(pool)
                .await
                .unwrap(),
        }
    };
    let mut tx = begin_for_user(pool, BOB).await.unwrap();
    let foreign_insert = sqlx::query(
        "INSERT INTO goals (id, owner_id, title, created_at, updated_at) \
         VALUES ($1, $2, 'x', now(), now())",
    )
    .bind(Uuid::from_u128(99))
    .bind(ALICE)
    .execute(&mut *tx)
    .await;
    drop(tx);

    assert_eq!(
        forced,
        [
            ("goals".to_owned(), true, true),
            ("milestones".to_owned(), true, true)
        ]
    );
    assert_eq!(count("goals", Some(ALICE)).await, 1);
    assert_eq!(count("milestones", Some(ALICE)).await, 1);
    assert_eq!(count("goals", Some(BOB)).await, 0);
    assert_eq!(count("milestones", Some(BOB)).await, 0);
    assert_eq!(count("goals", None).await, 0);
    assert!(foreign_insert.is_err());
}

#[tokio::test]
async fn mutation_without_csrf_is_refused() {
    let t = TestApp::new().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let goal_id = goal["id"].as_str().unwrap();

    let without_header = Request::builder()
        .method(Method::POST)
        .uri("/api/v1/goals")
        .header(header::COOKIE, &t.alice.cookie)
        .header(header::ORIGIN, TEST_PUBLIC_URL)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "title": "Sem token" }).to_string()))
        .unwrap();
    let wrong_origin = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/v1/goals/{goal_id}"))
        .header(header::COOKIE, &t.alice.cookie)
        .header(CSRF_HEADER, &t.alice.csrf_token)
        .header(header::ORIGIN, "https://evil.test")
        .body(Body::empty())
        .unwrap();
    let (created, _, problem) = send(&t.app, without_header).await;
    let (deleted, _, _) = send(&t.app, wrong_origin).await;

    assert_eq!(created, StatusCode::FORBIDDEN);
    assert_eq!(problem["code"], "csrf_invalid");
    assert_eq!(deleted, StatusCode::FORBIDDEN);
    assert_eq!(t.get_goal(&t.alice, goal_id).await["title"], "Meta");
}

#[tokio::test]
async fn goal_label_filter_ignores_other_user_goals() {
    let t = TestApp::new().await;
    t.create_goal(
        &t.alice,
        json!({ "title": "Da Alice", "labels": ["casa"], "deadline": "2027-01-01" }),
    )
    .await;

    let (by_label, labeled) = t
        .call(&t.bob, Method::GET, "/api/v1/goals?label=casa", None)
        .await;
    let (by_deadline, dated) = t
        .call(&t.bob, Method::GET, "/api/v1/goals?has_deadline=true", None)
        .await;

    assert_eq!(by_label, StatusCode::OK);
    assert!(labeled["items"].as_array().unwrap().is_empty());
    assert_eq!(by_deadline, StatusCode::OK);
    assert!(dated["items"].as_array().unwrap().is_empty());
}
