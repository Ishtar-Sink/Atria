//! Arquivos: acesso só do dono, tipo e tamanho, RLS, busca e listagem.

use axum::http::{Method, StatusCode};
use serde_json::json;

use super::{ALICE, BOB, Harness, book_body, ids, minimal_pdf, minimal_png};
use crate::library::LibrarySearch;

async fn book_pdf_file(h: &Harness) -> (String, String) {
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;
    let book = h
        .upload_ok(&h.alice, &format!("/api/v1/books/{id}/pdf"), minimal_pdf())
        .await;
    (id, book["pdf_file_id"].as_str().unwrap().to_owned())
}

#[tokio::test]
async fn rn25_file_is_served_only_to_owner() {
    let h = Harness::new().await;
    let (_, file_id) = book_pdf_file(&h).await;
    let uri = format!("/api/v1/files/{file_id}");

    let (owner_status, _, bytes) = h.download(&h.alice, &uri).await;
    let (other_status, _, other_bytes) = h.download(&h.bob, &uri).await;
    let (missing_status, _, _) = h
        .download(
            &h.alice,
            "/api/v1/files/0192f0c8-0000-7000-8000-0000000000ff",
        )
        .await;
    let (malformed_status, _, _) = h.download(&h.alice, "/api/v1/files/nao-e-uuid").await;

    assert_eq!(owner_status, StatusCode::OK);
    assert_eq!(bytes, minimal_pdf());
    assert_eq!(other_status, StatusCode::NOT_FOUND);
    assert!(!String::from_utf8_lossy(&other_bytes).contains("%PDF"));
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(malformed_status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn ct38_file_download_has_attachment_disposition() {
    let h = Harness::new().await;
    let (_, file_id) = book_pdf_file(&h).await;

    let (status, headers, bytes) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}?download=true"))
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        headers["content-disposition"],
        format!("attachment; filename=\"{file_id}.pdf\"").as_str()
    );
    assert_eq!(bytes, minimal_pdf());
}

#[tokio::test]
async fn file_response_has_nosniff_and_inline_disposition() {
    let h = Harness::new().await;
    let (_, file_id) = book_pdf_file(&h).await;

    let (_, headers, _) = h
        .download(&h.alice, &format!("/api/v1/files/{file_id}"))
        .await;

    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert_eq!(headers["cache-control"], "private, no-store");
    assert_eq!(
        headers["content-disposition"],
        format!("inline; filename=\"{file_id}.pdf\"").as_str()
    );
}

#[tokio::test]
async fn upload_with_wrong_magic_is_rejected_with_415() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;

    let (pdf_status, pdf_body) = h
        .upload(
            &h.alice,
            &format!("/api/v1/books/{id}/pdf"),
            b"<html>nao sou pdf</html>".to_vec(),
        )
        .await;
    let (png_as_pdf, _) = h
        .upload(&h.alice, &format!("/api/v1/books/{id}/pdf"), minimal_png())
        .await;
    let (cover_status, cover_body) = h
        .upload(
            &h.alice,
            &format!("/api/v1/books/{id}/cover"),
            minimal_pdf(),
        )
        .await;
    let (empty_status, _) = h
        .upload(&h.alice, &format!("/api/v1/books/{id}/cover"), Vec::new())
        .await;

    assert_eq!(pdf_status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(pdf_body["code"], "unsupported_file_type");
    assert_eq!(png_as_pdf, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(cover_status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(cover_body["code"], "unsupported_file_type");
    assert_eq!(empty_status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(
        h.get(&h.alice, &format!("/api/v1/books/{id}")).await["pdf_file_id"],
        serde_json::Value::Null
    );
}

#[tokio::test]
async fn upload_over_limit_is_rejected_with_413() {
    let h = Harness::new().await;
    let id = h.create_book(&h.alice, book_body("Livro", 10)).await;
    let mut big_image = minimal_png();
    big_image.resize(5 * 1024 * 1024 + 1, 0);
    let mut big_pdf = minimal_pdf();
    big_pdf.resize(50 * 1024 * 1024 + 1, b' ');

    let (image_status, image_body) = h
        .upload(&h.alice, &format!("/api/v1/books/{id}/cover"), big_image)
        .await;
    let (pdf_status, pdf_body) = h
        .upload(&h.alice, &format!("/api/v1/books/{id}/pdf"), big_pdf)
        .await;

    assert_eq!(image_status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(image_body["code"], "file_too_large");
    assert_eq!(pdf_status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(pdf_body["code"], "file_too_large");
}

#[tokio::test]
async fn rls_is_enabled_on_library_tables() {
    let h = Harness::new().await;
    let tables: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT relname::text, relrowsecurity, relforcerowsecurity FROM pg_class \
         WHERE relname = ANY($1) ORDER BY relname",
    )
    .bind(vec![
        "articles",
        "books",
        "highlights",
        "item_notes",
        "library_files",
        "reading_sessions",
        "videos",
    ])
    .fetch_all(&h.ctx.state.pool)
    .await
    .unwrap();
    let book_id = h.create_book(&h.alice, book_body("Livro", 10)).await;

    // Sem usuário na transação, a política esconde tudo.
    let visible: i64 = sqlx::query_scalar("SELECT count(*) FROM books")
        .fetch_one(&h.ctx.state.pool)
        .await
        .unwrap();

    assert_eq!(tables.len(), 7);
    assert!(
        tables
            .iter()
            .all(|(_, enabled, forced)| *enabled && *forced),
        "{tables:?}"
    );
    assert_eq!(visible, 0, "livro {book_id} visível sem usuário");
}

#[tokio::test]
async fn library_search_finds_book_by_unaccented_author() {
    let h = Harness::new().await;
    h.create_book(
        &h.alice,
        json!({ "title": "Grande Sertão", "author": "João Guimarães Rosa", "page_count": 600 }),
    )
    .await;
    h.create_article(
        &h.alice,
        json!({ "title": "Guimarães e o sertão", "source": "Revista" }),
    )
    .await;
    h.create_book(&h.bob, json!({ "title": "Outro", "author": "Guimarães" }))
        .await;
    let search = LibrarySearch::from_state(&h.ctx.state);

    let hits = search.search(ALICE, "guimaraes", 10).await.unwrap();
    let other = search.search(BOB, "sertao", 10).await.unwrap();
    let none = search.search(ALICE, "inexistente", 10).await.unwrap();

    let kinds: Vec<_> = hits.iter().map(|hit| hit.entity_type).collect();
    assert_eq!(hits.len(), 2, "{hits:?}");
    assert!(kinds.contains(&"book") && kinds.contains(&"article"));
    assert!(other.is_empty());
    assert!(none.is_empty());
}

#[tokio::test]
async fn listing_filters_by_tag_status_and_cursor() {
    let h = Harness::new().await;
    for (title, tag) in [("A", "romance"), ("B", "ciência"), ("C", "romance")] {
        h.create_book(&h.alice, json!({ "title": title, "tags": [tag] }))
            .await;
    }
    for (title, status) in [("X", "to_read"), ("Y", "read"), ("Z", "read")] {
        h.create_article(
            &h.alice,
            json!({ "title": title, "reading_status": status }),
        )
        .await;
    }

    let by_tag = h.get(&h.alice, "/api/v1/books?tag=romance").await;
    let by_text = h.get(&h.alice, "/api/v1/books?q=ciencia").await;
    let by_status = h
        .get(&h.alice, "/api/v1/articles?reading_status=read")
        .await;
    let first = h.get(&h.alice, "/api/v1/books?limit=2").await;
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let second = h
        .get(&h.alice, &format!("/api/v1/books?limit=2&cursor={cursor}"))
        .await;
    let bad_cursor = h
        .expect(
            &h.alice,
            Method::GET,
            "/api/v1/books?cursor=xx",
            None,
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;
    let bad_limit = h
        .expect(
            &h.alice,
            Method::GET,
            "/api/v1/books?limit=0",
            None,
            StatusCode::UNPROCESSABLE_ENTITY,
        )
        .await;

    assert_eq!(ids(&by_tag).len(), 2);
    assert_eq!(ids(&by_text).len(), 1);
    assert_eq!(ids(&by_status).len(), 2);
    assert_eq!(ids(&first).len(), 2);
    assert_eq!(ids(&second).len(), 1);
    assert!(second["next_cursor"].is_null());
    let mut all = ids(&first);
    all.extend(ids(&second));
    all.sort();
    all.dedup();
    assert_eq!(all.len(), 3);
    assert_eq!(bad_cursor["code"], "validation_failed");
    assert_eq!(bad_limit["code"], "validation_failed");
}
