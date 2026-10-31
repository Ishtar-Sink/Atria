//! O OpenAPI juntado dos doze contextos (decisão 56, [project/api-02]).

use std::collections::{BTreeMap, BTreeSet};

use serde_json::Value;

use crate::http::openapi::{api_doc, context_docs, with_api_prefix};

const METHODS: [&str; 8] = [
    "get", "put", "post", "delete", "options", "head", "patch", "trace",
];

fn operations(doc: &utoipa::openapi::OpenApi) -> Vec<(String, String)> {
    let json = serde_json::to_value(doc).unwrap();
    let mut found = Vec::new();
    if let Some(paths) = json["paths"].as_object() {
        for (path, item) in paths {
            for method in METHODS {
                if item.get(method).is_some() {
                    found.push((path.clone(), method.to_owned()));
                }
            }
        }
    }
    found
}

#[test]
fn merged_openapi_keeps_every_context_route() {
    let merged: BTreeSet<_> = operations(&api_doc()).into_iter().collect();
    let mut missing = Vec::new();
    for (context, doc) in context_docs() {
        let context_operations = operations(&with_api_prefix(doc));
        assert!(
            !context_operations.is_empty(),
            "o contexto {context} não declara rotas"
        );
        for operation in context_operations {
            if !merged.contains(&operation) {
                missing.push(format!("{context}: {} {}", operation.1, operation.0));
            }
        }
    }
    assert!(
        missing.is_empty(),
        "rotas fora do OpenAPI juntado: {missing:?}"
    );
    for (method, path) in [
        ("post", "/api/v1/setup"),
        ("get", "/api/v1/accounts"),
        ("get", "/api/v1/goals"),
        ("get", "/api/v1/tasks"),
        ("get", "/api/v1/reminders"),
        ("get", "/api/v1/projects"),
        ("get", "/api/v1/search"),
        ("get", "/api/v1/links"),
        ("get", "/api/v1/reports/{report}"),
        ("get", "/api/v1/exports"),
    ] {
        assert!(
            merged.contains(&(path.to_owned(), method.to_owned())),
            "falta {method} {path}"
        );
    }
}

#[test]
fn openapi_paths_have_single_api_prefix() {
    let wrong: Vec<_> = operations(&api_doc())
        .into_iter()
        .map(|(path, _)| path)
        .filter(|path| !path.starts_with("/api/v1/") || path.contains("/api/v1/api/v1"))
        .collect();
    assert!(wrong.is_empty(), "caminhos com prefixo errado: {wrong:?}");
}

#[test]
fn openapi_has_no_duplicate_operations() {
    let mut owners: BTreeMap<(String, String), Vec<&str>> = BTreeMap::new();
    let mut total = 0;
    for (context, doc) in context_docs() {
        for operation in operations(&with_api_prefix(doc)) {
            total += 1;
            owners.entry(operation).or_default().push(context);
        }
    }
    let repeated: Vec<_> = owners
        .iter()
        .filter(|(_, contexts)| contexts.len() > 1)
        .collect();
    assert!(repeated.is_empty(), "operações repetidas: {repeated:?}");
    assert_eq!(operations(&api_doc()).len(), total);
}

#[test]
fn openapi_schema_names_do_not_conflict() {
    let mut schemas: BTreeMap<String, (&str, Value)> = BTreeMap::new();
    let mut conflicts = Vec::new();
    for (context, doc) in context_docs() {
        let json = serde_json::to_value(&doc).unwrap();
        let Some(defined) = json["components"]["schemas"].as_object() else {
            continue;
        };
        for (name, schema) in defined {
            match schemas.get(name) {
                Some((owner, existing)) if existing != schema => {
                    conflicts.push(format!("{name}: {owner} x {context}"));
                }
                Some(_) => {}
                None => {
                    schemas.insert(name.clone(), (context, schema.clone()));
                }
            }
        }
    }
    assert!(
        conflicts.is_empty(),
        "schemas com o mesmo nome e forma diferente: {conflicts:?}"
    );
}
