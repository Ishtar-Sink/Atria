//! Testes HTTP do contexto `projects`.

use std::sync::{Arc, Mutex};

use axum::Extension;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{ALICE, BOB, TestApp, lane_id};
use crate::projects::ProjectSearch;
use crate::projects::application::ports::EntityDeletedHook;
use crate::shared::db::begin_for_user;

fn id_of(value: &Value) -> String {
    value["id"].as_str().unwrap_or_default().to_owned()
}

fn ids_of(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .map(|items| items.iter().map(id_of).collect())
        .unwrap_or_default()
}

#[tokio::test]
async fn ct30_projects_list_with_default_lanes() {
    let t = TestApp::new().await;
    t.create_project(&t.alice, "Casa nova").await;
    t.create_project(&t.alice, "Viagem").await;

    let page = t
        .alice_expects(StatusCode::OK, Method::GET, "/api/v1/projects", None)
        .await;

    let items = page["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    for item in items {
        let keys: Vec<_> = item["lanes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|l| l["system_key"].as_str().unwrap().to_owned())
            .collect();
        assert_eq!(keys, ["waiting", "in_progress", "done"]);
        let done = item["lanes"][2].clone();
        assert_eq!(done["counts_as_done"], true);
        assert_eq!(item["lanes"][0]["counts_as_done"], false);
        assert_eq!(item["lanes"][0]["color"], "#92400e");
        assert_eq!(
            item["progress"],
            json!({ "done_cards": 0, "total_cards": 0 })
        );
    }
}

#[tokio::test]
async fn ct30_create_colored_lane_and_reorder() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let lanes_uri = format!("/api/v1/projects/{pid}/lanes");

    let lane = t
        .alice_expects(
            StatusCode::CREATED,
            Method::POST,
            &lanes_uri,
            Some(json!({ "name": "Revisão", "color": "#0EA5E9" })),
        )
        .await;
    let order = [
        lane_id(&project, "waiting"),
        id_of(&lane),
        lane_id(&project, "in_progress"),
        lane_id(&project, "done"),
    ];
    let reordered = t
        .alice_expects(
            StatusCode::OK,
            Method::PUT,
            &format!("{lanes_uri}/order"),
            Some(json!({ "lane_ids": order })),
        )
        .await;

    assert_eq!(lane["color"], "#0ea5e9");
    assert_eq!(lane["counts_as_done"], false);
    assert_eq!(lane["system_key"], Value::Null);
    assert_eq!(ids_of(&reordered), order);
    let listed = t
        .alice_expects(StatusCode::OK, Method::GET, &lanes_uri, None)
        .await;
    assert_eq!(ids_of(&listed), order);
    assert_eq!(listed["items"][1]["position"], 1);
}

#[tokio::test]
async fn create_lane_with_invalid_hex_returns_422() {
    let t = TestApp::new().await;
    let pid = id_of(&t.create_project(&t.alice, "Obra").await);

    let (status, body) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/projects/{pid}/lanes"),
            Some(json!({ "name": "Revisão", "color": "accent" })),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "validation_failed");
}

#[tokio::test]
async fn ct30_create_card_and_move_between_lanes() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let progress = lane_id(&project, "in_progress");
    let first = t
        .create_card(&pid, json!({ "lane_id": waiting, "title": "Orçamento" }))
        .await;
    let second = t
        .create_card(&pid, json!({ "lane_id": waiting, "title": "Contrato" }))
        .await;

    let moved = t
        .alice_expects(
            StatusCode::OK,
            Method::POST,
            &format!("/api/v1/projects/{pid}/cards/{}/move", id_of(&first)),
            Some(json!({ "lane_id": progress, "position": 0 })),
        )
        .await;

    assert_eq!(moved["lane_id"], progress);
    assert_eq!(moved["position"], 0);
    let cards = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects/{pid}/cards"),
            None,
        )
        .await;
    let layout: Vec<_> = cards["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| {
            (
                c["lane_id"].as_str().unwrap().to_owned(),
                c["position"].as_i64().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        layout,
        [(waiting.clone(), 0), (progress.clone(), 0)],
        "{cards}"
    );
    assert_eq!(cards["items"][0]["id"], second["id"]);
}

#[tokio::test]
async fn pd45_create_card_in_chosen_lane() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let progress = lane_id(&project, "in_progress");

    let card = t
        .create_card(
            &id_of(&project),
            json!({ "lane_id": progress, "title": "Direto" }),
        )
        .await;

    assert_eq!(card["lane_id"], progress);
    assert_eq!(card["position"], 0);
}

#[tokio::test]
async fn create_card_in_lane_of_other_project_returns_422() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let other = t.create_project(&t.alice, "Viagem").await;

    let (status, body) = t
        .call(
            &t.alice,
            Method::POST,
            &format!("/api/v1/projects/{}/cards", id_of(&project)),
            Some(json!({ "lane_id": lane_id(&other, "waiting"), "title": "x" })),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "invalid_target_lane");
}

#[tokio::test]
async fn pd46_card_crud_with_priority_labels_due_date_and_checklist() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);

    let card = t
        .create_card(
            &pid,
            json!({
                "lane_id": lane_id(&project, "waiting"),
                "title": "Pintar a sala",
                "description": "Duas demãos",
                "priority": "high",
                "labels": [" casa ", "obra"],
                "due_date": "2026-11-20",
                "checklist": [{ "text": "Comprar tinta", "done": true }, { "text": "Lixar" }],
            }),
        )
        .await;
    let uri = format!("/api/v1/projects/{pid}/cards/{}", id_of(&card));
    let read = t
        .alice_expects(StatusCode::OK, Method::GET, &uri, None)
        .await;
    let edited = t
        .alice_expects(
            StatusCode::OK,
            Method::PATCH,
            &uri,
            Some(json!({
                "priority": null,
                "due_date": null,
                "labels": ["casa"],
                "checklist": [{ "text": "Passar rolo" }],
            })),
        )
        .await;
    t.alice_expects(StatusCode::NO_CONTENT, Method::DELETE, &uri, None)
        .await;
    let (status, gone) = t.call(&t.alice, Method::GET, &uri, None).await;

    assert_eq!(read["priority"], "high");
    assert_eq!(read["labels"], json!(["casa", "obra"]));
    assert_eq!(read["due_date"], "2026-11-20");
    assert_eq!(read["description"], "Duas demãos");
    assert_eq!(read["checklist"][0]["text"], "Comprar tinta");
    assert_eq!(read["checklist"][0]["done"], true);
    assert_eq!(read["checklist"][1]["position"], 1);
    assert_eq!(edited["priority"], Value::Null);
    assert_eq!(edited["due_date"], Value::Null);
    assert_eq!(edited["labels"], json!(["casa"]));
    assert_eq!(edited["checklist"].as_array().unwrap().len(), 1);
    assert_eq!(edited["checklist"][0]["text"], "Passar rolo");
    assert_eq!(edited["title"], "Pintar a sala");
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(gone["code"], "card_not_found");
}

#[tokio::test]
async fn card_with_unknown_priority_or_duplicate_labels_returns_422() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let waiting = lane_id(&project, "waiting");
    let uri = format!("/api/v1/projects/{}/cards", id_of(&project));

    for extra in [
        json!({ "priority": "urgent" }),
        json!({ "labels": ["a", "A"] }),
        json!({ "checklist": [{ "text": "  " }] }),
    ] {
        let mut body = json!({ "lane_id": waiting, "title": "x" });
        body.as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let (status, json) = t.call(&t.alice, Method::POST, &uri, Some(body)).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{json}");
        assert_eq!(json["code"], "validation_failed");
    }
}

#[tokio::test]
async fn pd43_lane_counts_as_done_drives_project_progress() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    t.create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
        .await;
    t.create_card(
        &pid,
        json!({ "lane_id": lane_id(&project, "done"), "title": "b" }),
    )
    .await;
    let before = t.get_project(&pid).await;

    t.alice_expects(
        StatusCode::OK,
        Method::PATCH,
        &format!("/api/v1/projects/{pid}/lanes/{waiting}"),
        Some(json!({ "counts_as_done": true })),
    )
    .await;
    let after = t.get_project(&pid).await;
    let listed = t
        .alice_expects(StatusCode::OK, Method::GET, "/api/v1/projects", None)
        .await;

    assert_eq!(
        before["progress"],
        json!({ "done_cards": 1, "total_cards": 2 })
    );
    assert_eq!(
        after["progress"],
        json!({ "done_cards": 2, "total_cards": 2 })
    );
    assert_eq!(listed["items"][0]["progress"], after["progress"]);
}

#[tokio::test]
async fn pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let progress = lane_id(&project, "in_progress");
    let done = lane_id(&project, "done");
    let overdue = t
        .create_card(
            &pid,
            json!({ "lane_id": waiting, "title": "Vencido", "due_date": "2026-10-30" }),
        )
        .await;
    let next = t
        .create_card(
            &pid,
            json!({
                "lane_id": progress, "title": "Em andamento", "priority": "high",
                "due_date": "2026-11-15",
                "checklist": [{ "text": "a", "done": true }, { "text": "b" }],
            }),
        )
        .await;
    t.create_card(
        &pid,
        json!({ "lane_id": waiting, "title": "Longe", "due_date": "2026-11-16" }),
    )
    .await;
    t.create_card(
        &pid,
        json!({ "lane_id": done, "title": "Feito", "due_date": "2026-10-01" }),
    )
    .await;
    t.create_card(&pid, json!({ "lane_id": done, "title": "Feito 2" }))
        .await;

    let summary = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects/{pid}/summary?today=2026-11-01"),
            None,
        )
        .await;

    assert_eq!(
        summary["progress"],
        json!({ "done_cards": 2, "total_cards": 5 })
    );
    let counts: Vec<_> = summary["lanes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|l| l["card_count"].as_i64().unwrap())
        .collect();
    assert_eq!(counts, [2, 1, 2]);
    assert_eq!(summary["lanes"][2]["counts_as_done"], true);
    let upcoming = summary["upcoming_due"].as_array().unwrap();
    assert_eq!(upcoming.len(), 2, "{summary}");
    assert_eq!(upcoming[0]["card_id"], overdue["id"]);
    assert_eq!(upcoming[0]["overdue"], true);
    assert_eq!(upcoming[1]["card_id"], next["id"]);
    assert_eq!(upcoming[1]["overdue"], false);
    let running = summary["in_progress"].as_array().unwrap();
    assert_eq!(running.len(), 1);
    assert_eq!(running[0]["card_id"], next["id"]);
    assert_eq!(running[0]["priority"], "high");
    assert_eq!(running[0]["checklist_done"], 1);
    assert_eq!(running[0]["checklist_total"], 2);
}

#[tokio::test]
async fn summary_without_today_uses_clock_date() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    // O relógio de teste marca 2026-11-01: 2026-10-31 já venceu.
    t.create_card(
        &pid,
        json!({ "lane_id": lane_id(&project, "waiting"), "title": "x", "due_date": "2026-10-31" }),
    )
    .await;

    let summary = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects/{pid}/summary"),
            None,
        )
        .await;

    assert_eq!(summary["upcoming_due"][0]["overdue"], true);
}

#[tokio::test]
async fn rf56_rename_and_delete_lane() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let lane_uri = format!("/api/v1/projects/{pid}/lanes/{waiting}");

    let renamed = t
        .alice_expects(
            StatusCode::OK,
            Method::PATCH,
            &lane_uri,
            Some(json!({ "name": "A fazer", "color": "#112233" })),
        )
        .await;
    t.alice_expects(StatusCode::NO_CONTENT, Method::DELETE, &lane_uri, None)
        .await;
    let after = t.get_project(&pid).await;

    assert_eq!(renamed["name"], "A fazer");
    assert_eq!(renamed["system_key"], "waiting");
    assert_eq!(renamed["color"], "#112233");
    assert_eq!(after["lanes"].as_array().unwrap().len(), 2);
    assert_eq!(after["lanes"][0]["position"], 0);
}

#[tokio::test]
async fn cb07_delete_lane_with_cards_moves_them_to_target() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let progress = lane_id(&project, "in_progress");
    t.create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
        .await;
    t.create_card(&pid, json!({ "lane_id": waiting, "title": "b" }))
        .await;
    t.create_card(&pid, json!({ "lane_id": progress, "title": "c" }))
        .await;

    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}/lanes/{waiting}?move_cards_to={progress}"),
        None,
    )
    .await;

    let cards = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects/{pid}/cards"),
            None,
        )
        .await;
    let titles: Vec<_> = cards["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| {
            (
                c["title"].as_str().unwrap().to_owned(),
                c["position"].as_i64().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        titles,
        [
            ("c".to_owned(), 0),
            ("a".to_owned(), 1),
            ("b".to_owned(), 2)
        ]
    );
    assert!(
        cards["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|c| c["lane_id"] == progress)
    );
}

#[tokio::test]
async fn cb07_delete_lane_with_cards_without_target_returns_409() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    t.create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
        .await;

    let (status, body) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/projects/{pid}/lanes/{waiting}"),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "lane_has_cards");
    assert_eq!(
        t.get_project(&pid).await["lanes"].as_array().unwrap().len(),
        3
    );
}

#[tokio::test]
async fn cb08_delete_last_lane_returns_409() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    for key in ["waiting", "in_progress"] {
        t.alice_expects(
            StatusCode::NO_CONTENT,
            Method::DELETE,
            &format!("/api/v1/projects/{pid}/lanes/{}", lane_id(&project, key)),
            None,
        )
        .await;
    }

    let (status, body) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/api/v1/projects/{pid}/lanes/{}", lane_id(&project, "done")),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "last_lane");
    assert_eq!(
        t.get_project(&pid).await["lanes"].as_array().unwrap().len(),
        1
    );
}

#[tokio::test]
async fn reorder_with_missing_lane_returns_422() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;

    let (status, body) = t
        .call(
            &t.alice,
            Method::PUT,
            &format!("/api/v1/projects/{}/lanes/order", id_of(&project)),
            Some(json!({ "lane_ids": [lane_id(&project, "done"), lane_id(&project, "waiting")] })),
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "invalid_lane_order");
}

#[tokio::test]
async fn other_user_project_lanes_and_cards_return_404() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let card = t
        .create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
        .await;
    let cid = id_of(&card);
    let base = format!("/api/v1/projects/{pid}");

    let attempts = [
        (Method::GET, base.clone(), None),
        (Method::PATCH, base.clone(), Some(json!({ "name": "x" }))),
        (Method::GET, format!("{base}/summary"), None),
        (Method::GET, format!("{base}/lanes"), None),
        (
            Method::POST,
            format!("{base}/lanes"),
            Some(json!({ "name": "x", "color": "#000000" })),
        ),
        (
            Method::PATCH,
            format!("{base}/lanes/{waiting}"),
            Some(json!({ "name": "x" })),
        ),
        (Method::DELETE, format!("{base}/lanes/{waiting}"), None),
        (Method::GET, format!("{base}/cards"), None),
        (
            Method::POST,
            format!("{base}/cards"),
            Some(json!({ "lane_id": waiting, "title": "x" })),
        ),
        (Method::GET, format!("{base}/cards/{cid}"), None),
        (
            Method::PATCH,
            format!("{base}/cards/{cid}"),
            Some(json!({ "title": "x" })),
        ),
        (
            Method::POST,
            format!("{base}/cards/{cid}/move"),
            Some(json!({ "lane_id": waiting })),
        ),
        (Method::DELETE, format!("{base}/cards/{cid}"), None),
        (Method::DELETE, base.clone(), None),
    ];
    for (method, uri, body) in attempts {
        let (status, json) = t.call(&t.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}: {json}");
        assert_eq!(json["code"], "project_not_found", "{method} {uri}");
    }
    let by_id = format!("/api/v1/cards/{cid}");
    let (status, json) = t.call(&t.bob, Method::GET, &by_id, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "GET {by_id}: {json}");
    assert_eq!(json["code"], "card_not_found");
    let listed = t
        .call(&t.bob, Method::GET, "/api/v1/projects", None)
        .await
        .1;
    assert!(listed["items"].as_array().unwrap().is_empty());
    assert_eq!(t.get_project(&pid).await["name"], "Obra");
}

#[tokio::test]
async fn card_by_id_returns_card_with_project_id() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let card = t
        .create_card(
            &pid,
            json!({
                "lane_id": lane_id(&project, "in_progress"),
                "title": "Pintar a sala",
                "priority": "high",
                "labels": ["casa", "obra"],
                "due_date": "2026-11-20",
                "checklist": [{ "text": "Comprar tinta", "done": true }, { "text": "Lixar" }],
            }),
        )
        .await;
    let cid = id_of(&card);

    let by_id = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/cards/{cid}"),
            None,
        )
        .await;
    let nested = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects/{pid}/cards/{cid}"),
            None,
        )
        .await;

    assert_eq!(by_id, nested);
    assert_eq!(by_id["project_id"], pid.as_str());
    assert_eq!(by_id["lane_id"], lane_id(&project, "in_progress").as_str());
    assert_eq!(by_id["title"], "Pintar a sala");
    assert_eq!(by_id["checklist"].as_array().unwrap().len(), 2);
    assert_eq!(by_id["checklist"][0]["text"], "Comprar tinta");
}

#[tokio::test]
async fn card_by_id_of_other_user_returns_404() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let card = t
        .create_card(
            &id_of(&project),
            json!({ "lane_id": lane_id(&project, "waiting"), "title": "a" }),
        )
        .await;
    let uri = format!("/api/v1/cards/{}", id_of(&card));

    let (status, json) = t.call(&t.bob, Method::GET, &uri, None).await;

    assert_eq!(status, StatusCode::NOT_FOUND, "{json}");
    assert_eq!(json["code"], "card_not_found");
}

#[tokio::test]
async fn card_by_id_of_deleted_card_or_project_returns_404() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let deleted_card = id_of(
        &t.create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
            .await,
    );
    let live_card = id_of(
        &t.create_card(&pid, json!({ "lane_id": waiting, "title": "b" }))
            .await,
    );
    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}/cards/{deleted_card}"),
        None,
    )
    .await;
    // Cartão vivo, lido antes de o projeto ser excluído.
    t.alice_expects(
        StatusCode::OK,
        Method::GET,
        &format!("/api/v1/cards/{live_card}"),
        None,
    )
    .await;

    let (card_status, card_json) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/cards/{deleted_card}"),
            None,
        )
        .await;
    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}"),
        None,
    )
    .await;
    let (project_status, project_json) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/cards/{live_card}"),
            None,
        )
        .await;

    assert_eq!(card_status, StatusCode::NOT_FOUND, "{card_json}");
    assert_eq!(card_json["code"], "card_not_found");
    assert_eq!(project_status, StatusCode::NOT_FOUND, "{project_json}");
    assert_eq!(project_json["code"], "card_not_found");
}

#[tokio::test]
async fn card_by_id_unknown_returns_404() {
    let t = TestApp::new().await;
    let unknown = Uuid::from_u128(0x0192_0000_0000_7000_8000_0000_0000_0099);

    let (status, json) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/cards/{unknown}"),
            None,
        )
        .await;

    assert_eq!(status, StatusCode::NOT_FOUND, "{json}");
    assert_eq!(json["code"], "card_not_found");
}

type Calls = Arc<Mutex<Vec<(Uuid, &'static str, Uuid)>>>;

fn recording_hook(calls: Calls) -> EntityDeletedHook {
    Arc::new(move |owner, kind, id| {
        let calls = calls.clone();
        Box::pin(async move {
            calls.lock().unwrap().push((owner, kind, id));
        })
    })
}

async fn app_with_hook() -> (TestApp, Calls) {
    let calls = Calls::default();
    let recorded = calls.clone();
    let t = TestApp::with_api_using(move |_| {
        crate::projects::router().layer(Extension(recording_hook(recorded)))
    })
    .await;
    (t, calls)
}

fn parse(id: &str) -> Uuid {
    id.parse().unwrap()
}

#[tokio::test]
async fn project_and_card_deletion_call_entity_deleted_hook() {
    let (t, calls) = app_with_hook().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let waiting = lane_id(&project, "waiting");
    let first = id_of(
        &t.create_card(&pid, json!({ "lane_id": waiting, "title": "a" }))
            .await,
    );
    let second = id_of(
        &t.create_card(&pid, json!({ "lane_id": waiting, "title": "b" }))
            .await,
    );

    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}/cards/{first}"),
        None,
    )
    .await;
    let after_card = calls.lock().unwrap().clone();
    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}"),
        None,
    )
    .await;

    assert_eq!(after_card, [(ALICE, "project_card", parse(&first))]);
    let all = calls.lock().unwrap().clone();
    assert_eq!(all.len(), 3);
    assert!(all.contains(&(ALICE, "project", parse(&pid))));
    assert!(all.contains(&(ALICE, "project_card", parse(&second))));
}

#[tokio::test]
async fn delete_without_hook_still_succeeds() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    let pid = id_of(&project);
    let card = t
        .create_card(
            &pid,
            json!({ "lane_id": lane_id(&project, "waiting"), "title": "a" }),
        )
        .await;

    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}/cards/{}", id_of(&card)),
        None,
    )
    .await;
    t.alice_expects(
        StatusCode::NO_CONTENT,
        Method::DELETE,
        &format!("/api/v1/projects/{pid}"),
        None,
    )
    .await;

    let (status, _) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/projects/{pid}"),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn listing_filters_by_query_and_paginates_by_cursor() {
    let t = TestApp::new().await;
    for name in ["Casa nova", "Carro", "Viagem"] {
        t.create_project(&t.alice, name).await;
    }

    let filtered = t
        .alice_expects(StatusCode::OK, Method::GET, "/api/v1/projects?q=casa", None)
        .await;
    let first = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            "/api/v1/projects?limit=2",
            None,
        )
        .await;
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let second = t
        .alice_expects(
            StatusCode::OK,
            Method::GET,
            &format!("/api/v1/projects?limit=2&cursor={cursor}"),
            None,
        )
        .await;

    assert_eq!(ids_of(&filtered).len(), 1);
    assert_eq!(filtered["items"][0]["name"], "Casa nova");
    assert_eq!(ids_of(&first).len(), 2);
    assert_eq!(ids_of(&second).len(), 1);
    assert_eq!(second["next_cursor"], Value::Null);
    let mut all = ids_of(&first);
    all.extend(ids_of(&second));
    all.dedup();
    assert_eq!(all.len(), 3);
}

#[tokio::test]
async fn update_project_renames_and_clears_description() {
    let t = TestApp::new().await;
    let created = t
        .alice_expects(
            StatusCode::CREATED,
            Method::POST,
            "/api/v1/projects",
            Some(json!({ "name": "Obra", "description": "Reforma" })),
        )
        .await;

    let updated = t
        .alice_expects(
            StatusCode::OK,
            Method::PATCH,
            &format!("/api/v1/projects/{}", id_of(&created)),
            Some(json!({ "name": " Obra grande ", "description": null, "visibility": "shared" })),
        )
        .await;

    assert_eq!(created["description"], "Reforma");
    assert_eq!(updated["name"], "Obra grande");
    assert_eq!(updated["description"], Value::Null);
    assert_eq!(updated["visibility"], "shared");
    assert_eq!(updated["lanes"][0]["visibility"], "shared");
}

#[tokio::test]
async fn project_search_finds_card_by_unaccented_title() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Reforma").await;
    let pid = id_of(&project);
    let card = t
        .create_card(
            &pid,
            json!({ "lane_id": lane_id(&project, "waiting"), "title": "Reunião de orçamento" }),
        )
        .await;
    let search = ProjectSearch::from_state(&t.ctx.state);

    let hits = search.search(ALICE, "orcamento", 10).await.unwrap();
    let projects = search.search(ALICE, "reforma", 10).await.unwrap();
    let foreign = search.search(BOB, "orcamento", 10).await.unwrap();

    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].entity_type, "project_card");
    assert_eq!(hits[0].id, parse(&id_of(&card)));
    assert_eq!(hits[0].project_id, parse(&pid));
    assert_eq!(projects[0].entity_type, "project");
    assert!(foreign.is_empty());
}

#[tokio::test]
async fn rls_is_enabled_on_projects_tables() {
    let t = TestApp::new().await;
    let project = t.create_project(&t.alice, "Obra").await;
    t.create_card(
        &id_of(&project),
        json!({
            "lane_id": lane_id(&project, "waiting"), "title": "a",
            "checklist": [{ "text": "item" }],
        }),
    )
    .await;
    let pool = &t.ctx.state.pool;
    let tables = [
        "project_card_checklist_items",
        "project_cards",
        "project_lanes",
        "projects",
    ];

    let flags: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT relname::text, relrowsecurity, relforcerowsecurity FROM pg_class \
         WHERE relname = ANY($1) ORDER BY relname",
    )
    .bind(tables.map(String::from).to_vec())
    .fetch_all(pool)
    .await
    .unwrap();

    assert_eq!(flags.len(), 4);
    assert!(
        flags.iter().all(|(_, enabled, forced)| *enabled && *forced),
        "{flags:?}"
    );
    for table in tables {
        let count = |user: Uuid| async move {
            let mut tx = begin_for_user(pool, user).await.unwrap();
            sqlx::query_scalar::<_, i64>(&format!("SELECT count(*) FROM {table}"))
                .fetch_one(&mut *tx)
                .await
                .unwrap()
        };
        assert!(count(ALICE).await > 0, "{table}");
        assert_eq!(count(BOB).await, 0, "{table}");
    }
}
