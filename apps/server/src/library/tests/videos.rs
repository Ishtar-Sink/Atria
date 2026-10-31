//! Vídeos: miniatura por oEmbed (injetada), envio manual e notas.

use axum::http::{Method, StatusCode};
use serde_json::json;
use uuid::Uuid;

use super::{ALICE, FakeResult, Harness, ids, minimal_png};

const YOUTUBE: &str = "https://www.youtube.com/watch?v=abc123";

#[tokio::test]
async fn ct29_video_gets_thumbnail_from_oembed() {
    let h = Harness::new().await;

    let video = h
        .create_video(&h.alice, json!({ "url": YOUTUBE, "tags": ["música"] }))
        .await;

    let file_id = video["thumbnail_file_id"].as_str().unwrap();
    let (status, headers, bytes) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;
    assert_eq!(video["title"], "Título do provedor");
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "image/png");
    assert_eq!(bytes, minimal_png());
    assert_eq!(h.fetcher.call_count(), 1);
}

#[tokio::test]
async fn cb12_video_without_internet_is_created_without_thumbnail() {
    let h = Harness::with_fetcher(FakeResult::NetworkError).await;

    let video = h
        .create_video(&h.alice, json!({ "url": YOUTUBE, "title": "Meu vídeo" }))
        .await;

    assert_eq!(video["thumbnail_file_id"], serde_json::Value::Null);
    assert_eq!(video["title"], "Meu vídeo");
    assert_eq!(h.fetcher.call_count(), 1);
}

#[tokio::test]
async fn cb12_manual_thumbnail_upload() {
    let h = Harness::with_fetcher(FakeResult::NetworkError).await;
    let video = h.create_video(&h.alice, json!({ "url": YOUTUBE })).await;
    let id = video["id"].as_str().unwrap();

    let updated = h
        .upload_ok(
            &h.alice,
            &format!("/api/v1/videos/{id}/thumbnail"),
            minimal_png(),
        )
        .await;

    let file_id = updated["thumbnail_file_id"].as_str().unwrap();
    let (status, headers, _) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "image/png");
}

#[tokio::test]
async fn rf53_video_notes_history() {
    let h = Harness::new().await;
    let video = h.create_video(&h.alice, json!({ "url": YOUTUBE })).await;
    let id = video["id"].as_str().unwrap();
    let uri = format!("/api/v1/videos/{id}/video-notes");

    let first = h
        .create(&h.alice, &uri, json!({ "comment": "aos 3 minutos" }))
        .await;
    h.create(&h.alice, &uri, json!({ "comment": "refrão" }))
        .await;
    h.expect(
        &h.alice,
        Method::PATCH,
        &format!("{uri}/{}", first["id"].as_str().unwrap()),
        Some(json!({ "comment": "aos 4 minutos" })),
        StatusCode::OK,
    )
    .await;
    h.expect(
        &h.alice,
        Method::DELETE,
        &format!("{uri}/{}", first["id"].as_str().unwrap()),
        None,
        StatusCode::NO_CONTENT,
    )
    .await;

    let list = h.get(&h.alice, &uri).await;
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
    assert_eq!(list["items"][0]["comment"], "refrão");
}

#[tokio::test]
async fn video_from_unknown_provider_skips_oembed() {
    let h = Harness::new().await;

    let video = h
        .create_video(
            &h.alice,
            json!({ "url": "https://example.org/video/1", "title": "Outro" }),
        )
        .await;
    let insecure = h
        .create_video(
            &h.alice,
            json!({ "url": "http://www.youtube.com/watch?v=x" }),
        )
        .await;
    let invalid = h
        .expect(
            &h.alice,
            Method::POST,
            "/api/v1/videos",
            Some(json!({ "url": "javascript:alert(1)" })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(video["thumbnail_file_id"], serde_json::Value::Null);
    assert_eq!(insecure["thumbnail_file_id"], serde_json::Value::Null);
    assert_eq!(invalid["code"], "validation_failed");
    assert_eq!(h.fetcher.call_count(), 0);
}

#[tokio::test]
async fn video_deletion_calls_entity_deleted_hook() {
    let h = Harness::new().await;
    let video = h.create_video(&h.alice, json!({ "url": YOUTUBE })).await;
    let id = video["id"].as_str().unwrap();

    h.expect(
        &h.alice,
        Method::DELETE,
        &format!("/api/v1/videos/{id}"),
        None,
        StatusCode::NO_CONTENT,
    )
    .await;

    let (status, body) = h
        .call(&h.alice, Method::GET, &format!("/api/v1/videos/{id}"), None)
        .await;
    assert_eq!(
        h.hook_calls.lock().unwrap().clone(),
        vec![(ALICE, "video", id.parse::<Uuid>().unwrap())]
    );
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "video_not_found");
}

#[tokio::test]
async fn other_user_video_returns_404() {
    let h = Harness::new().await;
    let video = h.create_video(&h.alice, json!({ "url": YOUTUBE })).await;
    let id = video["id"].as_str().unwrap();
    let note = h
        .create(
            &h.alice,
            &format!("/api/v1/videos/{id}/video-notes"),
            json!({ "comment": "x" }),
        )
        .await;
    let note_id = note["id"].as_str().unwrap();
    let base = format!("/api/v1/videos/{id}");
    let attempts = [
        (Method::GET, base.clone(), None),
        (Method::PATCH, base.clone(), Some(json!({ "title": "x" }))),
        (Method::DELETE, base.clone(), None),
        (Method::GET, format!("{base}/video-notes"), None),
        (
            Method::POST,
            format!("{base}/video-notes"),
            Some(json!({ "comment": "x" })),
        ),
        (
            Method::PATCH,
            format!("{base}/video-notes/{note_id}"),
            Some(json!({ "comment": "y" })),
        ),
        (
            Method::DELETE,
            format!("{base}/video-notes/{note_id}"),
            None,
        ),
        (
            Method::GET,
            format!(
                "/api/v1/files/{}",
                video["thumbnail_file_id"].as_str().unwrap()
            ),
            None,
        ),
    ];

    for (method, uri, body) in attempts {
        let (status, _) = h.call(&h.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
    }
    let (status, _) = h
        .upload(&h.bob, &format!("{base}/thumbnail"), minimal_png())
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(ids(&h.get(&h.bob, "/api/v1/videos").await).is_empty());
}

fn titles(page: &serde_json::Value) -> Vec<String> {
    let mut titles: Vec<String> = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["title"].as_str().unwrap().to_owned())
        .collect();
    titles.sort();
    titles
}

#[tokio::test]
async fn pd35_video_watch_status_defaults_to_to_watch_and_can_be_changed() {
    let h = Harness::new().await;
    let created = h.create_video(&h.alice, json!({ "url": YOUTUBE })).await;
    let id = created["id"].as_str().unwrap();
    assert_eq!(created["watch_status"], "to_watch");

    for status in ["watching", "watched"] {
        let patched = h
            .expect(
                &h.alice,
                Method::PATCH,
                &format!("/api/v1/videos/{id}"),
                Some(json!({ "watch_status": status })),
                StatusCode::OK,
            )
            .await;
        assert_eq!(patched["watch_status"], status);
    }

    let detail = h.get(&h.alice, &format!("/api/v1/videos/{id}")).await;
    let list = h.get(&h.alice, "/api/v1/videos").await;
    assert_eq!(detail["watch_status"], "watched");
    assert_eq!(list["items"][0]["watch_status"], "watched");
}

#[tokio::test]
async fn pd35_videos_listing_filters_by_watch_status() {
    let h = Harness::new().await;
    for (title, status, tag) in [
        ("A", "to_watch", "x"),
        ("B", "watching", "x"),
        ("C", "watching", "y"),
        ("D", "watched", "x"),
    ] {
        h.create_video(
            &h.alice,
            json!({ "url": "https://example.com/v", "title": title,
                    "watch_status": status, "tags": [tag] }),
        )
        .await;
    }
    h.create_video(
        &h.bob,
        json!({ "url": "https://example.com/v", "title": "Do Bob", "watch_status": "watching" }),
    )
    .await;

    let watching = h
        .get(&h.alice, "/api/v1/videos?watch_status=watching")
        .await;
    let combined = h
        .get(&h.alice, "/api/v1/videos?watch_status=watching&tag=x")
        .await;
    let to_watch = h
        .get(&h.alice, "/api/v1/videos?watch_status=to_watch")
        .await;

    assert_eq!(titles(&watching), ["B", "C"]);
    assert_eq!(titles(&combined), ["B"]);
    assert_eq!(titles(&to_watch), ["A"]);
}

#[tokio::test]
async fn pd35_video_rejects_unknown_watch_status_with_422() {
    let h = Harness::new().await;

    let created = h
        .expect(
            &h.alice,
            Method::POST,
            "/api/v1/videos",
            Some(json!({ "url": YOUTUBE, "watch_status": "to_read" })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;
    let listed = h
        .expect(
            &h.alice,
            Method::GET,
            "/api/v1/videos?watch_status=to_read",
            None,
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(created["code"], "validation_failed");
    assert_eq!(listed["code"], "validation_failed");
}

#[tokio::test]
async fn pd37_video_channel_is_saved_edited_and_cleared() {
    let h = Harness::new().await;
    let created = h
        .create_video(
            &h.alice,
            json!({ "url": YOUTUBE, "channel": "Canal Céu Aberto" }),
        )
        .await;
    let id = created["id"].as_str().unwrap();
    let uri = format!("/api/v1/videos/{id}");
    assert_eq!(created["channel"], "Canal Céu Aberto");

    let edited = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "channel": "Outro Canal" })),
            StatusCode::OK,
        )
        .await;
    assert_eq!(edited["channel"], "Outro Canal");

    let cleared = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "channel": null })),
            StatusCode::OK,
        )
        .await;
    assert!(cleared["channel"].is_null());

    let too_long = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "channel": "a".repeat(301) })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;
    assert_eq!(too_long["code"], "validation_failed");
    let detail = h.get(&h.alice, &uri).await;
    assert!(detail["channel"].is_null());
}

#[tokio::test]
async fn pd37_videos_listing_finds_by_channel_text() {
    let h = Harness::new().await;
    h.create_video(
        &h.alice,
        json!({ "url": YOUTUBE, "title": "Aula", "channel": "Canal Céu Aberto" }),
    )
    .await;
    h.create_video(
        &h.alice,
        json!({ "url": YOUTUBE, "title": "Outro", "channel": "Cozinha" }),
    )
    .await;

    let found = h.get(&h.alice, "/api/v1/videos?q=ceu%20aberto").await;

    assert_eq!(titles(&found), ["Aula"]);
}
