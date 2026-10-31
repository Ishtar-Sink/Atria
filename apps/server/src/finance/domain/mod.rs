//! Regras do Financeiro, sem dependência de framework, banco nem HTTP
//! ([project/architecture-03]).

pub mod account;
pub mod category;
pub mod credit_card;
pub mod error;
pub mod forecast;
pub mod recurring_transaction;
pub mod settlement;
pub mod summary;
pub mod transaction;
pub mod transfer;

pub use error::{FieldIssue, FinanceError};

/// Texto opcional aparado, com limite de caracteres; vazio vira `None`.
pub fn optional_text(
    value: Option<String>,
    field: &'static str,
    max_chars: usize,
) -> Result<Option<String>, FinanceError> {
    let Some(text) = value else {
        return Ok(None);
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > max_chars {
        return Err(FinanceError::invalid(field, "too_long"));
    }
    Ok(Some(trimmed.to_owned()))
}

/// Nome obrigatório aparado, com limite de caracteres.
pub fn required_name(
    value: &str,
    field: &'static str,
    max_chars: usize,
) -> Result<String, FinanceError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(FinanceError::invalid(field, "required"));
    }
    if trimmed.chars().count() > max_chars {
        return Err(FinanceError::invalid(field, "too_long"));
    }
    Ok(trimmed.to_owned())
}
