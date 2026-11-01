//! Editar e excluir destaques (RF-32): só a cor muda, e a exclusão é lógica, com o
//! destaque fora do leitor e das listas e a linha mantida com `deleted_at` (RN-08).
//! A migração só acrescenta a coluna, sem mexer nos destaques existentes (RNF-01).

use axum::http::{Method, StatusCode};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{ALICE, Harness, book_body, minimal_pdf};
use crate::http::test_support::TestContext;
use crate::library;
use crate::shared::db::begin_for_user;

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

async fn article_with_pdf(h: &Harness) -> (String, String) {
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
    let file_id = article["pdf_file_id"].as_str().unwrap().to_owned();
    (id, file_id)
}

/// Cria um destaque `accent` no item (`books` ou `articles`) e devolve o corpo.
async fn highlight(h: &Harness, base: &str, file_id: &str) -> Value {
    h.create(
        &h.alice,
        &format!("{base}/highlights"),
        json!({ "file_id": file_id, "page": 7, "color": "accent", "text": "trecho", "rects": rect() }),
    )
    .await
}

fn id_of(value: &Value) -> String {
    value["id"].as_str().unwrap().to_owned()
}

async fn assert_color_changes(h: &Harness, base: &str, file_id: &str) {
    let created = highlight(h, base, file_id).await;
    let uri = format!("{base}/highlights/{}", id_of(&created));

    let changed = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "color": "warning" })),
            StatusCode::OK,
        )
        .await;
    let list = h.get(&h.alice, &format!("{base}/highlights")).await;

    assert_eq!(changed["color"], "warning");
    assert_eq!(changed["id"], created["id"]);
    assert_eq!(changed["text"], created["text"]);
    assert_eq!(changed["page"], created["page"]);
    assert_eq!(changed["rects"], created["rects"]);
    assert_eq!(list["items"][0]["color"], "warning");
}

async fn assert_deleted_leaves_list(h: &Harness, base: &str, file_id: &str) -> Uuid {
    let created = highlight(h, base, file_id).await;
    let uri = format!("{base}/highlights/{}", id_of(&created));

    h.expect(&h.alice, Method::DELETE, &uri, None, StatusCode::NO_CONTENT)
        .await;
    let list = h.get(&h.alice, &format!("{base}/highlights")).await;

    assert!(list["items"].as_array().unwrap().is_empty(), "{list}");
    id_of(&created).parse().unwrap()
}

#[tokio::test]
async fn ct31_book_highlight_color_changes() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;

    assert_color_changes(&h, &format!("/api/v1/books/{id}"), &file_id).await;
}

#[tokio::test]
async fn ct31_article_highlight_color_changes() {
    let h = Harness::new().await;
    let (id, file_id) = article_with_pdf(&h).await;

    assert_color_changes(&h, &format!("/api/v1/articles/{id}"), &file_id).await;
}

#[tokio::test]
async fn ct31_deleted_book_highlight_leaves_lists_and_keeps_deleted_at() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;

    let highlight_id =
        assert_deleted_leaves_list(&h, &format!("/api/v1/books/{id}"), &file_id).await;
    let mut tx = begin_for_user(&h.ctx.state.pool, ALICE).await.unwrap();
    let deleted_at: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT deleted_at FROM highlights WHERE id = $1")
            .bind(highlight_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();

    assert!(deleted_at.is_some());
}

#[tokio::test]
async fn ct31_deleted_article_highlight_leaves_lists() {
    let h = Harness::new().await;
    let (id, file_id) = article_with_pdf(&h).await;

    assert_deleted_leaves_list(&h, &format!("/api/v1/articles/{id}"), &file_id).await;
}

#[tokio::test]
async fn deleted_highlight_cannot_be_changed_or_deleted_again() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;
    let base = format!("/api/v1/books/{id}");
    let highlight_id = assert_deleted_leaves_list(&h, &base, &file_id).await;
    let uri = format!("{base}/highlights/{highlight_id}");

    let changed = h
        .expect(
            &h.alice,
            Method::PATCH,
            &uri,
            Some(json!({ "color": "info" })),
            StatusCode::NOT_FOUND,
        )
        .await;
    let deleted = h
        .expect(&h.alice, Method::DELETE, &uri, None, StatusCode::NOT_FOUND)
        .await;

    assert_eq!(changed["code"], "highlight_not_found");
    assert_eq!(deleted["code"], "highlight_not_found");
}

#[tokio::test]
async fn highlight_of_other_item_or_user_returns_404() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;
    let created = highlight(&h, &format!("/api/v1/books/{id}"), &file_id).await;
    let highlight_id = id_of(&created);
    let uri = format!("/api/v1/books/{id}/highlights/{highlight_id}");
    let other = h.create_book(&h.alice, book_body("Outro", 100)).await;
    let other_uri = format!("/api/v1/books/{other}/highlights/{highlight_id}");
    let recolor = json!({ "color": "info" });

    h.expect(
        &h.bob,
        Method::PATCH,
        &uri,
        Some(recolor.clone()),
        StatusCode::NOT_FOUND,
    )
    .await;
    h.expect(&h.bob, Method::DELETE, &uri, None, StatusCode::NOT_FOUND)
        .await;
    let changed = h
        .expect(
            &h.alice,
            Method::PATCH,
            &other_uri,
            Some(recolor),
            StatusCode::NOT_FOUND,
        )
        .await;
    let deleted = h
        .expect(
            &h.alice,
            Method::DELETE,
            &other_uri,
            None,
            StatusCode::NOT_FOUND,
        )
        .await;
    let list = h
        .get(&h.alice, &format!("/api/v1/books/{id}/highlights"))
        .await;

    assert_eq!(changed["code"], "highlight_not_found");
    assert_eq!(deleted["code"], "highlight_not_found");
    assert_eq!(list["items"][0]["color"], "accent");
}

#[tokio::test]
async fn invalid_highlight_color_is_rejected() {
    let h = Harness::new().await;
    let (id, file_id) = book_with_pdf(&h).await;
    let created = highlight(&h, &format!("/api/v1/books/{id}"), &file_id).await;
    let uri = format!("/api/v1/books/{id}/highlights/{}", id_of(&created));

    for body in [
        json!({ "color": "danger" }),
        json!({ "color": "warning", "text": "x" }),
    ] {
        let problem = h
            .expect(
                &h.alice,
                Method::PATCH,
                &uri,
                Some(body),
                StatusCode::UNPROCESSABLE_ENTITY,
            )
            .await;
        assert_eq!(problem["code"], "validation_failed");
    }
}

#[tokio::test]
async fn rnf01_highlights_migration_keeps_existing_rows() {
    let ctx = TestContext::new().await;
    let pool = &ctx.state.pool;
    let mut before = library::migrator();
    before.migrations = std::borrow::Cow::Owned(
        before
            .migrations
            .iter()
            .filter(|migration| migration.version < 20261102010003)
            .cloned()
            .collect(),
    );
    before.run(pool).await.unwrap();
    let file_id = Uuid::from_u128(1);
    let book_id = Uuid::from_u128(2);
    let mut tx = begin_for_user(pool, ALICE).await.unwrap();
    sqlx::query(
        "INSERT INTO library_files (id, owner_id, kind, content_type, size_bytes, sha256, \
         storage_key, created_at, updated_at) \
         VALUES ($1, $2, 'pdf', 'application/pdf', 10, 'abc', $3, now(), now())",
    )
    .bind(file_id)
    .bind(ALICE)
    .bind(format!("library/{ALICE}/{file_id}"))
    .execute(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO books (id, owner_id, title, pdf_file_id, created_at, updated_at) \
         VALUES ($1, $2, 'Livro', $3, now(), now())",
    )
    .bind(book_id)
    .bind(ALICE)
    .bind(file_id)
    .execute(&mut *tx)
    .await
    .unwrap();
    for (id, color, text) in [(10u128, "accent", "primeiro"), (11u128, "info", "segundo")] {
        sqlx::query(
            "INSERT INTO highlights (id, owner_id, book_id, file_id, page, color, text, rects, \
             created_at, updated_at) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, now(), now())",
        )
        .bind(Uuid::from_u128(id))
        .bind(ALICE)
        .bind(book_id)
        .bind(file_id)
        .bind(color)
        .bind(text)
        .bind(rect())
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    let count_before: i64 = sqlx::query_scalar("SELECT count(*) FROM highlights")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();

    library::migrator().run(pool).await.unwrap();
    let mut tx = begin_for_user(pool, ALICE).await.unwrap();
    let rows: Vec<(String, String, bool)> =
        sqlx::query_as("SELECT color, text, deleted_at IS NULL FROM highlights ORDER BY id")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();

    assert_eq!(count_before, 2);
    assert_eq!(
        rows,
        [
            ("accent".to_owned(), "primeiro".to_owned(), true),
            ("info".to_owned(), "segundo".to_owned(), true),
        ]
    );
}
