//! Categorias padrão (RF-11, RN-01): semeadas uma única vez por pessoa na primeira
//! listagem, sem voltar depois de excluídas, e a migração da `system_key` só
//! acrescenta a coluna, sem mexer nas categorias que já existem (RNF-01). A cor é um
//! HEX livre guardado em minúsculas, e a migração converte os tons antigos no HEX do
//! tema claro (RF-18, RF-20, RN-09, CT-14).

use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};

use super::{ALICE, FinanceTest, id_of};
use crate::finance;
use crate::http::test_support::{TestContext, send};
use crate::shared::db::begin_for_user;

/// Tons antigos e o HEX do tema claro (RF-20).
const THEME_HEX: [(&str, &str); 6] = [
    ("primary", "#6d28d9"),
    ("accent", "#0e7490"),
    ("success", "#047857"),
    ("warning", "#92400e"),
    ("danger", "#be123c"),
    ("info", "#0369a1"),
];

const DEFAULTS: [(&str, &str); 7] = [
    ("salary", "income"),
    ("freelance", "income"),
    ("housing", "expense"),
    ("groceries", "expense"),
    ("transport", "expense"),
    ("leisure", "expense"),
    ("health", "expense"),
];

fn keys_and_kinds(items: &[Value]) -> Vec<(String, String)> {
    let mut pairs: Vec<(String, String)> = items
        .iter()
        .map(|item| {
            (
                item["system_key"].as_str().expect("system_key").to_owned(),
                item["kind"].as_str().expect("kind").to_owned(),
            )
        })
        .collect();
    pairs.sort();
    pairs
}

fn expected_defaults() -> Vec<(String, String)> {
    let mut pairs: Vec<(String, String)> = DEFAULTS
        .iter()
        .map(|(key, kind)| ((*key).to_owned(), (*kind).to_owned()))
        .collect();
    pairs.sort();
    pairs
}

fn ids(items: &[Value]) -> Vec<String> {
    items.iter().map(id_of).collect()
}

fn with_key<'a>(items: &'a [Value], key: &str) -> &'a Value {
    items
        .iter()
        .find(|item| item["system_key"] == key)
        .expect("categoria padrão")
}

#[tokio::test]
async fn ct10_default_categories_are_seeded_once() {
    let t = FinanceTest::new().await;

    let first = t.items(&t.alice, "/categories").await;
    let second = t.items(&t.alice, "/categories").await;

    assert_eq!(first.len(), 7, "{first:?}");
    assert_eq!(keys_and_kinds(&first), expected_defaults());
    assert_eq!(keys_and_kinds(&second), expected_defaults());
    assert_eq!(ids(&first), ids(&second));
}

#[tokio::test]
async fn ct10_deleted_default_category_is_not_recreated() {
    let t = FinanceTest::new().await;
    let listed = t.items(&t.alice, "/categories").await;
    let groceries = id_of(with_key(&listed, "groceries"));

    let (deleted, body) = t
        .delete(&t.alice, &format!("/categories/{groceries}"))
        .await;
    let after = t.items(&t.alice, "/categories").await;

    assert_eq!(deleted, StatusCode::NO_CONTENT, "{body}");
    assert_eq!(after.len(), 6);
    assert!(after.iter().all(|item| item["system_key"] != "groceries"));
}

#[tokio::test]
async fn ct10_person_who_deleted_all_categories_is_not_seeded_again() {
    let t = FinanceTest::new().await;
    let listed = t.items(&t.alice, "/categories").await;

    for id in ids(&listed) {
        let (status, body) = t.delete(&t.alice, &format!("/categories/{id}")).await;
        assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
    }
    let after = t.items(&t.alice, "/categories").await;

    assert!(after.is_empty(), "{after:?}");
}

#[tokio::test]
async fn person_with_own_category_is_not_seeded() {
    let t = FinanceTest::new().await;
    t.create_category(&t.alice, "Viagem", "expense", "#0369a1")
        .await;

    let listed = t.items(&t.alice, "/categories").await;

    assert_eq!(listed.len(), 1, "{listed:?}");
    assert_eq!(listed[0]["name"], "Viagem");
    assert_eq!(listed[0]["system_key"], Value::Null);
}

#[tokio::test]
async fn renaming_default_category_clears_system_key() {
    let t = FinanceTest::new().await;
    let listed = t.items(&t.alice, "/categories").await;
    let salary = id_of(with_key(&listed, "salary"));

    let (status, renamed) = t
        .patch(
            &t.alice,
            &format!("/categories/{salary}"),
            json!({ "name": "Pró-labore" }),
        )
        .await;
    let after = t.items(&t.alice, "/categories").await;

    assert_eq!(status, StatusCode::OK, "{renamed}");
    assert_eq!(renamed["name"], "Pró-labore");
    assert_eq!(renamed["system_key"], Value::Null);
    assert_eq!(after.len(), 7);
}

#[tokio::test]
async fn default_categories_belong_to_each_person() {
    let t = FinanceTest::new().await;

    let alice = t.items(&t.alice, "/categories").await;
    let bob = t.items(&t.bob, "/categories").await;
    let alice_salary = id_of(with_key(&alice, "salary"));
    let (foreign, _) = t.get(&t.bob, &format!("/categories/{alice_salary}")).await;

    assert_eq!(alice.len(), 7);
    assert_eq!(bob.len(), 7);
    let bob_ids = ids(&bob);
    assert!(ids(&alice).iter().all(|id| !bob_ids.contains(id)));
    assert_eq!(foreign, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rnf01_system_key_migration_keeps_existing_categories() {
    let ctx = TestContext::new().await;
    let mut before = finance::migrator();
    before.migrations = std::borrow::Cow::Owned(
        before
            .migrations
            .iter()
            .filter(|migration| migration.version < 20261102010001)
            .cloned()
            .collect(),
    );
    before.run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    for (id, name) in [(1u128, "Mercado"), (2u128, "Salário")] {
        sqlx::query(
            "INSERT INTO categories (id, owner_id, name, kind, color, created_at, updated_at) \
             VALUES ($1, $2, $3, 'expense', 'info', now(), now())",
        )
        .bind(uuid::Uuid::from_u128(id))
        .bind(ALICE)
        .bind(name)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    let count_before: i64 = sqlx::query_scalar("SELECT count(*) FROM categories")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();

    finance::migrator().run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let rows: Vec<(String, Option<String>)> =
        sqlx::query_as("SELECT name, system_key FROM categories ORDER BY id")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
    tx.commit().await.unwrap();
    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    let request = alice
        .request(Method::GET, "/api/v1/categories")
        .body(Body::empty())
        .unwrap();
    let (status, _, body) = send(&app, request).await;

    assert_eq!(count_before, 2);
    assert_eq!(rows.len() as i64, count_before);
    assert_eq!(
        rows,
        [("Mercado".to_owned(), None), ("Salário".to_owned(), None)]
    );
    assert_eq!(status, StatusCode::OK, "{body}");
    let names: Vec<&str> = body["items"]
        .as_array()
        .expect("itens")
        .iter()
        .map(|item| item["name"].as_str().expect("nome"))
        .collect();
    assert_eq!(names, ["Mercado", "Salário"]);
}

#[tokio::test]
async fn ct12_category_is_created_and_edited_with_hex_color() {
    let t = FinanceTest::new().await;

    let (status, created) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Viagem", "kind": "expense", "color": "#1a2b3c" }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["color"], "#1a2b3c");
    let uri = format!("/categories/{}", id_of(&created));
    let (status, edited) = t.patch(&t.alice, &uri, json!({ "color": "#ffcc00" })).await;

    assert_eq!(status, StatusCode::OK, "{edited}");
    assert_eq!(edited["color"], "#ffcc00");
    assert_eq!(edited["name"], "Viagem");
    let (status, read) = t.get(&t.alice, &uri).await;
    assert_eq!(status, StatusCode::OK, "{read}");
    assert_eq!(read["color"], "#ffcc00");
}

#[tokio::test]
async fn rn09_category_color_is_stored_in_lowercase() {
    let t = FinanceTest::new().await;

    let (status, created) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Viagem", "kind": "expense", "color": "#AABBCC" }),
        )
        .await;

    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["color"], "#aabbcc");
    let id: uuid::Uuid = id_of(&created).parse().unwrap();
    let mut tx = begin_for_user(t.pool(), ALICE).await.unwrap();
    let stored: String = sqlx::query_scalar("SELECT color FROM categories WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    drop(tx);
    assert_eq!(stored, "#aabbcc");
    let (status, edited) = t
        .patch(
            &t.alice,
            &format!("/categories/{id}"),
            json!({ "color": "#00FF7F" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{edited}");
    assert_eq!(edited["color"], "#00ff7f");
}

#[tokio::test]
async fn invalid_category_color_is_rejected() {
    let t = FinanceTest::new().await;
    let invalid = json!({ "field": "color", "code": "invalid" });

    for color in ["primary", "#fff", "#12345g", "123456", "#1234567", ""] {
        let (status, body) = t
            .post(
                &t.alice,
                "/categories",
                json!({ "name": "Viagem", "kind": "expense", "color": color }),
            )
            .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{color}: {body}");
        assert_eq!(body["code"], "validation_failed");
        assert_eq!(body["errors"][0], invalid, "{color}");
    }

    let (_, created) = t
        .post(
            &t.alice,
            "/categories",
            json!({ "name": "Viagem", "kind": "expense", "color": "#123456" }),
        )
        .await;
    let uri = format!("/categories/{}", id_of(&created));
    let (status, body) = t.patch(&t.alice, &uri, json!({ "color": "info" })).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    assert_eq!(body["code"], "validation_failed");
    assert_eq!(body["errors"][0], invalid);
    let (_, read) = t.get(&t.alice, &uri).await;
    assert_eq!(read["color"], "#123456");
}

#[tokio::test]
async fn ct12_default_categories_have_theme_hex_colors() {
    let t = FinanceTest::new().await;

    let items = t.items(&t.alice, "/categories").await;

    for (key, hex) in [
        ("salary", "#047857"),
        ("freelance", "#0e7490"),
        ("housing", "#6d28d9"),
        ("groceries", "#047857"),
        ("transport", "#0369a1"),
        ("leisure", "#0e7490"),
        ("health", "#be123c"),
    ] {
        assert_eq!(with_key(&items, key)["color"], hex, "{key}");
    }
}

#[tokio::test]
async fn rnf01_category_color_migration_converts_names_to_hex() {
    let ctx = TestContext::new().await;
    let mut before = finance::migrator();
    before.migrations = std::borrow::Cow::Owned(
        before
            .migrations
            .iter()
            .filter(|migration| migration.version < 20261103010002)
            .cloned()
            .collect(),
    );
    before.run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    for (index, (tone, _)) in THEME_HEX.iter().enumerate() {
        sqlx::query(
            "INSERT INTO categories (id, owner_id, name, kind, color, created_at, updated_at, \
             deleted_at) VALUES ($1, $2, $3, 'expense', $4, now(), now(), \
             CASE WHEN $5 THEN now() END)",
        )
        .bind(uuid::Uuid::from_u128(index as u128 + 1))
        .bind(ALICE)
        .bind(format!("Categoria {index}"))
        .bind(*tone)
        .bind(index == THEME_HEX.len() - 1)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    let count_before: i64 = sqlx::query_scalar("SELECT count(*) FROM categories")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();

    finance::migrator().run(&ctx.state.pool).await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let colors: Vec<String> = sqlx::query_scalar("SELECT color FROM categories ORDER BY id")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    let mut tx = begin_for_user(&ctx.state.pool, ALICE).await.unwrap();
    let refused = sqlx::query(
        "INSERT INTO categories (id, owner_id, name, kind, color, created_at, updated_at) \
         VALUES ($1, $2, 'Nova', 'expense', 'primary', now(), now())",
    )
    .bind(uuid::Uuid::from_u128(99))
    .bind(ALICE)
    .execute(&mut *tx)
    .await;
    drop(tx);
    let app = ctx.app(finance::router());
    let alice = ctx.sign_in_as(ALICE).await;
    let request = alice
        .request(Method::GET, "/api/v1/categories")
        .body(Body::empty())
        .unwrap();
    let (status, _, body) = send(&app, request).await;

    assert_eq!(count_before, 6);
    assert_eq!(colors.len() as i64, count_before);
    let expected: Vec<&str> = THEME_HEX.iter().map(|(_, hex)| *hex).collect();
    assert_eq!(colors, expected);
    assert!(colors.iter().all(|color| {
        color.len() == 7
            && color.starts_with('#')
            && color[1..]
                .chars()
                .all(|c| matches!(c, '0'..='9' | 'a'..='f'))
    }));
    assert!(refused.is_err());
    assert_eq!(status, StatusCode::OK, "{body}");
    let listed: Vec<&str> = body["items"]
        .as_array()
        .expect("itens")
        .iter()
        .map(|item| item["color"].as_str().expect("cor"))
        .collect();
    assert_eq!(listed, expected[..5]);
}
