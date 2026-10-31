//! Gancho de exclusão chamado depois do commit (CB-06).

use std::sync::{Arc, Mutex};

use axum::Extension;
use axum::http::{Method, StatusCode};
use serde_json::json;
use uuid::Uuid;

use super::{ALICE, TestApp};
use crate::goals::application::ports::EntityDeletedHook;
use crate::shared::db::begin_for_user;

type Calls = Arc<Mutex<Vec<(Uuid, &'static str, Uuid, bool)>>>;

/// Gancho que grava a chamada e se a exclusão já estava gravada naquele momento.
fn recording_hook(pool: sqlx::PgPool, calls: Calls) -> EntityDeletedHook {
    Arc::new(move |owner, kind, id| {
        let pool = pool.clone();
        let calls = calls.clone();
        Box::pin(async move {
            let table = if kind == "goal" {
                "goals"
            } else {
                "milestones"
            };
            let mut tx = begin_for_user(&pool, owner).await.unwrap();
            let committed: bool = sqlx::query_scalar(&format!(
                "SELECT count(*) = 1 FROM {table} WHERE id = $1 AND deleted_at IS NOT NULL"
            ))
            .bind(id)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
            drop(tx);
            calls.lock().unwrap().push((owner, kind, id, committed));
        })
    })
}

async fn app_with_hook() -> (TestApp, Calls) {
    let calls = Calls::default();
    let recorded = calls.clone();
    let t = TestApp::with_api_using(move |state| {
        let hook = recording_hook(state.pool.clone(), recorded);
        crate::goals::router().layer(Extension(hook))
    })
    .await;
    (t, calls)
}

#[tokio::test]
async fn deleting_goal_calls_entity_deleted_hook_for_goal_and_milestones() {
    let (t, calls) = app_with_hook().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let goal_id: Uuid = goal["id"].as_str().unwrap().parse().unwrap();
    let mut milestone_ids = Vec::new();
    for title in ["A", "B"] {
        let m = t
            .create_milestone(&t.alice, &goal_id.to_string(), title)
            .await;
        milestone_ids.push(m["id"].as_str().unwrap().parse::<Uuid>().unwrap());
    }

    let (status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/goals/{goal_id}"),
            None,
        )
        .await;

    let calls = calls.lock().unwrap().clone();
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(calls.len(), 3);
    assert!(calls.contains(&(ALICE, "goal", goal_id, true)));
    for id in milestone_ids {
        assert!(calls.contains(&(ALICE, "milestone", id, true)), "{id}");
    }
}

#[tokio::test]
async fn deleting_milestone_calls_entity_deleted_hook() {
    let (t, calls) = app_with_hook().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let goal_id = goal["id"].as_str().unwrap();
    let m = t.create_milestone(&t.alice, goal_id, "A").await;
    let milestone_id: Uuid = m["id"].as_str().unwrap().parse().unwrap();

    let (status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/goals/{goal_id}/milestones/{milestone_id}"),
            None,
        )
        .await;
    let (missing, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/goals/{goal_id}/milestones/{milestone_id}"),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(missing, StatusCode::NOT_FOUND);
    // Só a exclusão que aconteceu chama o gancho.
    assert_eq!(
        calls.lock().unwrap().clone(),
        [(ALICE, "milestone", milestone_id, true)]
    );
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let t = TestApp::new().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let goal_id = goal["id"].as_str().unwrap();
    let m = t.create_milestone(&t.alice, goal_id, "A").await;

    let (milestone, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!(
                "/api/v1/goals/{goal_id}/milestones/{}",
                m["id"].as_str().unwrap()
            ),
            None,
        )
        .await;
    let (goal_status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/goals/{goal_id}"),
            None,
        )
        .await;

    assert_eq!(milestone, StatusCode::NO_CONTENT);
    assert_eq!(goal_status, StatusCode::NO_CONTENT);
}
