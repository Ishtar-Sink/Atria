//! Testes de integração do catálogo, dos relatórios com filtros e da exportação, contra
//! um PostgreSQL real em container ([project/testing-02]), com relógio fixo
//! ([project/testing-07]) em 2026-11-01. Os dados nascem pelas rotas dos outros
//! contextos, que chamam os serviços de aplicação deles.

use std::collections::HashSet;
use std::io::Read;

use axum::Router;
use axum::body::Body;
use axum::http::{HeaderMap, Method, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use crate::auth::domain::user::{Role, User};
use crate::auth::infrastructure::pg_users;
use crate::http::test_support::{TestContext, TestSession, send};
use crate::reports::domain::{ReportFilters, ReportKind};
use crate::reports::infrastructure::html::html_csp;
use crate::reports::infrastructure::pdf::data_json;
use crate::reports::infrastructure::report_service;

const ALICE: Uuid = Uuid::from_u128(0xa11c_e000_0000_7000_8000_0000_0000_0001);
const BOB: Uuid = Uuid::from_u128(0xb0b0_0000_0000_7000_8000_0000_0000_0002);
const ADMIN: Uuid = Uuid::from_u128(0xad00_0000_0000_7000_8000_0000_0000_0003);

fn id_of(value: &Value) -> String {
    value["id"].as_str().unwrap().to_owned()
}

struct T {
    ctx: TestContext,
    app: Router,
    alice: TestSession,
    bob: TestSession,
    admin: TestSession,
}

/// Dados financeiros de referência, todos de 2026-09 e 2026-10.
struct Finance {
    checking: String,
    savings: String,
    market: String,
    transport: String,
    salary: String,
    tx_old: String,
    tx_salary: String,
    tx_market: String,
    tx_transport: String,
    tx_open: String,
}

impl T {
    async fn new() -> Self {
        let ctx = TestContext::new().await;
        let pool = &ctx.state.pool;
        for migrator in [
            crate::auth::migrator(),
            crate::finance::migrator(),
            crate::goals::migrator(),
            crate::tasks::migrator(),
            crate::reminders::migrator(),
            crate::notes::migrator(),
            crate::journal::migrator(),
            crate::library::migrator(),
            crate::projects::migrator(),
            crate::links::migrator(),
            crate::reports::migrator(),
        ] {
            // Os contextos dividem a `_sqlx_migrations`: cada migrator ignora as dos outros.
            let mut migrator = migrator;
            migrator.set_ignore_missing(true);
            migrator.run(pool).await.expect("migrações");
        }
        let now = "2026-11-01T12:00:00Z".parse().unwrap();
        let mut conn = pool.acquire().await.unwrap();
        for (id, email, role) in [
            (ALICE, "alice@example.com", Role::User),
            (BOB, "bob@example.com", Role::User),
            (ADMIN, "admin@example.com", Role::Admin),
        ] {
            let user = User {
                id,
                email: email.to_owned(),
                password_hash: "hash".to_owned(),
                role,
                is_active: true,
                totp_secret_encrypted: None,
                totp_pending_secret_encrypted: None,
                totp_enabled_at: None,
                created_at: now,
            };
            pg_users::insert(&mut conn, &user, now).await.unwrap();
        }
        drop(conn);
        let api = Router::new()
            .merge(crate::finance::router())
            .merge(crate::goals::router())
            .merge(crate::tasks::router())
            .merge(crate::reminders::router())
            .merge(crate::notes::router())
            .merge(crate::journal::router())
            .merge(crate::library::router())
            .merge(crate::projects::router())
            .merge(crate::links::router())
            .merge(crate::reports::router());
        let app = ctx.app(api);
        let alice = ctx.sign_in_as(ALICE).await;
        let bob = ctx.sign_in_as(BOB).await;
        let admin = ctx.sign_in_as(ADMIN).await;
        Self {
            ctx,
            app,
            alice,
            bob,
            admin,
        }
    }

    async fn call(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let uri = format!("/api/v1{uri}");
        let request = match body {
            Some(body) => session.json(method, &uri, &body),
            None => session
                .request(method, &uri)
                .body(Body::empty())
                .expect("pedido"),
        };
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    async fn get(&self, session: &TestSession, uri: &str) -> (StatusCode, Value) {
        self.call(session, Method::GET, uri, None).await
    }

    /// POST que precisa dar certo; devolve o corpo.
    async fn make(&self, session: &TestSession, uri: &str, body: Value) -> Value {
        let (status, json) = self.call(session, Method::POST, uri, Some(body)).await;
        assert!(status.is_success(), "POST {uri}: {status} {json}");
        json
    }

    async fn change(&self, session: &TestSession, method: Method, uri: &str, body: Value) -> Value {
        let (status, json) = self.call(session, method, uri, Some(body)).await;
        assert!(status.is_success(), "{uri}: {status} {json}");
        json
    }

    /// Resposta crua (HTML, PDF, ZIP), com os cabeçalhos.
    async fn raw(&self, session: &TestSession, uri: &str) -> (StatusCode, HeaderMap, Vec<u8>) {
        let request = session
            .request(Method::GET, &format!("/api/v1{uri}"))
            .body(Body::empty())
            .expect("pedido");
        let response = self.app.clone().oneshot(request).await.expect("resposta");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        (status, headers, bytes.to_vec())
    }

    /// Relatório em JSON; `path` é o que vem depois de `/reports/`.
    async fn report(&self, session: &TestSession, path: &str) -> Value {
        let (status, json) = self.get(session, &format!("/reports/{path}")).await;
        assert_eq!(status, StatusCode::OK, "{path}: {json}");
        json
    }

    async fn problem(&self, session: &TestSession, path: &str) -> (StatusCode, Value) {
        self.get(session, &format!("/reports/{path}")).await
    }

    // ---------------------------------------------------------------- Financeiro

    async fn default_account(&self, session: &TestSession) -> String {
        let (_, body) = self.get(session, "/accounts").await;
        let items = body["items"].as_array().unwrap();
        id_of(items.iter().find(|a| a["is_default"] == true).unwrap())
    }

    async fn account(&self, session: &TestSession, name: &str) -> String {
        id_of(
            &self
                .make(session, "/accounts", json!({ "name": name }))
                .await,
        )
    }

    async fn category(&self, session: &TestSession, name: &str, kind: &str) -> String {
        let body = json!({ "name": name, "kind": kind, "color": "primary" });
        id_of(&self.make(session, "/categories", body).await)
    }

    /// Movimentação liquidada; devolve o id.
    #[allow(clippy::too_many_arguments)]
    async fn settled(
        &self,
        session: &TestSession,
        account: &str,
        category: Option<&str>,
        kind: &str,
        expected: i64,
        settled: i64,
        day: &str,
    ) -> String {
        let created = self
            .make(
                session,
                "/transactions",
                json!({
                    "kind": kind,
                    "account_id": account,
                    "category_id": category,
                    "expected_amount": expected,
                    "expected_date": day,
                }),
            )
            .await;
        let id = id_of(&created["items"][0]);
        self.make(
            session,
            &format!("/transactions/{id}/settlement"),
            json!({ "settled_amount": settled, "settled_at": day }),
        )
        .await;
        id
    }

    async fn seed_finance(&self, session: &TestSession) -> Finance {
        let checking = self.default_account(session).await;
        let savings = self.account(session, "Poupança").await;
        let market = self.category(session, "Mercado", "expense").await;
        let transport = self.category(session, "Transporte", "expense").await;
        let salary = self.category(session, "Salário", "income").await;
        let tx_old = self
            .settled(
                session,
                &checking,
                Some(&market),
                "expense",
                8_000,
                8_000,
                "2026-09-15",
            )
            .await;
        let tx_salary = self
            .settled(
                session,
                &checking,
                Some(&salary),
                "income",
                500_000,
                520_000,
                "2026-10-05",
            )
            .await;
        let tx_market = self
            .settled(
                session,
                &checking,
                Some(&market),
                "expense",
                150_000,
                145_000,
                "2026-10-10",
            )
            .await;
        let tx_transport = self
            .settled(
                session,
                &savings,
                Some(&transport),
                "expense",
                10_000,
                12_500,
                "2026-10-12",
            )
            .await;
        let open = self
            .make(
                session,
                "/transactions",
                json!({
                    "kind": "expense",
                    "account_id": checking,
                    "category_id": market,
                    "expected_amount": 99_000,
                    "expected_date": "2026-10-20",
                }),
            )
            .await;
        Finance {
            checking,
            savings,
            market,
            transport,
            salary,
            tx_old,
            tx_salary,
            tx_market,
            tx_transport,
            tx_open: id_of(&open["items"][0]),
        }
    }

    // ------------------------------------------------------------------- Acervo

    async fn book(&self, session: &TestSession, title: &str, pages: i32, status: &str) -> String {
        let body = json!({ "title": title, "page_count": pages, "reading_status": status });
        id_of(&self.make(session, "/books", body).await)
    }

    async fn reading(&self, session: &TestSession, book: &str, day: &str, pages: i32) {
        let body = json!({ "read_on": day, "pages_read": pages });
        self.make(session, &format!("/books/{book}/reading-sessions"), body)
            .await;
    }

    async fn article(&self, session: &TestSession, title: &str, status: &str) -> String {
        let body = json!({ "title": title, "reading_status": status });
        id_of(&self.make(session, "/articles", body).await)
    }

    async fn video(&self, session: &TestSession, slug: &str, status: &str) -> String {
        let body = json!({
            "url": format!("https://example.com/video/{slug}"),
            "title": slug,
            "watch_status": status,
        });
        id_of(&self.make(session, "/videos", body).await)
    }

    // ------------------------------------------------------------ Outros contextos

    async fn goal(&self, session: &TestSession, title: &str, status: &str) -> String {
        let goal = self
            .make(session, "/goals", json!({ "title": title }))
            .await;
        let id = id_of(&goal);
        if status != "planned" {
            self.change(
                session,
                Method::PATCH,
                &format!("/goals/{id}"),
                json!({ "status": status }),
            )
            .await;
        }
        id
    }

    async fn journal(&self, session: &TestSession, at: &str, text: &str, marks: Value) -> String {
        let body = json!({ "occurred_at": at, "text": text, "emotions": marks });
        id_of(&self.make(session, "/journal-entries", body).await)
    }

    /// Ids das emoções padrão pela chave (`joy`, `anxiety`, `calm`...).
    async fn emotion(&self, session: &TestSession, key: &str) -> String {
        let (_, body) = self.get(session, "/emotions").await;
        let items = body["items"].as_array().unwrap();
        id_of(items.iter().find(|e| e["system_key"] == key).unwrap())
    }

    async fn project(&self, session: &TestSession, name: &str, cards: &[(&str, &str)]) -> String {
        let project = self
            .make(session, "/projects", json!({ "name": name }))
            .await;
        let id = id_of(&project);
        for (lane_key, title) in cards {
            let lane = project["lanes"]
                .as_array()
                .unwrap()
                .iter()
                .find(|l| l["system_key"] == *lane_key)
                .map(id_of)
                .unwrap();
            self.make(
                session,
                &format!("/projects/{id}/cards"),
                json!({ "lane_id": lane, "title": title }),
            )
            .await;
        }
        id
    }
}

fn rows<'a>(value: &'a Value, key: &str) -> &'a Vec<Value> {
    value[key].as_array().unwrap()
}

fn status_counts(report: &Value, key: &str) -> Vec<(String, i64)> {
    rows(report, key)
        .iter()
        .map(|s| {
            (
                s["status"].as_str().unwrap().to_owned(),
                s["count"].as_i64().unwrap(),
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Catálogo e período
// ---------------------------------------------------------------------------

#[tokio::test]
async fn report_catalog_lists_nine_reports_with_filters() {
    let t = T::new().await;

    let (status, catalog) = t.get(&t.alice, "/reports").await;

    assert_eq!(status, StatusCode::OK, "{catalog}");
    let items = catalog.as_array().unwrap();
    let summary: Vec<(&str, &str, Vec<&str>)> = items
        .iter()
        .map(|e| {
            (
                e["id"].as_str().unwrap(),
                e["module"].as_str().unwrap(),
                e["filters"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|f| f.as_str().unwrap())
                    .collect(),
            )
        })
        .collect();
    assert_eq!(items.len(), 9);
    assert_eq!(
        summary[0],
        ("fin-flow", "finance", vec!["period", "account"])
    );
    assert_eq!(summary[4], ("lib-status", "library", vec!["type"]));
    assert_eq!(
        summary[6],
        ("goals-progress", "goals", vec!["goal", "goal_status"])
    );
    assert_eq!(summary[7], ("tasks-done", "tasks", vec![]));
    assert!(
        items
            .iter()
            .all(|e| e["title"].is_string() && e["description"].is_string())
    );
}

#[tokio::test]
async fn catalog_requires_session() {
    let t = T::new().await;
    let anonymous = t.ctx.anonymous().await;

    let (status, problem) = t.get(&anonymous, "/reports").await;
    let (status_one, _) = t.get(&anonymous, "/reports/fin-flow").await;

    assert_eq!(status, StatusCode::UNAUTHORIZED, "{problem}");
    assert_eq!(status_one, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn report_json_returns_each_report_kind() {
    let t = T::new().await;
    t.seed_finance(&t.alice).await;

    for kind in ReportKind::ALL {
        let report = t.report(&t.alice, kind.id()).await;

        assert_eq!(report["report"], kind.id());
        assert_eq!(
            report["period"].is_object(),
            kind.has_period(),
            "{}",
            kind.id()
        );
        assert!(report["generated_on"].is_string());
    }
}

#[tokio::test]
async fn report_period_accepted_only_in_period_reports() {
    let t = T::new().await;

    let (status, problem) = t.problem(&t.alice, "proj-cards?from=2026-10-01").await;
    let (inverted, inverted_problem) = t
        .problem(&t.alice, "fin-flow?from=2026-10-31&to=2026-10-01")
        .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "report_filter_invalid");
    assert_eq!(inverted, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(inverted_problem["code"], "report_period_invalid");
    for id in ["lib-status", "goals-progress", "tasks-done", "proj-cards"] {
        let report = t.report(&t.alice, id).await;
        assert!(report.get("period").is_none(), "{id}");
        assert_eq!(report["generated_on"], "2026-11-01");
    }
    for id in ["lib-status", "goals-progress", "tasks-done"] {
        let (status, problem) = t.problem(&t.alice, &format!("{id}?to=2026-10-01")).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{id}");
        assert_eq!(problem["code"], "report_filter_invalid");
    }
}

/// Primeira movimentação em 2026-08-20, primeira sessão de leitura em 2026-09-03 e
/// primeira entrada do diário em 2026-09-15.
async fn seed_first_records(t: &T) {
    let checking = t.default_account(&t.alice).await;
    t.settled(
        &t.alice,
        &checking,
        None,
        "expense",
        1_000,
        1_000,
        "2026-08-20",
    )
    .await;
    t.settled(
        &t.alice,
        &checking,
        None,
        "income",
        5_000,
        5_000,
        "2026-10-02",
    )
    .await;
    let book = t.book(&t.alice, "Dom Casmurro", 200, "reading").await;
    t.reading(&t.alice, &book, "2026-10-01", 10).await;
    t.reading(&t.alice, &book, "2026-09-03", 20).await;
    let joy = t.emotion(&t.alice, "joy").await;
    t.journal(
        &t.alice,
        "2026-10-04T08:00:00Z",
        "mais tarde",
        json!([{ "emotion_id": joy }]),
    )
    .await;
    t.journal(
        &t.alice,
        "2026-09-15T08:00:00Z",
        "primeira",
        json!([{ "emotion_id": joy }]),
    )
    .await;
}

#[tokio::test]
async fn report_any_period_goes_from_first_record_to_today() {
    let t = T::new().await;
    seed_first_records(&t).await;
    let (_, summary) = t.get(&t.alice, "/financial-summaries").await;

    let flow = t.report(&t.alice, "fin-flow").await;
    let expected = [
        (
            "fin-flow",
            summary["period"]["from"].as_str().unwrap().to_owned(),
        ),
        ("fin-cat", "2026-08-20".to_owned()),
        ("fin-diff", "2026-08-20".to_owned()),
        ("read-pages", "2026-09-03".to_owned()),
        ("journal-emo", "2026-09-15".to_owned()),
    ];

    assert_eq!(flow["period"]["from"], "2026-08-20");
    for (id, from) in expected {
        let report = t.report(&t.alice, id).await;

        assert_eq!(report["period"]["from"], from.as_str(), "{id}");
        assert_eq!(report["period"]["to"], "2026-11-01", "{id}");
        assert_eq!(report["any_period"], true, "{id}");
    }
    let closed = t
        .report(&t.alice, "fin-flow?from=2026-08-01&to=2026-10-31")
        .await;
    assert_eq!(closed["any_period"], false);
}

#[tokio::test]
async fn report_any_period_without_records_starts_today() {
    let t = T::new().await;

    for id in [
        "fin-flow",
        "fin-cat",
        "fin-diff",
        "read-pages",
        "journal-emo",
    ] {
        let report = t.report(&t.bob, id).await;

        assert_eq!(report["period"]["from"], "2026-11-01", "{id}");
        assert_eq!(report["period"]["to"], "2026-11-01", "{id}");
        assert_eq!(report["any_period"], true);
    }
    let flow = t.report(&t.bob, "fin-flow").await;
    assert_eq!(
        flow["totals"],
        json!({ "income": 0, "expense": 0, "net": 0 })
    );
    assert!(rows(&flow, "months").is_empty());
}

#[tokio::test]
async fn report_with_only_from_or_only_to() {
    let t = T::new().await;
    seed_first_records(&t).await;

    let only_from = t.report(&t.alice, "fin-flow?from=2026-10-01").await;
    let only_to = t.report(&t.alice, "fin-flow?to=2026-09-30").await;
    let before_first = t.report(&t.alice, "fin-flow?to=2026-07-01").await;

    assert_eq!(
        only_from["period"],
        json!({ "from": "2026-10-01", "to": "2026-11-01" })
    );
    assert_eq!(only_from["any_period"], true);
    assert_eq!(only_from["totals"]["income"], 5_000);
    assert_eq!(
        only_to["period"],
        json!({ "from": "2026-08-20", "to": "2026-09-30" })
    );
    assert_eq!(only_to["totals"]["expense"], 1_000);
    assert_eq!(only_to["totals"]["income"], 0);
    assert_eq!(before_first["period"]["from"], "2026-07-01");
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

const RANGE: &str = "from=2026-09-01&to=2026-10-31";

#[tokio::test]
async fn report_filters_by_account_and_category() {
    let t = T::new().await;
    let f = t.seed_finance(&t.alice).await;

    let flow = t.report(&t.alice, &format!("fin-flow?{RANGE}")).await;
    let flow_savings = t
        .report(
            &t.alice,
            &format!("fin-flow?{RANGE}&account_id={}", f.savings),
        )
        .await;
    let cat = t.report(&t.alice, &format!("fin-cat?{RANGE}")).await;
    let cat_checking = t
        .report(
            &t.alice,
            &format!("fin-cat?{RANGE}&account_id={}", f.checking),
        )
        .await;
    let cat_transport = t
        .report(
            &t.alice,
            &format!("fin-cat?{RANGE}&category_id={}", f.transport),
        )
        .await;
    let cat_none = t
        .report(
            &t.alice,
            &format!(
                "fin-cat?{RANGE}&account_id={}&category_id={}",
                f.checking, f.transport
            ),
        )
        .await;
    let diff = t.report(&t.alice, &format!("fin-diff?{RANGE}")).await;
    let diff_checking = t
        .report(
            &t.alice,
            &format!("fin-diff?{RANGE}&account_id={}", f.checking),
        )
        .await;

    assert_eq!(
        flow["totals"],
        json!({ "income": 520_000, "expense": 165_500, "net": 354_500 })
    );
    assert_eq!(rows(&flow, "months").len(), 2);
    assert_eq!(flow["months"][0]["month"], "2026-09");
    assert_eq!(flow["months"][0]["expense"], 8_000);
    assert_eq!(flow["months"][1]["income"], 520_000);
    assert_eq!(flow["months"][1]["expense"], 157_500);
    assert_eq!(flow["accounts"][0]["account_id"], f.checking.as_str());
    assert_eq!(flow["accounts"][0]["expense"], 153_000);
    assert_eq!(flow["accounts"][1]["account_id"], f.savings.as_str());
    assert_eq!(
        flow_savings["totals"],
        json!({ "income": 0, "expense": 12_500, "net": -12_500 })
    );
    assert_eq!(flow_savings["filters"][0]["value"], "Poupança");
    assert_eq!(cat["total_expense"], 165_500);
    assert_eq!(cat["categories"][0]["name"], "Mercado");
    assert_eq!(cat["categories"][0]["amount"], 153_000);
    assert_eq!(cat["categories"][0]["percent"], 92);
    assert_eq!(cat["categories"][1]["name"], "Transporte");
    assert_eq!(rows(&cat_checking, "categories").len(), 1);
    assert_eq!(cat_checking["categories"][0]["amount"], 153_000);
    assert_eq!(rows(&cat_transport, "categories").len(), 1);
    assert_eq!(cat_transport["categories"][0]["amount"], 12_500);
    assert_eq!(cat_transport["filters"][0]["value"], "Transporte");
    assert!(rows(&cat_none, "categories").is_empty());
    assert_eq!(
        diff["totals"],
        json!({ "savings": 5_000, "gains": 20_000, "losses": 2_500 })
    );
    assert_eq!(rows(&diff, "months").len(), 1);
    assert_eq!(
        diff_checking["totals"],
        json!({ "savings": 5_000, "gains": 20_000, "losses": 0 })
    );
    let _ = (
        f.salary,
        f.tx_old,
        f.tx_salary,
        f.tx_market,
        f.tx_transport,
        f.tx_open,
    );
}

#[tokio::test]
async fn finance_reports_use_only_settled_transactions() {
    let t = T::new().await;
    let checking = t.default_account(&t.alice).await;
    let savings = t.account(&t.alice, "Poupança").await;
    let rule = json!({
        "frequency": "monthly", "interval": 1, "weekdays": [], "month_day": 10,
        "time": "08:00", "timezone": "America/Sao_Paulo", "starts_on": "2026-09-10", "ends_on": null
    });
    let recurring = t
        .make(
            &t.alice,
            "/recurring-transactions",
            json!({ "kind": "expense", "account_id": checking, "expected_amount": 30_000, "rule": rule }),
        )
        .await;
    let rid = id_of(&recurring);
    let copy = t
        .make(
            &t.alice,
            &format!("/recurring-transactions/{rid}/settlement"),
            json!({ "occurrence_date": "2026-09-10", "settled_amount": 31_000, "settled_at": "2026-09-10" }),
        )
        .await;
    t.settled(
        &t.alice,
        &checking,
        None,
        "expense",
        5_000,
        5_000,
        "2026-10-02",
    )
    .await;
    t.make(
        &t.alice,
        "/transfers",
        json!({
            "from_account_id": checking, "to_account_id": savings,
            "amount": 777_000, "transferred_on": "2026-10-03",
        }),
    )
    .await;

    let flow = t
        .report(&t.alice, "fin-flow?from=2026-09-01&to=2026-12-31")
        .await;
    let (_, items) = t
        .get(&t.alice, "/transactions?from=2026-09-01&to=2026-12-31")
        .await;

    assert!(!copy.is_null());
    // A listagem do Financeiro traz a ocorrência aberta e a previsão; o relatório, não.
    assert!(rows(&items, "items").len() > 2, "{items}");
    assert_eq!(
        flow["totals"],
        json!({ "income": 0, "expense": 36_000, "net": -36_000 })
    );
    assert_eq!(rows(&flow, "months").len(), 2);
}

#[tokio::test]
async fn finance_reports_reflect_edits_and_undone_settlements() {
    let t = T::new().await;
    let f = t.seed_finance(&t.alice).await;
    let query = |kind: &str| format!("{kind}?{RANGE}");

    // Categoria trocada numa liquidada: o Gastos por categoria acompanha (DEC-005).
    t.change(
        &t.alice,
        Method::PATCH,
        &format!("/transactions/{}", f.tx_transport),
        json!({ "category_id": f.market }),
    )
    .await;
    let moved = t.report(&t.alice, &query("fin-cat")).await;
    // Editar o valor de uma não liquidada não muda nenhum total.
    t.change(
        &t.alice,
        Method::PATCH,
        &format!("/transactions/{}", f.tx_open),
        json!({ "expected_amount": 1_000 }),
    )
    .await;
    let edited_open = t.report(&t.alice, &query("fin-flow")).await;
    // Liquidação desfeita de uma comum: sai de todos os totais.
    let (status, _) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/transactions/{}/settlement", f.tx_market),
            None,
        )
        .await;
    let flow = t.report(&t.alice, &query("fin-flow")).await;
    let cat = t.report(&t.alice, &query("fin-cat")).await;
    let diff = t.report(&t.alice, &query("fin-diff")).await;

    assert_eq!(moved["categories"].as_array().unwrap().len(), 1);
    assert_eq!(moved["categories"][0]["name"], "Mercado");
    assert_eq!(moved["categories"][0]["amount"], 165_500);
    assert_eq!(edited_open["totals"]["expense"], 165_500);
    assert!(status.is_success());
    assert_eq!(flow["totals"]["expense"], 20_500);
    assert_eq!(cat["categories"][0]["amount"], 20_500);
    assert_eq!(
        diff["totals"],
        json!({ "savings": 0, "gains": 20_000, "losses": 2_500 })
    );

    // Cópia de recorrente: desfazer a liquidação apaga a cópia, e a ocorrência reaberta,
    // virtual, não entra.
    let checking = f.checking.clone();
    let rule = json!({
        "frequency": "monthly", "interval": 1, "weekdays": [], "month_day": 20,
        "time": "08:00", "timezone": "America/Sao_Paulo", "starts_on": "2026-10-20", "ends_on": null
    });
    let recurring = t
        .make(
            &t.alice,
            "/recurring-transactions",
            json!({ "kind": "expense", "account_id": checking, "expected_amount": 30_000, "rule": rule }),
        )
        .await;
    let copy = t
        .make(
            &t.alice,
            &format!("/recurring-transactions/{}/settlement", id_of(&recurring)),
            json!({ "occurrence_date": "2026-10-20", "settled_amount": 31_000, "settled_at": "2026-10-20" }),
        )
        .await;
    let with_copy = t.report(&t.alice, &query("fin-flow")).await;
    let copy_id = copy["id"]
        .as_str()
        .or(copy["items"][0]["id"].as_str())
        .unwrap()
        .to_owned();
    let (undone, body) = t
        .call(
            &t.alice,
            Method::DELETE,
            &format!("/transactions/{copy_id}/settlement"),
            None,
        )
        .await;
    let without_copy = t.report(&t.alice, &query("fin-flow")).await;

    assert!(undone.is_success(), "{body}");
    assert_eq!(with_copy["totals"]["expense"], 51_500);
    assert_eq!(without_copy["totals"]["expense"], 20_500);
}

// ---------------------------------------------------------------------------
// Acervo, leitura, diário
// ---------------------------------------------------------------------------

#[tokio::test]
async fn lib_status_counts_each_type_by_its_own_status() {
    let t = T::new().await;
    t.book(&t.alice, "Quero", 100, "want_to_read").await;
    let changing = t.book(&t.alice, "Mudando", 100, "reading").await;
    t.book(&t.alice, "Ainda lendo", 100, "reading").await;
    t.article(&t.alice, "Para depois", "to_read").await;
    t.article(&t.alice, "Já li", "read").await;
    t.video(&t.alice, "um", "to_watch").await;
    t.video(&t.alice, "dois", "watched").await;
    t.change(
        &t.alice,
        Method::PATCH,
        &format!("/books/{changing}"),
        json!({ "reading_status": "read" }),
    )
    .await;

    let report = t.report(&t.alice, "lib-status").await;
    let articles = t.report(&t.alice, "lib-status?type=article").await;

    let groups = rows(&report, "groups");
    assert_eq!(groups.len(), 3);
    assert_eq!(
        status_counts(&groups[0], "statuses"),
        vec![
            ("want_to_read".into(), 1),
            ("reading".into(), 1),
            ("read".into(), 1)
        ]
    );
    assert_eq!(
        status_counts(&groups[1], "statuses"),
        vec![
            ("to_read".into(), 1),
            ("reading".into(), 0),
            ("read".into(), 1)
        ]
    );
    assert_eq!(
        status_counts(&groups[2], "statuses"),
        vec![
            ("to_watch".into(), 1),
            ("watching".into(), 0),
            ("watched".into(), 1)
        ]
    );
    assert_eq!(rows(&articles, "groups").len(), 1);
    assert_eq!(articles["groups"][0]["item_type"], "article");
    assert_eq!(articles["groups"][0]["total"], 2);
}

#[tokio::test]
async fn report_filters_by_type_and_goal_status() {
    let t = T::new().await;
    t.book(&t.alice, "Livro", 100, "reading").await;
    t.article(&t.alice, "Artigo", "to_read").await;
    t.goal(&t.alice, "Planejada", "planned").await;
    t.goal(&t.alice, "Andando", "in_progress").await;
    t.goal(&t.alice, "Feita", "completed").await;
    t.goal(&t.alice, "Largada", "abandoned").await;

    let by_type = t.report(&t.alice, "lib-status?type=article").await;
    let abandoned = t
        .report(&t.alice, "goals-progress?goal_status=abandoned")
        .await;
    let running = t
        .report(&t.alice, "goals-progress?goal_status=in_progress")
        .await;
    let all = t.report(&t.alice, "goals-progress").await;
    let (paused, problem) = t
        .problem(&t.alice, "goals-progress?goal_status=paused")
        .await;
    let (music, music_problem) = t.problem(&t.alice, "lib-status?type=music").await;

    assert_eq!(rows(&by_type, "groups").len(), 1);
    assert_eq!(by_type["groups"][0]["item_type"], "article");
    assert_eq!(rows(&abandoned, "goals").len(), 1);
    assert_eq!(abandoned["goals"][0]["title"], "Largada");
    assert_eq!(rows(&running, "goals").len(), 1);
    assert_eq!(running["goals"][0]["title"], "Andando");
    assert_eq!(rows(&all, "goals").len(), 4);
    assert_eq!(
        status_counts(&all, "by_status"),
        vec![
            ("planned".into(), 1),
            ("in_progress".into(), 1),
            ("completed".into(), 1),
            ("abandoned".into(), 1)
        ]
    );
    assert_eq!(paused, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "report_filter_invalid");
    assert_eq!(music, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(music_problem["code"], "report_filter_invalid");
    for value in ["active", "done"] {
        let (status, _) = t
            .problem(&t.alice, &format!("goals-progress?goal_status={value}"))
            .await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{value}");
    }
}

#[tokio::test]
async fn goals_progress_matches_goals_context_progress() {
    let t = T::new().await;
    let with_milestones = t.goal(&t.alice, "Correr 10 km", "in_progress").await;
    let mut first = None;
    for title in ["Semana 1", "Semana 2", "Semana 3", "Semana 4"] {
        let milestone = t
            .make(
                &t.alice,
                &format!("/goals/{with_milestones}/milestones"),
                json!({ "title": title }),
            )
            .await;
        first.get_or_insert(id_of(&milestone));
    }
    t.change(
        &t.alice,
        Method::PATCH,
        &format!("/goals/{with_milestones}/milestones/{}", first.unwrap()),
        json!({ "completed": true }),
    )
    .await;
    let completed = t.goal(&t.alice, "Sem marcos", "completed").await;

    let report = t.report(&t.alice, "goals-progress").await;

    let progress_of = |id: &str| -> Value {
        rows(&report, "goals")
            .iter()
            .find(|g| g["goal_id"] == id)
            .unwrap()
            .clone()
    };
    for id in [&with_milestones, &completed] {
        let (_, goal) = t.get(&t.alice, &format!("/goals/{id}")).await;
        let entry = progress_of(id);

        assert_eq!(entry["progress_percent"], goal["progress_percent"]);
        assert_eq!(entry["milestone_count"], goal["milestone_count"]);
        assert_eq!(
            entry["completed_milestone_count"],
            goal["completed_milestone_count"]
        );
    }
    assert_eq!(progress_of(&with_milestones)["progress_percent"], 25);
    assert_eq!(progress_of(&completed)["progress_percent"], 100);
    assert_eq!(
        status_counts(&report, "by_status"),
        vec![
            ("planned".into(), 0),
            ("in_progress".into(), 1),
            ("completed".into(), 1),
            ("abandoned".into(), 0)
        ]
    );
}

#[tokio::test]
async fn tasks_done_reads_one_off_tasks_from_tasks_context() {
    let t = T::new().await;
    let done = id_of(
        &t.make(&t.alice, "/tasks", json!({ "title": "Concluída" }))
            .await,
    );
    t.make(&t.alice, &format!("/tasks/{done}/completion"), json!({}))
        .await;
    t.make(&t.alice, "/tasks", json!({ "title": "Sem prazo" }))
        .await;
    t.make(
        &t.alice,
        "/tasks",
        json!({ "title": "Vencida", "due_on": "2026-10-31" }),
    )
    .await;
    let rule = json!({
        "frequency": "daily", "interval": 1, "weekdays": [], "month_day": null,
        "time": "08:00", "timezone": "America/Sao_Paulo", "starts_on": "2026-11-01", "ends_on": null
    });
    let daily = id_of(
        &t.make(
            &t.alice,
            "/tasks",
            json!({ "title": "Rotina", "recurrence": rule }),
        )
        .await,
    );
    t.make(
        &t.alice,
        &format!("/tasks/{daily}/completion"),
        json!({ "occurrence_date": "2026-11-01" }),
    )
    .await;

    let report = t.report(&t.alice, "tasks-done").await;
    let (_, body) = {
        let r = t.raw(&t.alice, "/reports/tasks-done?format=html").await;
        (r.0, String::from_utf8(r.2).unwrap())
    };

    assert_eq!(report["completed"], 1);
    assert_eq!(report["open"], 2);
    assert_eq!(report["overdue"], 1);
    assert!(
        report["recurring_notice"]
            .as_str()
            .unwrap()
            .contains("recorrentes")
    );
    assert!(!body.contains("Rotina"));
}

#[tokio::test]
async fn report_filters_by_book_emotion_goal_and_project() {
    let t = T::new().await;
    let a = t.book(&t.alice, "Livro A", 100, "reading").await;
    let b = t.book(&t.alice, "Livro B", 80, "reading").await;
    t.reading(&t.alice, &a, "2026-10-03", 20).await;
    t.reading(&t.alice, &a, "2026-10-04", 30).await;
    t.reading(&t.alice, &b, "2026-10-05", 40).await;
    t.reading(&t.alice, &b, "2026-12-30", 99).await;
    let joy = t.emotion(&t.alice, "joy").await;
    let calm = t.emotion(&t.alice, "calm").await;
    t.journal(
        &t.alice,
        "2026-10-05T08:00:00Z",
        "um",
        json!([{ "emotion_id": joy, "intensity": 4 }]),
    )
    .await;
    t.journal(
        &t.alice,
        "2026-10-06T08:00:00Z",
        "dois",
        json!([{ "emotion_id": calm, "intensity": 2 }]),
    )
    .await;
    let goal_a = t.goal(&t.alice, "Meta A", "in_progress").await;
    t.goal(&t.alice, "Meta B", "in_progress").await;
    let project_a = t
        .project(
            &t.alice,
            "Projeto A",
            &[("waiting", "c1"), ("waiting", "c2"), ("done", "c3")],
        )
        .await;
    t.project(&t.alice, "Projeto B", &[("in_progress", "c4")])
        .await;

    let pages = t.report(&t.alice, &format!("read-pages?{RANGE}")).await;
    let pages_a = t
        .report(&t.alice, &format!("read-pages?{RANGE}&book_id={a}"))
        .await;
    let emotions = t.report(&t.alice, &format!("journal-emo?{RANGE}")).await;
    let emotions_joy = t
        .report(&t.alice, &format!("journal-emo?{RANGE}&emotion_id={joy}"))
        .await;
    let goals_a = t
        .report(&t.alice, &format!("goals-progress?goal_id={goal_a}"))
        .await;
    let cards = t.report(&t.alice, "proj-cards").await;
    let cards_a = t
        .report(&t.alice, &format!("proj-cards?project_id={project_a}"))
        .await;

    assert_eq!(pages["total_pages"], 90);
    assert_eq!(pages["session_count"], 3);
    assert_eq!(pages_a["total_pages"], 50);
    assert_eq!(rows(&pages_a, "books").len(), 1);
    assert_eq!(pages_a["books"][0]["progress_percent"], 50);
    assert_eq!(emotions["entry_count"], 2);
    assert_eq!(rows(&emotions, "emotions").len(), 2);
    assert_eq!(emotions_joy["entry_count"], 1);
    assert_eq!(emotions_joy["emotions"][0]["name"], "Alegria");
    assert_eq!(emotions_joy["emotions"][0]["average_intensity"], 4.0);
    assert_eq!(rows(&goals_a, "goals").len(), 1);
    assert_eq!(goals_a["goals"][0]["title"], "Meta A");
    assert_eq!(rows(&cards, "projects").len(), 2);
    assert_eq!(rows(&cards_a, "projects").len(), 1);
    let lanes = rows(&cards_a["projects"][0], "lanes");
    let counts: Vec<i64> = lanes
        .iter()
        .map(|l| l["card_count"].as_i64().unwrap())
        .collect();
    assert_eq!(counts.iter().sum::<i64>(), 3);
    assert_eq!(counts, vec![2, 0, 1]);
}

#[tokio::test]
async fn report_journal_never_includes_entry_text() {
    let t = T::new().await;
    let joy = t.emotion(&t.alice, "joy").await;
    t.journal(
        &t.alice,
        "2026-10-05T08:00:00Z",
        "segredo-absoluto-do-diario",
        json!([{ "emotion_id": joy, "intensity": 3 }]),
    )
    .await;

    let (_, _, html) = t.raw(&t.alice, "/reports/journal-emo?format=html").await;
    let (_, _, pdf) = t.raw(&t.alice, "/reports/journal-emo?format=pdf").await;
    let json = t.report(&t.alice, "journal-emo").await;

    let needle = "segredo-absoluto";
    assert!(!String::from_utf8(html).unwrap().contains(needle));
    assert!(!json.to_string().contains(needle));
    assert!(!pdf.windows(needle.len()).any(|w| w == needle.as_bytes()));
}

// ---------------------------------------------------------------------------
// Erros e isolamento
// ---------------------------------------------------------------------------

#[tokio::test]
async fn report_rejects_filter_not_accepted() {
    let t = T::new().await;
    let id = Uuid::from_u128(1);
    let cases = [
        format!("fin-flow?book_id={id}"),
        format!("fin-flow?category_id={id}"),
        "goals-progress?type=book".to_owned(),
        "lib-status?goal_status=planned".to_owned(),
        format!("tasks-done?account_id={id}"),
        format!("proj-cards?emotion_id={id}"),
        format!("journal-emo?project_id={id}"),
        format!("read-pages?goal_id={id}"),
    ];

    for case in cases {
        let (status, problem) = t.problem(&t.alice, &case).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{case}");
        assert_eq!(problem["code"], "report_filter_invalid", "{case}");
        assert_eq!(
            problem["type"], "urn:atria:problem:report_filter_invalid",
            "{case}"
        );
    }
}

#[tokio::test]
async fn report_rejects_malformed_filter_id() {
    let t = T::new().await;

    for case in [
        "fin-flow?account_id=nao-e-uuid",
        "fin-cat?category_id=123",
        "read-pages?book_id=x",
        "journal-emo?emotion_id=y",
        "goals-progress?goal_id=z",
        "proj-cards?project_id=w",
    ] {
        let (status, problem) = t.problem(&t.alice, case).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{case}");
        assert_eq!(problem["code"], "report_filter_invalid", "{case}");
    }
}

#[tokio::test]
async fn report_entity_filter_never_reveals_other_users_data() {
    let t = T::new().await;
    let f = t.seed_finance(&t.bob).await;
    let book = t.book(&t.bob, "Livro secreto do Bob", 100, "reading").await;
    t.reading(&t.bob, &book, "2026-10-03", 20).await;
    let goal = t.goal(&t.bob, "Meta secreta do Bob", "in_progress").await;
    let project = t
        .project(&t.bob, "Projeto secreto do Bob", &[("waiting", "c")])
        .await;
    let queries = [
        format!("fin-flow?{RANGE}&account_id={}", f.checking),
        format!("fin-cat?{RANGE}&category_id={}", f.market),
        format!("read-pages?{RANGE}&book_id={book}"),
        format!("goals-progress?goal_id={goal}"),
        format!("proj-cards?project_id={project}"),
    ];

    for query in queries {
        let report = t.report(&t.alice, &query).await;
        let text = report.to_string();

        assert!(!text.contains("secret"), "{query}: {text}");
        assert!(
            !text.contains("Mercado") && !text.contains("Poupança"),
            "{query}"
        );
        for key in [
            "categories",
            "books",
            "goals",
            "projects",
            "accounts",
            "months",
        ] {
            if let Some(list) = report.get(key) {
                assert!(list.as_array().unwrap().is_empty(), "{query}: {key}");
            }
        }
    }
}

#[tokio::test]
async fn report_never_includes_other_users_data() {
    let t = T::new().await;
    t.seed_finance(&t.bob).await;
    let book = t.book(&t.bob, "Livro do Bob", 100, "reading").await;
    t.reading(&t.bob, &book, "2026-10-03", 20).await;
    t.article(&t.bob, "Artigo do Bob", "read").await;
    t.goal(&t.bob, "Meta do Bob", "completed").await;
    t.make(
        &t.bob,
        "/tasks",
        json!({ "title": "Tarefa do Bob", "due_on": "2026-10-01" }),
    )
    .await;
    t.project(&t.bob, "Projeto do Bob", &[("waiting", "c")])
        .await;
    let joy = t.emotion(&t.bob, "joy").await;
    t.journal(
        &t.bob,
        "2026-10-05T08:00:00Z",
        "diário do Bob",
        json!([{ "emotion_id": joy }]),
    )
    .await;

    let flow = t.report(&t.alice, &format!("fin-flow?{RANGE}")).await;
    let cat = t.report(&t.alice, &format!("fin-cat?{RANGE}")).await;
    let diff = t.report(&t.alice, &format!("fin-diff?{RANGE}")).await;
    let pages = t.report(&t.alice, &format!("read-pages?{RANGE}")).await;
    let emotions = t.report(&t.alice, &format!("journal-emo?{RANGE}")).await;
    let lib = t.report(&t.alice, "lib-status").await;
    let goals = t.report(&t.alice, "goals-progress").await;
    let tasks = t.report(&t.alice, "tasks-done").await;
    let cards = t.report(&t.alice, "proj-cards").await;

    assert_eq!(
        flow["totals"],
        json!({ "income": 0, "expense": 0, "net": 0 })
    );
    assert_eq!(cat["total_expense"], 0);
    assert_eq!(
        diff["totals"],
        json!({ "savings": 0, "gains": 0, "losses": 0 })
    );
    assert_eq!(pages["total_pages"], 0);
    assert_eq!(emotions["entry_count"], 0);
    assert!(rows(&lib, "groups").iter().all(|g| g["total"] == 0));
    assert!(rows(&goals, "goals").is_empty());
    assert_eq!(
        (tasks["completed"].as_i64(), tasks["open"].as_i64()),
        (Some(0), Some(0))
    );
    assert!(rows(&cards, "projects").is_empty());
}

#[tokio::test]
async fn report_unknown_returns_404_problem() {
    let t = T::new().await;

    let (status, problem) = t.problem(&t.alice, "nao-existe").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(problem["code"], "report_not_found");
}

#[tokio::test]
async fn report_rejects_invalid_period() {
    let t = T::new().await;

    let (status, problem) = t
        .problem(&t.alice, "fin-cat?from=2026-10-10&to=2026-10-01")
        .await;
    let (future, future_problem) = t.problem(&t.alice, "fin-cat?from=2026-12-01").await;
    let (malformed, malformed_problem) = t.problem(&t.alice, "fin-cat?from=01/10/2026").await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "report_period_invalid");
    assert_eq!(future, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(future_problem["code"], "report_period_invalid");
    assert_eq!(malformed, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(malformed_problem["code"], "report_period_invalid");
}

// ---------------------------------------------------------------------------
// HTML e PDF
// ---------------------------------------------------------------------------

#[tokio::test]
async fn report_html_is_self_contained_and_filters_by_period() {
    let t = T::new().await;
    let f = t.seed_finance(&t.alice).await;

    let (status, headers, bytes) = t
        .raw(
            &t.alice,
            &format!(
                "/reports/fin-cat?format=html&from=2026-10-01&to=2026-10-31&account_id={}",
                f.checking
            ),
        )
        .await;
    let (_, _, september) = t
        .raw(
            &t.alice,
            "/reports/fin-cat?format=html&from=2026-09-01&to=2026-09-30",
        )
        .await;
    let (_, _, empty_form) = t
        .raw(
            &t.alice,
            "/reports/fin-cat?format=html&from=&to=&account_id=",
        )
        .await;
    let page = String::from_utf8(bytes).unwrap();
    let september = String::from_utf8(september).unwrap();

    assert_eq!(status, StatusCode::OK);
    assert!(
        headers["content-type"]
            .to_str()
            .unwrap()
            .starts_with("text/html")
    );
    assert!(!page.contains("<script"));
    assert!(!page.contains("http://") && !page.contains("https://"));
    assert!(page.contains("<details open>"));
    assert!(page.contains("<form class=\"filters\" method=\"get\">"));
    assert!(page.contains("value=\"2026-10-01\"") && page.contains("value=\"2026-10-31\""));
    assert!(page.contains(&f.checking));
    assert!(page.contains("Mercado") && page.contains("R$ 1.450,00"));
    assert!(
        !page.contains("Transporte"),
        "a despesa de Transporte é da Poupança"
    );
    assert!(september.contains("R$ 80,00"));
    assert!(!september.contains("R$ 1.450,00"));
    let empty_form = String::from_utf8(empty_form).unwrap();
    assert!(empty_form.contains("Qualquer período"));
}

#[tokio::test]
async fn report_html_response_has_hash_csp() {
    let t = T::new().await;

    let (status, headers, bytes) = t.raw(&t.alice, "/reports/goals-progress?format=html").await;
    let (_, json_headers, _) = t.raw(&t.alice, "/reports/goals-progress").await;

    assert_eq!(status, StatusCode::OK);
    let csp = headers["content-security-policy"].to_str().unwrap();
    assert_eq!(csp, html_csp());
    assert!(csp.contains("style-src 'sha256-"));
    assert!(!csp.contains("script-src") && !csp.contains("unsafe-inline"));
    assert_eq!(headers["cache-control"], "no-store");
    let page = String::from_utf8(bytes).unwrap();
    assert!(page.contains("<select id=\"goal_status\" name=\"goal_status\">"));
    // As outras respostas seguem com a CSP global da API.
    assert!(
        json_headers["content-security-policy"]
            .to_str()
            .unwrap()
            .contains("default-src 'self'")
    );
}

#[tokio::test]
async fn report_pdf_has_pdf_content_type_and_attachment_name() {
    let t = T::new().await;
    t.seed_finance(&t.alice).await;

    let (status, headers, bytes) = t
        .raw(&t.alice, &format!("/reports/fin-cat?format=pdf&{RANGE}"))
        .await;
    let (_, state_headers, state_bytes) = t.raw(&t.alice, "/reports/tasks-done?format=pdf").await;
    let (_, open_headers, _) = t.raw(&t.alice, "/reports/fin-flow?format=pdf").await;
    let (bad, _, _) = t.raw(&t.alice, "/reports/fin-cat?format=docx").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "application/pdf");
    assert_eq!(
        headers["content-disposition"],
        "attachment; filename=\"atria-fin-cat-2026-09-01-2026-10-31.pdf\""
    );
    assert!(bytes.starts_with(b"%PDF-"));
    assert_eq!(
        state_headers["content-disposition"],
        "attachment; filename=\"atria-tasks-done-2026-11-01.pdf\""
    );
    assert!(state_bytes.starts_with(b"%PDF-"));
    assert_eq!(
        open_headers["content-disposition"],
        "attachment; filename=\"atria-fin-flow-2026-09-15-2026-11-01.pdf\""
    );
    assert_eq!(bad, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn report_pdf_applies_filters() {
    let t = T::new().await;
    let f = t.seed_finance(&t.alice).await;
    let filters = ReportFilters {
        category_id: Some(f.transport.parse().unwrap()),
        period: crate::reports::domain::PeriodRequest {
            from: Some("2026-09-01".parse().unwrap()),
            to: Some("2026-10-31".parse().unwrap()),
        },
        ..ReportFilters::default()
    };

    let report = report_service(&t.ctx.state)
        .build(ALICE, ReportKind::FinCat, filters)
        .await
        .unwrap();
    let data = data_json(&report.document());
    let (status, _, pdf) = t
        .raw(
            &t.alice,
            &format!(
                "/reports/fin-cat?format=pdf&{RANGE}&category_id={}",
                f.transport
            ),
        )
        .await;

    let sections = data["report"]["sections"].to_string();
    assert!(sections.contains("Transporte"));
    assert!(!sections.contains("Mercado"));
    assert_eq!(data["report"]["filters"][0]["value"], "Transporte");
    assert_eq!(status, StatusCode::OK);
    assert!(pdf.starts_with(b"%PDF-"));
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

struct Entities {
    ids: Vec<(&'static str, String)>,
}

/// Uma entidade de cada tipo dos dez contextos.
async fn seed_every_context(t: &T, who: &TestSession, tag: &str) -> Entities {
    let mut ids: Vec<(&'static str, String)> = Vec::new();
    let checking = t.default_account(who).await;
    let savings = t.account(who, &format!("Poupança {tag}")).await;
    let category = t.category(who, &format!("Mercado {tag}"), "expense").await;
    let tx = t
        .settled(
            who,
            &checking,
            Some(&category),
            "expense",
            1_000,
            900,
            "2026-10-02",
        )
        .await;
    let rule = json!({
        "frequency": "monthly", "interval": 1, "weekdays": [], "month_day": 10,
        "time": "08:00", "timezone": "America/Sao_Paulo", "starts_on": "2026-11-10", "ends_on": null
    });
    let recurring = t
        .make(
            who,
            "/recurring-transactions",
            json!({ "kind": "expense", "account_id": checking, "expected_amount": 2_000, "rule": rule }),
        )
        .await;
    let transfer = t
        .make(
            who,
            "/transfers",
            json!({ "from_account_id": checking, "to_account_id": savings, "amount": 50, "transferred_on": "2026-10-03" }),
        )
        .await;
    ids.extend([
        ("finance.accounts", savings),
        ("finance.categories", category),
        ("finance.transactions", tx),
        ("finance.recurring_transactions", id_of(&recurring)),
        ("finance.transfers", id_of(&transfer)),
    ]);
    let goal = t
        .make(
            who,
            "/goals",
            json!({ "title": format!("Meta {tag}"), "labels": ["casa"] }),
        )
        .await;
    let milestone = t
        .make(
            who,
            &format!("/goals/{}/milestones", id_of(&goal)),
            json!({ "title": "Marco" }),
        )
        .await;
    ids.extend([
        ("goals.goals", id_of(&goal)),
        ("goals.milestones", id_of(&milestone)),
    ]);
    let task = t
        .make(
            who,
            "/tasks",
            json!({ "title": format!("Tarefa {tag}"), "labels": ["casa"] }),
        )
        .await;
    ids.push(("tasks.tasks", id_of(&task)));
    let reminder = t
        .make(
            who,
            "/reminders",
            json!({ "title": format!("Lembrete {tag}"), "timezone": "UTC", "remind_at": "2026-12-10T10:00:00Z" }),
        )
        .await;
    ids.push(("reminders.reminders", id_of(&reminder)));
    let note = t
        .make(
            who,
            "/notes",
            json!({ "title": format!("Nota {tag}"), "body": "corpo, com \"aspas\"" }),
        )
        .await;
    ids.push(("notes.notes", id_of(&note)));
    let joy = t.emotion(who, "joy").await;
    let entry = t
        .journal(
            who,
            "2026-10-05T08:00:00Z",
            &format!("Diário {tag}"),
            json!([{ "emotion_id": joy, "intensity": 3 }]),
        )
        .await;
    ids.push(("journal.entries", entry));
    let book = t.book(who, &format!("Livro {tag}"), 100, "reading").await;
    t.reading(who, &book, "2026-10-03", 20).await;
    let article = t.article(who, &format!("Artigo {tag}"), "to_read").await;
    let video = t.video(who, &format!("video-{tag}"), "to_watch").await;
    ids.extend([
        ("library.books", book),
        ("library.articles", article),
        ("library.videos", video),
    ]);
    let project = t
        .project(who, &format!("Projeto {tag}"), &[("waiting", "Cartão")])
        .await;
    let (_, cards) = t.get(who, &format!("/projects/{project}/cards")).await;
    let card = cards["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    ids.extend([("projects.projects", project), ("projects.cards", card)]);
    let link = t
        .make(
            who,
            "/links",
            json!({
                "source_type": "note", "source_id": id_of(&note),
                "target_type": "goal", "target_id": id_of(&goal),
            }),
        )
        .await;
    ids.push(("links.links", id_of(&link)));
    Entities { ids }
}

fn contains_id(export: &Value, path: &str, id: &str) -> bool {
    let (context, table) = path.split_once('.').unwrap();
    export["contexts"][context][table]
        .as_array()
        .is_some_and(|rows| rows.iter().any(|row| row["id"] == id))
}

fn all_ids(export: &Value) -> HashSet<String> {
    let mut found = HashSet::new();
    for tables in export["contexts"].as_object().unwrap().values() {
        for rows in tables.as_object().unwrap().values() {
            for row in rows.as_array().unwrap() {
                if let Some(id) = row["id"].as_str() {
                    found.insert(id.to_owned());
                }
            }
        }
    }
    found
}

async fn export_json_of(t: &T, who: &TestSession) -> (HeaderMap, Value) {
    let (status, headers, bytes) = t.raw(who, "/exports?format=json").await;
    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&bytes)
    );
    (headers, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn export_json_contains_all_user_entities() {
    let t = T::new().await;
    let entities = seed_every_context(&t, &t.alice, "alice").await;

    let (headers, export) = export_json_of(&t, &t.alice).await;

    assert_eq!(headers["content-type"], "application/json");
    assert_eq!(
        headers["content-disposition"],
        "attachment; filename=\"atria-export.json\""
    );
    assert_eq!(export["owner_id"], ALICE.to_string());
    assert_eq!(export["exported_at"], "2026-11-01T12:00:00+00:00");
    for (path, id) in &entities.ids {
        assert!(contains_id(&export, path, id), "falta {path} {id}");
    }
    let profile = &export["contexts"]["auth"]["profile"][0];
    assert_eq!(profile["id"], ALICE.to_string());
    assert_eq!(profile["email"], "alice@example.com");
    assert!(profile.get("password_hash").is_none());
    assert!(export["contexts"]["auth"]["preferences"][0]["theme"].is_string());
    // Etiquetas da meta e da tarefa saem como lista (DEC-006).
    assert_eq!(
        export["contexts"]["goals"]["goals"][0]["labels"],
        json!(["casa"])
    );
    assert_eq!(
        export["contexts"]["tasks"]["tasks"][0]["labels"],
        json!(["casa"])
    );
    assert_eq!(
        export["contexts"]["notes"]["notes"][0]["body"],
        "corpo, com \"aspas\""
    );
    assert!(
        export["contexts"]["journal"]["entries"][0]["text"]
            .as_str()
            .unwrap()
            .contains("alice")
    );
    assert_eq!(
        export["contexts"]["journal"]["entry_emotions"][0]["intensity"],
        3
    );
    assert_eq!(
        export["contexts"]["library"]["reading_sessions"][0]["pages_read"],
        20
    );
    assert_eq!(rows(&export["contexts"]["links"], "links").len(), 1);
    let text = export.to_string();
    assert!(!text.contains("hash") && !text.contains("totp_secret"));
}

#[tokio::test]
async fn export_csv_zip_has_one_file_per_entity_type() {
    let t = T::new().await;
    seed_every_context(&t, &t.alice, "alice").await;

    let (status, headers, bytes) = t.raw(&t.alice, "/exports?format=csv").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(headers["content-type"], "application/zip");
    assert_eq!(
        headers["content-disposition"],
        "attachment; filename=\"atria-export-csv.zip\""
    );
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let names: HashSet<String> = archive
        .file_names()
        .filter_map(Result::ok)
        .map(std::borrow::Cow::into_owned)
        .collect();
    for expected in [
        "auth-profile.csv",
        "auth-preferences.csv",
        "finance-accounts.csv",
        "finance-categories.csv",
        "finance-transactions.csv",
        "finance-recurring_transactions.csv",
        "finance-transfers.csv",
        "goals-goals.csv",
        "goals-milestones.csv",
        "tasks-tasks.csv",
        "reminders-reminders.csv",
        "notes-notes.csv",
        "journal-entries.csv",
        "journal-entry_emotions.csv",
        "library-books.csv",
        "library-reading_sessions.csv",
        "library-articles.csv",
        "library-videos.csv",
        "library-item_notes.csv",
        "library-highlights.csv",
        "library-files.csv",
        "projects-projects.csv",
        "projects-lanes.csv",
        "projects-cards.csv",
        "links-links.csv",
    ] {
        assert!(names.contains(expected), "falta {expected} em {names:?}");
    }
    let mut goals = String::new();
    archive
        .by_name("goals-goals.csv")
        .unwrap()
        .read_to_string(&mut goals)
        .unwrap();
    assert!(goals.starts_with('\u{feff}'));
    assert!(goals.contains("\"[\"\"casa\"\"]\""), "{goals}");
    let mut notes = String::new();
    archive
        .by_name("notes-notes.csv")
        .unwrap()
        .read_to_string(&mut notes)
        .unwrap();
    assert!(notes.contains("\"corpo, com \"\"aspas\"\"\""), "{notes}");
}

#[tokio::test]
async fn export_never_includes_other_users_data() {
    let t = T::new().await;
    let alice = seed_every_context(&t, &t.alice, "alice").await;
    let bob = seed_every_context(&t, &t.bob, "bob").await;

    let (_, alice_export) = export_json_of(&t, &t.alice).await;
    let (_, bob_export) = export_json_of(&t, &t.bob).await;
    let (_, admin_export) = export_json_of(&t, &t.admin).await;

    let alice_ids = all_ids(&alice_export);
    let bob_ids = all_ids(&bob_export);
    let admin_ids = all_ids(&admin_export);
    for (path, id) in &alice.ids {
        assert!(
            !contains_id(&bob_export, path, id),
            "Bob viu {path} da Alice"
        );
        assert!(
            !contains_id(&admin_export, path, id),
            "o admin viu {path} da Alice"
        );
    }
    for (path, id) in &bob.ids {
        assert!(contains_id(&bob_export, path, id), "falta {path} do Bob");
        assert!(
            !contains_id(&alice_export, path, id),
            "Alice viu {path} do Bob"
        );
        assert!(
            !contains_id(&admin_export, path, id),
            "o admin viu {path} do Bob"
        );
    }
    assert!(
        alice_ids.is_disjoint(
            &bob_ids
                .difference(&HashSet::from([BOB.to_string()]))
                .cloned()
                .collect()
        )
    );
    assert!(
        admin_ids
            .iter()
            .all(|id| !alice_ids.contains(id) && !bob_ids.contains(id))
    );
    assert!(!alice_export.to_string().contains("bob"));
    assert!(
        !admin_export.to_string().contains("alice") && !admin_export.to_string().contains("bob")
    );
    assert_eq!(
        admin_export["contexts"]["auth"]["profile"][0]["role"],
        "admin"
    );
}

#[tokio::test]
async fn export_requires_session() {
    let t = T::new().await;
    let anonymous = t.ctx.anonymous().await;

    let (status, _, _) = t.raw(&anonymous, "/exports?format=json").await;
    let (bad, _, _) = t.raw(&t.alice, "/exports?format=xml").await;
    let (missing, _, _) = t.raw(&t.alice, "/exports").await;
    let (_, problem) = t.get(&t.alice, "/exports?format=xml").await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(bad, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(missing, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(problem["code"], "export_format_invalid");
}

// ---------------------------------------------------------------------------
// Amostras para a revisão visual
// ---------------------------------------------------------------------------

#[tokio::test]
#[ignore = "gera amostras para revisão visual"]
async fn write_sample_reports() {
    let t = T::new().await;
    let f = t.seed_finance(&t.alice).await;
    let book = t.book(&t.alice, "Dom Casmurro", 250, "reading").await;
    t.reading(&t.alice, &book, "2026-10-03", 40).await;
    t.reading(&t.alice, &book, "2026-10-09", 25).await;
    t.article(&t.alice, "Sobre a leitura", "to_read").await;
    t.video(&t.alice, "palestra", "watched").await;
    let joy = t.emotion(&t.alice, "joy").await;
    let calm = t.emotion(&t.alice, "calm").await;
    t.journal(
        &t.alice,
        "2026-10-05T08:00:00Z",
        "texto que nunca deve aparecer no relatório",
        json!([{ "emotion_id": joy, "intensity": 4 }, { "emotion_id": calm, "intensity": 2 }]),
    )
    .await;
    t.journal(
        &t.alice,
        "2026-10-12T08:00:00Z",
        "outro texto",
        json!([{ "emotion_id": joy, "intensity": 5 }]),
    )
    .await;
    t.goal(&t.alice, "Correr 10 km", "in_progress").await;
    t.goal(&t.alice, "Ler 12 livros", "completed").await;
    t.make(
        &t.alice,
        "/tasks",
        json!({ "title": "Pagar a luz", "due_on": "2026-10-20" }),
    )
    .await;
    t.project(
        &t.alice,
        "Reforma",
        &[
            ("waiting", "Orçamento"),
            ("in_progress", "Pintura"),
            ("done", "Contrato"),
        ],
    )
    .await;
    let _ = f;

    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("target/report-samples");
    std::fs::create_dir_all(&dir).unwrap();
    for kind in ReportKind::ALL {
        let id = kind.id();
        let query = if kind.has_period() {
            format!("&{RANGE}")
        } else {
            String::new()
        };
        for (format, extension) in [("html", "html"), ("pdf", "pdf")] {
            let (status, _, bytes) = t
                .raw(&t.alice, &format!("/reports/{id}?format={format}{query}"))
                .await;
            assert_eq!(status, StatusCode::OK, "{id}.{extension}");
            std::fs::write(dir.join(format!("{id}.{extension}")), bytes).unwrap();
        }
    }
}
