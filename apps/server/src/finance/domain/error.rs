//! Erros do Financeiro, com códigos estáveis em inglês ([project/language-08]).
//! Viram `problem+json` só na camada `interface` ([project/code-style-03]).

/// Campo inválido e o código estável do problema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldIssue {
    pub field: &'static str,
    pub code: &'static str,
}

#[derive(Debug, thiserror::Error)]
pub enum FinanceError {
    #[error("registro não encontrado")]
    NotFound,
    #[error("a conta padrão não pode ser excluída")]
    DefaultAccountNotDeletable,
    #[error("a movimentação já foi liquidada")]
    TransactionAlreadySettled,
    #[error("a movimentação não está liquidada")]
    TransactionNotSettled,
    #[error("a categoria está em uso e precisa de uma categoria de destino")]
    CategoryReplacementRequired,
    #[error("a categoria é de outro tipo")]
    CategoryKindMismatch,
    #[error("a data não é a da ocorrência aberta")]
    OccurrenceNotOpen,
    #[error("a recorrência terminou e não tem ocorrência aberta")]
    RecurrenceEnded,
    #[error("a conta tem movimentações ou transferências")]
    AccountHasTransactions,
    #[error("a Idempotency-Key já foi usada com outro corpo")]
    IdempotencyKeyReused,
    #[error("dados inválidos")]
    Validation(Vec<FieldIssue>),
    #[error("falha no armazenamento")]
    Storage(#[source] Box<dyn std::error::Error + Send + Sync>),
}

impl FinanceError {
    pub fn invalid(field: &'static str, code: &'static str) -> Self {
        Self::Validation(vec![FieldIssue { field, code }])
    }

    pub fn storage(cause: impl std::error::Error + Send + Sync + 'static) -> Self {
        Self::Storage(Box::new(cause))
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound => "not_found",
            Self::DefaultAccountNotDeletable => "default_account_not_deletable",
            Self::TransactionAlreadySettled => "transaction_already_settled",
            Self::TransactionNotSettled => "transaction_not_settled",
            Self::CategoryReplacementRequired => "category_replacement_required",
            Self::CategoryKindMismatch => "category_kind_mismatch",
            Self::OccurrenceNotOpen => "occurrence_not_open",
            Self::RecurrenceEnded => "recurrence_ended",
            Self::AccountHasTransactions => "account_has_transactions",
            Self::IdempotencyKeyReused => "idempotency_key_reused",
            Self::Validation(_) => "validation_failed",
            Self::Storage(_) => "internal_error",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable() {
        assert_eq!(FinanceError::NotFound.code(), "not_found");
        assert_eq!(
            FinanceError::invalid("name", "required").code(),
            "validation_failed"
        );
        assert_eq!(
            FinanceError::IdempotencyKeyReused.code(),
            "idempotency_key_reused"
        );
        assert_eq!(
            FinanceError::OccurrenceNotOpen.code(),
            "occurrence_not_open"
        );
        assert_eq!(FinanceError::RecurrenceEnded.code(), "recurrence_ended");
        assert_eq!(
            FinanceError::TransactionNotSettled.code(),
            "transaction_not_settled"
        );
        assert_eq!(
            FinanceError::CategoryKindMismatch.code(),
            "category_kind_mismatch"
        );
    }
}
