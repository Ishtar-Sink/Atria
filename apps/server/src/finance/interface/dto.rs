//! Corpos de requisição e resposta do Financeiro, em `snake_case`
//! ([project/naming-convention-06]), com os esquemas do OpenAPI.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::finance::application::credit_cards::Statement;
use crate::finance::application::ports::{Repetition, StatementPayment};
use crate::finance::application::summaries::{CardView, PeriodSummaryView, WhereView};
use crate::finance::domain::account::{Account, AccountKind};
use crate::finance::domain::category::{Category, CategoryColor};
use crate::finance::domain::forecast::FinanceItem;
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::settlement::{DifferenceKind, Settlement};
use crate::finance::domain::summary::{
    ExpectedVsSettled, Flow, Period, PeriodTotals, Planned, SavingsAndLosses, WhereGroup,
};
use crate::finance::domain::transaction::{ItemStatus, Transaction, TransactionKind};
use crate::finance::domain::transfer::Transfer;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AccountKindDto {
    #[default]
    Standard,
    CreditCard,
}

impl From<AccountKindDto> for AccountKind {
    fn from(value: AccountKindDto) -> Self {
        match value {
            AccountKindDto::Standard => Self::Standard,
            AccountKindDto::CreditCard => Self::CreditCard,
        }
    }
}

impl From<AccountKind> for AccountKindDto {
    fn from(value: AccountKind) -> Self {
        match value {
            AccountKind::Standard => Self::Standard,
            AccountKind::CreditCard => Self::CreditCard,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum TransactionKindDto {
    Income,
    Expense,
}

impl From<TransactionKindDto> for TransactionKind {
    fn from(value: TransactionKindDto) -> Self {
        match value {
            TransactionKindDto::Income => Self::Income,
            TransactionKindDto::Expense => Self::Expense,
        }
    }
}

impl From<TransactionKind> for TransactionKindDto {
    fn from(value: TransactionKind) -> Self {
        match value {
            TransactionKind::Income => Self::Income,
            TransactionKind::Expense => Self::Expense,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum DifferenceKindDto {
    Saving,
    Gain,
    Loss,
}

impl From<DifferenceKind> for DifferenceKindDto {
    fn from(value: DifferenceKind) -> Self {
        match value {
            DifferenceKind::Saving => Self::Saving,
            DifferenceKind::Gain => Self::Gain,
            DifferenceKind::Loss => Self::Loss,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CategoryColorDto {
    Primary,
    Accent,
    Success,
    Warning,
    Danger,
    Info,
}

impl From<CategoryColorDto> for CategoryColor {
    fn from(value: CategoryColorDto) -> Self {
        match value {
            CategoryColorDto::Primary => Self::Primary,
            CategoryColorDto::Accent => Self::Accent,
            CategoryColorDto::Success => Self::Success,
            CategoryColorDto::Warning => Self::Warning,
            CategoryColorDto::Danger => Self::Danger,
            CategoryColorDto::Info => Self::Info,
        }
    }
}

impl From<CategoryColor> for CategoryColorDto {
    fn from(value: CategoryColor) -> Self {
        match value {
            CategoryColor::Primary => Self::Primary,
            CategoryColor::Accent => Self::Accent,
            CategoryColor::Success => Self::Success,
            CategoryColor::Warning => Self::Warning,
            CategoryColor::Danger => Self::Danger,
            CategoryColor::Info => Self::Info,
        }
    }
}

/// Situação do item: liquidado, aberto, atrasado ou previsto (PD-51).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ItemStatusDto {
    Settled,
    Open,
    Overdue,
    Forecast,
}

impl From<ItemStatus> for ItemStatusDto {
    fn from(value: ItemStatus) -> Self {
        match value {
            ItemStatus::Settled => Self::Settled,
            ItemStatus::Open => Self::Open,
            ItemStatus::Overdue => Self::Overdue,
            ItemStatus::Forecast => Self::Forecast,
        }
    }
}

/// Filtro de repetição (PD-52): `recurring` traz a aberta e as previsões das
/// recorrentes; `one_off`, as gravadas, inclusive as cópias liquidadas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RepetitionDto {
    #[default]
    All,
    Recurring,
    OneOff,
}

impl From<RepetitionDto> for Repetition {
    fn from(value: RepetitionDto) -> Self {
        match value {
            RepetitionDto::All => Self::All,
            RepetitionDto::Recurring => Self::Recurring,
            RepetitionDto::OneOff => Self::OneOff,
        }
    }
}

// Contas -------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateAccountRequest {
    pub name: String,
    #[serde(default)]
    pub kind: AccountKindDto,
    pub credit_limit_amount: Option<i64>,
    pub closing_day: Option<u32>,
    pub due_day: Option<u32>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateAccountRequest {
    pub name: Option<String>,
    pub credit_limit_amount: Option<i64>,
    pub closing_day: Option<u32>,
    pub due_day: Option<u32>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AccountResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub kind: AccountKindDto,
    pub is_default: bool,
    pub balance_amount: i64,
    #[schema(example = "BRL")]
    pub currency: String,
    pub credit_limit_amount: Option<i64>,
    pub closing_day: Option<u32>,
    pub due_day: Option<u32>,
}

impl From<Account> for AccountResponse {
    fn from(account: Account) -> Self {
        Self {
            id: account.id,
            owner_id: account.owner_id,
            visibility: account.visibility,
            created_at: account.created_at,
            updated_at: account.updated_at,
            name: account.name,
            kind: account.kind.into(),
            is_default: account.is_default,
            balance_amount: account.balance_amount,
            currency: account.currency.to_string(),
            credit_limit_amount: account.card.map(|terms| terms.credit_limit_amount),
            closing_day: account.card.map(|terms| terms.cycle.closing_day),
            due_day: account.card.map(|terms| terms.cycle.due_day),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AccountPage {
    pub items: Vec<AccountResponse>,
    pub next_cursor: Option<String>,
}

// Categorias ---------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub kind: TransactionKindDto,
    pub color: CategoryColorDto,
    pub visibility: Option<Visibility>,
}

/// O tipo da categoria não muda depois da criação.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub color: Option<CategoryColorDto>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct CategoryQuery {
    pub kind: Option<TransactionKindDto>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct DeleteCategoryQuery {
    /// Categoria do mesmo tipo que recebe as movimentações de uma categoria em uso
    /// (CB-15, PD-49).
    pub replacement_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategoryResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub kind: TransactionKindDto,
    pub color: CategoryColorDto,
}

impl From<Category> for CategoryResponse {
    fn from(category: Category) -> Self {
        Self {
            id: category.id,
            owner_id: category.owner_id,
            visibility: category.visibility,
            created_at: category.created_at,
            updated_at: category.updated_at,
            name: category.name,
            kind: category.kind.into(),
            color: category.color.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategoryPage {
    pub items: Vec<CategoryResponse>,
    pub next_cursor: Option<String>,
}

// Movimentações ------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTransactionRequest {
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    pub expected_date: NaiveDate,
    /// Número de parcelas de uma compra no cartão (RF-28).
    pub installments: Option<u32>,
    pub visibility: Option<Visibility>,
}

/// Edição (DEC-005): a liquidada só aceita `description`, `category_id` e
/// `visibility`; a parcela não muda `account_id` nem `expected_date`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateTransactionRequest {
    pub description: Option<String>,
    pub expected_amount: Option<i64>,
    pub expected_date: Option<NaiveDate>,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SettleTransactionRequest {
    pub settled_amount: i64,
    pub settled_at: NaiveDate,
}

/// Período livre pela data efetiva, a da liquidação ou a prevista (PD-55); sem
/// `from` e `to`, sem limite de data (DEC-004).
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct TransactionQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub kind: Option<TransactionKindDto>,
    pub settled: Option<bool>,
    #[serde(default)]
    pub repetition: RepetitionDto,
    /// Busca na descrição, de 1 a 100 caracteres, sem diferenciar maiúsculas e
    /// acentos (DEC-005).
    pub q: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct InstallmentDto {
    pub number: u32,
    pub total: u32,
}

/// Movimentação gravada (contrato "Movimentação financeira").
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransactionResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    pub expected_date: NaiveDate,
    pub settled_amount: Option<i64>,
    pub settled_at: Option<NaiveDate>,
    pub difference_amount: Option<i64>,
    pub difference_kind: Option<DifferenceKindDto>,
    #[schema(example = "BRL")]
    pub currency: String,
    pub status: ItemStatusDto,
    /// Data da liquidação, quando liquidada, e a prevista nos outros casos.
    pub effective_date: NaiveDate,
    /// Sempre nulo numa gravada: só as ocorrências virtuais têm recorrência.
    pub recurrence_id: Option<Uuid>,
    /// Recorrente de onde veio a cópia liquidada.
    pub generated_from: Option<Uuid>,
    pub occurrence_date: Option<NaiveDate>,
    pub installment: Option<InstallmentDto>,
    #[schema(example = "2026-11")]
    pub statement_period: Option<String>,
}

impl TransactionResponse {
    /// `today` decide entre aberta e atrasada ([project/code-style-06]).
    pub fn new(item: Transaction, today: NaiveDate) -> Self {
        let status = item.status(today).into();
        let effective_date = item.effective_date();
        let settlement = item.settlement;
        Self {
            id: item.id,
            owner_id: item.owner_id,
            visibility: item.visibility,
            created_at: item.created_at,
            updated_at: item.updated_at,
            kind: item.kind.into(),
            account_id: item.account_id,
            category_id: item.category_id,
            description: item.description,
            expected_amount: item.expected_amount,
            expected_date: item.expected_date,
            settled_amount: settlement.map(|done| done.settled_amount),
            settled_at: settlement.map(|done| done.settled_at),
            difference_amount: settlement.map(|done| done.difference_amount),
            difference_kind: difference_kind(settlement),
            currency: item.currency.to_string(),
            status,
            effective_date,
            recurrence_id: None,
            generated_from: item.generated_from,
            occurrence_date: item.occurrence_date,
            installment: item.installment.map(|i| InstallmentDto {
                number: i.number,
                total: i.total,
            }),
            statement_period: item.statement_period.map(|p| p.to_string()),
        }
    }
}

fn difference_kind(settlement: Option<Settlement>) -> Option<DifferenceKindDto> {
    settlement
        .and_then(|done| done.difference_kind)
        .map(Into::into)
}

/// Item da listagem: uma gravada ou uma ocorrência virtual de recorrente, sem `id` e
/// com `recurrence_id` (PD-51).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransactionItemResponse {
    pub id: Option<Uuid>,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    pub expected_date: NaiveDate,
    pub settled_amount: Option<i64>,
    pub settled_at: Option<NaiveDate>,
    pub difference_amount: Option<i64>,
    pub difference_kind: Option<DifferenceKindDto>,
    #[schema(example = "BRL")]
    pub currency: String,
    pub status: ItemStatusDto,
    pub effective_date: NaiveDate,
    pub recurrence_id: Option<Uuid>,
    pub generated_from: Option<Uuid>,
    pub occurrence_date: Option<NaiveDate>,
    pub installment: Option<InstallmentDto>,
    #[schema(example = "2026-11")]
    pub statement_period: Option<String>,
}

impl TransactionItemResponse {
    pub fn new(item: FinanceItem, today: NaiveDate) -> Self {
        match item {
            FinanceItem::Stored(stored) => TransactionResponse::new(stored, today).into(),
            FinanceItem::Virtual(projected) => Self {
                id: None,
                owner_id: projected.owner_id,
                visibility: projected.visibility,
                created_at: None,
                updated_at: None,
                kind: projected.kind.into(),
                account_id: projected.account_id,
                category_id: projected.category_id,
                description: projected.description,
                expected_amount: projected.expected_amount,
                expected_date: projected.occurrence_date,
                settled_amount: None,
                settled_at: None,
                difference_amount: None,
                difference_kind: None,
                currency: projected.currency.to_string(),
                status: projected.status.into(),
                effective_date: projected.occurrence_date,
                recurrence_id: Some(projected.recurrence_id),
                generated_from: None,
                occurrence_date: Some(projected.occurrence_date),
                installment: None,
                statement_period: None,
            },
        }
    }
}

impl From<TransactionResponse> for TransactionItemResponse {
    fn from(item: TransactionResponse) -> Self {
        Self {
            id: Some(item.id),
            owner_id: item.owner_id,
            visibility: item.visibility,
            created_at: Some(item.created_at),
            updated_at: Some(item.updated_at),
            kind: item.kind,
            account_id: item.account_id,
            category_id: item.category_id,
            description: item.description,
            expected_amount: item.expected_amount,
            expected_date: item.expected_date,
            settled_amount: item.settled_amount,
            settled_at: item.settled_at,
            difference_amount: item.difference_amount,
            difference_kind: item.difference_kind,
            currency: item.currency,
            status: item.status,
            effective_date: item.effective_date,
            recurrence_id: item.recurrence_id,
            generated_from: item.generated_from,
            occurrence_date: item.occurrence_date,
            installment: item.installment,
            statement_period: item.statement_period,
        }
    }
}

/// Movimentações criadas por um pedido: uma, ou uma por parcela.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreatedTransactions {
    pub items: Vec<TransactionResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransactionPage {
    pub items: Vec<TransactionItemResponse>,
    pub next_cursor: Option<String>,
}

// Transferências -----------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTransferRequest {
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub amount: i64,
    pub transferred_on: NaiveDate,
    pub description: Option<String>,
    pub visibility: Option<Visibility>,
}

/// Período livre por `transferred_on`, com limites opcionais.
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct TransferQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    /// Busca na descrição, como em `GET /transactions`.
    pub q: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransferResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub amount: i64,
    #[schema(example = "BRL")]
    pub currency: String,
    pub transferred_on: NaiveDate,
    pub description: Option<String>,
    /// Período da fatura que a transferência pagou, quando paga uma fatura.
    pub statement_period: Option<String>,
}

impl From<Transfer> for TransferResponse {
    fn from(transfer: Transfer) -> Self {
        Self {
            id: transfer.id,
            owner_id: transfer.owner_id,
            visibility: transfer.visibility,
            created_at: transfer.created_at,
            updated_at: transfer.updated_at,
            from_account_id: transfer.from_account_id,
            to_account_id: transfer.to_account_id,
            amount: transfer.amount,
            currency: transfer.currency.to_string(),
            transferred_on: transfer.transferred_on,
            description: transfer.description,
            statement_period: transfer.statement_period.map(|p| p.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TransferPage {
    pub items: Vec<TransferResponse>,
    pub next_cursor: Option<String>,
}

// Recorrências -------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateRecurringTransactionRequest {
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub expected_amount: i64,
    pub description: Option<String>,
    pub rule: RecurrenceRule,
    pub visibility: Option<Visibility>,
}

/// Mudança da recorrente: vale para a ocorrência aberta e as seguintes, e as cópias
/// liquidadas não mudam (RN-08).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateRecurringTransactionRequest {
    pub account_id: Option<Uuid>,
    pub expected_amount: Option<i64>,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub rule: Option<RecurrenceRule>,
}

/// Liquidação da ocorrência aberta; `occurrence_date` tem de ser a dela.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SettleOccurrenceRequest {
    pub occurrence_date: NaiveDate,
    pub settled_amount: i64,
    pub settled_at: NaiveDate,
}

/// Pulo da ocorrência aberta, sem cópia.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SkipOccurrenceRequest {
    pub occurrence_date: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OpenOccurrenceDto {
    pub occurrence_date: NaiveDate,
    pub status: ItemStatusDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecurringTransactionResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub expected_amount: i64,
    #[schema(example = "BRL")]
    pub currency: String,
    pub description: Option<String>,
    pub rule: RecurrenceRule,
    /// Última ocorrência liquidada ou pulada.
    pub last_closed_on: Option<NaiveDate>,
    /// A ocorrência aberta, ou nula quando a recorrente terminou.
    pub open_occurrence: Option<OpenOccurrenceDto>,
}

impl RecurringTransactionResponse {
    /// `now` decide se a aberta está atrasada, no fuso da regra.
    pub fn new(recurring: RecurringTransaction, now: DateTime<Utc>) -> Self {
        let open_occurrence =
            recurring
                .open_status(now)
                .map(|(occurrence_date, status)| OpenOccurrenceDto {
                    occurrence_date,
                    status: status.into(),
                });
        Self {
            id: recurring.id,
            owner_id: recurring.owner_id,
            visibility: recurring.visibility,
            created_at: recurring.created_at,
            updated_at: recurring.updated_at,
            kind: recurring.kind.into(),
            account_id: recurring.account_id,
            category_id: recurring.category_id,
            expected_amount: recurring.expected_amount,
            currency: recurring.currency.to_string(),
            description: recurring.description,
            rule: recurring.rule,
            last_closed_on: recurring.last_closed_on,
            open_occurrence,
        }
    }
}

/// Cópias liquidadas de uma recorrente, da ocorrência mais recente para a mais
/// antiga (DEC-005).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SettledTransactionPage {
    pub items: Vec<TransactionResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecurringTransactionPage {
    pub items: Vec<RecurringTransactionResponse>,
    pub next_cursor: Option<String>,
}

// Faturas ------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StatementResponse {
    #[schema(example = "2026-11")]
    pub period: String,
    pub closing_date: NaiveDate,
    pub due_date: NaiveDate,
    pub total_amount: i64,
    pub outstanding_amount: i64,
    pub transaction_count: usize,
    pub paid: bool,
}

impl From<Statement> for StatementResponse {
    fn from(statement: Statement) -> Self {
        Self {
            period: statement.period.to_string(),
            closing_date: statement.closing_date,
            due_date: statement.due_date,
            total_amount: statement.total_amount,
            outstanding_amount: statement.outstanding_amount,
            transaction_count: statement.transaction_count,
            paid: statement.paid,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StatementList {
    pub items: Vec<StatementResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct PayStatementRequest {
    pub from_account_id: Uuid,
    pub paid_on: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StatementPaymentResponse {
    pub transfer: TransferResponse,
    pub settled_transaction_ids: Vec<Uuid>,
}

impl From<StatementPayment> for StatementPaymentResponse {
    fn from(payment: StatementPayment) -> Self {
        Self {
            transfer: payment.transfer.into(),
            settled_transaction_ids: payment.settled_transaction_ids,
        }
    }
}

// Resumo do período --------------------------------------------------------

/// Período livre (PD-55); sem `from` e `to`, da primeira movimentação até hoje, sem
/// comparação (DEC-004).
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct SummaryQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct PeriodDto {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

impl From<Period> for PeriodDto {
    fn from(period: Period) -> Self {
        Self {
            from: period.from,
            to: period.to,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct FlowDto {
    pub realized: i64,
    pub forecast: i64,
}

impl From<Flow> for FlowDto {
    fn from(flow: Flow) -> Self {
        Self {
            realized: flow.realized,
            forecast: flow.forecast,
        }
    }
}

/// Entradas, saídas e sobra, cada uma com o realizado e o previsto.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct PeriodTotalsDto {
    pub income: FlowDto,
    pub expense: FlowDto,
    pub surplus: FlowDto,
}

impl From<PeriodTotals> for PeriodTotalsDto {
    fn from(totals: PeriodTotals) -> Self {
        Self {
            income: totals.income.into(),
            expense: totals.expense.into(),
            surplus: totals.surplus.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum WhereGroupDto {
    Category,
    Uncategorized,
    Others,
}

impl From<WhereGroup> for WhereGroupDto {
    fn from(group: WhereGroup) -> Self {
        match group {
            WhereGroup::Category => Self::Category,
            WhereGroup::Uncategorized => Self::Uncategorized,
            WhereGroup::Others => Self::Others,
        }
    }
}

/// Barra de "Para onde foi": uma categoria (com nome e cor), "Outras" ou as saídas
/// sem categoria.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WhereItemDto {
    pub category_id: Option<Uuid>,
    pub name: Option<String>,
    pub color: Option<CategoryColorDto>,
    pub group: WhereGroupDto,
    pub amount: i64,
}

impl From<WhereView> for WhereItemDto {
    fn from(view: WhereView) -> Self {
        Self {
            category_id: view.item.category_id,
            name: view.category.as_ref().map(|category| category.name.clone()),
            color: view.category.map(|category| category.color.into()),
            group: view.item.group.into(),
            amount: view.item.amount,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct PlannedDto {
    pub expected_amount: i64,
    pub settled_amount: i64,
}

impl From<Planned> for PlannedDto {
    fn from(planned: Planned) -> Self {
        Self {
            expected_amount: planned.expected_amount,
            settled_amount: planned.settled_amount,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct ExpectedVsSettledDto {
    pub income: PlannedDto,
    pub expense: PlannedDto,
}

impl From<ExpectedVsSettled> for ExpectedVsSettledDto {
    fn from(value: ExpectedVsSettled) -> Self {
        Self {
            income: value.income.into(),
            expense: value.expense.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub struct SavingsAndLossesDto {
    pub savings_amount: i64,
    pub gains_amount: i64,
    pub losses_amount: i64,
}

impl From<SavingsAndLosses> for SavingsAndLossesDto {
    fn from(value: SavingsAndLosses) -> Self {
        Self {
            savings_amount: value.savings_amount,
            gains_amount: value.gains_amount,
            losses_amount: value.losses_amount,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AccountBalanceDto {
    pub id: Uuid,
    pub name: String,
    pub kind: AccountKindDto,
    pub balance_amount: i64,
}

/// Saldo de agora, fora do período: o atual soma todas as contas, a lista traz só as
/// comuns, e o previsto no fim do período é nulo quando ele já terminou.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BalanceDto {
    pub current: i64,
    pub forecast_at_period_end: Option<i64>,
    pub accounts: Vec<AccountBalanceDto>,
}

/// Fatura aberta e limite usado de um cartão, fora do período.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreditCardSummaryDto {
    pub account_id: Uuid,
    pub name: String,
    #[schema(example = "2026-11")]
    pub statement_period: String,
    pub open_statement_amount: i64,
    pub due_date: NaiveDate,
    pub credit_limit_amount: i64,
    pub used_limit_amount: i64,
}

impl From<CardView> for CreditCardSummaryDto {
    fn from(view: CardView) -> Self {
        Self {
            account_id: view.account.id,
            name: view.account.name,
            statement_period: view.statement_period.to_string(),
            open_statement_amount: view.usage.open_statement_amount,
            due_date: view.due_date,
            credit_limit_amount: view.credit_limit_amount,
            used_limit_amount: view.usage.used_limit_amount,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FinancialSummaryResponse {
    pub period: PeriodDto,
    pub previous_period: Option<PeriodDto>,
    pub totals: PeriodTotalsDto,
    pub previous_totals: Option<PeriodTotalsDto>,
    pub where_it_went: Vec<WhereItemDto>,
    pub expected_vs_settled: ExpectedVsSettledDto,
    pub savings_and_losses: SavingsAndLossesDto,
    pub balance: BalanceDto,
    pub credit_cards: Vec<CreditCardSummaryDto>,
    /// Saídas não liquidadas dos próximos 30 dias, inclusive as atrasadas.
    pub upcoming_bills: Vec<TransactionItemResponse>,
    #[schema(example = "BRL")]
    pub currency: String,
}

impl From<PeriodSummaryView> for FinancialSummaryResponse {
    fn from(view: PeriodSummaryView) -> Self {
        let today = view.today;
        Self {
            period: view.period.into(),
            previous_period: view.previous_period.map(Into::into),
            totals: view.totals.into(),
            previous_totals: view.previous_totals.map(Into::into),
            where_it_went: view.where_it_went.into_iter().map(Into::into).collect(),
            expected_vs_settled: view.expected_vs_settled.into(),
            savings_and_losses: view.savings_and_losses.into(),
            balance: BalanceDto {
                current: view.current_balance,
                forecast_at_period_end: view.forecast_at_period_end,
                accounts: view
                    .accounts
                    .into_iter()
                    .map(|account| AccountBalanceDto {
                        id: account.id,
                        name: account.name,
                        kind: account.kind.into(),
                        balance_amount: account.balance_amount,
                    })
                    .collect(),
            },
            credit_cards: view.credit_cards.into_iter().map(Into::into).collect(),
            upcoming_bills: view
                .upcoming_bills
                .into_iter()
                .map(|item| TransactionItemResponse::new(item, today))
                .collect(),
            currency: view.currency.to_string(),
        }
    }
}
