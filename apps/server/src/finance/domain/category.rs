//! Categoria de movimentação: tipo (entrada ou saída), cor HEX livre e a regra de
//! substituição ao excluir uma em uso (RF-30, CB-15, PD-49, PD-58).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::finance::domain::transaction::TransactionKind;
use crate::finance::domain::{FinanceError, required_name};
use crate::shared::visibility::Visibility;

pub const NAME_MAX_CHARS: usize = 80;

/// Cor da categoria: HEX `#rrggbb` livre (PD-12, RF-18), sempre em minúsculas (RN-09).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CategoryColor(String);

impl CategoryColor {
    pub fn parse(text: &str) -> Result<Self, FinanceError> {
        let digits = text.strip_prefix('#').unwrap_or_default();
        if digits.len() != 6 || !digits.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(FinanceError::invalid("color", "invalid"));
        }
        Ok(Self(text.to_ascii_lowercase()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
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
    /// Chave da categoria padrão; nula nas criadas pela pessoa e nas padrão renomeadas.
    pub system_key: Option<SystemCategory>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Categorias padrão que cada pessoa recebe na primeira listagem (RF-11).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemCategory {
    Salary,
    Freelance,
    Housing,
    Groceries,
    Transport,
    Leisure,
    Health,
}

impl SystemCategory {
    pub const ALL: [Self; 7] = [
        Self::Salary,
        Self::Freelance,
        Self::Housing,
        Self::Groceries,
        Self::Transport,
        Self::Leisure,
        Self::Health,
    ];

    pub fn key(self) -> &'static str {
        match self {
            Self::Salary => "salary",
            Self::Freelance => "freelance",
            Self::Housing => "housing",
            Self::Groceries => "groceries",
            Self::Transport => "transport",
            Self::Leisure => "leisure",
            Self::Health => "health",
        }
    }

    pub fn from_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|category| category.key() == key)
    }

    pub fn kind(self) -> TransactionKind {
        match self {
            Self::Salary | Self::Freelance => TransactionKind::Income,
            _ => TransactionKind::Expense,
        }
    }

    /// HEX dos tokens do tema claro, os mesmos tons do protótipo (RF-20).
    pub fn color(self) -> CategoryColor {
        let hex = match self {
            Self::Salary => "#047857",
            Self::Freelance => "#0e7490",
            Self::Housing => "#6d28d9",
            Self::Groceries => "#047857",
            Self::Transport => "#0369a1",
            Self::Leisure => "#0e7490",
            Self::Health => "#be123c",
        };
        CategoryColor(hex.to_owned())
    }

    /// Só o valor gravado na coluna `name`, que é obrigatória: a tela mostra o nome
    /// traduzido pela chave ([project/language-06]).
    pub fn default_name(self) -> &'static str {
        match self {
            Self::Salary => "Salário",
            Self::Freelance => "Freelance",
            Self::Housing => "Moradia",
            Self::Groceries => "Mercado",
            Self::Transport => "Transporte",
            Self::Leisure => "Lazer",
            Self::Health => "Saúde",
        }
    }
}

/// As categorias padrão de uma pessoa, uma por `SystemCategory::ALL`.
pub fn default_categories(
    owner_id: Uuid,
    now: DateTime<Utc>,
    mut new_id: impl FnMut() -> Uuid,
) -> Vec<Category> {
    SystemCategory::ALL
        .into_iter()
        .map(|system| Category {
            id: new_id(),
            owner_id,
            visibility: Visibility::Personal,
            name: system.default_name().to_owned(),
            kind: system.kind(),
            color: system.color(),
            system_key: Some(system),
            created_at: now,
            updated_at: now,
        })
        .collect()
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
    fn system_category_keys_round_trip() {
        for category in SystemCategory::ALL {
            assert_eq!(SystemCategory::from_key(category.key()), Some(category));
        }
        assert_eq!(SystemCategory::from_key("other"), None);
    }

    #[test]
    fn default_categories_have_two_income_and_five_expense() {
        let owner = Uuid::from_u128(7);
        let now = DateTime::<Utc>::UNIX_EPOCH;
        let mut next = 0u128;

        let defaults = default_categories(owner, now, || {
            next += 1;
            Uuid::from_u128(next)
        });

        let income = defaults
            .iter()
            .filter(|category| category.kind == TransactionKind::Income)
            .count();
        assert_eq!(defaults.len(), 7);
        assert_eq!(income, 2);
        assert!(defaults.iter().all(|category| category.owner_id == owner
            && category.system_key.is_some()
            && category.visibility == Visibility::Personal));
    }

    #[test]
    fn category_color_accepts_only_hex_rrggbb() {
        assert_eq!(CategoryColor::parse("#1A2b3C").unwrap().as_str(), "#1a2b3c");
        for other in ["primary", "#fff", "#12345g", "123456", "#1234567", ""] {
            assert!(
                matches!(
                    CategoryColor::parse(other),
                    Err(FinanceError::Validation(_))
                ),
                "{other}"
            );
        }
    }

    #[test]
    fn system_category_colors_are_theme_hex() {
        let colors: Vec<(&str, String)> = SystemCategory::ALL
            .into_iter()
            .map(|category| (category.key(), category.color().as_str().to_owned()))
            .collect();
        assert_eq!(
            colors,
            [
                ("salary", "#047857"),
                ("freelance", "#0e7490"),
                ("housing", "#6d28d9"),
                ("groceries", "#047857"),
                ("transport", "#0369a1"),
                ("leisure", "#0e7490"),
                ("health", "#be123c"),
            ]
            .map(|(key, hex)| (key, hex.to_owned()))
        );
    }
}
