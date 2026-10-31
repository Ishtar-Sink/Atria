//! Gancho de exclusão para as ligações sumirem dos dois lados (CB-06).

use std::sync::{Arc, Mutex};

use axum::Extension;
use axum::http::{Method, StatusCode};
use serde_json::json;
use uuid::Uuid;

use super::{ALICE, TestApp, id_of};
use crate::shared::db::begin_for_user;
use crate::tasks::application::ports::EntityDeletedHook;

/// Chamada recebida pelo gancho, com o estado da tarefa visto por outra conexão.
type Call = (Uuid, &'static str, Uuid, bool);

fn recording_hook(pool: sqlx::PgPool, calls: Arc<Mutex<Vec<Call>>>) -> EntityDeletedHook {
    Arc::new(move |owner_id, entity_type, entity_id| {
        let pool = pool.clone();
        let calls = calls.clone();
        Box::pin(async move {
            // Outra conexão só vê a exclusão se a transação já tiver sido confirmada.
            let mut tx = begin_for_user(&pool, owner_id).await.unwrap();
            let committed: bool =
                sqlx::query_scalar("SELECT deleted_at IS NOT NULL FROM tasks WHERE id = $1")
                    .bind(entity_id)
                    .fetch_one(&mut *tx)
                    .await
                    .unwrap();
            calls
                .lock()
                .unwrap()
                .push((owner_id, entity_type, entity_id, committed));
        })
    })
}

#[tokio::test]
async fn deleting_task_calls_entity_deleted_hook() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let t = TestApp::new().await;
    // O app com o gancho usa o mesmo estado (banco e sessões) do app de teste.
    let hook = recording_hook(t.ctx.state.pool.clone(), calls.clone());
    let app = t.ctx.app(crate::tasks::router().layer(Extension(hook)));
    let id = id_of(
        &t.create(&t.alice, json!({ "title": "Excluir depois" }))
            .await,
    );

    let request = t
        .alice
        .request(Method::DELETE, &format!("/api/v1/tasks/{id}"))
        .body(axum::body::Body::empty())
        .unwrap();
    let (status, _, _) = crate::http::test_support::send(&app, request).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    let calls = calls.lock().unwrap().clone();
    assert_eq!(
        calls,
        [(ALICE, "task", Uuid::parse_str(&id).unwrap(), true)]
    );
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let t = TestApp::new().await;
    let id = id_of(&t.create(&t.alice, json!({ "title": "Sem gancho" })).await);

    let (status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/tasks/{id}"),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, problem) = t
        .call(&t.alice, Method::GET, &format!("/api/v1/tasks/{id}"), None)
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "not_found");
    let (status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/tasks/{id}"),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
