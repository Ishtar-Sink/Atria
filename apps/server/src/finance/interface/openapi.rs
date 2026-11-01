//! Documento OpenAPI do Financeiro, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use crate::finance::interface::dto::*;
use crate::finance::interface::handlers;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::recurrence::{Frequency, RecurrenceRule, Weekday};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::list_accounts,
        handlers::create_account,
        handlers::get_account,
        handlers::update_account,
        handlers::delete_account,
        handlers::list_categories,
        handlers::create_category,
        handlers::get_category,
        handlers::update_category,
        handlers::delete_category,
        handlers::list_transactions,
        handlers::create_transactions,
        handlers::get_transaction,
        handlers::update_transaction,
        handlers::delete_transaction,
        handlers::settle_transaction,
        handlers::undo_settlement,
        handlers::list_transfers,
        handlers::create_transfer,
        handlers::get_transfer,
        handlers::delete_transfer,
        handlers::list_recurring_transactions,
        handlers::create_recurring_transaction,
        handlers::get_recurring_transaction,
        handlers::update_recurring_transaction,
        handlers::delete_recurring_transaction,
        handlers::settle_occurrence,
        handlers::skip_occurrence,
        handlers::list_settled_transactions,
        handlers::get_financial_summary,
    ),
    components(schemas(
        TransactionKindDto, DifferenceKindDto, ItemStatusDto,
        RepetitionDto,
        CreateAccountRequest, UpdateAccountRequest, AccountResponse, AccountPage,
        CreateCategoryRequest, UpdateCategoryRequest, CategoryResponse, CategoryPage,
        CreateTransactionRequest, UpdateTransactionRequest, SettleTransactionRequest, TransactionResponse,
        TransactionItemResponse, CreatedTransactions, TransactionPage,
        CreateTransferRequest, TransferResponse, TransferPage,
        CreateRecurringTransactionRequest, UpdateRecurringTransactionRequest,
        SettleOccurrenceRequest, SkipOccurrenceRequest, OpenOccurrenceDto,
        RecurringTransactionResponse, RecurringTransactionPage, SettledTransactionPage,
        PeriodDto, FlowDto, PeriodTotalsDto, WhereGroupDto, WhereItemDto, PlannedDto,
        ExpectedVsSettledDto, SavingsAndLossesDto, AccountBalanceDto, BalanceDto,
        FinancialSummaryResponse, MonthlyTotalsDto,
        RecurrenceRule, Frequency, Weekday, Visibility, ProblemDetails, FieldError,
    )),
    tags((name = "finance", description = "Financeiro: contas, movimentações, recorrências e painel"))
)]
pub struct FinanceApi;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_finance_routes() {
        let document = FinanceApi::openapi();
        let expected = [
            ("/api/v1/accounts", ["get", "post"].as_slice()),
            ("/api/v1/accounts/{id}", &["get", "patch", "delete"]),
            ("/api/v1/categories", &["get", "post"]),
            ("/api/v1/categories/{id}", &["get", "patch", "delete"]),
            ("/api/v1/transactions", &["get", "post"]),
            ("/api/v1/transactions/{id}", &["get", "patch", "delete"]),
            ("/api/v1/transactions/{id}/settlement", &["post", "delete"]),
            ("/api/v1/transfers", &["get", "post"]),
            ("/api/v1/transfers/{id}", &["get", "delete"]),
            ("/api/v1/recurring-transactions", &["get", "post"]),
            (
                "/api/v1/recurring-transactions/{id}",
                &["get", "patch", "delete"],
            ),
            ("/api/v1/recurring-transactions/{id}/settlement", &["post"]),
            ("/api/v1/recurring-transactions/{id}/skip", &["post"]),
            (
                "/api/v1/recurring-transactions/{id}/settled-transactions",
                &["get"],
            ),
            ("/api/v1/financial-summaries", &["get"]),
        ];
        let json = serde_json::to_value(&document).unwrap();

        for (path, methods) in expected {
            let item = &json["paths"][path];
            assert!(item.is_object(), "falta o caminho {path}");
            for method in methods {
                assert!(item[method].is_object(), "falta {method} {path}");
            }
        }
        assert_eq!(json["paths"].as_object().unwrap().len(), expected.len());
        let parameters = json["paths"]["/api/v1/accounts/{id}"]["delete"]["parameters"]
            .as_array()
            .unwrap();
        assert!(
            parameters
                .iter()
                .any(|p| p["name"] == "move_to" && p["in"] == "query"),
            "falta o move_to no DELETE /accounts/{{id}}"
        );
        assert!(json["components"]["schemas"]["TransactionResponse"].is_object());
        assert!(json["components"]["schemas"]["TransactionItemResponse"].is_object());
        assert!(json["components"]["schemas"]["FinancialSummaryResponse"].is_object());
        assert!(json["components"]["schemas"]["MonthlyTotalsDto"].is_object());
        assert!(
            json["components"]["schemas"]["FinancialSummaryResponse"]["properties"]["monthly"]
                .is_object()
        );
    }

    #[test]
    fn card_schemas_are_gone_from_contract() {
        let json = serde_json::to_value(FinanceApi::openapi()).unwrap();
        let schemas = &json["components"]["schemas"];
        let lacks = |schema: &str, fields: &[&str]| {
            let properties = &schemas[schema]["properties"];
            assert!(properties.is_object(), "falta o schema {schema}");
            for field in fields {
                assert!(properties.get(*field).is_none(), "{schema}.{field}");
            }
        };

        for removed in [
            "AccountKindDto",
            "InstallmentDto",
            "StatementResponse",
            "StatementList",
            "PayStatementRequest",
            "StatementPaymentResponse",
            "CreditCardSummaryDto",
        ] {
            assert!(schemas.get(removed).is_none(), "{removed}");
        }
        lacks(
            "AccountResponse",
            &["kind", "credit_limit_amount", "closing_day", "due_day"],
        );
        lacks("CreateTransactionRequest", &["installments"]);
        lacks("TransactionResponse", &["installment", "statement_period"]);
        lacks(
            "TransactionItemResponse",
            &["installment", "statement_period"],
        );
        lacks("TransferResponse", &["statement_period"]);
        lacks("FinancialSummaryResponse", &["credit_cards"]);
        lacks("AccountBalanceDto", &["kind"]);
    }
}
