//! Testes de integração da busca global, contra um PostgreSQL real em container
//! ([project/testing-02]): os dados nascem pelas rotas `POST` de cada contexto.

use std::time::Instant;

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use tokio::task::JoinSet;
use tower::ServiceExt;
use uuid::Uuid;

use crate::http::test_support::{TestContext, TestSession, send};

const ALICE: Uuid = Uuid::from_u128(0xa11c_e000_0000_7000_8000_0000_0000_0001);
const BOB: Uuid = Uuid::from_u128(0xb0b0_0000_0000_7000_8000_0000_0000_0002);

struct Harness {
    ctx: TestContext,
    app: Router,
    alice: TestSession,
    bob: TestSession,
}

impl Harness {
    async fn new() -> Self {
        let ctx = TestContext::new().await;
        let migrators = [
            crate::finance::migrator(),
            crate::goals::migrator(),
            crate::tasks::migrator(),
            crate::reminders::migrator(),
            crate::notes::migrator(),
            crate::journal::migrator(),
            crate::library::migrator(),
            crate::projects::migrator(),
        ];
        for mut migrator in migrators {
            // `tasks` e `reminders` não ignoram as migrações dos outros no próprio migrator.
            migrator.set_ignore_missing(true);
            migrator.run(&ctx.state.pool).await.expect("migrações");
        }
        let api = crate::search::router()
            .merge(crate::finance::router())
            .merge(crate::goals::router())
            .merge(crate::tasks::router())
            .merge(crate::reminders::router())
            .merge(crate::notes::router())
            .merge(crate::journal::router())
            .merge(crate::library::router())
            .merge(crate::projects::router());
        let app = ctx.app(api);
        let alice = ctx.sign_in_as(ALICE).await;
        let bob = ctx.sign_in_as(BOB).await;
        Self {
            ctx,
            app,
            alice,
            bob,
        }
    }

    /// `POST` que espera 201 e devolve o corpo.
    async fn create(&self, session: &TestSession, uri: &str, body: Value) -> Value {
        post(&self.app, session, uri, body).await
    }

    async fn search(
        &self,
        session: &TestSession,
        q: &str,
        contexts: Option<&str>,
    ) -> (StatusCode, Value) {
        search(&self.app, session, q, contexts).await
    }

    async fn search_ok(&self, session: &TestSession, q: &str, contexts: Option<&str>) -> Value {
        let (status, body) = self.search(session, q, contexts).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        body
    }

    async fn account(&self, session: &TestSession, name: &str) -> String {
        let body = self
            .create(session, "/api/v1/accounts", json!({ "name": name }))
            .await;
        id_of(&body)
    }
}

async fn post(app: &Router, session: &TestSession, uri: &str, body: Value) -> Value {
    let (status, _, json) = send(app, session.json(Method::POST, uri, &body)).await;
    assert_eq!(status, StatusCode::CREATED, "{uri}: {json}");
    json
}

async fn search(
    app: &Router,
    session: &TestSession,
    q: &str,
    contexts: Option<&str>,
) -> (StatusCode, Value) {
    let mut uri = format!("/api/v1/search?q={}", percent_encode(q));
    if let Some(contexts) = contexts {
        uri.push_str(&format!("&contexts={}", percent_encode(contexts)));
    }
    let request = session
        .request(Method::GET, &uri)
        .body(Body::empty())
        .expect("pedido");
    let (status, _, json) = send(app, request).await;
    (status, json)
}

fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b',' => char::from(byte).to_string(),
            other => format!("%{other:02X}"),
        })
        .collect()
}

fn id_of(body: &Value) -> String {
    body["id"].as_str().expect("id").to_owned()
}

fn group<'a>(body: &'a Value, context: &str) -> Option<&'a Value> {
    body["groups"]
        .as_array()?
        .iter()
        .find(|group| group["context"] == context)
}

fn items<'a>(body: &'a Value, context: &str) -> Vec<&'a Value> {
    group(body, context)
        .and_then(|group| group["items"].as_array())
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn has_item(body: &Value, context: &str, entity_type: &str, id: &str) -> bool {
    items(body, context)
        .iter()
        .any(|item| item["entity_type"] == entity_type && item["id"] == id)
}

fn contexts_of(body: &Value) -> Vec<&str> {
    body["groups"]
        .as_array()
        .map(|groups| {
            groups
                .iter()
                .filter_map(|g| g["context"].as_str())
                .collect()
        })
        .unwrap_or_default()
}

fn monthly_rule(starts_on: &str, month_day: u32) -> Value {
    json!({
        "frequency": "monthly",
        "interval": 1,
        "weekdays": [],
        "month_day": month_day,
        "time": "08:00",
        "timezone": "America/Sao_Paulo",
        "starts_on": starts_on,
        "ends_on": null
    })
}

/// Um item do termo `jardim` em cada contexto, para as buscas de todos os contextos.
async fn seed_orchid(h: &Harness, session: &TestSession) {
    let account = h.account(session, "Carteira").await;
    h.create(
        session,
        "/api/v1/transactions",
        json!({ "kind": "expense", "account_id": account, "description": "Vaso do jardim",
                "expected_amount": 5000, "expected_date": "2026-11-05" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/goals",
        json!({ "title": "Cuidar do jardim" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/tasks",
        json!({ "title": "Regar o jardim" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/reminders",
        json!({ "title": "Adubar o jardim", "timezone": "America/Sao_Paulo",
                "remind_at": "2026-12-05T12:00:00Z" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/notes",
        json!({ "title": "Jardim", "body": "luz indireta" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/journal-entries",
        json!({ "occurred_at": "2026-11-01T10:00:00Z", "text": "Comprei plantas para o jardim", "emotions": [] }),
    )
    .await;
    h.create(
        session,
        "/api/v1/books",
        json!({ "title": "Guia do jardim" }),
    )
    .await;
    h.create(
        session,
        "/api/v1/projects",
        json!({ "name": "Jardim de casa" }),
    )
    .await;
}

#[tokio::test]
async fn search_returns_groups_from_all_contexts_when_contexts_absent() {
    let h = Harness::new().await;
    seed_orchid(&h, &h.alice).await;
    let body = h.search_ok(&h.alice, "jardim", None).await;
    assert_eq!(
        contexts_of(&body),
        vec![
            "finance",
            "goals",
            "tasks",
            "reminders",
            "notes",
            "journal",
            "library",
            "projects"
        ],
        "{body}"
    );
}

#[tokio::test]
async fn search_with_empty_contexts_param_searches_all() {
    let h = Harness::new().await;
    seed_orchid(&h, &h.alice).await;
    let body = h.search_ok(&h.alice, "jardim", Some("")).await;
    assert_eq!(contexts_of(&body).len(), 8, "{body}");
}

#[tokio::test]
async fn search_respects_selected_contexts() {
    let h = Harness::new().await;
    seed_orchid(&h, &h.alice).await;
    let body = h.search_ok(&h.alice, "jardim", Some("notes,goals")).await;
    assert_eq!(contexts_of(&body), vec!["notes", "goals"], "{body}");
}

#[tokio::test]
async fn search_finds_journal_and_note_text_decrypted_in_memory() {
    let h = Harness::new().await;
    let a = &h.alice;
    let note = id_of(
        &h.create(
            a,
            "/api/v1/notes",
            json!({ "title": "Receitas", "body": "Bolo de AÇAÍ com mel" }),
        )
        .await,
    );
    let entry = id_of(
        &h.create(
            a,
            "/api/v1/journal-entries",
            json!({ "occurred_at": "2026-11-01T10:00:00Z",
                    "text": "Dia de sol\nfui tomar açaí na praia", "emotions": [] }),
        )
        .await,
    );
    let body = h.search_ok(a, "acai", Some("notes,journal")).await;
    assert!(has_item(&body, "notes", "note", &note), "{body}");
    assert!(
        has_item(&body, "journal", "journal_entry", &entry),
        "{body}"
    );
    assert_eq!(items(&body, "journal")[0]["title"], "Dia de sol");
}

#[tokio::test]
async fn search_finds_stored_transactions_and_transfers_without_accents() {
    let h = Harness::new().await;
    let a = &h.alice;
    let checking = h.account(a, "Corrente").await;
    let savings = h.account(a, "Poupança").await;
    let transaction = id_of(
        &h.create(
            a,
            "/api/v1/transactions",
            json!({ "kind": "expense", "account_id": checking, "description": "Café da esquina",
                    "expected_amount": 1200, "expected_date": "2026-11-05" }),
        )
        .await["items"][0],
    );
    let transfer = id_of(
        &h.create(
            a,
            "/api/v1/transfers",
            json!({ "from_account_id": checking, "to_account_id": savings, "amount": 3000,
                    "transferred_on": "2026-11-06", "description": "Reserva do café" }),
        )
        .await,
    );
    let body = h.search_ok(a, "cafe", Some("finance")).await;
    assert!(
        has_item(&body, "finance", "transaction", &transaction),
        "{body}"
    );
    assert!(has_item(&body, "finance", "transfer", &transfer), "{body}");
}

#[tokio::test]
async fn search_finds_recurring_transaction_but_not_virtual_occurrences() {
    let h = Harness::new().await;
    let a = &h.alice;
    let account = h.account(a, "Corrente").await;
    let recurring = id_of(
        &h.create(
            a,
            "/api/v1/recurring-transactions",
            json!({ "kind": "expense", "account_id": account, "expected_amount": 150_000,
                    "description": "Aluguel", "rule": monthly_rule("2026-11-05", 5) }),
        )
        .await,
    );
    let body = h.search_ok(a, "aluguel", Some("finance")).await;
    let found = items(&body, "finance");
    assert_eq!(found.len(), 1, "{body}");
    assert_eq!(found[0]["entity_type"], "recurring_transaction");
    assert_eq!(found[0]["id"], recurring.as_str());
}

#[tokio::test]
async fn search_finds_goals_and_tasks_by_label() {
    let h = Harness::new().await;
    let a = &h.alice;
    let goal = id_of(
        &h.create(
            a,
            "/api/v1/goals",
            json!({ "title": "Correr 5 km", "labels": ["saúde"] }),
        )
        .await,
    );
    let task = id_of(
        &h.create(
            a,
            "/api/v1/tasks",
            json!({ "title": "Marcar consulta", "labels": ["saúde"] }),
        )
        .await,
    );
    for q in ["saúde", "#saúde"] {
        let body = h.search_ok(a, q, Some("goals,tasks")).await;
        assert!(has_item(&body, "goals", "goal", &goal), "{q}: {body}");
        assert!(has_item(&body, "tasks", "task", &task), "{q}: {body}");
    }
}

#[tokio::test]
async fn search_finds_video_by_channel() {
    let h = Harness::new().await;
    let video = id_of(
        &h.create(
            &h.alice,
            "/api/v1/videos",
            json!({ "url": "https://example.com/v/1", "title": "Aula de piano",
                    "channel": "Canal Harmonia" }),
        )
        .await,
    );
    let body = h.search_ok(&h.alice, "harmonia", Some("library")).await;
    assert!(has_item(&body, "library", "video", &video), "{body}");
}

#[tokio::test]
async fn search_returns_project_card_with_project_id() {
    let h = Harness::new().await;
    let a = &h.alice;
    let project = h
        .create(a, "/api/v1/projects", json!({ "name": "Casa nova" }))
        .await;
    let project_id = id_of(&project);
    let lane = project["lanes"][0]["id"].as_str().expect("raia").to_owned();
    let card = id_of(
        &h.create(
            a,
            &format!("/api/v1/projects/{project_id}/cards"),
            json!({ "lane_id": lane, "title": "Pintar a varanda" }),
        )
        .await,
    );
    let body = h.search_ok(a, "varanda", Some("projects")).await;
    let found = items(&body, "projects");
    assert_eq!(found.len(), 1, "{body}");
    assert_eq!(found[0]["entity_type"], "project_card");
    assert_eq!(found[0]["id"], card.as_str());
    assert_eq!(found[0]["project_id"], project_id.as_str());
}

#[tokio::test]
async fn search_never_returns_other_users_entities() {
    let h = Harness::new().await;
    seed_orchid(&h, &h.alice).await;
    let body = h.search_ok(&h.bob, "jardim", None).await;
    assert_eq!(body["groups"], json!([]), "{body}");
}

#[tokio::test]
async fn search_ignores_shared_visibility_of_other_users() {
    let h = Harness::new().await;
    let a = &h.alice;
    let account = h.account(a, "Carteira").await;
    h.create(
        a,
        "/api/v1/transactions",
        json!({ "kind": "expense", "account_id": account, "description": "Jardim",
                "expected_amount": 100, "expected_date": "2026-11-05", "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/goals",
        json!({ "title": "Jardim", "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/tasks",
        json!({ "title": "Jardim", "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/notes",
        json!({ "title": "Jardim", "body": "x", "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/journal-entries",
        json!({ "occurred_at": "2026-11-01T10:00:00Z", "text": "Jardim",
                "emotions": [], "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/books",
        json!({ "title": "Jardim", "visibility": "shared" }),
    )
    .await;
    h.create(
        a,
        "/api/v1/projects",
        json!({ "name": "Jardim", "visibility": "shared" }),
    )
    .await;
    let own = h.search_ok(a, "jardim", None).await;
    assert!(contexts_of(&own).len() >= 6, "{own}");
    let body = h.search_ok(&h.bob, "jardim", None).await;
    assert_eq!(body["groups"], json!([]), "{body}");
}

#[tokio::test]
async fn search_rejects_unknown_context_with_problem_json() {
    let h = Harness::new().await;
    let request = h
        .alice
        .request(Method::GET, "/api/v1/search?q=a&contexts=notes,mail")
        .body(Body::empty())
        .expect("pedido");
    let response = h.app.clone().oneshot(request).await.expect("resposta");
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(
        response.headers()["content-type"],
        "application/problem+json"
    );
    let (_, body) = h.search(&h.alice, "a", Some("mail")).await;
    assert_eq!(body["code"], "invalid_search_context");
}

#[tokio::test]
async fn search_rejects_blank_query() {
    let h = Harness::new().await;
    let (status, body) = h.search(&h.alice, "   ", None).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "search_query_empty");
    let request = h
        .alice
        .request(Method::GET, "/api/v1/search")
        .body(Body::empty())
        .expect("pedido");
    let (status, _, body) = send(&h.app, request).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "search_query_empty");
}

#[tokio::test]
async fn search_requires_session() {
    let h = Harness::new().await;
    let anonymous = h.ctx.anonymous().await;
    let (status, body) = h.search(&anonymous, "café", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
}

#[tokio::test]
async fn library_and_projects_tables_have_gin_tsvector_index() {
    let h = Harness::new().await;
    for table in ["books", "articles", "videos", "projects", "project_cards"] {
        let columns: Vec<String> = sqlx::query_scalar(
            "SELECT a.attname::text FROM pg_attribute a \
             JOIN pg_class c ON c.oid = a.attrelid \
             JOIN pg_type t ON t.oid = a.atttypid \
             WHERE c.relname = $1 AND t.typname = 'tsvector' AND NOT a.attisdropped",
        )
        .bind(table)
        .fetch_all(&h.ctx.state.pool)
        .await
        .expect("colunas tsvector");
        assert!(!columns.is_empty(), "{table} sem coluna tsvector");
        let indexes: Vec<String> =
            sqlx::query_scalar("SELECT indexdef FROM pg_indexes WHERE tablename = $1")
                .bind(table)
                .fetch_all(&h.ctx.state.pool)
                .await
                .expect("índices");
        let indexed = columns.iter().any(|column| {
            indexes
                .iter()
                .any(|def| def.contains("USING gin") && def.contains(&format!("({column})")))
        });
        assert!(
            indexed,
            "{table} sem índice GIN em {columns:?}: {indexes:?}"
        );
    }
}

const LATENCY_TERM: &str = "jardim";

/// Cria `count` entidades pelas rotas, 16 pedidos por vez.
async fn create_many(
    app: &Router,
    session: &TestSession,
    count: usize,
    build: impl Fn(usize) -> (String, Value),
) {
    let mut pending = 0;
    let mut tasks = JoinSet::new();
    for n in 0..count {
        let (uri, body) = build(n);
        let (app, session) = (app.clone(), session.clone());
        tasks.spawn(async move { post(&app, &session, &uri, body).await });
        pending += 1;
        if pending == 16 {
            while tasks.join_next().await.is_some() {}
            pending = 0;
        }
    }
    while tasks.join_next().await.is_some() {}
}

#[tokio::test]
#[ignore = "medição de desempenho: rodar em release"]
async fn search_latency_with_ten_thousand_entities() {
    let h = Harness::new().await;
    let (app, a) = (&h.app, &h.alice);
    let account = h.account(a, "Carteira").await;
    let title = |n: usize| format!("Item {n} do jardim");
    create_many(app, a, 1500, |n| {
        (
            "/api/v1/transactions".to_owned(),
            json!({ "kind": "expense", "account_id": account,
            "description": title(n), "expected_amount": 100, "expected_date": "2026-11-05" }),
        )
    })
    .await;
    create_many(app, a, 1000, |n| {
        ("/api/v1/goals".to_owned(), json!({ "title": title(n) }))
    })
    .await;
    create_many(app, a, 1000, |n| {
        ("/api/v1/tasks".to_owned(), json!({ "title": title(n) }))
    })
    .await;
    create_many(app, a, 1000, |n| {
        (
            "/api/v1/reminders".to_owned(),
            json!({ "title": title(n),
            "timezone": "America/Sao_Paulo", "remind_at": "2026-12-05T12:00:00Z" }),
        )
    })
    .await;
    create_many(app, a, 1000, |n| {
        (
            "/api/v1/notes".to_owned(),
            json!({ "title": title(n), "body": "texto da nota" }),
        )
    })
    .await;
    create_many(app, a, 1000, |n| {
        (
            "/api/v1/journal-entries".to_owned(),
            json!({ "occurred_at": "2026-11-01T10:00:00Z",
            "text": title(n), "emotions": [] }),
        )
    })
    .await;
    create_many(app, a, 500, |n| {
        ("/api/v1/books".to_owned(), json!({ "title": title(n) }))
    })
    .await;
    create_many(app, a, 500, |n| {
        ("/api/v1/articles".to_owned(), json!({ "title": title(n) }))
    })
    .await;
    create_many(app, a, 500, |n| {
        (
            "/api/v1/videos".to_owned(),
            json!({ "url": format!("https://example.com/v/{n}"),
            "title": title(n) }),
        )
    })
    .await;
    let mut project_ids = Vec::new();
    let mut lanes = Vec::new();
    for n in 0..500 {
        let project = h
            .create(a, "/api/v1/projects", json!({ "name": title(n) }))
            .await;
        project_ids.push(id_of(&project));
        lanes.push(project["lanes"][0]["id"].as_str().expect("raia").to_owned());
    }
    create_many(app, a, 1500, |n| {
        (
            format!("/api/v1/projects/{}/cards", project_ids[n % 500]),
            json!({ "lane_id": lanes[n % 500], "title": title(n) }),
        )
    })
    .await;

    let mut millis = Vec::new();
    for _ in 0..20 {
        let started = Instant::now();
        let (status, body) = search(app, a, LATENCY_TERM, None).await;
        millis.push(started.elapsed().as_millis());
        assert_eq!(status, StatusCode::OK, "{body}");
        assert_eq!(contexts_of(&body).len(), 8);
    }
    millis.sort_unstable();
    let p95 = millis[(millis.len() * 95).div_ceil(100) - 1];
    println!("search_latency p95_ms={p95}");
    assert!(p95 <= 300, "p95 de {p95} ms acima de 300 ms: {millis:?}");
}
