//! Erro da API no formato `application/problem+json` (RFC 9457), com código estável
//! ([project/api-03], [project/language-08]).

use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use utoipa::ToSchema;

pub const PROBLEM_JSON: &str = "application/problem+json";

/// Erro de validação de um campo, com código estável.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct FieldError {
    pub field: String,
    pub code: String,
}

impl FieldError {
    pub fn new(field: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            code: code.into(),
        }
    }
}

/// Corpo do erro. O `type` é uma URN, sem URL externa ([project/architecture-12]).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ProblemDetails {
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub code: String,
    pub detail: Option<String>,
    pub errors: Vec<FieldError>,
}

/// Erro devolvido pelos handlers; os erros de domínio viram `ApiError` só na camada
/// `interface` ([project/code-style-03]).
#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub title: &'static str,
    pub detail: Option<String>,
    pub errors: Vec<FieldError>,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, title: &'static str) -> Self {
        Self {
            status,
            code,
            title,
            detail: None,
            errors: Vec::new(),
        }
    }

    pub fn not_found(code: &'static str) -> Self {
        Self::new(StatusCode::NOT_FOUND, code, "Not Found")
    }

    pub fn unauthorized(code: &'static str) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, code, "Unauthorized")
    }

    pub fn forbidden(code: &'static str) -> Self {
        Self::new(StatusCode::FORBIDDEN, code, "Forbidden")
    }

    pub fn conflict(code: &'static str) -> Self {
        Self::new(StatusCode::CONFLICT, code, "Conflict")
    }

    pub fn unprocessable(code: &'static str, errors: Vec<FieldError>) -> Self {
        Self {
            errors,
            ..Self::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                code,
                "Unprocessable Content",
            )
        }
    }

    /// Erro interno: a causa nunca vai para a resposta, só para o log.
    pub fn internal() -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "Internal Server Error",
        )
    }

    /// Registra a causa no log, sem conteúdo pessoal ([project/security-13]), e
    /// devolve o erro interno genérico.
    pub fn internal_from(cause: &dyn std::error::Error) -> Self {
        tracing::error!(error = %cause, "erro interno");
        Self::internal()
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn problem(&self) -> ProblemDetails {
        ProblemDetails {
            r#type: format!("urn:atria:problem:{}", self.code),
            title: self.title.to_owned(),
            status: self.status.as_u16(),
            code: self.code.to_owned(),
            detail: self.detail.clone(),
            errors: self.errors.clone(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (self.status, axum::Json(self.problem())).into_response();
        response
            .headers_mut()
            .insert(header::CONTENT_TYPE, HeaderValue::from_static(PROBLEM_JSON));
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    #[tokio::test]
    async fn problem_response_has_problem_json_content_type() {
        let response = ApiError::not_found("note_not_found").into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            PROBLEM_JSON
        );
    }

    #[tokio::test]
    async fn problem_body_has_stable_code() {
        let errors = vec![FieldError::new("title", "too_long")];
        let response = ApiError::unprocessable("validation_failed", errors).into_response();
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["code"], "validation_failed");
        assert_eq!(json["type"], "urn:atria:problem:validation_failed");
        assert_eq!(json["status"], 422);
        assert_eq!(json["errors"][0]["field"], "title");
        assert_eq!(json["errors"][0]["code"], "too_long");
        let conflict = ApiError::conflict("already_exists").with_detail("detalhe");
        assert_eq!(conflict.problem().status, 409);
        assert_eq!(conflict.problem().detail.as_deref(), Some("detalhe"));
    }
}
