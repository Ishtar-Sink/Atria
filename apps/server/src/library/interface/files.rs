//! Handler de `GET /files/{id}`: PDF, capas e miniaturas, só para o dono (RN-25).

use axum::extract::State;
use axum::response::Response;

use super::dto::FileQuery;
use super::{ValidQuery, file_response, id_extractor};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::library::interface::file_service;
use crate::shared::error::{ApiError, ProblemDetails};

id_extractor!(FileId, "file_not_found");

#[utoipa::path(
    get, path = "/api/v1/files/{id}", tag = "library", params(
        ("id" = Uuid, Path, description = "Id do arquivo"),
        FileQuery,
    ),
    responses(
        (status = 200, content_type = "application/pdf", description = "Conteúdo do arquivo; o tipo é o gravado no envio"),
        (status = 404, body = ProblemDetails, description = "file_not_found, também para arquivo de outra pessoa"),
    )
)]
pub async fn get_file(
    State(state): State<AppState>,
    user: CurrentUser,
    FileId(id): FileId,
    ValidQuery(query): ValidQuery<FileQuery>,
) -> Result<Response, ApiError> {
    let (file, bytes) = file_service(&state).read(user.user_id, id).await?;
    file_response(&file, bytes, query.download.unwrap_or(false))
}
