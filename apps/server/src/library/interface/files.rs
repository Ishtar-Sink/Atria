//! Handler de `GET /files/{id}`: PDF, capas e miniaturas, só para o dono (RN-25), com
//! envio parcial por `Range` para o leitor abrir o PDF grande aos poucos (RF-27).

use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, header};
use axum::response::Response;

use super::dto::FileQuery;
use super::{ValidQuery, id_extractor, range_not_satisfiable, stored_file_response};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::library::interface::file_service;
use crate::shared::error::{ApiError, ProblemDetails};

id_extractor!(FileId, "file_not_found");

/// O que o cabeçalho `Range` pede, já limitado ao tamanho do arquivo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RangeRequest {
    Whole,
    Part { start: u64, end: u64 },
    Unsatisfiable,
}

/// Só a unidade `bytes` com um único intervalo; outra unidade ou vários intervalos
/// são ignorados e o arquivo vai inteiro, como a RFC 9110 permite.
pub(crate) fn requested_range(header: Option<&HeaderValue>, size: u64) -> RangeRequest {
    let Some(text) = header.and_then(|value| value.to_str().ok()) else {
        return RangeRequest::Whole;
    };
    let Some(spec) = text.trim().strip_prefix("bytes=") else {
        return RangeRequest::Whole;
    };
    if spec.contains(',') {
        return RangeRequest::Whole;
    }
    byte_range(spec.trim(), size).unwrap_or(RangeRequest::Unsatisfiable)
}

fn byte_range(spec: &str, size: u64) -> Option<RangeRequest> {
    let (first, last) = spec.split_once('-')?;
    if first.is_empty() {
        return suffix_range(digits(last)?, size);
    }
    let start = digits(first)?;
    if start >= size {
        return None;
    }
    let end = if last.is_empty() {
        size - 1
    } else {
        digits(last)?.min(size - 1)
    };
    (end >= start).then_some(RangeRequest::Part { start, end })
}

fn suffix_range(len: u64, size: u64) -> Option<RangeRequest> {
    if len == 0 || size == 0 {
        return None;
    }
    Some(RangeRequest::Part {
        start: size.saturating_sub(len),
        end: size - 1,
    })
}

/// `u64::from_str` aceitaria `+5`; o intervalo só admite dígitos.
fn digits(text: &str) -> Option<u64> {
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

#[utoipa::path(
    get, path = "/api/v1/files/{id}", tag = "library", params(
        ("id" = Uuid, Path, description = "Id do arquivo"),
        ("Range" = Option<String>, Header, description = "Um intervalo em bytes, como bytes=0-65535"),
        FileQuery,
    ),
    responses(
        (status = 200, content_type = "application/pdf", description = "Arquivo inteiro, com Accept-Ranges: bytes; o tipo é o gravado no envio"),
        (status = 206, content_type = "application/pdf", description = "Trecho pedido em Range, com Content-Range: bytes início-fim/tamanho"),
        (status = 404, body = ProblemDetails, description = "file_not_found, também para arquivo de outra pessoa"),
        (status = 416, body = ProblemDetails, description = "range_not_satisfiable, com Content-Range: bytes */tamanho"),
    )
)]
pub async fn get_file(
    State(state): State<AppState>,
    user: CurrentUser,
    FileId(id): FileId,
    headers: HeaderMap,
    ValidQuery(query): ValidQuery<FileQuery>,
) -> Result<Response, ApiError> {
    let service = file_service(&state);
    // O dono é conferido antes do `Range`: quem não é dono recebe 404 sem leitura (RN-03).
    let file = service.describe(user.user_id, id).await?;
    let size = u64::try_from(file.size_bytes).map_err(|_| ApiError::internal())?;
    let download = query.download.unwrap_or(false);
    match requested_range(headers.get(header::RANGE), size) {
        RangeRequest::Whole => {
            let bytes = service.read_range(&file, 0, size).await?;
            stored_file_response(&file, bytes, download, None)
        }
        RangeRequest::Part { start, end } => {
            let bytes = service.read_range(&file, start, end - start + 1).await?;
            stored_file_response(&file, bytes, download, Some((start, end)))
        }
        RangeRequest::Unsatisfiable => Ok(range_not_satisfiable(size)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn range(text: Option<&'static str>) -> RangeRequest {
        let header = text.map(HeaderValue::from_static);
        requested_range(header.as_ref(), 100)
    }

    #[test]
    fn without_header_returns_whole() {
        assert_eq!(range(None), RangeRequest::Whole);
    }

    #[test]
    fn valid_ranges_are_clamped_to_size() {
        let cases = [
            ("bytes=0-9", 0, 9),
            ("bytes=90-", 90, 99),
            ("bytes=-10", 90, 99),
            ("bytes=-500", 0, 99),
            ("bytes=0-999", 0, 99),
        ];
        for (text, start, end) in cases {
            assert_eq!(
                range(Some(text)),
                RangeRequest::Part { start, end },
                "{text}"
            );
        }
    }

    #[test]
    fn invalid_byte_ranges_are_unsatisfiable() {
        for text in [
            "bytes=100-",
            "bytes=50-10",
            "bytes=abc",
            "bytes=-0",
            "bytes=",
        ] {
            assert_eq!(range(Some(text)), RangeRequest::Unsatisfiable, "{text}");
        }
    }

    #[test]
    fn multiple_ranges_and_other_units_are_ignored() {
        for text in ["bytes=0-1,5-6", "items=0-1"] {
            assert_eq!(range(Some(text)), RangeRequest::Whole, "{text}");
        }
    }
}
