//! Livros: progresso, sessões, notas, capa, PDF, posição e destaques.

use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{ALICE, Harness, book_body, ids, minimal_jpeg, minimal_pdf, minimal_png};

fn rect() -> Value {
    json!([{ "x": 0.12, "y": 0.40, "width": 0.60, "height": 0.03 }])
}

async fn book_with_pdf(h: &Harness) -> (String, String) {
    let id = h
        .create_book(&h.alice, book_body("Dom Casmurro", 200))
        .await;
    let book = h
        .upload_ok(&h.alice, &format!("/api/v1/books/{id}/pdf"), minimal_pdf())
        .await;
    let file_id = book["pdf_file_id"].as_str().unwrap().to_owned();
    (id, file_id)
}

async fn highlight(h: &Harness, id: &str, file_id: &str, color: &str, page: i32) -> Value {
    h.create(
        &h.alice,
        &format!("/api/v1/books/{id}/highlights"),
        json!({ "file_id": file_id, "page": page, "color": color, "text": "trecho", "rects": rect() }),
    )
    .await
}

#[tokio::test]
async fn ct28_book_progress_27_5_after_editing_first_session() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let first = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/reading-sessions"),
            json!({ "read_on": "2026-10-26", "pages_read": 20, "observation": "capítulo 1" }),
        )
        .await;
    h.create(
        &h.alice,
        &format!("/api/v1/books/{id}/reading-sessions"),
        json!({ "read_on": "2026-10-27", "pages_read": 30 }),
    )
    .await;

    h.expect(
        &h.alice,
        Method::PATCH,
        &format!(
            "/api/v1/books/{id}/reading-sessions/{}",
            first["id"].as_str().unwrap()
        ),
        Some(json!({ "pages_read": 25 })),
        StatusCode::OK,
    )
    .await;

    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
    let list = h.get(&h.alice, "/api/v1/books").await;
    assert_eq!(detail["progress_percent"], 27.5);
    assert_eq!(detail["pages_read_total"], 55);
    assert_eq!(list["items"][0]["progress_percent"], 27.5);
}

#[tokio::test]
async fn cb05_session_beyond_total_caps_progress_at_100() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 100)).await;

    h.create(
        &h.alice,
        &format!("/api/v1/books/{id}/reading-sessions"),
        json!({ "read_on": "2026-10-26", "pages_read": 250 }),
    )
    .await;

    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
    assert_eq!(detail["progress_percent"], 100.0);
    assert_eq!(detail["pages_read_total"], 250);
}

#[tokio::test]
async fn rf48_reading_session_can_be_edited_and_deleted() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let session = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/reading-sessions"),
            json!({ "read_on": "2026-10-26", "pages_read": 20 }),
        )
        .await;
    let uri = format!(
        "/api/v1/books/{id}/reading-sessions/{}",
        session["id"].as_str().unwrap()
    );

    let edited = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "observation": "relido", "pages_read": 22 })),
            StatusCode::OK,
        )
        .await;
    h.expect(&h.alice, Method::DELETE, &uri, None, StatusCode::NO_CONTENT)
        .await;
    let (status, body) = h.call(&h.alice, Method::DELETE, &uri, None).await;
    let list = h
        .get(&h.alice, &format!("/api/v1/books/{id}/reading-sessions"))
        .await;

    assert_eq!(edited["observation"], "relido");
    assert_eq!(edited["pages_read"], 22);
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "reading_session_not_found");
    assert!(list["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn rf50_reading_sessions_and_book_notes_are_listed_separately() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    h.create(
        &h.alice,
        &format!("/api/v1/books/{id}/reading-sessions"),
        json!({ "read_on": "2026-10-26", "pages_read": 20 }),
    )
    .await;
    h.create(
        &h.alice,
        &format!("/api/v1/books/{id}/book-notes"),
        json!({ "comment": "ótimo capítulo" }),
    )
    .await;

    let sessions = h
        .get(&h.alice, &format!("/api/v1/books/{id}/reading-sessions"))
        .await;
    let notes = h
        .get(&h.alice, &format!("/api/v1/books/{id}/book-notes"))
        .await;

    assert_eq!(sessions["items"].as_array().unwrap().len(), 1);
    assert_eq!(notes["items"].as_array().unwrap().len(), 1);
    assert!(sessions["items"][0].get("comment").is_none());
    assert!(notes["items"][0].get("pages_read").is_none());
}

#[tokio::test]
async fn rf47_book_cover_upload_is_served_as_image() {
    let h = Harness::new().await;
    let id = h
        .create_book(
            &h.alice,
            json!({ "title": "Livro", "author": "Autora", "publisher": "Editora", "page_count": 10, "tags": ["ficção", "clássico"] }),
        )
        .await;

    let book = h
        .upload_ok(
            &h.alice,
            &format!("/api/v1/books/{id}/cover"),
            minimal_png(),
        )
        .await;
    let file_id = book["cover_file_id"].as_str().unwrap();
    let (status, headers, bytes) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;

    assert_eq!(book["author"], "Autora");
    assert_eq!(book["tags"], json!(["ficção", "clássico"]));
    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "image/png");
    assert_eq!(bytes, minimal_png());
}

#[tokio::test]
async fn rf51_book_pdf_upload_and_download() {
    let h = Harness::new().await;
    let (_, file_id) = book_with_pdf(&h).await;

    let (status, headers, bytes) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "application/pdf");
    assert_eq!(bytes, minimal_pdf());
}

#[tokio::test]
async fn ct35_book_reading_position_resumes_at_page_12() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/reading-position");
    let before = h.get(&h.alice, &uri).await;

    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 12 })),
        StatusCode::OK,
    )
    .await;

    let after = h.get(&h.alice, &uri).await;
    assert_eq!(before["page"], Value::Null);
    assert_eq!(after["page"], 12);
}

#[tokio::test]
async fn cb18_reading_position_accepts_page_before_previous() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/reading-position");
    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 40 })),
        StatusCode::OK,
    )
    .await;

    h.expect(
        &h.alice,
        Method::PUT,
        &uri,
        Some(json!({ "page": 7 })),
        StatusCode::OK,
    )
    .await;
    let invalid = h
        .expect(
            &h.alice,
            Method::PUT,
            &uri,
            Some(json!({ "page": 0 })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(h.get(&h.alice, &uri).await["page"], 7);
    assert_eq!(invalid["code"], "validation_failed");
}

#[tokio::test]
async fn ct36_session_with_page_range_40_to_62_enters_history_and_progress() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;

    let session = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/reading-sessions"),
            json!({ "read_on": "2026-10-26", "pages_read": 22, "from_page": 40, "to_page": 62 }),
        )
        .await;
    let invalid = h
        .expect(
            &h.alice,
            Method::POST,
            &format!("/api/v1/books/{id}/reading-sessions"),
            Some(
                json!({ "read_on": "2026-10-26", "pages_read": 5, "from_page": 62, "to_page": 40 }),
            ),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    let history = h
        .get(&h.alice, &format!("/api/v1/books/{id}/reading-sessions"))
        .await;
    let book = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
    assert_eq!(session["from_page"], 40);
    assert_eq!(session["to_page"], 62);
    assert_eq!(history["items"].as_array().unwrap().len(), 1);
    assert_eq!(book["progress_percent"], 11.0);
    assert_eq!(invalid["code"], "validation_failed");
}

#[tokio::test]
async fn ct37_book_note_from_quote_with_and_without_comment() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/book-notes");

    let bare = h
        .create(
            &h.alice,
            &uri,
            json!({ "quote": "Capitu era dissimulada", "page": 31 }),
        )
        .await;
    let commented = h
        .create(
            &h.alice,
            &uri,
            json!({ "quote": "Bentinho", "page": 32, "comment": "volta no cap. 5" }),
        )
        .await;
    let empty = h
        .expect(
            &h.alice,
            Method::POST,
            &uri,
            Some(json!({ "page": 3 })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    let list = h.get(&h.alice, &uri).await;
    assert_eq!(bare["quote"], "Capitu era dissimulada");
    assert_eq!(bare["page"], 31);
    assert_eq!(bare["comment"], Value::Null);
    assert_eq!(commented["comment"], "volta no cap. 5");
    assert_eq!(list["items"].as_array().unwrap().len(), 2);
    assert_eq!(empty["code"], "validation_failed");
}

#[tokio::test]
async fn cb20_book_note_with_page_and_comment_only() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/book-notes");

    let note = h
        .create(
            &h.alice,
            &uri,
            json!({ "page": 9, "comment": "página escaneada" }),
        )
        .await;
    let edited = h
        .expect(
            &h.alice,
            Method::PATCH,
            &format!("{uri}/{}", note["id"].as_str().unwrap()),
            Some(json!({ "comment": "revisada" })),
            StatusCode::OK,
        )
        .await;

    assert_eq!(note["quote"], Value::Null);
    assert_eq!(note["page"], 9);
    assert_eq!(edited["comment"], "revisada");
    h.expect(
        &h.alice,
        Method::DELETE,
        &format!("{uri}/{}", note["id"].as_str().unwrap()),
        None,
        StatusCode::NO_CONTENT,
    )
    .await;
}

#[tokio::test]
async fn ct38_book_highlights_with_two_colors_are_listed() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;

    highlight(&h, &id, &file_id, "#0e7490", 3).await;
    highlight(&h, &id, &file_id, "#92400e", 4).await;

    let list = h
        .get(&h.alice, &format!("/api/v1/books/{id}/highlights"))
        .await;
    let colors: Vec<_> = list["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["color"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(colors.len(), 2);
    assert!(colors.contains(&"#0e7490".to_owned()) && colors.contains(&"#92400e".to_owned()));
    assert_eq!(list["items"][0]["is_current_file"], true);
    assert_eq!(list["items"][0]["rects"][0]["width"], 0.60);
}

#[tokio::test]
async fn cb19_highlights_of_replaced_pdf_are_marked_as_other_file() {
    let h = Harness::new().await;
    let (id, old_file_id) = book_with_pdf(&h).await;
    highlight(&h, &id, &old_file_id, "#0369a1", 3).await;

    let replaced = h
        .upload_ok(&h.alice, &format!("/api/v1/books/{id}/pdf"), minimal_pdf())
        .await;
    let new_file_id = replaced["pdf_file_id"].as_str().unwrap();

    let list = h
        .get(&h.alice, &format!("/api/v1/books/{id}/highlights"))
        .await;
    let (old_status, _, _) = h
        .download(&h.alice, &format!("/api/v1/files/{old_file_id}"))
        .await;
    let stale = h
        .expect(
            &h.alice,
            Method::POST,
            &format!("/api/v1/books/{id}/highlights"),
            Some(json!({ "file_id": old_file_id, "page": 1, "color": "#0369a1", "text": "x", "rects": rect() })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;
    assert_ne!(new_file_id, old_file_id);
    assert_eq!(list["items"].as_array().unwrap().len(), 1);
    assert_eq!(list["items"][0]["file_id"], old_file_id);
    assert_eq!(list["items"][0]["is_current_file"], false);
    assert_eq!(old_status, StatusCode::NOT_FOUND);
    assert_eq!(stale["code"], "highlight_file_mismatch");
}

#[tokio::test]
async fn highlight_on_book_without_pdf_is_rejected() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;

    let error = h
        .expect(
            &h.alice,
            Method::POST,
            &format!("/api/v1/books/{id}/highlights"),
            Some(json!({ "file_id": Uuid::from_u128(9), "page": 1, "color": "#0369a1", "text": "x", "rects": rect() })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(error["code"], "pdf_required");
}

#[tokio::test]
async fn book_deletion_calls_entity_deleted_hook() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;

    h.expect(
        &h.alice,
        Method::DELETE,
        &format!("/api/v1/books/{id}"),
        None,
        StatusCode::NO_CONTENT,
    )
    .await;

    let (status, body) = h
        .call(&h.alice, Method::GET, &format!("/api/v1/books/{id}"), None)
        .await;
    let calls = h.hook_calls.lock().unwrap().clone();
    assert_eq!(calls, vec![(ALICE, "book", id.parse::<Uuid>().unwrap())]);
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "book_not_found");
}

#[tokio::test]
async fn other_user_book_resources_return_404() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;
    let session = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/reading-sessions"),
            json!({ "read_on": "2026-10-26", "pages_read": 20 }),
        )
        .await;
    let note = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/book-notes"),
            json!({ "comment": "x" }),
        )
        .await;
    let session_id = session["id"].as_str().unwrap();
    let note_id = note["id"].as_str().unwrap();
    let base = format!("/api/v1/books/{id}");
    let attempts = [
        (Method::GET, base.clone(), None),
        (Method::PATCH, base.clone(), Some(json!({ "title": "x" }))),
        (Method::DELETE, base.clone(), None),
        (Method::GET, format!("{base}/reading-sessions"), None),
        (
            Method::POST,
            format!("{base}/reading-sessions"),
            Some(json!({ "read_on": "2026-10-26", "pages_read": 1 })),
        ),
        (
            Method::PATCH,
            format!("{base}/reading-sessions/{session_id}"),
            Some(json!({ "pages_read": 1 })),
        ),
        (
            Method::DELETE,
            format!("{base}/reading-sessions/{session_id}"),
            None,
        ),
        (Method::GET, format!("{base}/book-notes"), None),
        (
            Method::POST,
            format!("{base}/book-notes"),
            Some(json!({ "comment": "x" })),
        ),
        (
            Method::PATCH,
            format!("{base}/book-notes/{note_id}"),
            Some(json!({ "comment": "y" })),
        ),
        (Method::DELETE, format!("{base}/book-notes/{note_id}"), None),
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
        (Method::GET, format!("/api/v1/files/{file_id}"), None),
    ];

    for (method, uri, body) in attempts {
        let (status, _) = h.call(&h.bob, method.clone(), &uri, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
    }
    for (method, uri) in [
        (Method::PUT, format!("{base}/pdf")),
        (Method::PUT, format!("{base}/cover")),
    ] {
        let (status, _) = h.upload(&h.bob, &uri, minimal_pdf()).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method} {uri}");
    }
    let list = h.get(&h.bob, "/api/v1/books").await;
    assert!(ids(&list).is_empty());
    assert_eq!(h.get(&h.alice, &base).await["id"], id.as_str());
}

// ---- Capa por upload (PD-36) ---------------------------------------------------

#[tokio::test]
async fn pd36_book_cover_upload_read_and_replace() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;
    let cover_uri = format!("/api/v1/books/{id}/cover");

    let book = h.upload_ok(&h.alice, &cover_uri, minimal_png()).await;
    let first_id = book["cover_file_id"].as_str().unwrap().to_owned();
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
async fn pd36_book_cover_remove() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;
    let cover_uri = format!("/api/v1/books/{id}/cover");
    let book = h.upload_ok(&h.alice, &cover_uri, minimal_png()).await;
    let file_id = book["cover_file_id"].as_str().unwrap().to_owned();

    h.expect(
        &h.alice,
        Method::DELETE,
        &cover_uri,
        None,
        StatusCode::NO_CONTENT,
    )
    .await;
    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
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
async fn pd36_book_cover_rejects_non_image_with_415() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;

    let (status, body) = h
        .upload(
            &h.alice,
            &format!("/api/v1/books/{id}/cover"),
            minimal_pdf(),
        )
        .await;

    assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(body["code"], "unsupported_file_type");
}

#[tokio::test]
async fn pd36_book_cover_over_5_mib_is_rejected_with_413() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;
    let mut big = minimal_png();
    big.resize(5 * 1024 * 1024 + 1, 0);

    let (status, body) = h
        .upload(&h.alice, &format!("/api/v1/books/{id}/cover"), big)
        .await;

    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body["code"], "file_too_large");
}

// ---- Sessão de leitura por páginas lidas (PD-60) -------------------------------

#[tokio::test]
async fn pd60_session_with_only_pages_and_date_counts_in_progress() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;

    let session = h
        .create(
            &h.alice,
            &format!("/api/v1/books/{id}/reading-sessions"),
            json!({ "read_on": "2026-10-26", "pages_read": 50 }),
        )
        .await;

    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
    assert_eq!(session["pages_read"], 50);
    assert_eq!(session["from_page"], Value::Null);
    assert_eq!(session["to_page"], Value::Null);
    assert_eq!(detail["progress_percent"], 25.0);
}

#[tokio::test]
async fn pd60_session_without_pages_read_is_rejected() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;

    let body = h
        .expect(
            &h.alice,
            Method::POST,
            &format!("/api/v1/books/{id}/reading-sessions"),
            Some(json!({ "read_on": "2026-10-26" })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(body["code"], "validation_failed");
}

#[tokio::test]
async fn pd60_sessions_add_up_in_progress() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/reading-sessions");
    h.create(
        &h.alice,
        &uri,
        json!({ "read_on": "2026-10-26", "pages_read": 50, "from_page": 1, "to_page": 51 }),
    )
    .await;
    h.create(
        &h.alice,
        &uri,
        json!({ "read_on": "2026-10-27", "pages_read": 30 }),
    )
    .await;

    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;

    assert_eq!(detail["pages_read_total"], 80);
    assert_eq!(detail["progress_percent"], 40.0);
}

#[tokio::test]
async fn pd60_session_history_lists_pages_and_date() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 200)).await;
    let uri = format!("/api/v1/books/{id}/reading-sessions");
    h.create(
        &h.alice,
        &uri,
        json!({ "read_on": "2026-10-20", "pages_read": 10, "from_page": 5, "to_page": 15 }),
    )
    .await;
    h.create(
        &h.alice,
        &uri,
        json!({ "read_on": "2026-10-25", "pages_read": 30 }),
    )
    .await;

    let list = h.get(&h.alice, &uri).await;
    let items = list["items"].as_array().unwrap();

    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["read_on"], "2026-10-25");
    assert_eq!(items[0]["pages_read"], 30);
    assert_eq!(items[0]["from_page"], Value::Null);
    assert_eq!(items[1]["read_on"], "2026-10-20");
    assert_eq!(items[1]["pages_read"], 10);
    assert_eq!(items[1]["from_page"], 5);
    assert_eq!(items[1]["to_page"], 15);
}

#[tokio::test]
async fn pd35_book_reading_status_defaults_to_want_to_read_and_can_be_changed() {
    let h = Harness::new().await;
    let created = h
        .create(&h.alice, "/api/v1/books", book_body("Livro", 100))
        .await;
    let id = created["id"].as_str().unwrap();
    assert_eq!(created["reading_status"], "want_to_read");

    for status in ["reading", "read"] {
        let patched = h
            .expect(
                &h.alice,
                Method::PATCH,
                &format!("/api/v1/books/{id}"),
                Some(json!({ "reading_status": status })),
                StatusCode::OK,
            )
            .await;
        assert_eq!(patched["reading_status"], status);
    }

    let detail = h.get(&h.alice, &format!("/api/v1/books/{id}")).await;
    let list = h.get(&h.alice, "/api/v1/books").await;
    assert_eq!(detail["reading_status"], "read");
    assert_eq!(list["items"][0]["reading_status"], "read");
}

#[tokio::test]
async fn pd35_books_listing_filters_by_reading_status() {
    let h = Harness::new().await;
    for (title, status, tag) in [
        ("A", "want_to_read", "x"),
        ("B", "reading", "x"),
        ("C", "reading", "y"),
        ("D", "read", "x"),
    ] {
        h.create(
            &h.alice,
            "/api/v1/books",
            json!({ "title": title, "reading_status": status, "tags": [tag] }),
        )
        .await;
    }
    h.create(
        &h.bob,
        "/api/v1/books",
        json!({ "title": "Do Bob", "reading_status": "reading" }),
    )
    .await;

    let reading = h
        .get(&h.alice, "/api/v1/books?reading_status=reading")
        .await;
    let combined = h
        .get(&h.alice, "/api/v1/books?reading_status=reading&tag=x")
        .await;
    let want = h
        .get(&h.alice, "/api/v1/books?reading_status=want_to_read")
        .await;

    let titles = |page: &Value| -> Vec<String> {
        let mut titles: Vec<String> = page["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["title"].as_str().unwrap().to_owned())
            .collect();
        titles.sort();
        titles
    };
    assert_eq!(titles(&reading), ["B", "C"]);
    assert_eq!(titles(&combined), ["B"]);
    assert_eq!(titles(&want), ["A"]);
}

#[tokio::test]
async fn pd35_book_rejects_unknown_reading_status_with_422() {
    let h = Harness::new().await;

    let created = h
        .expect(
            &h.alice,
            Method::POST,
            "/api/v1/books",
            Some(json!({ "title": "Livro", "reading_status": "wishlist" })),
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;
    let listed = h
        .expect(
            &h.alice,
            Method::GET,
            "/api/v1/books?reading_status=finished",
            None,
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(created["code"], "validation_failed");
    assert_eq!(listed["code"], "validation_failed");
}
