//! Isolamento entre usuários no servidor completo, com sessão e CSRF reais (RNF-02):
//! ninguém, nem o admin (RN-13), lê, altera ou exclui dado de outro, e a marcação
//! "compartilhada" sozinha não dá acesso (RN-17, CT-15).

use axum::http::StatusCode;
use serde_json::{Map, Value, json};

use super::support::{Server, Users};
use crate::http::openapi::api_doc;
use crate::http::test_support::TestSession;

/// Termo único posto no texto de todo item da alice, procurado nas respostas do bob.
const TERM: &str = "xilofonealice";

/// Recursos com rota `{id}`, na ordem em que as dependências são criadas.
const RESOURCES: [&str; 14] = [
    "accounts",
    "categories",
    "transactions",
    "goals",
    "tasks",
    "reminders",
    "notes",
    "emotions",
    "journal-entries",
    "books",
    "articles",
    "videos",
    "projects",
    "links",
];

struct Created {
    resource: &'static str,
    id: String,
    methods: Vec<String>,
    body: Map<String, Value>,
}

struct Schemas {
    doc: Value,
}

impl Schemas {
    fn new() -> Self {
        Self {
            doc: serde_json::to_value(api_doc()).unwrap(),
        }
    }

    fn resolve<'a>(&'a self, mut schema: &'a Value) -> &'a Value {
        while let Some(reference) = schema["$ref"].as_str() {
            let name = reference.rsplit('/').next().unwrap();
            schema = &self.doc["components"]["schemas"][name];
        }
        schema
    }

    fn request_schema(&self, path: &str, method: &str) -> &Value {
        let schema = &self.doc["paths"][path][method]["requestBody"]["content"]["application/json"]
            ["schema"];
        self.resolve(schema)
    }

    /// Campos obrigatórios da criação, como o OpenAPI os declara.
    fn required_fields(&self, resource: &str) -> Vec<String> {
        self.request_schema(&format!("/api/v1/{resource}"), "post")["required"]
            .as_array()
            .map(|fields| {
                fields
                    .iter()
                    .filter_map(|field| field.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default()
    }

    fn patch_fields(&self, resource: &str) -> Vec<String> {
        self.request_schema(&format!("/api/v1/{resource}/{{id}}"), "patch")["properties"]
            .as_object()
            .map(|fields| fields.keys().cloned().collect())
            .unwrap_or_default()
    }

    fn item_methods(&self, resource: &str) -> Vec<String> {
        self.doc["paths"][format!("/api/v1/{resource}/{{id}}")]
            .as_object()
            .map(|item| {
                ["get", "patch", "delete"]
                    .into_iter()
                    .filter(|method| item.contains_key(*method))
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Valor de exemplo de um campo obrigatório, pelo tipo e formato do schema.
    fn sample(&self, resource: &str, field: &str) -> Value {
        let path = format!("/api/v1/{resource}");
        let schema = self.resolve(&self.request_schema(&path, "post")["properties"][field]);
        if let Some(first) = schema["enum"].as_array().and_then(|values| values.first()) {
            return first.clone();
        }
        match (schema["type"].as_str(), schema["format"].as_str()) {
            (_, Some("date")) => json!("2026-11-05"),
            (_, Some("date-time")) => json!("2026-11-05T08:00:00Z"),
            (Some("integer"), _) => json!(1000),
            (Some("array"), _) => json!([]),
            _ => json!(format!("{TERM} {resource}")),
        }
    }
}

fn id_of(created: &[Created], resource: &str) -> String {
    created
        .iter()
        .find(|item| item.resource == resource)
        .map(|item| item.id.clone())
        .unwrap_or_else(|| panic!("{resource} ainda não foi criado"))
}

/// Campos que dependem de outro item já criado ou têm formato próprio.
fn overrides(resource: &str, created: &[Created]) -> Map<String, Value> {
    let id = |name: &str| json!(id_of(created, name));
    let value = match resource {
        // O valor é opcional desde os descontos (SPEC-004): sem ele nem o bruto, é recusado.
        "transactions" => json!({"account_id": id("accounts"), "expected_amount": 1000}),
        // Sem horário, o lembrete é recusado (`missing_schedule`).
        "reminders" => {
            json!({"remind_at": "2026-11-05T08:00:00Z", "timezone": "America/Sao_Paulo"})
        }
        "videos" => json!({"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}),
        "links" => json!({
            "source_type": "note",
            "source_id": id("notes"),
            "target_type": "goal",
            "target_id": id("goals"),
        }),
        // A cor é HEX livre, e a amostra gerada do schema seria recusada.
        "categories" => json!({"color": "#6d28d9"}),
        _ => json!({}),
    };
    value.as_object().cloned().unwrap_or_default()
}

fn created_id(body: &Value) -> String {
    body["id"]
        .as_str()
        .or_else(|| body["items"][0]["id"].as_str())
        .unwrap_or_else(|| panic!("resposta sem id: {body}"))
        .to_owned()
}

/// Cria um item de cada recurso como `owner`, com o corpo mínimo dos campos obrigatórios.
async fn create_all(
    server: &Server,
    schemas: &Schemas,
    owner: &TestSession,
    visibility: &str,
) -> Vec<Created> {
    let mut created = Vec::new();
    for resource in RESOURCES {
        let required = schemas.required_fields(resource);
        assert!(!required.is_empty(), "{resource} sem campos obrigatórios");
        let mut body = Map::new();
        for field in &required {
            body.insert(field.clone(), schemas.sample(resource, field));
        }
        body.extend(overrides(resource, &created));
        body.insert("visibility".to_owned(), json!(visibility));
        let (status, _, reply) = server
            .post(
                owner,
                &format!("/api/v1/{resource}"),
                &Value::Object(body.clone()),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "criar {resource}: {reply}");
        created.push(Created {
            resource,
            id: created_id(&reply),
            methods: schemas.item_methods(resource),
            body,
        });
    }
    created
}

/// Corpo de edição válido: o primeiro campo obrigatório da criação aceito na edição,
/// com o valor usado na criação.
fn patch_body(schemas: &Schemas, item: &Created) -> Value {
    let patchable = schemas.patch_fields(item.resource);
    let field = schemas
        .required_fields(item.resource)
        .into_iter()
        .find(|field| patchable.contains(field))
        .unwrap_or_else(|| panic!("{} sem campo editável", item.resource));
    json!({ field.clone(): item.body[&field].clone() })
}

/// `GET`, `PATCH` e `DELETE` de `intruder` em cada item recebem 404, e os itens continuam.
async fn assert_foreign_access_is_hidden(
    server: &Server,
    schemas: &Schemas,
    owner: &TestSession,
    intruder: &TestSession,
    created: &[Created],
) {
    let mut leaks = Vec::new();
    for item in created {
        let uri = format!("/api/v1/{}/{}", item.resource, item.id);
        for method in &item.methods {
            let (status, _, body) = match method.as_str() {
                "get" => server.get(intruder, &uri).await,
                "patch" => {
                    server
                        .patch(intruder, &uri, &patch_body(schemas, item))
                        .await
                }
                _ => server.delete(intruder, &uri).await,
            };
            if status != StatusCode::NOT_FOUND {
                leaks.push(format!("{method} {uri} -> {status} {body}"));
            }
        }
    }
    assert!(
        leaks.is_empty(),
        "acesso a dado de outro usuário: {leaks:#?}"
    );
    for item in created
        .iter()
        .filter(|item| item.methods.iter().any(|m| m == "get"))
    {
        let uri = format!("/api/v1/{}/{}", item.resource, item.id);
        let (status, _, body) = server.get(owner, &uri).await;
        assert_eq!(status, StatusCode::OK, "o dono perdeu {uri}: {body}");
    }
}

fn assert_no_trace(context: &str, body: &str, created: &[Created]) {
    assert!(
        !body.contains(TERM),
        "{context} trouxe o termo da alice: {body}"
    );
    for item in created {
        assert!(
            !body.contains(&item.id),
            "{context} trouxe o id {} de {}",
            item.id,
            item.resource
        );
    }
}

async fn fixture() -> (Server, Schemas, Users) {
    let server = Server::new().await;
    let users = server.users().await;
    (server, Schemas::new(), users)
}

#[tokio::test]
async fn other_user_gets_404_on_every_resource() {
    let (server, schemas, users) = fixture().await;
    let created = create_all(&server, &schemas, &users.alice.session, "personal").await;

    assert_foreign_access_is_hidden(
        &server,
        &schemas,
        &users.alice.session,
        &users.bob.session,
        &created,
    )
    .await;
}

#[tokio::test]
async fn admin_gets_404_on_other_users_content() {
    let (server, schemas, users) = fixture().await;
    let created = create_all(&server, &schemas, &users.alice.session, "personal").await;

    assert_foreign_access_is_hidden(
        &server,
        &schemas,
        &users.alice.session,
        &users.admin.session,
        &created,
    )
    .await;
}

#[tokio::test]
async fn shared_visibility_does_not_grant_access() {
    let (server, schemas, users) = fixture().await;
    let created = create_all(&server, &schemas, &users.alice.session, "shared").await;

    assert_foreign_access_is_hidden(
        &server,
        &schemas,
        &users.alice.session,
        &users.bob.session,
        &created,
    )
    .await;
}

#[tokio::test]
async fn listings_never_include_other_users_items() {
    let (server, schemas, users) = fixture().await;
    let created = create_all(&server, &schemas, &users.alice.session, "shared").await;

    for resource in RESOURCES {
        // A listagem de ligações é sempre de uma entidade: a nota da alice.
        let uri = match resource {
            "links" => format!(
                "/api/v1/links?entity_type=note&entity_id={}",
                id_of(&created, "notes")
            ),
            _ => format!("/api/v1/{resource}"),
        };
        let (status, _, body) = server.get(&users.bob.session, &uri).await;
        assert!(
            status == StatusCode::OK || (resource == "links" && status == StatusCode::NOT_FOUND),
            "{uri}: {status} {body}"
        );
        assert_no_trace(&uri, &body.to_string(), &created);
    }
}

#[tokio::test]
async fn search_reports_and_exports_never_leak_other_users_data() {
    let (server, schemas, users) = fixture().await;
    let created = create_all(&server, &schemas, &users.alice.session, "shared").await;
    let (status, _, own) = server
        .get(&users.alice.session, &format!("/api/v1/search?q={TERM}"))
        .await;
    assert_eq!(status, StatusCode::OK, "{own}");
    assert!(
        own.to_string().contains(TERM),
        "a busca da alice acha os próprios itens: {own}"
    );

    let mut uris = vec![
        format!("/api/v1/search?q={TERM}"),
        "/api/v1/exports?format=json".to_owned(),
    ];
    let (status, _, catalog) = server.get(&users.bob.session, "/api/v1/reports").await;
    assert_eq!(status, StatusCode::OK, "{catalog}");
    for report in catalog.as_array().unwrap() {
        uris.push(format!(
            "/api/v1/reports/{}",
            report["id"].as_str().unwrap()
        ));
    }
    for uri in uris {
        let (status, _, body) = server.get(&users.bob.session, &uri).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
        assert_no_trace(&uri, &body.to_string(), &created);
    }
}

#[tokio::test]
async fn deleting_entity_removes_its_links_on_both_sides() {
    let (server, schemas, users) = fixture().await;
    let alice = &users.alice.session;
    let created = create_all(&server, &schemas, alice, "personal").await;
    let (note, goal) = (id_of(&created, "notes"), id_of(&created, "goals"));
    let goal_links = format!("/api/v1/links?entity_type=goal&entity_id={goal}");
    let (_, _, before) = server.get(alice, &goal_links).await;
    assert!(
        before.to_string().contains(&note),
        "a ligação existe: {before}"
    );

    let (status, _, body) = server.delete(alice, &format!("/api/v1/notes/{note}")).await;
    assert_eq!(status, StatusCode::NO_CONTENT, "{body}");

    let (status, _, after) = server.get(alice, &goal_links).await;
    assert_eq!(status, StatusCode::OK, "{after}");
    assert!(
        !after.to_string().contains(&note),
        "a ligação continuou: {after}"
    );
    let (_, _, note_links) = server
        .get(
            alice,
            &format!("/api/v1/links?entity_type=note&entity_id={note}"),
        )
        .await;
    assert!(
        !note_links.to_string().contains(&goal),
        "a ligação continuou: {note_links}"
    );
}
