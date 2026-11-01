//! Artigos: status de leitura, notas, PDF, posição e destaques.

use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{ALICE, Harness, ids, minimal_jpeg, minimal_pdf, minimal_png};

fn rect() -> Value {
    json!([{ "x": 0.1, "y": 0.2, "width": 0.5, "height": 0.04 }])
}

#[tokio::test]
async fn ct29_article_with_status_and_note_history() {
    let h = Harness::new().await;
    let id = h
        .create_article(
            &h.alice,
            json!({
                "title": "Sobre a leitura",
                "url": "https://example.com/artigo",
                "author": "Autor",
                "source": "Blog",
                "tags": ["ensaio"],
                "reading_status": "reading"
            }),
        )
        .await;
    let uri = format!("/api/v1/articles/{id}");

    let article = h.get(&h.alice, &uri).await;
    h.create(
        &h.alice,
        &format!("{uri}/article-notes"),
        json!({ "comment": "primeira" }),
    )
    .await;
    h.create(
        &h.alice,
        &format!("{uri}/article-notes"),
        json!({ "comment": "segunda" }),
    )
    .await;
    let patched = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "reading_status": "read" })),
            StatusCode::OK,
        )
        .await;
    let invalid = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "reading_status": "abandoned" })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    let notes = h.get(&h.alice, &format!("{uri}/article-notes")).await;
    assert_eq!(article["reading_status"], "reading");
    assert_eq!(article["source"], "Blog");
    assert_eq!(patched["reading_status"], "read");
    assert_eq!(invalid["code"], "validation_failed");
    assert_eq!(notes["items"].as_array().unwrap().len(), 2);
    assert_eq!(notes["items"][0]["comment"], "segunda");
}

#[tokio::test]
async fn rf64_article_pdf_upload_and_download() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;

    let article = h
        .upload_ok(
            &h.alice,
            &format!("/api/v1/articles/{id}/pdf"),
            minimal_pdf(),
        )
        .await;
    let file_id = article["pdf_file_id"].as_str().unwrap();
    let (status, headers, bytes) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "application/pdf");
    assert_eq!(bytes, minimal_pdf());
}

#[tokio::test]
async fn ct35_article_reading_position_resumes_at_page_12() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let uri = format!("/api/v1/articles/{id}/reading-position");
    let before = h.get(&h.alice, &uri).await;

    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 12 })),
        StatusCode::OK,
    )
    .await;
    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 3 })),
        StatusCode::OK,
    )
    .await;
    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 12 })),
        StatusCode::OK,
    )
    .await;

    assert_eq!(before["page"], Value::Null);
    assert_eq!(h.get(&h.alice, &uri).await["page"], 12);
}

#[tokio::test]
async fn rn22_article_response_has_no_progress() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;

    let article = h.get(&h.alice, &format!("/api/v1/articles/{id}")).await;
    let list = h.get(&h.alice, "/api/v1/articles").await;

    for body in [&article, &list["items"][0]] {
        assert!(body.get("progress_percent").is_none());
        assert!(body.get("pages_read_total").is_none());
    }
    assert_eq!(article["reading_status"], "to_read");
}

#[tokio::test]
async fn ct37_article_note_from_quote() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let uri = format!("/api/v1/articles/{id}/article-notes");

    let note = h
        .create(&h.alice, &uri, json!({ "quote": "um trecho", "page": 4 }))
        .await;

    assert_eq!(note["quote"], "um trecho");
    assert_eq!(note["page"], 4);
    let edited = h
        .expect(
            &h.alice,
            Method::PATCH,
            &format!("{uri}/{}", note["id"].as_str().unwrap()),
            Some(json!({ "comment": "concordo" })),
            StatusCode::OK,
        )
        .await;
    assert_eq!(edited["comment"], "concordo");
    assert_eq!(edited["quote"], "um trecho");
}

#[tokio::test]
async fn ct38_article_highlights_are_listed() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let article = h
        .upload_ok(
            &h.alice,
            &format!("/api/v1/articles/{id}/pdf"),
            minimal_pdf(),
        )
        .await;
    let file_id = article["pdf_file_id"].as_str().unwrap();
    let uri = format!("/api/v1/articles/{id}/highlights");

    h.create(
        &h.alice,
        &uri,
        json!({ "file_id": file_id, "page": 2, "color": "#047857", "text": "a", "rects": rect() }),
    )
    .await;
    h.create(
        &h.alice,
        &uri,
        json!({ "file_id": file_id, "page": 3, "color": "#6d28d9", "text": "b", "rects": rect() }),
    )
    .await;

    let list = h.get(&h.alice, &uri).await;
    assert_eq!(list["items"].as_array().unwrap().len(), 2);
    assert!(
        list["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item["is_current_file"] == true)
    );
}

#[tokio::test]
async fn article_deletion_calls_entity_deleted_hook() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;

    h.expect(
        &h.alice,
        Method::DELETE,
        &format!("/api/v1/articles/{id}"),
        None,
        StatusCode::NO_CONTENT,
    )
    .await;

    let (status, body) = h
        .call(
            &h.alice,
            Method::GET,
            &format!("/api/v1/articles/{id}"),
            None,
        )
        .await;
    assert_eq!(
        h.hook_calls.lock().unwrap().clone(),
        vec![(ALICE, "article", id.parse::<Uuid>().unwrap())]
    );
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "article_not_found");
}

#[tokio::test]
async fn other_user_article_resources_return_404() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let article = h
        .upload_ok(
            &h.alice,
            &format!("/api/v1/articles/{id}/pdf"),
            minimal_pdf(),
        )
        .await;
    let file_id = article["pdf_file_id"].as_str().unwrap();
    let note = h
        .create(
            &h.alice,
            &format!("/api/v1/articles/{id}/article-notes"),
            json!({ "comment": "x" }),
        )
        .await;
    let note_id = note["id"].as_str().unwrap();
    let base = format!("/api/v1/articles/{id}");
    let attempts = [
        (Method::GET, base.clone(), None),
        (Method::PATCH, base.clone(), Some(json!({ "title": "x" }))),
        (Method::DELETE, base.clone(), None),
        (Method::GET, format!("{base}/article-notes"), None),
        (
            Method::POST,
            format!("{base}/article-notes"),
            Some(json!({ "comment": "x" })),
        ),
        (
            Method::PATCH,
            format!("{base}/article-notes/{note_id}"),
            Some(json!({ "comment": "y" })),
        ),
        (
            Method::DELETE,
            format!("{base}/article-notes/{note_id}"),
            None,
        ),
        (Method::GET, format!("{base}/reading-position"), None),
        (
            Method::PUT,
            format!("{base}/reading-position"),
            Some(json!({ "page": 3 })),
        ),
        (Method::GET, format!("{base}/highlights"), None),
        (
            Method::POST,
            format!("{base}/highlights"),
            Some(
                json!({ "file_id": file_id, "page": 1, "color": "#0369a1", "text": "x", "rects": rect() }),
            ),
        ),
    ];

    for (method, uri, body) in attempts {
        let (status, _) = h.call(&h.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
    }
    let (status, _) = h
        .upload(&h.bob, &format!("{base}/pdf"), minimal_pdf())
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert!(ids(&h.get(&h.bob, "/api/v1/articles").await).is_empty());
}

// ---- Capa por upload (PD-36) ---------------------------------------------------

#[tokio::test]
async fn pd36_article_cover_upload_read_and_replace() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let cover_uri = format!("/api/v1/articles/{id}/cover");

    let article = h.upload_ok(&h.alice, &cover_uri, minimal_png()).await;
    let first_id = article["cover_file_id"].as_str().unwrap().to_owned();
    let (status, headers, bytes) = h.download(&h.alice, &cover_uri).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "image/png");
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert!(
        headers["content-disposition"]
            .to_str()
            .unwrap()
            .starts_with("inline")
    );
    assert_eq!(headers["cache-control"], "private, no-store");
    assert_eq!(bytes, minimal_png());

    let replaced = h.upload_ok(&h.alice, &cover_uri, minimal_jpeg()).await;
    let (new_status, new_headers, _) = h.download(&h.alice, &cover_uri).await;
    let (old_status, _, _) = h
        .download(&h.alice, &format!("/api/v1/files/{first_id}"))
        .await;

    assert_ne!(replaced["cover_file_id"], first_id.as_str());
    assert_eq!(new_status, StatusCode::OK);
    assert_eq!(new_headers["content-type"], "image/jpeg");
    assert_eq!(old_status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn pd36_article_cover_remove() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let cover_uri = format!("/api/v1/articles/{id}/cover");
    let article = h.upload_ok(&h.alice, &cover_uri, minimal_png()).await;
    let file_id = article["cover_file_id"].as_str().unwrap().to_owned();

    h.expect(
        &h.alice,
        Method::DELETE,
        &cover_uri,
        None,
        StatusCode::NO_CONTENT,
    )
    .await;
    let detail = h.get(&h.alice, &format!("/api/v1/articles/{id}")).await;
    let (status, body) = h.call(&h.alice, Method::GET, &cover_uri, None).await;
    let (old_status, _, _) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;
    h.expect(
        &h.alice,
        Method::DELETE,
        &cover_uri,
        None,
        StatusCode::NO_CONTENT,
    )
    .await;

    assert_eq!(detail["cover_file_id"], Value::Null);
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "cover_not_found");
    assert_eq!(old_status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn pd36_article_cover_rejects_non_image_with_415() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;

    let (status, body) = h
        .upload(
            &h.alice,
            &format!("/api/v1/articles/{id}/cover"),
            minimal_pdf(),
        )
        .await;

    assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(body["code"], "unsupported_file_type");
}

#[tokio::test]
async fn pd36_article_cover_over_5_mib_is_rejected_with_413() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let mut big = minimal_png();
    big.resize(5 * 1024 * 1024 + 1, 0);

    let (status, body) = h
        .upload(&h.alice, &format!("/api/v1/articles/{id}/cover"), big)
        .await;

    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body["code"], "file_too_large");
}

#[tokio::test]
async fn pd36_other_user_article_cover_returns_404() {
    let h = Harness::new().await;
    let id = h
        .create_article(&h.alice, json!({ "title": "Artigo" }))
        .await;
    let cover_uri = format!("/api/v1/articles/{id}/cover");
    let article = h.upload_ok(&h.alice, &cover_uri, minimal_png()).await;
    let file_id = article["cover_file_id"].as_str().unwrap();

    let (get_status, _, _) = h.download(&h.bob, &cover_uri).await;
    let (put_status, _) = h.upload(&h.bob, &cover_uri, minimal_png()).await;
    let (delete_status, _) = h.call(&h.bob, Method::DELETE, &cover_uri, None).await;
    let (file_status, _, _) = h
        .download(&h.bob, &format!("/api/v1/files/{file_id}"))
        .await;

    assert_eq!(get_status, StatusCode::NOT_FOUND);
    assert_eq!(put_status, StatusCode::NOT_FOUND);
    assert_eq!(delete_status, StatusCode::NOT_FOUND);
    assert_eq!(file_status, StatusCode::NOT_FOUND);
    assert_eq!(
        h.get(&h.alice, &cover_uri.replace("/cover", "")).await["cover_file_id"],
        file_id
    );
}
