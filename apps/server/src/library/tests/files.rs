//! Arquivos: acesso só do dono, tipo e tamanho, RLS, busca e listagem.

use axum::body::Body;
use axum::http::{HeaderMap, Method, StatusCode, header};
use http_body_util::BodyExt;
use serde_json::json;
use sha2::{Digest, Sha256};
use tower::ServiceExt;

use super::{ALICE, BOB, Harness, book_body, ids, minimal_pdf, minimal_png};
use crate::http::test_support::TestSession;
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
    assert_eq!(headers["cache-control"], "private, max-age=3600");
    assert_eq!(headers["accept-ranges"], "bytes");
    assert_eq!(
        headers["content-disposition"],
        format!("inline; filename=\"{file_id}.pdf\"").as_str()
    );
}

/// Pedido com `Range`, enviado como em `Harness::download`.
async fn get_with_range(
    h: &Harness,
    session: &TestSession,
    uri: &str,
    range: &str,
) -> (StatusCode, HeaderMap, Vec<u8>) {
    let request = session
        .request(Method::GET, uri)
        .header(header::RANGE, range)
        .body(Body::empty())
        .expect("pedido");
    let response = h.app.clone().oneshot(request).await.expect("resposta");
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("corpo")
        .to_bytes();
    (status, headers, bytes.to_vec())
}

fn large_pdf() -> Vec<u8> {
    let mut pdf = minimal_pdf();
    pdf.resize(200_000, b'0');
    pdf
}

async fn large_pdf_file(h: &Harness, pdf: Vec<u8>) -> String {
    let id = h.create_book(&h.alice, book_body("Livro grande", 10)).await;
    let book = h
        .upload_ok(&h.alice, &format!("/api/v1/books/{id}/pdf"), pdf)
        .await;
    format!("/api/v1/files/{}", book["pdf_file_id"].as_str().unwrap())
}

#[tokio::test]
async fn ct26_range_returns_206_with_content_range() {
    let h = Harness::new().await;
    let pdf = large_pdf();
    let uri = large_pdf_file(&h, pdf.clone()).await;

    let (status, headers, bytes) = get_with_range(&h, &h.alice, &uri, "bytes=0-65535").await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes.len(), 65_536);
    assert_eq!(bytes, pdf[..65_536]);
    assert_eq!(headers["content-range"], "bytes 0-65535/200000");
    assert_eq!(headers["accept-ranges"], "bytes");
    assert_eq!(headers["cache-control"], "private, max-age=3600");
}

#[tokio::test]
async fn ct26_suffix_range_returns_last_bytes() {
    let h = Harness::new().await;
    let pdf = large_pdf();
    let uri = large_pdf_file(&h, pdf.clone()).await;

    let (status, headers, bytes) = get_with_range(&h, &h.alice, &uri, "bytes=-4").await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes, pdf[pdf.len() - 4..]);
    assert_eq!(headers["content-range"], "bytes 199996-199999/200000");
}

#[tokio::test]
async fn ct26_without_range_returns_200_with_accept_ranges_and_etag() {
    let h = Harness::new().await;
    let pdf = large_pdf();
    let uri = large_pdf_file(&h, pdf.clone()).await;
    let sha: String = Sha256::digest(&pdf)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();

    let (status, headers, bytes) = h.download(&h.alice, &uri).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(bytes, pdf);
    assert_eq!(headers["accept-ranges"], "bytes");
    assert_eq!(headers["cache-control"], "private, max-age=3600");
    assert_eq!(headers["etag"], format!("\"{sha}\"").as_str());
}

#[tokio::test]
async fn cb10_range_beyond_size_returns_416_with_size() {
    let h = Harness::new().await;
    let uri = large_pdf_file(&h, large_pdf()).await;

    let (status, headers, bytes) = get_with_range(&h, &h.alice, &uri, "bytes=200000-").await;

    let problem: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(status, StatusCode::RANGE_NOT_SATISFIABLE);
    assert_eq!(headers["content-range"], "bytes */200000");
    assert_eq!(problem["code"], "range_not_satisfiable");
}

#[tokio::test]
async fn ct26_malformed_range_returns_416() {
    let h = Harness::new().await;
    let uri = large_pdf_file(&h, large_pdf()).await;

    let (status, _, _) = get_with_range(&h, &h.alice, &uri, "bytes=abc").await;

    assert_eq!(status, StatusCode::RANGE_NOT_SATISFIABLE);
}

#[tokio::test]
async fn rn03_range_from_other_user_returns_404() {
    let h = Harness::new().await;
    let uri = large_pdf_file(&h, large_pdf()).await;

    let (other_status, _, other_bytes) = get_with_range(&h, &h.bob, &uri, "bytes=0-3").await;
    let (malformed_status, _, malformed_bytes) =
        get_with_range(&h, &h.alice, "/api/v1/files/nao-e-uuid", "bytes=0-3").await;

    let problem: serde_json::Value = serde_json::from_slice(&other_bytes).unwrap();
    assert_eq!(other_status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "file_not_found");
    assert!(!String::from_utf8_lossy(&other_bytes).contains("%PDF"));
    assert_eq!(malformed_status, StatusCode::NOT_FOUND);
    assert!(!String::from_utf8_lossy(&malformed_bytes).contains("%PDF"));
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
