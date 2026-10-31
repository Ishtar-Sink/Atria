use std::sync::{Arc, Mutex};

use axum::http::{Method, StatusCode, header};
use axum::{Extension, Router};
use chrono::Duration;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::test_support::{TestContext, TestSession, send};
use crate::notes;
use crate::notes::application::ports::EntityDeletedHook;
use crate::notes::{DecryptedNote, NoteReader};
use crate::shared::db::begin_for_user;
use crate::shared::error::PROBLEM_JSON;
use crate::shared::visibility::Visibility;

const ALICE: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0001);
const BOB: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0002);

struct Harness {
    ctx: TestContext,
    app: Router,
}

async fn harness_with(api: Router<crate::http::AppState>) -> Harness {
    let ctx = TestContext::new().await;
    notes::migrator()
        .run(&ctx.state.pool)
        .await
        .expect("migrações de notas");
    let app = ctx.app(api);
    Harness { ctx, app }
}

async fn harness() -> Harness {
    harness_with(notes::router()).await
}

async fn create(h: &Harness, session: &TestSession, body: Value) -> Value {
    let (status, _, json) = send(&h.app, session.json(Method::POST, "/api/v1/notes", &body)).await;
    assert_eq!(status, StatusCode::CREATED, "{json}");
    json
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

fn ids(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["id"].as_str().unwrap().to_owned())
        .collect()
}

#[tokio::test]
async fn ct26_note_lifecycle_create_edit_delete() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;

    let created = create(
        &h,
        &alice,
        json!({ "title": "  Ideias  ", "body": "primeira versão" }),
    )
    .await;
    let id = created["id"].as_str().unwrap().to_owned();
    assert_eq!(created["title"], "Ideias");
    assert_eq!(created["owner_id"], ALICE.to_string());
    assert_eq!(created["visibility"], "personal");
    assert_eq!(created["created_at"], "2026-11-01T12:00:00Z");

    h.ctx.clock.advance(Duration::hours(1));
    let patch = json!({ "title": "Ideias revistas", "visibility": "shared" });
    let (status, _, edited) = send(
        &h.app,
        alice.json(Method::PATCH, &format!("/api/v1/notes/{id}"), &patch),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{edited}");
    assert_eq!(edited["title"], "Ideias revistas");
    assert_eq!(edited["body"], "primeira versão");
    assert_eq!(edited["visibility"], "shared");
    assert_eq!(edited["updated_at"], "2026-11-01T13:00:00Z");

    let (status, read) = get(&h, &alice, &format!("/api/v1/notes/{id}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["title"], "Ideias revistas");

    let (status, _) = delete(&h, &alice, &format!("/api/v1/notes/{id}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, problem) = get(&h, &alice, &format!("/api/v1/notes/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "note_not_found");
    let (status, page) = get(&h, &alice, "/api/v1/notes").await;
    assert_eq!(status, StatusCode::OK);
    assert!(ids(&page).is_empty());
    let (status, _) = delete(&h, &alice, &format!("/api/v1/notes/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rnf03_note_content_is_not_stored_in_plain_text() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let marker = "marcador-secreto-ct26";
    let created = create(
        &h,
        &alice,
        json!({ "title": format!("Título {marker}"), "body": format!("Corpo {marker}") }),
    )
    .await;

    let mut tx = begin_for_user(&h.ctx.state.pool, ALICE).await.unwrap();
    let rows: Vec<(Vec<u8>, Vec<u8>)> =
        sqlx::query_as("SELECT title_ciphertext, body_ciphertext FROM notes")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();

    assert_eq!(rows.len(), 1);
    let needle = marker.as_bytes();
    for (title, body) in &rows {
        assert!(!title.windows(needle.len()).any(|w| w == needle));
        assert!(!body.windows(needle.len()).any(|w| w == needle));
    }
    let id = created["id"].as_str().unwrap();
    let (_, read) = get(&h, &alice, &format!("/api/v1/notes/{id}")).await;
    assert_eq!(read["title"], format!("Título {marker}"));
    assert_eq!(read["body"], format!("Corpo {marker}"));
}

#[tokio::test]
async fn other_user_note_returns_404_on_get_patch_delete() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let created = create(&h, &alice, json!({ "title": "Da Alice", "body": "" })).await;
    let uri = format!("/api/v1/notes/{}", created["id"].as_str().unwrap());

    let (status, problem) = get(&h, &bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "note_not_found");
    let (status, _, problem) = send(
        &h.app,
        bob.json(Method::PATCH, &uri, &json!({ "title": "Do Bob" })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "note_not_found");
    let (status, problem) = delete(&h, &bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "note_not_found");
    let (_, page) = get(&h, &bob, "/api/v1/notes").await;
    assert!(ids(&page).is_empty());

    let (status, read) = get(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["title"], "Da Alice");
}

#[tokio::test]
async fn listing_paginates_by_cursor_and_filters_by_visibility() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let mut created = Vec::new();
    for (title, visibility) in [
        ("Primeira", "personal"),
        ("Segunda", "shared"),
        ("Terceira", "personal"),
    ] {
        let note = create(
            &h,
            &alice,
            json!({ "title": title, "body": "", "visibility": visibility }),
        )
        .await;
        created.push(note["id"].as_str().unwrap().to_owned());
        h.ctx.clock.advance(Duration::minutes(5));
    }
    create(&h, &bob, json!({ "title": "Do Bob", "body": "" })).await;
    // Editar a primeira a coloca no topo da ordem por `updated_at`.
    let (status, _, _) = send(
        &h.app,
        alice.json(
            Method::PATCH,
            &format!("/api/v1/notes/{}", created[0]),
            &json!({ "body": "editada" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, first) = get(&h, &alice, "/api/v1/notes?limit=2").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ids(&first), [created[0].clone(), created[2].clone()]);
    let cursor = first["next_cursor"].as_str().unwrap();
    let (_, second) = get(
        &h,
        &alice,
        &format!("/api/v1/notes?limit=2&cursor={cursor}"),
    )
    .await;
    assert_eq!(ids(&second), [created[1].clone()]);
    assert!(second["next_cursor"].is_null());

    let (_, by_created) = get(&h, &alice, "/api/v1/notes?sort=created_at&limit=2").await;
    assert_eq!(ids(&by_created), [created[2].clone(), created[1].clone()]);
    let cursor = by_created["next_cursor"].as_str().unwrap();
    let (_, rest) = get(
        &h,
        &alice,
        &format!("/api/v1/notes?sort=created_at&limit=2&cursor={cursor}"),
    )
    .await;
    assert_eq!(ids(&rest), [created[0].clone()]);

    let (_, shared) = get(&h, &alice, "/api/v1/notes?visibility=shared").await;
    assert_eq!(ids(&shared), [created[1].clone()]);
    let (_, personal) = get(&h, &alice, "/api/v1/notes?visibility=personal").await;
    assert_eq!(ids(&personal), [created[0].clone(), created[2].clone()]);
}

#[tokio::test]
async fn invalid_payload_returns_problem_json() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let long_title = "a".repeat(201);
    let long_body = "a".repeat(100_001);
    let cases = [
        (json!({ "title": "   ", "body": "" }), "title", "required"),
        (
            json!({ "title": long_title, "body": "" }),
            "title",
            "too_long",
        ),
        (
            json!({ "title": "Ok", "body": long_body }),
            "body",
            "too_long",
        ),
        (json!({ "title": "Ok" }), "body", "invalid"),
        (
            json!({ "title": "Ok", "body": "", "visibility": "public" }),
            "body",
            "invalid",
        ),
    ];
    for (body, field, code) in cases {
        let (status, headers, problem) =
            send(&h.app, alice.json(Method::POST, "/api/v1/notes", &body)).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
        assert_eq!(headers.get(header::CONTENT_TYPE).unwrap(), PROBLEM_JSON);
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], field);
        assert_eq!(problem["errors"][0]["code"], code);
    }
    let malformed = alice
        .request(Method::POST, "/api/v1/notes")
        .header(header::CONTENT_TYPE, "application/json")
        .body(axum::body::Body::from("{ nao é json"))
        .unwrap();
    let (status, headers, _) = send(&h.app, malformed).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(headers.get(header::CONTENT_TYPE).unwrap(), PROBLEM_JSON);

    for (uri, field) in [
        ("/api/v1/notes?limit=0", "limit"),
        ("/api/v1/notes?limit=101", "limit"),
        ("/api/v1/notes?cursor=nao-e-cursor", "cursor"),
        ("/api/v1/notes?sort=title", "query"),
    ] {
        let (status, problem) = get(&h, &alice, uri).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}");
        assert_eq!(problem["errors"][0]["field"], field, "{uri}");
    }
    let (status, problem) = get(&h, &alice, "/api/v1/notes/nao-e-uuid").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "note_not_found");

    let anonymous = h.ctx.anonymous().await;
    let (status, _, _) = send(
        &h.app,
        anonymous.json(
            Method::POST,
            "/api/v1/notes",
            &json!({ "title": "x", "body": "" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

type Calls = Arc<Mutex<Vec<(Uuid, &'static str, Uuid)>>>;

fn recording_hook(calls: Calls) -> EntityDeletedHook {
    Arc::new(move |owner_id, entity_type, entity_id| {
        let calls = calls.clone();
        Box::pin(async move {
            calls
                .lock()
                .unwrap()
                .push((owner_id, entity_type, entity_id));
        })
    })
}

#[tokio::test]
async fn deleting_note_calls_entity_deleted_hook() {
    let calls: Calls = Arc::default();
    let h = harness_with(notes::router().layer(Extension(recording_hook(calls.clone())))).await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let created = create(&h, &alice, json!({ "title": "Ligada", "body": "" })).await;
    let id: Uuid = created["id"].as_str().unwrap().parse().unwrap();
    let uri = format!("/api/v1/notes/{id}");

    let (status, _) = delete(&h, &bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(calls.lock().unwrap().is_empty());

    let (status, _) = delete(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(*calls.lock().unwrap(), [(ALICE, "note", id)]);
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let created = create(&h, &alice, json!({ "title": "Sem gancho", "body": "" })).await;
    let uri = format!("/api/v1/notes/{}", created["id"].as_str().unwrap());

    let (status, _) = delete(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = get(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn note_reader_returns_only_own_live_notes_decrypted() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let kept = create(
        &h,
        &alice,
        json!({ "title": "Viagem", "body": "roteiro", "visibility": "shared" }),
    )
    .await;
    let removed = create(&h, &alice, json!({ "title": "Rascunho", "body": "" })).await;
    create(&h, &bob, json!({ "title": "Do Bob", "body": "segredo" })).await;
    let (status, _) = delete(
        &h,
        &alice,
        &format!("/api/v1/notes/{}", removed["id"].as_str().unwrap()),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let reader = NoteReader::from_state(&h.ctx.state);
    let notes: Vec<DecryptedNote> = reader.decrypted_notes_for_owner(ALICE).await.unwrap();

    assert_eq!(notes.len(), 1);
    let note = &notes[0];
    assert_eq!(note.id.to_string(), kept["id"].as_str().unwrap());
    assert_eq!(note.title, "Viagem");
    assert_eq!(note.body, "roteiro");
    assert_eq!(note.visibility, Visibility::Shared);
    assert_eq!(
        note.created_at,
        "2026-11-01T12:00:00Z"
            .parse::<chrono::DateTime<chrono::Utc>>()
            .unwrap()
    );
    let nobody = reader
        .decrypted_notes_for_owner(Uuid::from_u128(99))
        .await
        .unwrap();
    assert!(nobody.is_empty());
}

#[tokio::test]
async fn rls_is_enabled_on_notes_table() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    create(&h, &alice, json!({ "title": "Protegida", "body": "" })).await;

    let (enabled, forced): (bool, bool) = sqlx::query_as(
        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'notes'",
    )
    .fetch_one(&h.ctx.state.pool)
    .await
    .unwrap();
    let without_user: i64 = sqlx::query_scalar("SELECT count(*) FROM notes")
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();
    let mut tx = begin_for_user(&h.ctx.state.pool, BOB).await.unwrap();
    let as_bob: i64 = sqlx::query_scalar("SELECT count(*) FROM notes")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();

    assert!(enabled);
    assert!(forced);
    assert_eq!(without_user, 0);
    assert_eq!(as_bob, 0);
}
