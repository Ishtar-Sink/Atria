use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{Method, StatusCode};
use axum::{Extension, Router};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::AppState;
use crate::http::test_support::{TestContext, TestSession, send};
use crate::journal;
use crate::journal::application::ports::EntityDeletedHook;
use crate::journal::domain::emotion::SystemEmotion;
use crate::journal::{DecryptedJournalEntry, JournalReader};
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

const ALICE: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0001);
const BOB: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0002);
const ENTRIES: &str = "/api/v1/journal-entries";
const EMOTIONS: &str = "/api/v1/emotions";

struct Harness {
    ctx: TestContext,
    app: Router,
}

async fn harness_with(api: Router<AppState>) -> Harness {
    let ctx = TestContext::new().await;
    journal::migrator()
        .run(&ctx.state.pool)
        .await
        .expect("migrações do diário");
    let app = ctx.app(api);
    Harness { ctx, app }
}

async fn harness() -> Harness {
    harness_with(journal::router()).await
}

async fn call(
    h: &Harness,
    session: &TestSession,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let request = match body {
        Some(body) => session.json(method, uri, &body),
        None => session.request(method, uri).body(Body::empty()).unwrap(),
    };
    let (status, _, json) = send(&h.app, request).await;
    (status, json)
}

async fn get(h: &Harness, session: &TestSession, uri: &str) -> (StatusCode, Value) {
    call(h, session, Method::GET, uri, None).await
}

async fn delete(h: &Harness, session: &TestSession, uri: &str) -> (StatusCode, Value) {
    call(h, session, Method::DELETE, uri, None).await
}

async fn create_entry(h: &Harness, session: &TestSession, body: Value) -> Value {
    let (status, json) = call(h, session, Method::POST, ENTRIES, Some(body)).await;
    assert_eq!(status, StatusCode::CREATED, "{json}");
    json
}

async fn create_emotion(h: &Harness, session: &TestSession, name: &str) -> Value {
    let body = json!({ "name": name });
    let (status, json) = call(h, session, Method::POST, EMOTIONS, Some(body)).await;
    assert_eq!(status, StatusCode::CREATED, "{json}");
    json
}

/// Lista as emoções; a primeira chamada semeia a lista padrão.
async fn emotions(h: &Harness, session: &TestSession) -> Vec<Value> {
    let (status, json) = get(h, session, EMOTIONS).await;
    assert_eq!(status, StatusCode::OK, "{json}");
    json["items"].as_array().unwrap().clone()
}

fn system_id(list: &[Value], key: SystemEmotion) -> String {
    list.iter()
        .find(|emotion| emotion["system_key"] == key.key())
        .map(|emotion| emotion["id"].as_str().unwrap().to_owned())
        .unwrap()
}

fn ids(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["id"].as_str().unwrap().to_owned())
        .collect()
}

fn id_of(value: &Value) -> String {
    value["id"].as_str().unwrap().to_owned()
}

fn instant(text: &str) -> DateTime<Utc> {
    text.parse().unwrap()
}

#[tokio::test]
async fn ct27_two_entries_same_day_with_emotions_and_intensity() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let list = emotions(&h, &alice).await;
    let anxiety = system_id(&list, SystemEmotion::Anxiety);
    let joy = system_id(&list, SystemEmotion::Joy);
    let calm = system_id(&list, SystemEmotion::Calm);

    let morning = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T08:00:00Z",
            "text": "Paguei o aluguel e fiquei apreensiva.",
            "emotions": [{ "emotion_id": anxiety, "intensity": 4 }],
        }),
    )
    .await;
    let night = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T18:30:00-03:00",
            "text": "Jantar com amigos.",
            "emotions": [{ "emotion_id": joy }, { "emotion_id": calm }],
        }),
    )
    .await;
    assert_eq!(morning["owner_id"], ALICE.to_string());
    assert_eq!(morning["visibility"], "personal");
    assert_eq!(night["occurred_at"], "2026-11-05T21:30:00Z");

    let (status, day) = get(
        &h,
        &alice,
        &format!("{ENTRIES}?from=2026-11-05T00:00:00Z&to=2026-11-06T00:00:00Z"),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{day}");
    assert_eq!(ids(&day), [id_of(&night), id_of(&morning)]);
    let items = day["items"].as_array().unwrap();
    assert_eq!(items[0]["occurred_at"], "2026-11-05T21:30:00Z");
    assert_eq!(items[0]["text"], "Jantar com amigos.");
    let night_emotions = items[0]["emotions"].as_array().unwrap();
    assert_eq!(night_emotions.len(), 2);
    for (emotion, key) in night_emotions.iter().zip(["joy", "calm"]) {
        assert_eq!(emotion["system_key"], key);
        assert!(emotion["intensity"].is_null());
        assert!(emotion["name"].is_null());
        assert_eq!(emotion["deleted"], false);
    }
    assert_eq!(items[1]["occurred_at"], "2026-11-05T08:00:00Z");
    assert_eq!(items[1]["text"], "Paguei o aluguel e fiquei apreensiva.");
    assert_eq!(
        items[1]["emotions"],
        json!([{
            "emotion_id": anxiety,
            "system_key": "anxiety",
            "name": null,
            "intensity": 4,
            "deleted": false,
        }])
    );
    let (status, read) = get(&h, &alice, &format!("{ENTRIES}/{}", id_of(&morning))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["emotions"][0]["intensity"], 4);
}

#[tokio::test]
async fn ct27_new_emotion_appears_in_list() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    assert_eq!(emotions(&h, &alice).await.len(), 7);

    let created = create_emotion(&h, &alice, "  Esperança ").await;
    assert_eq!(created["name"], "Esperança");
    assert!(created["system_key"].is_null());
    assert_eq!(created["owner_id"], ALICE.to_string());

    let list = emotions(&h, &alice).await;
    assert_eq!(list.len(), 8);
    assert!(
        list.iter()
            .any(|emotion| emotion["id"] == created["id"] && emotion["name"] == "Esperança")
    );
    let entry = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T10:00:00Z",
            "text": "Notícia boa.",
            "emotions": [{ "emotion_id": created["id"], "intensity": 5 }],
        }),
    )
    .await;
    assert_eq!(entry["emotions"][0]["name"], "Esperança");
    assert_eq!(entry["emotions"][0]["intensity"], 5);
}

#[tokio::test]
async fn rf46_emotion_can_be_renamed_and_deleted() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let list = emotions(&h, &alice).await;
    let calm = system_id(&list, SystemEmotion::Calm);
    let custom = create_emotion(&h, &alice, "Saudade").await;
    let custom_uri = format!("{EMOTIONS}/{}", id_of(&custom));

    let (status, renamed) = call(
        &h,
        &alice,
        Method::PATCH,
        &format!("{EMOTIONS}/{calm}"),
        Some(json!({ "name": "Serenidade" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["system_key"], "calm");
    assert_eq!(renamed["name"], "Serenidade");

    let (status, problem) = call(
        &h,
        &alice,
        Method::PATCH,
        &custom_uri,
        Some(json!({ "name": "serenidade" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "emotion_name_taken");
    let (status, problem) = call(
        &h,
        &alice,
        Method::POST,
        EMOTIONS,
        Some(json!({ "name": "SAUDADE" })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "emotion_name_taken");
    let (status, problem) = call(
        &h,
        &alice,
        Method::PATCH,
        &custom_uri,
        Some(json!({ "name": "x".repeat(51) })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");

    let (status, renamed) = call(
        &h,
        &alice,
        Method::PATCH,
        &custom_uri,
        Some(json!({ "name": "Nostalgia" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(renamed["name"], "Nostalgia");

    let (status, _) = delete(&h, &alice, &custom_uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let list = emotions(&h, &alice).await;
    assert_eq!(list.len(), 7);
    assert!(list.iter().all(|emotion| emotion["id"] != custom["id"]));
    assert!(
        list.iter()
            .any(|emotion| emotion["system_key"] == "calm" && emotion["name"] == "Serenidade")
    );
    let (status, problem) = delete(&h, &alice, &custom_uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "emotion_not_found");
    // O nome de uma emoção excluída fica livre de novo.
    create_emotion(&h, &alice, "Nostalgia").await;
}

#[tokio::test]
async fn default_emotions_are_seeded_once() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;

    let first = emotions(&h, &alice).await;
    assert_eq!(first.len(), 7);
    assert!(first.iter().all(|emotion| emotion["name"].is_null()));
    let keys: Vec<&str> = first
        .iter()
        .map(|emotion| emotion["system_key"].as_str().unwrap())
        .collect();
    assert_eq!(
        keys,
        [
            "joy",
            "sadness",
            "anger",
            "fear",
            "anxiety",
            "calm",
            "gratitude"
        ]
    );
    let second = emotions(&h, &alice).await;
    assert_eq!(second, first);

    for emotion in &first {
        let (status, _) = delete(&h, &alice, &format!("{EMOTIONS}/{}", id_of(emotion))).await;
        assert_eq!(status, StatusCode::NO_CONTENT);
    }
    assert!(emotions(&h, &alice).await.is_empty());
    assert_eq!(emotions(&h, &bob).await.len(), 7);
}

#[tokio::test]
async fn deleted_emotion_stays_on_past_entries() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    emotions(&h, &alice).await;
    let custom = create_emotion(&h, &alice, "Saudade").await;
    let entry = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-04T20:00:00Z",
            "text": "Lembrei da viagem.",
            "emotions": [{ "emotion_id": custom["id"], "intensity": 3 }],
        }),
    )
    .await;

    let (status, _) = delete(&h, &alice, &format!("{EMOTIONS}/{}", id_of(&custom))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, read) = get(&h, &alice, &format!("{ENTRIES}/{}", id_of(&entry))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        read["emotions"],
        json!([{
            "emotion_id": custom["id"],
            "system_key": null,
            "name": "Saudade",
            "intensity": 3,
            "deleted": true,
        }])
    );
    // Editar o texto mantém a emoção excluída que a entrada já tinha.
    let (status, edited) = call(
        &h,
        &alice,
        Method::PATCH,
        &format!("{ENTRIES}/{}", id_of(&entry)),
        Some(json!({
            "text": "Lembrei da viagem de novo.",
            "emotions": [{ "emotion_id": custom["id"], "intensity": 2 }],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{edited}");
    assert_eq!(edited["emotions"][0]["intensity"], 2);
    let (status, problem) = call(
        &h,
        &alice,
        Method::POST,
        ENTRIES,
        Some(json!({
            "occurred_at": "2026-11-05T20:00:00Z",
            "text": "Nova entrada.",
            "emotions": [{ "emotion_id": custom["id"] }],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "unknown_emotion");
}

#[tokio::test]
async fn entry_with_other_users_emotion_is_rejected() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let bobs = create_emotion(&h, &bob, "Do Bob").await;
    let bobs_joy = system_id(&emotions(&h, &bob).await, SystemEmotion::Joy);

    for emotion_id in [id_of(&bobs), bobs_joy, Uuid::from_u128(77).to_string()] {
        let (status, problem) = call(
            &h,
            &alice,
            Method::POST,
            ENTRIES,
            Some(json!({
                "occurred_at": "2026-11-05T08:00:00Z",
                "text": "Tentativa.",
                "emotions": [{ "emotion_id": emotion_id }],
            })),
        )
        .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{problem}");
        assert_eq!(problem["code"], "unknown_emotion");
    }
    let (_, page) = get(&h, &alice, ENTRIES).await;
    assert!(ids(&page).is_empty());
}

#[tokio::test]
async fn intensity_out_of_range_is_rejected() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let joy = system_id(&emotions(&h, &alice).await, SystemEmotion::Joy);

    for intensity in [0, 6, -1, 300] {
        let (status, problem) = call(
            &h,
            &alice,
            Method::POST,
            ENTRIES,
            Some(json!({
                "occurred_at": "2026-11-05T08:00:00Z",
                "text": "Fora da faixa.",
                "emotions": [{ "emotion_id": joy, "intensity": intensity }],
            })),
        )
        .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{intensity}");
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "emotions");
        assert_eq!(problem["errors"][0]["code"], "intensity_out_of_range");
    }
    let invalid = [
        json!({ "occurred_at": "2026-11-05T08:00:00Z", "text": "  ", "emotions": [] }),
        json!({ "occurred_at": "2026-11-05T08:00:00", "text": "Sem fuso", "emotions": [] }),
        json!({
            "occurred_at": "2026-11-05T08:00:00Z",
            "text": "Repetida",
            "emotions": [{ "emotion_id": joy }, { "emotion_id": joy }],
        }),
    ];
    for body in invalid {
        let (status, problem) = call(&h, &alice, Method::POST, ENTRIES, Some(body.clone())).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
        assert_eq!(problem["code"], "validation_failed", "{body}");
    }
    let (_, page) = get(&h, &alice, ENTRIES).await;
    assert!(ids(&page).is_empty());
}

#[tokio::test]
async fn rnf03_journal_text_is_not_stored_in_plain_text() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let marker = "marcador-secreto-ct27";
    let created = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T08:00:00Z",
            "text": format!("Hoje escrevi {marker} no diário."),
            "emotions": [],
        }),
    )
    .await;

    let mut tx = begin_for_user(&h.ctx.state.pool, ALICE).await.unwrap();
    let rows: Vec<Vec<u8>> = sqlx::query_scalar("SELECT text_ciphertext FROM journal_entries")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();

    assert_eq!(rows.len(), 1);
    let needle = marker.as_bytes();
    assert!(
        rows.iter()
            .all(|row| !row.windows(needle.len()).any(|window| window == needle))
    );
    let (_, read) = get(&h, &alice, &format!("{ENTRIES}/{}", id_of(&created))).await;
    assert_eq!(read["text"], format!("Hoje escrevi {marker} no diário."));
}

#[tokio::test]
async fn other_user_entry_and_emotion_return_404() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let entry = create_entry(
        &h,
        &alice,
        json!({ "occurred_at": "2026-11-05T08:00:00Z", "text": "Da Alice", "emotions": [] }),
    )
    .await;
    let emotion = create_emotion(&h, &alice, "Da Alice").await;
    let entry_uri = format!("{ENTRIES}/{}", id_of(&entry));
    let emotion_uri = format!("{EMOTIONS}/{}", id_of(&emotion));

    let (status, problem) = get(&h, &bob, &entry_uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "journal_entry_not_found");
    let patch = Some(json!({ "text": "Do Bob" }));
    let (status, problem) = call(&h, &bob, Method::PATCH, &entry_uri, patch).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "journal_entry_not_found");
    let (status, problem) = delete(&h, &bob, &entry_uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "journal_entry_not_found");
    let rename = Some(json!({ "name": "Do Bob" }));
    let (status, problem) = call(&h, &bob, Method::PATCH, &emotion_uri, rename).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "emotion_not_found");
    let (status, problem) = delete(&h, &bob, &emotion_uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "emotion_not_found");
    let (_, page) = get(&h, &bob, ENTRIES).await;
    assert!(ids(&page).is_empty());
    assert!(
        emotions(&h, &bob)
            .await
            .iter()
            .all(|item| item["id"] != emotion["id"])
    );
    let (status, problem) = get(&h, &alice, &format!("{ENTRIES}/nao-e-uuid")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "journal_entry_not_found");

    let (status, read) = get(&h, &alice, &entry_uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(read["text"], "Da Alice");
    assert!(
        emotions(&h, &alice)
            .await
            .iter()
            .any(|item| item["name"] == "Da Alice")
    );
}

#[tokio::test]
async fn listing_filters_by_period_and_emotion_with_cursor() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let list = emotions(&h, &alice).await;
    let joy = system_id(&list, SystemEmotion::Joy);
    let fear = system_id(&list, SystemEmotion::Fear);
    let mut created = Vec::new();
    for (occurred_at, emotion, visibility) in [
        ("2026-11-03T09:00:00Z", &joy, "personal"),
        ("2026-11-04T09:00:00Z", &fear, "shared"),
        ("2026-11-04T19:00:00Z", &joy, "personal"),
        ("2026-11-05T09:00:00Z", &joy, "shared"),
    ] {
        let entry = create_entry(
            &h,
            &alice,
            json!({
                "occurred_at": occurred_at,
                "text": "Entrada",
                "emotions": [{ "emotion_id": emotion }],
                "visibility": visibility,
            }),
        )
        .await;
        created.push(id_of(&entry));
    }
    create_entry(
        &h,
        &bob,
        json!({ "occurred_at": "2026-11-04T10:00:00Z", "text": "Do Bob", "emotions": [] }),
    )
    .await;

    let (_, all) = get(&h, &alice, ENTRIES).await;
    assert_eq!(
        ids(&all),
        [
            created[3].clone(),
            created[2].clone(),
            created[1].clone(),
            created[0].clone()
        ]
    );
    let period = format!("{ENTRIES}?from=2026-11-04T00:00:00Z&to=2026-11-05T00:00:00Z");
    let (_, day) = get(&h, &alice, &period).await;
    assert_eq!(ids(&day), [created[2].clone(), created[1].clone()]);
    let (_, by_joy) = get(&h, &alice, &format!("{ENTRIES}?emotion_id={joy}")).await;
    assert_eq!(
        ids(&by_joy),
        [created[3].clone(), created[2].clone(), created[0].clone()]
    );
    let (_, shared) = get(&h, &alice, &format!("{ENTRIES}?visibility=shared")).await;
    assert_eq!(ids(&shared), [created[3].clone(), created[1].clone()]);

    let (status, first) = get(&h, &alice, &format!("{ENTRIES}?emotion_id={joy}&limit=2")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ids(&first), [created[3].clone(), created[2].clone()]);
    let cursor = first["next_cursor"].as_str().unwrap();
    let (_, second) = get(
        &h,
        &alice,
        &format!("{ENTRIES}?emotion_id={joy}&limit=2&cursor={cursor}"),
    )
    .await;
    assert_eq!(ids(&second), [created[0].clone()]);
    assert!(second["next_cursor"].is_null());

    for (uri, field) in [
        (format!("{ENTRIES}?limit=0"), "limit"),
        (format!("{ENTRIES}?limit=101"), "limit"),
        (format!("{ENTRIES}?cursor=nao-e-cursor"), "cursor"),
        (format!("{ENTRIES}?from=ontem"), "query"),
    ] {
        let (status, problem) = get(&h, &alice, &uri).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}");
        assert_eq!(problem["errors"][0]["field"], field, "{uri}");
    }
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
async fn deleting_entry_calls_entity_deleted_hook() {
    let calls: Calls = Arc::default();
    let h = harness_with(journal::router().layer(Extension(recording_hook(calls.clone())))).await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let entry = create_entry(
        &h,
        &alice,
        json!({ "occurred_at": "2026-11-05T08:00:00Z", "text": "Ligada", "emotions": [] }),
    )
    .await;
    let id: Uuid = id_of(&entry).parse().unwrap();
    let uri = format!("{ENTRIES}/{id}");

    let (status, _) = delete(&h, &bob, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(calls.lock().unwrap().is_empty());

    let (status, _) = delete(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(*calls.lock().unwrap(), [(ALICE, "journal_entry", id)]);
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let entry = create_entry(
        &h,
        &alice,
        json!({ "occurred_at": "2026-11-05T08:00:00Z", "text": "Sem gancho", "emotions": [] }),
    )
    .await;
    let uri = format!("{ENTRIES}/{}", id_of(&entry));

    let (status, _) = delete(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = get(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = delete(&h, &alice, &uri).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn journal_reader_returns_only_own_live_entries_decrypted() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let bob = h.ctx.sign_in_as(BOB).await;
    let anxiety = system_id(&emotions(&h, &alice).await, SystemEmotion::Anxiety);
    let kept = create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T08:00:00Z",
            "text": "Aluguel pago.",
            "emotions": [{ "emotion_id": anxiety, "intensity": 4 }],
            "visibility": "shared",
        }),
    )
    .await;
    let removed = create_entry(
        &h,
        &alice,
        json!({ "occurred_at": "2026-11-05T09:00:00Z", "text": "Rascunho", "emotions": [] }),
    )
    .await;
    create_entry(
        &h,
        &bob,
        json!({ "occurred_at": "2026-11-05T09:00:00Z", "text": "Segredo do Bob", "emotions": [] }),
    )
    .await;
    let (status, _) = delete(&h, &alice, &format!("{ENTRIES}/{}", id_of(&removed))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let reader = JournalReader::from_state(&h.ctx.state);
    let entries: Vec<DecryptedJournalEntry> =
        reader.decrypted_entries_for_owner(ALICE).await.unwrap();

    assert_eq!(entries.len(), 1);
    let entry = &entries[0];
    assert_eq!(entry.id.to_string(), id_of(&kept));
    assert_eq!(entry.text, "Aluguel pago.");
    assert_eq!(entry.occurred_at, instant("2026-11-05T08:00:00Z"));
    assert_eq!(entry.visibility, Visibility::Shared);
    assert_eq!(entry.created_at, instant("2026-11-01T12:00:00Z"));
    assert_eq!(entry.updated_at, instant("2026-11-01T12:00:00Z"));
    assert_eq!(entry.emotions.len(), 1);
    assert_eq!(entry.emotions[0].emotion_id.to_string(), anxiety);
    assert_eq!(entry.emotions[0].system_key, Some(SystemEmotion::Anxiety));
    assert_eq!(entry.emotions[0].intensity, Some(4));
    assert!(!entry.emotions[0].deleted);
    let nobody = reader
        .decrypted_entries_for_owner(Uuid::from_u128(99))
        .await
        .unwrap();
    assert!(nobody.is_empty());
}

#[tokio::test]
async fn rls_is_enabled_on_journal_tables() {
    let h = harness().await;
    let alice = h.ctx.sign_in_as(ALICE).await;
    let joy = system_id(&emotions(&h, &alice).await, SystemEmotion::Joy);
    create_entry(
        &h,
        &alice,
        json!({
            "occurred_at": "2026-11-05T08:00:00Z",
            "text": "Protegida",
            "emotions": [{ "emotion_id": joy }],
        }),
    )
    .await;

    for table in ["emotions", "journal_entries", "journal_entry_emotions"] {
        let (enabled, forced): (bool, bool) = sqlx::query_as(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
        )
        .bind(table)
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();
        let count_sql = format!("SELECT count(*) FROM {table}");
        let without_user: i64 = sqlx::query_scalar(&count_sql)
            .fetch_one(&h.ctx.state.pool)
            .await
            .unwrap();
        let mut tx = begin_for_user(&h.ctx.state.pool, BOB).await.unwrap();
        let as_bob: i64 = sqlx::query_scalar(&count_sql)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let mut tx = begin_for_user(&h.ctx.state.pool, ALICE).await.unwrap();
        let as_alice: i64 = sqlx::query_scalar(&count_sql)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        assert!(enabled, "{table}");
        assert!(forced, "{table}");
        assert_eq!(without_user, 0, "{table}");
        assert_eq!(as_bob, 0, "{table}");
        assert!(as_alice > 0, "{table}");
    }
}
