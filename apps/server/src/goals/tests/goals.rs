//! Ciclo de metas e marcos, progresso e listagem (RF-36, RF-37, CT-23).

use axum::http::{Method, StatusCode};
use serde_json::json;

use super::TestApp;

#[tokio::test]
async fn goal_with_four_milestones_and_one_done_shows_25_percent() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(
            &t.alice,
            json!({ "title": "Correr 10 km", "deadline": "2027-03-01" }),
        )
        .await;
    let id = goal["id"].as_str().unwrap();
    assert_eq!(goal["progress_percent"], 0);
    let mut first = None;
    for title in ["Semana 1", "Semana 2", "Semana 3", "Semana 4"] {
        let milestone = t.create_milestone(&t.alice, id, title).await;
        first.get_or_insert(milestone["id"].as_str().unwrap().to_owned());
    }

    let uri = format!("/api/v1/goals/{id}/milestones/{}", first.unwrap());
    let (status, milestone) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "completed": true })),
        )
        .await;
    let one = t.get_goal(&t.alice, id).await;
    let (_, list) = t.call(&t.alice, Method::GET, "/api/v1/goals", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(milestone["completed"], true);
    assert_eq!(one["progress_percent"], 25);
    assert_eq!(one["milestone_count"], 4);
    assert_eq!(one["completed_milestone_count"], 1);
    assert_eq!(one["deadline"], "2027-03-01");
    assert_eq!(list["items"][0]["progress_percent"], 25);
}

#[tokio::test]
async fn creates_updates_and_deletes_goal() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(
            &t.alice,
            json!({ "title": "  Ler 12 livros ", "description": "Um por mês", "deadline": "2027-12-31" }),
        )
        .await;
    let id = goal["id"].as_str().unwrap().to_owned();
    assert_eq!(goal["title"], "Ler 12 livros");
    assert_eq!(goal["status"], "planned");
    assert_eq!(goal["visibility"], "personal");
    assert_eq!(goal["owner_id"], super::ALICE.to_string());
    assert_eq!(goal["created_at"], "2026-11-01T12:00:00Z");
    let uri = format!("/api/v1/goals/{id}");

    let (status, updated) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "status": "in_progress", "deadline": null, "description": null })),
        )
        .await;
    let (blank, problem) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "title": "  " })),
        )
        .await;
    let (bad_status, _) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "status": "nope" })),
        )
        .await;
    let (deleted, _) = t.call(&t.alice, Method::DELETE, &uri, None).await;
    let (after, problem_after) = t.call(&t.alice, Method::GET, &uri, None).await;
    let (_, list) = t.call(&t.alice, Method::GET, "/api/v1/goals", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["status"], "in_progress");
    assert!(updated["deadline"].is_null() && updated["description"].is_null());
    assert_eq!(updated["title"], "Ler 12 livros");
    assert_eq!(blank, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
    assert_eq!(problem["errors"][0]["field"], "title");
    assert_eq!(bad_status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(deleted, StatusCode::NO_CONTENT);
    assert_eq!(after, StatusCode::NOT_FOUND);
    assert_eq!(problem_after["code"], "not_found");
    assert!(list["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn reopening_milestone_lowers_progress() {
    let t = TestApp::new().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let id = goal["id"].as_str().unwrap();
    let a = t.create_milestone(&t.alice, id, "A").await;
    t.create_milestone(&t.alice, id, "B").await;
    let uri = format!(
        "/api/v1/goals/{id}/milestones/{}",
        a["id"].as_str().unwrap()
    );

    t.call(
        &t.alice,
        Method::PATCH,
        &uri,
        Some(json!({ "completed": true })),
    )
    .await;
    let done = t.get_goal(&t.alice, id).await;
    let (_, reopened) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "completed": false })),
        )
        .await;
    let after = t.get_goal(&t.alice, id).await;
    let (_, listed) = t
        .call(
            &t.alice,
            Method::GET,
            &format!("/api/v1/goals/{id}/milestones"),
            None,
        )
        .await;

    assert_eq!(done["progress_percent"], 50);
    assert_eq!(reopened["completed"], false);
    assert!(reopened["completed_at"].is_null());
    assert_eq!(after["progress_percent"], 0);
    assert_eq!(listed["items"][0]["title"], "A");
    assert_eq!(listed["items"][1]["position"], 1);
}

#[tokio::test]
async fn goal_list_filters_by_status_and_paginates() {
    let t = TestApp::new().await;
    let mut ids = Vec::new();
    for (title, status, deadline) in [
        ("Alfa", "planned", Some("2027-05-01")),
        ("Beta 100%", "completed", None),
        ("Gama", "planned", Some("2027-01-01")),
        ("Delta", "in_progress", Some("2027-03-01")),
    ] {
        let goal = t
            .create_goal(
                &t.alice,
                json!({ "title": title, "status": status, "deadline": deadline }),
            )
            .await;
        ids.push(goal["id"].as_str().unwrap().to_owned());
    }
    // Sem marcos, a meta concluída vale 100.
    let (_, completed) = t
        .call(
            &t.alice,
            Method::GET,
            "/api/v1/goals?status=completed",
            None,
        )
        .await;
    let (_, search) = t
        .call(&t.alice, Method::GET, "/api/v1/goals?q=100%25", None)
        .await;
    let (_, wildcard) = t
        .call(&t.alice, Method::GET, "/api/v1/goals?q=_", None)
        .await;

    let mut by_deadline = Vec::new();
    let mut uri = "/api/v1/goals?sort=deadline&limit=3".to_owned();
    loop {
        let (status, page) = t.call(&t.alice, Method::GET, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{page}");
        by_deadline.extend(
            page["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|g| g["title"].as_str().unwrap().to_owned()),
        );
        match page["next_cursor"].as_str() {
            Some(cursor) => uri = format!("/api/v1/goals?sort=deadline&limit=3&cursor={cursor}"),
            None => break,
        }
    }
    let mut newest = Vec::new();
    let mut uri = "/api/v1/goals?limit=3".to_owned();
    loop {
        let (_, page) = t.call(&t.alice, Method::GET, &uri, None).await;
        newest.extend(
            page["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|g| g["id"].as_str().unwrap().to_owned()),
        );
        match page["next_cursor"].as_str() {
            Some(cursor) => uri = format!("/api/v1/goals?limit=3&cursor={cursor}"),
            None => break,
        }
    }
    let (bad, problem) = t
        .call(&t.alice, Method::GET, "/api/v1/goals?cursor=xx", None)
        .await;

    assert_eq!(completed["items"].as_array().unwrap().len(), 1);
    assert_eq!(completed["items"][0]["progress_percent"], 100);
    assert_eq!(search["items"][0]["title"], "Beta 100%");
    assert_eq!(search["items"].as_array().unwrap().len(), 1);
    assert_eq!(wildcard["items"].as_array().unwrap().len(), 0);
    assert_eq!(by_deadline, ["Gama", "Delta", "Alfa", "Beta 100%"]);
    ids.reverse();
    assert_eq!(newest, ids);
    assert_eq!(bad, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["errors"][0]["field"], "cursor");
}

#[tokio::test]
async fn visibility_is_saved() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(&t.alice, json!({ "title": "Meta", "visibility": "shared" }))
        .await;
    let id = goal["id"].as_str().unwrap();
    let milestone = t.create_milestone(&t.alice, id, "Marco").await;
    let uri = format!("/api/v1/goals/{id}");

    let (_, patched) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "visibility": "personal" })),
        )
        .await;
    let (rejected, _) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "visibility": "public" })),
        )
        .await;

    assert_eq!(goal["visibility"], "shared");
    assert_eq!(milestone["visibility"], "personal");
    assert_eq!(patched["visibility"], "personal");
    assert_eq!(rejected, StatusCode::UNPROCESSABLE_ENTITY);
}

fn titles(page: &serde_json::Value) -> Vec<String> {
    page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|g| g["title"].as_str().unwrap().to_owned())
        .collect()
}

#[tokio::test]
async fn goal_labels_are_saved_and_replaced() {
    let t = TestApp::new().await;
    let goal = t
        .create_goal(
            &t.alice,
            json!({ "title": "Meta", "labels": [" casa ", "obra"] }),
        )
        .await;
    let plain = t.create_goal(&t.alice, json!({ "title": "Sem" })).await;
    let id = goal["id"].as_str().unwrap();
    let uri = format!("/api/v1/goals/{id}");

    let (_, replaced) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "labels": ["leitura"] })),
        )
        .await;
    let (_, kept) = t
        .call(
            &t.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "title": "Outro" })),
        )
        .await;
    let one = t.get_goal(&t.alice, id).await;
    let (_, list) = t.call(&t.alice, Method::GET, "/api/v1/goals", None).await;

    assert_eq!(goal["labels"], json!(["casa", "obra"]));
    assert_eq!(plain["labels"], json!([]));
    assert_eq!(replaced["labels"], json!(["leitura"]));
    assert_eq!(kept["labels"], json!(["leitura"]));
    assert_eq!(kept["title"], "Outro");
    assert_eq!(one["labels"], json!(["leitura"]));
    assert_eq!(list["items"][1]["labels"], json!(["leitura"]));
    assert_eq!(list["items"][0]["labels"], json!([]));
}

#[tokio::test]
async fn goal_labels_out_of_limits_return_422() {
    let t = TestApp::new().await;
    let goal = t.create_goal(&t.alice, json!({ "title": "Meta" })).await;
    let uri = format!("/api/v1/goals/{}", goal["id"].as_str().unwrap());
    let many: Vec<String> = (0..21).map(|n| format!("e{n}")).collect();
    let invalid = [
        json!(["casa", "CASA"]),
        json!(many),
        json!(["a".repeat(51)]),
    ];

    for labels in invalid {
        let (created, problem) = t
            .call(
                &t.alice,
                Method::POST,
                "/api/v1/goals",
                Some(json!({ "title": "Nova", "labels": labels })),
            )
            .await;
        let (patched, patch_problem) = t
            .call(
                &t.alice,
                Method::PATCH,
                &uri,
                Some(json!({ "labels": labels })),
            )
            .await;

        assert_eq!(created, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "labels");
        assert_eq!(patched, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(patch_problem["code"], "validation_failed");
    }
    let (_, list) = t.call(&t.alice, Method::GET, "/api/v1/goals", None).await;
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn goal_label_filter_lists_only_tagged_goals() {
    let t = TestApp::new().await;
    for (title, labels, status) in [
        ("A", json!(["casa"]), "planned"),
        ("B", json!(["casa", "obra"]), "in_progress"),
        ("C", json!([]), "planned"),
    ] {
        t.create_goal(
            &t.alice,
            json!({ "title": title, "labels": labels, "status": status }),
        )
        .await;
    }
    let get = |uri: &'static str| {
        let t = &t;
        async move { t.call(&t.alice, Method::GET, uri, None).await.1 }
    };

    let casa = get("/api/v1/goals?label=casa&sort=deadline").await;
    let obra = get("/api/v1/goals?label=obra").await;
    let nada = get("/api/v1/goals?label=nada").await;
    let combined = get("/api/v1/goals?label=casa&status=in_progress").await;
    let mut paged = Vec::new();
    let mut uri = "/api/v1/goals?label=casa&limit=1".to_owned();
    loop {
        let (status, page) = t.call(&t.alice, Method::GET, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{page}");
        paged.extend(titles(&page));
        match page["next_cursor"].as_str() {
            Some(cursor) => uri = format!("/api/v1/goals?label=casa&limit=1&cursor={cursor}"),
            None => break,
        }
    }
    paged.sort();

    let mut casa_titles = titles(&casa);
    casa_titles.sort();
    assert_eq!(casa_titles, ["A", "B"]);
    assert_eq!(titles(&obra), ["B"]);
    assert!(titles(&nada).is_empty());
    assert_eq!(titles(&combined), ["B"]);
    assert_eq!(paged, ["A", "B"]);
}

#[tokio::test]
async fn goal_label_filter_rejects_invalid_value_with_422() {
    let t = TestApp::new().await;
    let long = format!("/api/v1/goals?label={}", "a".repeat(51));

    for uri in ["/api/v1/goals?label=".to_owned(), long] {
        let (status, problem) = t.call(&t.alice, Method::GET, &uri, None).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{uri}");
        assert_eq!(problem["code"], "validation_failed");
        assert_eq!(problem["errors"][0]["field"], "label");
    }
}

#[tokio::test]
async fn goal_list_filters_by_has_deadline() {
    let t = TestApp::new().await;
    t.create_goal(
        &t.alice,
        json!({ "title": "Com", "deadline": "2027-01-01" }),
    )
    .await;
    t.create_goal(&t.alice, json!({ "title": "Sem" })).await;

    for sort in ["deadline", "created_at"] {
        let list = |filter: &str| {
            let uri = format!("/api/v1/goals?sort={sort}{filter}");
            let t = &t;
            async move { t.call(&t.alice, Method::GET, &uri, None).await.1 }
        };
        let with = list("&has_deadline=true").await;
        let without = list("&has_deadline=false").await;
        let all = list("").await;

        assert_eq!(titles(&with), ["Com"], "{sort}");
        assert_eq!(titles(&without), ["Sem"], "{sort}");
        assert_eq!(titles(&all).len(), 2, "{sort}");
    }
}

#[tokio::test]
async fn goal_has_deadline_rejects_invalid_value_with_422() {
    let t = TestApp::new().await;

    let (status, problem) = t
        .call(
            &t.alice,
            Method::GET,
            "/api/v1/goals?has_deadline=talvez",
            None,
        )
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "validation_failed");
}
