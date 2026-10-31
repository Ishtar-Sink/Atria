//! Rotas dos relatórios e da exportação, sob `/api/v1` (o prefixo é aplicado pela TASK-18):
//! `GET /reports`, `GET /reports/{report}` e `GET /exports`. Erros em `problem+json`.

use axum::Json;
use axum::Router;
use axum::extract::rejection::QueryRejection;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, OpenApi, ToSchema};
use uuid::Uuid;

use crate::http::{AppState, CurrentUser};
use crate::reports::domain::{
    GoalStatus, LibraryItemType, PeriodRequest, Report, ReportCatalogEntry, ReportError,
    ReportFilters, ReportKind,
};
use crate::reports::infrastructure::export::{export_csv_zip, export_json};
use crate::reports::infrastructure::html::{html_csp, render_html};
use crate::reports::infrastructure::pdf::render_pdf;
use crate::reports::infrastructure::{export_service, report_service};
use crate::shared::error::{ApiError, FieldError, ProblemDetails};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/reports", get(list_reports))
        .route("/reports/{report}", get(get_report))
        .route("/exports", get(get_export))
}

impl From<ReportError> for ApiError {
    fn from(error: ReportError) -> Self {
        match error {
            ReportError::NotFound => Self::not_found("report_not_found"),
            ReportError::PeriodInvalid => Self::unprocessable(
                "report_period_invalid",
                vec![FieldError::new("from", "must_not_be_after_to")],
            ),
            ReportError::FilterInvalid(field) => Self::unprocessable(
                "report_filter_invalid",
                vec![FieldError::new(field, "invalid")],
            ),
            ReportError::ExportFormatInvalid => Self::unprocessable(
                "export_format_invalid",
                vec![FieldError::new("format", "invalid")],
            ),
            ReportError::Render(_) | ReportError::Source(_) => Self::internal_from(&error),
        }
    }
}

/// Entrada do catálogo como a API a devolve.
#[derive(Debug, Serialize, ToSchema)]
pub struct CatalogEntryResponse {
    pub id: String,
    pub module: String,
    pub title: String,
    pub description: String,
    /// `period`, `account`, `category`, `book`, `type`, `emotion`, `goal`, `goal_status` ou `project`.
    pub filters: Vec<String>,
}

impl From<&ReportCatalogEntry> for CatalogEntryResponse {
    fn from(entry: &ReportCatalogEntry) -> Self {
        Self {
            id: entry.id.to_owned(),
            module: entry.module.to_owned(),
            title: entry.title.to_owned(),
            description: entry.description.to_owned(),
            filters: entry
                .filters
                .iter()
                .map(|filter| filter.as_str().to_owned())
                .collect(),
        }
    }
}

/// Período e filtros do relatório; só os aceitos por ele. Campos vazios valem como ausentes.
#[derive(Debug, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ReportQuery {
    /// Início do período (data ISO); sem ele, a primeira data registrada.
    pub from: Option<String>,
    /// Fim do período (data ISO); sem ele, hoje.
    pub to: Option<String>,
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub book_id: Option<String>,
    pub emotion_id: Option<String>,
    pub goal_id: Option<String>,
    pub project_id: Option<String>,
    /// `book`, `article` ou `video`.
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    /// `planned`, `in_progress`, `completed` ou `abandoned`.
    pub goal_status: Option<String>,
    /// `html` ou `pdf`; sem ele, o modelo em JSON.
    pub format: Option<String>,
}

#[derive(Debug, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ExportQuery {
    /// `json` ou `csv`.
    pub format: Option<String>,
}

fn present(value: &Option<String>) -> Option<&str> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
}

fn parse_date(value: &Option<String>) -> Result<Option<NaiveDate>, ReportError> {
    present(value)
        .map(|text| {
            NaiveDate::parse_from_str(text, "%Y-%m-%d").map_err(|_| ReportError::PeriodInvalid)
        })
        .transpose()
}

fn parse_id(field: &'static str, value: &Option<String>) -> Result<Option<Uuid>, ReportError> {
    present(value)
        .map(|text| Uuid::parse_str(text).map_err(|_| ReportError::FilterInvalid(field)))
        .transpose()
}

impl ReportQuery {
    fn filters(&self) -> Result<ReportFilters, ReportError> {
        Ok(ReportFilters {
            period: PeriodRequest {
                from: parse_date(&self.from)?,
                to: parse_date(&self.to)?,
            },
            account_id: parse_id("account_id", &self.account_id)?,
            category_id: parse_id("category_id", &self.category_id)?,
            book_id: parse_id("book_id", &self.book_id)?,
            emotion_id: parse_id("emotion_id", &self.emotion_id)?,
            goal_id: parse_id("goal_id", &self.goal_id)?,
            project_id: parse_id("project_id", &self.project_id)?,
            item_type: present(&self.item_type)
                .map(LibraryItemType::parse)
                .transpose()?,
            goal_status: present(&self.goal_status)
                .map(GoalStatus::parse)
                .transpose()?,
        })
    }
}

fn query_or_invalid<T>(query: Result<Query<T>, QueryRejection>) -> Result<T, ApiError> {
    query.map(|Query(value)| value).map_err(|_| {
        ApiError::unprocessable(
            "report_filter_invalid",
            vec![FieldError::new("query", "invalid")],
        )
    })
}

fn private_headers(response: &mut Response) {
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
}

fn attachment(content_type: &'static str, filename: &str, body: Vec<u8>) -> Response {
    let mut response = (StatusCode::OK, body).into_response();
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        headers.insert(header::CONTENT_DISPOSITION, value);
    }
    private_headers(&mut response);
    response
}

/// Nome do arquivo do PDF: com as datas resolvidas, ou a de geração no estado atual.
fn pdf_filename(report: &Report) -> String {
    let id = report.kind().id();
    match report.period() {
        Some((period, _)) => format!("atria-{id}-{}-{}.pdf", period.from, period.to),
        None => format!("atria-{id}-{}.pdf", report.generated_on()),
    }
}

#[utoipa::path(
    get, path = "/api/v1/reports", tag = "reports",
    responses(
        (status = 200, body = Vec<CatalogEntryResponse>, description = "Os nove relatórios, agrupados por módulo"),
        (status = 401, body = ProblemDetails),
    )
)]
pub async fn list_reports(
    State(state): State<AppState>,
    _user: CurrentUser,
) -> Json<Vec<CatalogEntryResponse>> {
    let service = report_service(&state);
    Json(
        service
            .catalog()
            .iter()
            .map(CatalogEntryResponse::from)
            .collect(),
    )
}

#[utoipa::path(
    get, path = "/api/v1/reports/{report}", tag = "reports",
    params(("report" = String, Path, description = "Id do relatório do catálogo"), ReportQuery),
    responses(
        (status = 200, body = serde_json::Value, description = "JSON (padrão), HTML (`format=html`, com CSP própria) ou PDF (`format=pdf`)"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "report_not_found"),
        (status = 422, body = ProblemDetails, description = "report_period_invalid ou report_filter_invalid"),
    )
)]
pub async fn get_report(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(report): Path<String>,
    query: Result<Query<ReportQuery>, QueryRejection>,
) -> Result<Response, ApiError> {
    let kind = ReportKind::parse(&report)?;
    let query = query_or_invalid(query)?;
    let filters = query.filters()?;
    let format = present(&query.format).map(str::to_owned);
    let built = report_service(&state)
        .build(user.user_id, kind, filters.clone())
        .await?;
    let mut response = match format.as_deref() {
        None => Json(&built).into_response(),
        Some("html") => {
            let mut response = (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                render_html(&built, &filters),
            )
                .into_response();
            if let Ok(value) = HeaderValue::from_str(&html_csp()) {
                response
                    .headers_mut()
                    .insert(header::CONTENT_SECURITY_POLICY, value);
            }
            response
        }
        Some("pdf") => {
            let document = built.document();
            let today = state.clock.now().date_naive();
            let bytes = tokio::task::spawn_blocking(move || render_pdf(&document, today))
                .await
                .map_err(|error| ApiError::internal_from(&error))??;
            attachment("application/pdf", &pdf_filename(&built), bytes)
        }
        Some(_) => {
            return Err(ReportError::FilterInvalid("format").into());
        }
    };
    private_headers(&mut response);
    Ok(response)
}

#[utoipa::path(
    get, path = "/api/v1/exports", tag = "reports", params(ExportQuery),
    responses(
        (status = 200, body = serde_json::Value, description = "JSON único ou ZIP com um CSV por tabela"),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "export_format_invalid"),
    )
)]
pub async fn get_export(
    State(state): State<AppState>,
    user: CurrentUser,
    query: Result<Query<ExportQuery>, QueryRejection>,
) -> Result<Response, ApiError> {
    let query = query_or_invalid(query).map_err(|_| ReportError::ExportFormatInvalid)?;
    let format = present(&query.format).map(str::to_owned);
    if !matches!(format.as_deref(), Some("json" | "csv")) {
        return Err(ReportError::ExportFormatInvalid.into());
    }
    let bundle = export_service(&state).collect(user.user_id).await?;
    match format.as_deref() {
        Some("csv") => Ok(attachment(
            "application/zip",
            "atria-export-csv.zip",
            export_csv_zip(&bundle)?,
        )),
        _ => Ok(attachment(
            "application/json",
            "atria-export.json",
            export_json(&bundle)?,
        )),
    }
}

/// Documento OpenAPI do contexto, gerado do código ([project/api-02]).
#[derive(OpenApi)]
#[openapi(
    paths(list_reports, get_report, get_export),
    components(schemas(CatalogEntryResponse, FieldError, ProblemDetails)),
    tags((name = "reports", description = "Relatórios em HTML e PDF e exportação dos dados em JSON e CSV"))
)]
pub struct ReportsApiDoc;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_reports_routes() {
        let doc = ReportsApiDoc::openapi();
        let paths = &doc.paths.paths;

        assert!(paths.get("/api/v1/reports").unwrap().get.is_some());
        assert!(paths.get("/api/v1/reports/{report}").unwrap().get.is_some());
        assert!(paths.get("/api/v1/exports").unwrap().get.is_some());
        let json = serde_json::to_value(&doc).unwrap();
        let params: Vec<&str> = json["paths"]["/api/v1/reports/{report}"]["get"]["parameters"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["name"].as_str().unwrap())
            .collect();
        for name in [
            "report",
            "from",
            "to",
            "account_id",
            "type",
            "goal_status",
            "format",
        ] {
            assert!(params.contains(&name), "falta o parâmetro {name}");
        }
    }

    #[test]
    fn query_treats_blank_values_as_absent_and_rejects_bad_ones() {
        let blank = ReportQuery {
            from: Some(String::new()),
            to: Some("  ".to_owned()),
            account_id: Some(String::new()),
            ..ReportQuery::default()
        };
        let bad_id = ReportQuery {
            account_id: Some("nao-e-uuid".to_owned()),
            ..ReportQuery::default()
        };
        let bad_date = ReportQuery {
            from: Some("31/10/2026".to_owned()),
            ..ReportQuery::default()
        };

        assert_eq!(blank.filters(), Ok(ReportFilters::default()));
        assert_eq!(
            bad_id.filters(),
            Err(ReportError::FilterInvalid("account_id"))
        );
        assert_eq!(bad_date.filters(), Err(ReportError::PeriodInvalid));
    }
}
