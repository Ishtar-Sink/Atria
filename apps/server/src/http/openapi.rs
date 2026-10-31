//! Contrato da API: a junção das descrições OpenAPI dos doze contextos, com todos
//! os caminhos sob um único prefixo `/api/v1` ([project/api-02]).

use utoipa::OpenApi;

use crate::auth::AuthApi;
use crate::finance::FinanceApi;
use crate::goals::GoalsApi;
use crate::reminders::RemindersApi;
use crate::reports::ReportsApiDoc;
use crate::tasks::TasksApi;
use crate::{journal, library, links, notes, projects, search};

const API_PREFIX: &str = "/api/v1";

#[derive(OpenApi)]
#[openapi(info(title = "Atria API", version = env!("CARGO_PKG_VERSION")))]
struct ApiDoc;

/// Descrição de cada contexto, como o contexto a declara.
pub fn context_docs() -> Vec<(&'static str, utoipa::openapi::OpenApi)> {
    vec![
        ("auth", AuthApi::openapi()),
        ("finance", FinanceApi::openapi()),
        ("goals", GoalsApi::openapi()),
        ("tasks", TasksApi::openapi()),
        ("reminders", RemindersApi::openapi()),
        ("notes", notes::openapi()),
        ("journal", journal::openapi()),
        ("library", library::openapi()),
        ("projects", projects::openapi()),
        ("links", links::openapi()),
        ("search", search::openapi()),
        ("reports", ReportsApiDoc::openapi()),
    ]
}

/// Acrescenta `/api/v1` só aos caminhos declarados relativos ao prefixo.
pub fn with_api_prefix(mut doc: utoipa::openapi::OpenApi) -> utoipa::openapi::OpenApi {
    doc.paths.paths = std::mem::take(&mut doc.paths.paths)
        .into_iter()
        .map(|(path, item)| (prefixed_path(&path), item))
        .collect();
    doc
}

fn prefixed_path(path: &str) -> String {
    if path.starts_with(&format!("{API_PREFIX}/")) {
        path.to_owned()
    } else {
        format!("{API_PREFIX}{path}")
    }
}

/// O documento juntado dos doze contextos.
pub fn api_doc() -> utoipa::openapi::OpenApi {
    let mut doc = ApiDoc::openapi();
    for (_, context) in context_docs() {
        doc.merge(with_api_prefix(context));
    }
    doc
}

/// O documento juntado em JSON, com os caminhos em ordem estável.
pub fn openapi_json() -> String {
    api_doc()
        .to_pretty_json()
        .unwrap_or_else(|error| format!("{{\"error\": \"{error}\"}}"))
}
