//! Categoria de movimentação: tipo (entrada ou saída), cor do tema e a regra de
//! substituição ao excluir uma em uso (RF-30, CB-15, PD-49, PD-58).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::finance::domain::transaction::TransactionKind;
use crate::finance::domain::{FinanceError, required_name};
use crate::shared::visibility::Visibility;

pub const NAME_MAX_CHARS: usize = 80;

/// Tons do tema que uma categoria pode usar, os mesmos do protótipo; uma cor livre
/// fugiria dos tokens do tema ([project/code-style-10]).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CategoryColor {
    Primary,
    Accent,
    Success,
    Warning,
    Danger,
    Info,
}

impl CategoryColor {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Primary => "primary",
            Self::Accent => "accent",
            Self::Success => "success",
            Self::Warning => "warning",
            Self::Danger => "danger",
            Self::Info => "info",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "primary" => Some(Self::Primary),
            "accent" => Some(Self::Accent),
            "success" => Some(Self::Success),
            "warning" => Some(Self::Warning),
            "danger" => Some(Self::Danger),
            "info" => Some(Self::Info),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Category {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub name: String,
    /// Imutável depois da criação: as movimentações dela têm o mesmo tipo.
    pub kind: TransactionKind,
    pub color: CategoryColor,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub fn validate_name(name: &str) -> Result<String, FinanceError> {
    required_name(name, "name", NAME_MAX_CHARS)
}

/// A categoria de uma movimentação, de uma recorrente ou a de destino na exclusão
/// tem o mesmo tipo (PD-49).
pub fn ensure_same_kind(
    category: TransactionKind,
    expected: TransactionKind,
) -> Result<(), FinanceError> {
    if category != expected {
        return Err(FinanceError::CategoryKindMismatch);
    }
    Ok(())
}

/// Categoria em uso só sai com uma categoria de destino, diferente dela. Devolve a
/// categoria que recebe as movimentações, quando houver.
pub fn replacement_for_deletion(
    category_id: Uuid,
    in_use: bool,
    replacement_id: Option<Uuid>,
) -> Result<Option<Uuid>, FinanceError> {
    if replacement_id == Some(category_id) {
        return Err(FinanceError::invalid("replacement_id", "same_category"));
    }
    if !in_use {
        return Ok(None);
    }
    replacement_id
        .map(Some)
        .ok_or(FinanceError::CategoryReplacementRequired)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deleting_category_in_use_requires_replacement() {
        let id = Uuid::from_u128(1);
        let other = Uuid::from_u128(2);

        assert!(matches!(
            replacement_for_deletion(id, true, None),
            Err(FinanceError::CategoryReplacementRequired)
        ));
        assert_eq!(
            replacement_for_deletion(id, true, Some(other)).unwrap(),
            Some(other)
        );
        assert_eq!(replacement_for_deletion(id, false, None).unwrap(), None);
    }

    #[test]
    fn replacement_cannot_be_the_deleted_category() {
        let id = Uuid::from_u128(1);

        let result = replacement_for_deletion(id, true, Some(id));

        assert!(
            matches!(result, Err(FinanceError::Validation(issues)) if issues[0].field == "replacement_id")
        );
    }

    #[test]
    fn replacement_must_have_same_kind() {
        assert!(ensure_same_kind(TransactionKind::Expense, TransactionKind::Expense).is_ok());
        assert!(matches!(
            ensure_same_kind(TransactionKind::Income, TransactionKind::Expense),
            Err(FinanceError::CategoryKindMismatch)
        ));
    }

    #[test]
    fn category_color_accepts_only_theme_tones() {
        for tone in ["primary", "accent", "success", "warning", "danger", "info"] {
            assert_eq!(
                CategoryColor::parse(tone).map(CategoryColor::as_str),
                Some(tone)
            );
        }
        for other in ["#ff0000", "red", "Primary", ""] {
            assert_eq!(CategoryColor::parse(other), None);
        }
    }
}
