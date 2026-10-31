//! Gancho de exclusão para as ligações sumirem dos dois lados (CB-06).

use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::json;
use uuid::Uuid;

use super::{ALICE, TestApp};
use crate::http::test_support::send;
use crate::reminders::application::ports::EntityDeletedHook;

type Calls = Arc<Mutex<Vec<(Uuid, &'static str, Uuid, bool)>>>;

/// Gancho que grava cada chamada e se a exclusão já estava confirmada no banco.
fn recording_hook(app: &TestApp, calls: Calls) -> EntityDeletedHook {
    let pool = app.ctx.state.pool.clone();
    Arc::new(move |owner_id, entity_type, entity_id| {
        let pool = pool.clone();
        let calls = calls.clone();
        Box::pin(async move {
            let mut tx = crate::shared::db::begin_for_user(&pool, owner_id)
                .await
                .unwrap();
            let committed: bool =
                sqlx::query_scalar("SELECT deleted_at IS NOT NULL FROM reminders WHERE id = $1")
                    .bind(entity_id)
                    .fetch_one(&mut *tx)
                    .await
                    .unwrap();
            tx.commit().await.unwrap();
            calls
                .lock()
                .unwrap()
                .push((owner_id, entity_type, entity_id, committed));
        })
    })
}

async fn reminder_id(app: &TestApp, session: &crate::http::test_support::TestSession) -> Uuid {
    let created = app
        .create(
            session,
            json!({ "title": "Pagar", "timezone": "UTC", "remind_at": "2026-11-10T10:00:00Z" }),
        )
        .await;
    created["id"].as_str().unwrap().parse().unwrap()
}

#[tokio::test]
async fn deleting_reminder_calls_entity_deleted_hook() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let id = reminder_id(&app, &alice).await;
    let calls: Calls = Arc::default();
    let router = app.app_with_hook(recording_hook(&app, calls.clone()));

    let request = alice
        .request(Method::DELETE, &format!("/api/v1/reminders/{id}"))
        .body(Body::empty())
        .unwrap();
    let (status, _, _) = send(&router, request).await;
    let missing = alice
        .request(
            Method::DELETE,
            &format!("/api/v1/reminders/{}", Uuid::now_v7()),
        )
        .body(Body::empty())
        .unwrap();
    let (missing_status, _, _) = send(&router, missing).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(
        *calls.lock().unwrap(),
        [(ALICE, "reminder", id, true)],
        "uma chamada, depois do commit"
    );
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let app = TestApp::new().await;
    let alice = app.sign_in(ALICE).await;
    let id = reminder_id(&app, &alice).await;
    let uri = format!("/api/v1/reminders/{id}");

    let status = app.delete(&alice, &uri).await;
    let (after, _) = app.get(&alice, &uri).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(after, StatusCode::NOT_FOUND);
    assert_eq!(
        app.count_as(ALICE, "SELECT count(*) FROM reminder_schedule")
            .await,
        0,
        "o lembrete excluído sai da fila de disparo"
    );
}
