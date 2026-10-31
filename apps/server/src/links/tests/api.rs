use axum::http::{Method, StatusCode};
use axum::{Extension, Router};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::test_support::{TestContext, TestSession, send};
use crate::links;
use crate::links::EntityDeletedHook;
use crate::shared::db::begin_for_user;
use crate::shared::error::PROBLEM_JSON;

const ALICE: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0001);
const BOB: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0002);
const NOTE: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_000a_0001);
const GOAL: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_000a_0002);
const BOOK: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_000a_0003);
const TASK: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_000a_0004);

struct Harness {
    ctx: TestContext,
    app: Router,
}

async fn harness_with(api: Router<crate::http::AppState>) -> Harness {
    let ctx = TestContext::new().await;
    links::migrator()
        .run(&ctx.state.pool)
        .await
        .expect("migrações de links");
    let app = ctx.app(api);
    Harness { ctx, app }
}

async fn harness() -> Harness {
    harness_with(links::router()).await
}

async fn post_link(h: &Harness, session: &TestSession, body: Value) -> (StatusCode, Value) {
    let (status, _, json) = send(&h.app, session.json(Method::POST, "/api/v1/links", &body)).await;
    (status, json)
}

fn link_body(source: (&str, Uuid), target: (&str, Uuid)) -> Value {
    json!({
        "source_type": source.0, "source_id": source.1,
        "target_type": target.0, "target_id": target.1,
    })
}

async fn get(h: &Harness, session: &TestSession, uri: &str) -> (StatusCode, Value) {
    let request = session
        .request(Method::GET, uri)
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, _, json) = send(&h.app, request).await;
    (status, json)
}

async fn delete(h: &Harness, session: &TestSession, uri: &str) -> (StatusCode, Value) {
    let request = session
        .request(Method::DELETE, uri)
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, _, json) = send(&h.app, request).await;
    (status, json)
}

async fn list(h: &Harness, session: &TestSession, kind: &str, id: Uuid) -> Value {
    let (status, json) = get(
        h,
        session,
        &format!("/api/v1/links?entity_type={kind}&entity_id={id}"),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{json}");
    json
}

async fn count_links(h: &Harness, owner: Uuid) -> i64 {
    let mut tx = begin_for_user(&h.ctx.state.pool, owner).await.unwrap();
    sqlx::query_scalar("SELECT count(*) FROM links")
        .fetch_one(&mut *tx)
        .await
        .unwrap()
}

#[tokio::test]
async fn ct13_link_note_to_goal_appears_on_both_sides() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;

    let (status, created) = post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["source_type"], "goal");
    assert_eq!(created["target_type"], "note");

    let from_note = list(&h, &alice, "note", NOTE).await;
    let from_goal = list(&h, &alice, "goal", GOAL).await;
    assert_eq!(from_note["items"].as_array().unwrap().len(), 1);
    assert_eq!(from_note["items"][0]["id"], from_goal["items"][0]["id"]);
    assert_eq!(from_note["items"][0]["linked_type"], "goal");
    assert_eq!(from_note["items"][0]["linked_id"], GOAL.to_string());
    assert_eq!(from_goal["items"][0]["linked_type"], "note");
    assert_eq!(from_goal["items"][0]["linked_id"], NOTE.to_string());
    assert!(from_note["next_cursor"].is_null());
}

#[tokio::test]
async fn ct13_removing_link_from_goal_side_removes_from_both() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;

    let from_goal = list(&h, &alice, "goal", GOAL).await;
    let id = from_goal["items"][0]["id"].as_str().unwrap().to_owned();
    let (status, _) = delete(&h, &alice, &format!("/api/v1/links/{id}")).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(
        list(&h, &alice, "goal", GOAL).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert!(
        list(&h, &alice, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn rn10_reverse_duplicate_link_returns_409() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;

    let (status, json) = post_link(&h, &alice, link_body(("goal", GOAL), ("note", NOTE))).await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(json["code"], "link_already_exists");
    assert_eq!(count_links(&h, ALICE).await, 1);
}

#[tokio::test]
async fn self_link_returns_422() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;

    let (status, json) = post_link(&h, &alice, link_body(("note", NOTE), ("note", NOTE))).await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(json["code"], "self_link");
    assert_eq!(count_links(&h, ALICE).await, 0);
}

#[tokio::test]
async fn unknown_entity_type_returns_422() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;

    let (status, json) =
        post_link(&h, &alice, link_body(("spaceship", NOTE), ("goal", GOAL))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(json["code"], "unknown_entity_type");

    let (status, json) = get(
        &h,
        &alice,
        &format!("/api/v1/links?entity_type=nope&entity_id={NOTE}"),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(json["code"], "unknown_entity_type");

    let (status, json) = get(&h, &alice, "/api/v1/links").await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(json["code"], "validation_failed");
}

#[tokio::test]
async fn listing_filters_by_linked_type_and_paginates_by_cursor() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    for other in [("goal", GOAL), ("book", BOOK), ("task", TASK)] {
        h.ctx.clock.advance(chrono::Duration::seconds(1));
        let (status, json) = post_link(&h, &alice, link_body(("note", NOTE), other)).await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
    }

    let (_, only_books) = get(
        &h,
        &alice,
        &format!("/api/v1/links?entity_type=note&entity_id={NOTE}&linked_type=book"),
    )
    .await;
    assert_eq!(only_books["items"].as_array().unwrap().len(), 1);
    assert_eq!(only_books["items"][0]["linked_type"], "book");

    let base = format!("/api/v1/links?entity_type=note&entity_id={NOTE}&limit=2");
    let (_, first) = get(&h, &alice, &base).await;
    assert_eq!(first["items"].as_array().unwrap().len(), 2);
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let (_, second) = get(&h, &alice, &format!("{base}&cursor={cursor}")).await;
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert!(second["next_cursor"].is_null());
    // Mais recente primeiro: task, book, goal.
    let kinds: Vec<&str> = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .chain(second["items"].as_array().unwrap())
        .map(|item| item["linked_type"].as_str().unwrap())
        .collect();
    assert_eq!(kinds, ["task", "book", "goal"]);

    let (status, json) = get(&h, &alice, &format!("{base}&cursor=lixo")).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(json["code"], "validation_failed");
    let (status, _) = get(
        &h,
        &alice,
        &format!("/api/v1/links?entity_type=note&entity_id={NOTE}&limit=0"),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn other_user_links_are_invisible_and_delete_returns_404() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let (_, created) = post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;
    let id = created["id"].as_str().unwrap();

    assert!(
        list(&h, &bob, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let (status, json) = delete(&h, &bob, &format!("/api/v1/links/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(json["code"], "link_not_found");
    let (status, _) = delete(&h, &bob, "/api/v1/links/nao-e-uuid").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(
        list(&h, &alice, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // A mesma ligação do outro dono é independente (a unicidade inclui o dono).
    let (status, _) = post_link(&h, &bob, link_body(("note", NOTE), ("goal", GOAL))).await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, headers, _) = send(
        &h.app,
        alice
            .request(
                Method::DELETE,
                "/api/v1/links/00000000-0000-0000-0000-000000000000",
            )
            .body(axum::body::Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(headers.get("content-type").unwrap(), PROBLEM_JSON);
}

#[tokio::test]
async fn cb06_remove_links_for_entity_clears_both_sides() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    // NOTE é destino num caso e origem no outro; BOOK-TASK é de outra entidade.
    post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;
    post_link(&h, &alice, link_body(("note", NOTE), ("task", TASK))).await;
    post_link(&h, &alice, link_body(("book", BOOK), ("task", TASK))).await;
    post_link(&h, &bob, link_body(("note", NOTE), ("goal", GOAL))).await;

    let removed = links::remove_links_for_entity(&h.ctx.state.pool, ALICE, "note", NOTE)
        .await
        .unwrap();
    let unknown = links::remove_links_for_entity(&h.ctx.state.pool, ALICE, "spaceship", NOTE)
        .await
        .unwrap();

    assert_eq!(removed, 2);
    assert_eq!(unknown, 0);
    assert!(
        list(&h, &alice, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert!(
        list(&h, &alice, "goal", GOAL).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        list(&h, &alice, "task", TASK).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        list(&h, &bob, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn cb06_entity_deleted_hook_removes_links() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;
    let hook: EntityDeletedHook = links::entity_deleted_hook(h.ctx.state.pool.clone());

    hook(ALICE, "note", NOTE).await;

    assert!(
        list(&h, &alice, "note", NOTE).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert!(
        list(&h, &alice, "goal", GOAL).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    // O mesmo tipo de `Extension` que os outros contextos usam chega ao app.
    let _ = Router::<crate::http::AppState>::new().layer(Extension(hook));
}

#[tokio::test]
async fn rls_is_enabled_on_links_table() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    post_link(&h, &alice, link_body(("note", NOTE), ("goal", GOAL))).await;

    let (enabled, forced): (bool, bool) = sqlx::query_as(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'links'",
    )
    .fetch_one(&h.ctx.state.pool)
    .await
    .unwrap();
    let without_user: i64 = sqlx::query_scalar("SELECT count(*) FROM links")
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();

    assert!(enabled && forced);
    assert_eq!(without_user, 0);
    assert_eq!(count_links(&h, BOB).await, 0);
    assert_eq!(count_links(&h, ALICE).await, 1);
}
