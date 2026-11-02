//! Corpos de requisição e resposta do Financeiro, em `snake_case`
//! ([project/naming-convention-06]), com os esquemas do OpenAPI.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::finance::application::payroll_loans::PayrollLoanView;
use crate::finance::application::ports::Repetition;
use crate::finance::application::summaries::{PeriodSummaryView, WhereView};
use crate::finance::domain::account::Account;
use crate::finance::domain::adjustment::{
    Adjustment, AdjustmentDirection, AdjustmentMode, Breakdown, ComputedAdjustment,
};
use crate::finance::domain::category::{Category, SystemCategory};
use crate::finance::domain::forecast::FinanceItem;
use crate::finance::domain::payroll_loan::{IncomeLink, LoanTerm, PayrollLoanStatus};
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::settlement::{DifferenceKind, Settlement};
use crate::finance::domain::summary::{
    AdjustmentTotal, ExpectedVsSettled, Flow, MonthTotals, Period, PeriodTotals, Planned,
    SavingsAndLosses, WhereGroup,
};
use crate::finance::domain::transaction::{ItemStatus, Transaction, TransactionKind};
use crate::finance::domain::transfer::Transfer;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

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
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateAccountRequest {
    pub name: Option<String>,
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
    pub is_default: bool,
    pub balance_amount: i64,
    #[schema(example = "BRL")]
    pub currency: String,
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
            is_default: account.is_default,
            balance_amount: account.balance_amount,
            currency: account.currency.to_string(),
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
    /// HEX `#rrggbb`; guardado em minúsculas (RN-09).
    #[schema(example = "#6d28d9")]
    pub color: String,
    pub visibility: Option<Visibility>,
}

/// O tipo da categoria não muda depois da criação.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    /// HEX `#rrggbb`; guardado em minúsculas (RN-09).
    #[schema(example = "#6d28d9")]
    pub color: Option<String>,
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

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct DeleteAccountQuery {
    /// Outra conta ativa da mesma pessoa e da mesma moeda que recebe as movimentações, as
    /// transferências, as recorrências e o saldo; obrigatória quando a conta tem
    /// movimentações (RF-05, RF-06, RN-04).
    pub move_to: Option<Uuid>,
}

/// Chave estável de uma categoria padrão (RF-11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SystemCategoryKey {
    Salary,
    Freelance,
    Housing,
    Groceries,
    Transport,
    Leisure,
    Health,
    Loan,
}

impl From<SystemCategory> for SystemCategoryKey {
    fn from(category: SystemCategory) -> Self {
        match category {
            SystemCategory::Salary => Self::Salary,
            SystemCategory::Freelance => Self::Freelance,
            SystemCategory::Housing => Self::Housing,
            SystemCategory::Groceries => Self::Groceries,
            SystemCategory::Transport => Self::Transport,
            SystemCategory::Leisure => Self::Leisure,
            SystemCategory::Health => Self::Health,
            SystemCategory::Loan => Self::Loan,
        }
    }
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
    /// HEX `#rrggbb`.
    #[schema(example = "#6d28d9")]
    pub color: String,
    /// Chave da categoria padrão (RF-11): a tela traduz o nome por ela; nula nas criadas pela pessoa e nas padrão renomeadas.
    pub system_key: Option<SystemCategoryKey>,
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
            color: category.color.as_str().to_owned(),
            system_key: category.system_key.map(Into::into),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CategoryPage {
    pub items: Vec<CategoryResponse>,
    pub next_cursor: Option<String>,
}

// Movimentações ------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdjustmentDirectionDto {
    Deduction,
    Addition,
}

impl From<AdjustmentDirectionDto> for AdjustmentDirection {
    fn from(value: AdjustmentDirectionDto) -> Self {
        match value {
            AdjustmentDirectionDto::Deduction => Self::Deduction,
            AdjustmentDirectionDto::Addition => Self::Addition,
        }
    }
}

impl From<AdjustmentDirection> for AdjustmentDirectionDto {
    fn from(value: AdjustmentDirection) -> Self {
        match value {
            AdjustmentDirection::Deduction => Self::Deduction,
            AdjustmentDirection::Addition => Self::Addition,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum AdjustmentModeDto {
    Fixed,
    Percent,
}

impl From<AdjustmentModeDto> for AdjustmentMode {
    fn from(value: AdjustmentModeDto) -> Self {
        match value {
            AdjustmentModeDto::Fixed => Self::Fixed,
            AdjustmentModeDto::Percent => Self::Percent,
        }
    }
}

impl From<AdjustmentMode> for AdjustmentModeDto {
    fn from(value: AdjustmentMode) -> Self {
        match value {
            AdjustmentMode::Fixed => Self::Fixed,
            AdjustmentMode::Percent => Self::Percent,
        }
    }
}

/// Item de ajuste: desconto ou acréscimo nominal, fixo ou percentual (RF-01 a RF-06), com a base
/// ligada e a parcela (SPEC-005).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct AdjustmentDto {
    /// Nome do item, de 1 a 60 caracteres.
    #[schema(example = "INSS")]
    pub name: String,
    /// Desconto (`deduction`) ou acréscimo (`addition`).
    pub direction: AdjustmentDirectionDto,
    /// Valor fixo (`fixed`) ou percentual (`percent`).
    pub mode: AdjustmentModeDto,
    /// Só no fixo: valor em centavos, maior que zero.
    pub amount: Option<i64>,
    /// Só no percentual: centésimos de ponto percentual, de 1 a 9999 (1100 = 11,00%).
    pub rate_bp: Option<i32>,
    /// Só no percentual, opcional: base digitada em centavos; ausente, a base é o bruto.
    pub base_amount: Option<i64>,
    /// Só no percentual, opcional: posições, a partir de 0, dos itens da mesma lista que formam a
    /// base ligada (o bruto menos os descontos e mais os acréscimos ligados); não vem com
    /// `base_amount`.
    pub base_items: Option<Vec<usize>>,
    /// Só no percentual, opcional: parcela a deduzir em centavos, maior que zero, já descontada
    /// de `computed_amount`; não muda na liquidação.
    pub deduction_amount: Option<i64>,
    /// Valor calculado em centavos; preenchido na resposta e ignorado no pedido.
    pub computed_amount: Option<i64>,
}

impl From<AdjustmentDto> for Adjustment {
    fn from(value: AdjustmentDto) -> Self {
        Self {
            name: value.name,
            direction: value.direction.into(),
            mode: value.mode.into(),
            amount: value.amount,
            rate_bp: value.rate_bp,
            base_amount: value.base_amount,
            base_items: value.base_items.unwrap_or_default(),
            deduction_amount: value.deduction_amount,
        }
    }
}

impl From<ComputedAdjustment> for AdjustmentDto {
    fn from(value: ComputedAdjustment) -> Self {
        let item = value.adjustment;
        Self {
            name: item.name,
            direction: item.direction.into(),
            mode: item.mode.into(),
            amount: item.amount,
            rate_bp: item.rate_bp,
            base_amount: item.base_amount,
            base_items: (!item.base_items.is_empty()).then_some(item.base_items),
            deduction_amount: item.deduction_amount,
            computed_amount: Some(value.computed_amount),
        }
    }
}

fn adjustment_dtos(items: Vec<ComputedAdjustment>) -> Vec<AdjustmentDto> {
    items.into_iter().map(Into::into).collect()
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTransactionRequest {
    pub kind: TransactionKindDto,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    /// Líquido sem itens, como antes; com itens, informe `gross_amount` (RN-09).
    pub expected_amount: Option<i64>,
    /// Bruto previsto em centavos; o líquido é calculado com os itens.
    pub gross_amount: Option<i64>,
    /// De 0 a 20 itens, na ordem.
    #[serde(default)]
    pub adjustments: Vec<AdjustmentDto>,
    pub expected_date: NaiveDate,
    pub visibility: Option<Visibility>,
}

/// Edição (DEC-005): a liquidada só aceita `description`, `category_id` e
/// `visibility`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateTransactionRequest {
    pub description: Option<String>,
    pub expected_amount: Option<i64>,
    pub expected_date: Option<NaiveDate>,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
    /// Bruto previsto; recalcula o líquido com os itens.
    pub gross_amount: Option<i64>,
    /// Itens previstos, que substituem os atuais; recalcula o líquido.
    pub adjustments: Option<Vec<AdjustmentDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SettleTransactionRequest {
    /// Líquido liquidado, o valor que entra no caixa.
    #[serde(default)]
    pub settled_amount: Option<i64>,
    /// O valor que caiu na conta, quando a entrada tem parcelas de consignado no período;
    /// exclusivo com `settled_amount` (SPEC-006, RF-08).
    #[serde(default)]
    pub account_amount: Option<i64>,
    pub settled_at: NaiveDate,
    /// Itens editados na liquidação; ausentes, os previstos (RF-10).
    pub adjustments: Option<Vec<AdjustmentDto>>,
}

/// Prévia da liquidação pelo líquido, sem gravar (RF-09, decisão 13).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SettlementPreviewRequest {
    /// Líquido informado, em centavos.
    pub settled_amount: i64,
    /// Itens da liquidação, na ordem.
    #[serde(default)]
    pub adjustments: Vec<AdjustmentDto>,
    /// Bruto previsto, para escalar a base digitada na proporção do bruto (RN-06).
    pub expected_gross_amount: i64,
}

/// Bruto, líquido e itens calculados.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BreakdownDto {
    pub gross_amount: i64,
    pub net_amount: i64,
    pub adjustments: Vec<AdjustmentDto>,
}

impl From<Breakdown> for BreakdownDto {
    fn from(value: Breakdown) -> Self {
        Self {
            gross_amount: value.gross_amount,
            net_amount: value.net_amount,
            adjustments: adjustment_dtos(value.items),
        }
    }
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
    /// Líquido previsto, o valor que afeta o saldo.
    pub expected_amount: i64,
    /// Bruto previsto; igual ao líquido sem itens.
    pub gross_amount: i64,
    /// Itens previstos, na ordem, com o valor calculado.
    pub adjustments: Vec<AdjustmentDto>,
    pub expected_date: NaiveDate,
    pub settled_amount: Option<i64>,
    pub settled_at: Option<NaiveDate>,
    pub difference_amount: Option<i64>,
    pub difference_kind: Option<DifferenceKindDto>,
    /// Bruto liquidado; nulo enquanto prevista.
    pub settled_gross_amount: Option<i64>,
    /// Itens da liquidação; nulos enquanto prevista.
    pub settled_adjustments: Option<Vec<AdjustmentDto>>,
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
    /// Só na saída de uma parcela de consignado: o consignado, a entrada de origem e o número
    /// (RF-13).
    pub payroll_loan_id: Option<Uuid>,
    pub income_transaction_id: Option<Uuid>,
    pub installment_number: Option<i16>,
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
            gross_amount: item.gross_amount,
            adjustments: adjustment_dtos(item.adjustments),
            expected_date: item.expected_date,
            settled_amount: settlement.map(|done| done.settled_amount),
            settled_at: settlement.map(|done| done.settled_at),
            difference_amount: settlement.map(|done| done.difference_amount),
            difference_kind: difference_kind(settlement),
            settled_gross_amount: settlement.map(|done| done.gross_amount),
            settled_adjustments: settlement.map(|_| adjustment_dtos(item.settled_adjustments)),
            currency: item.currency.to_string(),
            status,
            effective_date,
            recurrence_id: None,
            generated_from: item.generated_from,
            occurrence_date: item.occurrence_date,
            payroll_loan_id: item.payroll.map(|link| link.loan_id),
            income_transaction_id: item.payroll.map(|link| link.income_transaction_id),
            installment_number: item.payroll.and_then(|link| link.number),
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
    /// Líquido previsto, o valor que afeta o saldo.
    pub expected_amount: i64,
    /// Bruto previsto; igual ao líquido sem itens.
    pub gross_amount: i64,
    /// Itens previstos, na ordem, com o valor calculado.
    pub adjustments: Vec<AdjustmentDto>,
    pub expected_date: NaiveDate,
    pub settled_amount: Option<i64>,
    pub settled_at: Option<NaiveDate>,
    pub difference_amount: Option<i64>,
    pub difference_kind: Option<DifferenceKindDto>,
    /// Bruto liquidado; nulo enquanto prevista.
    pub settled_gross_amount: Option<i64>,
    /// Itens da liquidação; nulos enquanto prevista.
    pub settled_adjustments: Option<Vec<AdjustmentDto>>,
    #[schema(example = "BRL")]
    pub currency: String,
    pub status: ItemStatusDto,
    pub effective_date: NaiveDate,
    pub recurrence_id: Option<Uuid>,
    pub generated_from: Option<Uuid>,
    pub occurrence_date: Option<NaiveDate>,
    /// Só na saída de uma parcela de consignado: o consignado, a entrada de origem e o número
    /// (RF-13).
    pub payroll_loan_id: Option<Uuid>,
    pub income_transaction_id: Option<Uuid>,
    pub installment_number: Option<i16>,
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
                gross_amount: projected.gross_amount,
                adjustments: adjustment_dtos(projected.adjustments),
                expected_date: projected.occurrence_date,
                settled_amount: None,
                settled_at: None,
                difference_amount: None,
                difference_kind: None,
                settled_gross_amount: None,
                settled_adjustments: None,
                currency: projected.currency.to_string(),
                status: projected.status.into(),
                effective_date: projected.occurrence_date,
                recurrence_id: Some(projected.recurrence_id),
                generated_from: None,
                occurrence_date: Some(projected.occurrence_date),
                payroll_loan_id: None,
                income_transaction_id: None,
                installment_number: None,
            },
            FinanceItem::Installment(installment) => Self {
                id: None,
                owner_id: installment.owner_id,
                visibility: installment.visibility,
                created_at: None,
                updated_at: None,
                kind: TransactionKind::Expense.into(),
                account_id: installment.account_id,
                category_id: Some(installment.category_id),
                description: Some(installment.description),
                expected_amount: installment.amount,
                gross_amount: installment.amount,
                adjustments: Vec::new(),
                expected_date: installment.date,
                settled_amount: None,
                settled_at: None,
                difference_amount: None,
                difference_kind: None,
                settled_gross_amount: None,
                settled_adjustments: None,
                currency: installment.currency.to_string(),
                status: installment.status.into(),
                effective_date: installment.date,
                recurrence_id: installment.recurrence_id,
                generated_from: None,
                occurrence_date: installment.recurrence_id.map(|_| installment.date),
                payroll_loan_id: Some(installment.loan_id),
                income_transaction_id: installment.income_transaction_id,
                installment_number: installment.number,
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
            gross_amount: item.gross_amount,
            adjustments: item.adjustments,
            expected_date: item.expected_date,
            settled_amount: item.settled_amount,
            settled_at: item.settled_at,
            difference_amount: item.difference_amount,
            difference_kind: item.difference_kind,
            settled_gross_amount: item.settled_gross_amount,
            settled_adjustments: item.settled_adjustments,
            currency: item.currency,
            status: item.status,
            effective_date: item.effective_date,
            recurrence_id: item.recurrence_id,
            generated_from: item.generated_from,
            occurrence_date: item.occurrence_date,
            payroll_loan_id: item.payroll_loan_id,
            income_transaction_id: item.income_transaction_id,
            installment_number: item.installment_number,
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
    /// Líquido sem itens, como antes; com itens, informe `gross_amount` (RN-09).
    pub expected_amount: Option<i64>,
    /// Bruto previsto de cada ocorrência; o líquido é calculado com os itens.
    pub gross_amount: Option<i64>,
    /// De 0 a 20 itens, na ordem.
    #[serde(default)]
    pub adjustments: Vec<AdjustmentDto>,
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
    /// Bruto previsto; vale para a aberta e as seguintes (RN-10).
    pub gross_amount: Option<i64>,
    /// Itens previstos, que substituem os atuais; valem para a aberta e as seguintes (RN-10).
    pub adjustments: Option<Vec<AdjustmentDto>>,
}

/// Liquidação da ocorrência aberta; `occurrence_date` tem de ser a dela.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SettleOccurrenceRequest {
    pub occurrence_date: NaiveDate,
    #[serde(default)]
    pub settled_amount: Option<i64>,
    /// O valor que caiu na conta, quando a entrada tem parcelas de consignado no período;
    /// exclusivo com `settled_amount` (SPEC-006, RF-08).
    #[serde(default)]
    pub account_amount: Option<i64>,
    pub settled_at: NaiveDate,
    /// Itens editados na liquidação; a regra não muda (RF-10).
    pub adjustments: Option<Vec<AdjustmentDto>>,
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
    /// Líquido previsto de cada ocorrência.
    pub expected_amount: i64,
    /// Bruto previsto; igual ao líquido sem itens.
    pub gross_amount: i64,
    /// Itens previstos da regra, na ordem, com o valor calculado.
    pub adjustments: Vec<AdjustmentDto>,
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
            gross_amount: recurring.gross_amount,
            adjustments: adjustment_dtos(recurring.adjustments),
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
    /// HEX `#rrggbb`.
    pub color: Option<String>,
    pub group: WhereGroupDto,
    pub amount: i64,
}

impl From<WhereView> for WhereItemDto {
    fn from(view: WhereView) -> Self {
        Self {
            category_id: view.item.category_id,
            name: view.category.as_ref().map(|category| category.name.clone()),
            color: view
                .category
                .map(|category| category.color.as_str().to_owned()),
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
    pub balance_amount: i64,
}

/// Saldo de agora, fora do período: o atual soma todas as contas, a lista traz todas,
/// e o previsto no fim do período é nulo quando ele já terminou.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BalanceDto {
    pub current: i64,
    pub forecast_at_period_end: Option<i64>,
    pub accounts: Vec<AccountBalanceDto>,
}

/// Um mês do "Mês a mês": entradas, saídas e saldo ao fim do mês, em centavos; `projected`
/// nos meses calculados pelas recorrentes e pendentes, sem linhas gravadas (RF-17, RN-08).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MonthlyTotalsDto {
    #[schema(example = "2026-11")]
    pub month: String,
    pub income: i64,
    pub expense: i64,
    pub balance: i64,
    pub projected: bool,
}

impl From<MonthTotals> for MonthlyTotalsDto {
    fn from(value: MonthTotals) -> Self {
        Self {
            month: value.month.format("%Y-%m").to_string(),
            income: value.income,
            expense: value.expense,
            balance: value.balance,
            projected: value.projected,
        }
    }
}

/// Um nome do cartão "Descontos do período", em centavos: `expected` com as liquidadas pelos valores da liquidação e as previstas pelos previstos, `settled` só as liquidadas (RF-14, RN-11).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AdjustmentTotalDto {
    #[schema(example = "INSS")]
    pub name: String,
    pub direction: AdjustmentDirectionDto,
    pub expected: i64,
    pub settled: i64,
}

impl From<AdjustmentTotal> for AdjustmentTotalDto {
    fn from(value: AdjustmentTotal) -> Self {
        Self {
            name: value.name,
            direction: value.direction.into(),
            expected: value.expected,
            settled: value.settled,
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
    /// Entradas e saídas não liquidadas dos próximos 30 dias, inclusive as atrasadas, com as ocorrências abertas das recorrentes (RF-15).
    pub upcoming_bills: Vec<TransactionItemResponse>,
    /// 6 meses realizados e 6 projetados, em ordem (RF-17).
    pub monthly: Vec<MonthlyTotalsDto>,
    /// Descontos e acréscimos do período por nome, sem diferenciar maiúsculas e acentos; descontos primeiro (RF-14).
    pub adjustments_by_name: Vec<AdjustmentTotalDto>,
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
                        balance_amount: account.balance_amount,
                    })
                    .collect(),
            },
            upcoming_bills: view
                .upcoming_bills
                .into_iter()
                .map(|item| TransactionItemResponse::new(item, today))
                .collect(),
            monthly: view.monthly.into_iter().map(Into::into).collect(),
            adjustments_by_name: view
                .adjustments_by_name
                .into_iter()
                .map(Into::into)
                .collect(),
            currency: view.currency.to_string(),
        }
    }
}

// Consignados ---------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PayrollLoanStatusDto {
    Active,
    Ended,
}

impl From<PayrollLoanStatus> for PayrollLoanStatusDto {
    fn from(value: PayrollLoanStatus) -> Self {
        match value {
            PayrollLoanStatus::Active => Self::Active,
            PayrollLoanStatus::Ended => Self::Ended,
        }
    }
}

/// Cadastro do consignado: uma entrada (avulsa ou recorrente) e um modo de prazo, o total
/// com a parcela atual ou a data final (RF-02 a RF-04).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreatePayrollLoanRequest {
    pub income_id: Option<Uuid>,
    pub income_recurrence_id: Option<Uuid>,
    pub name: String,
    pub contract_number: Option<String>,
    pub installment_amount: i64,
    pub total_installments: Option<i16>,
    pub current_installment: Option<i16>,
    pub ends_on: Option<NaiveDate>,
}

/// Campos ausentes ficam como estão; mudar o prazo regrava o início na entrada aberta.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdatePayrollLoanRequest {
    pub name: Option<String>,
    /// Vazio apaga o contrato.
    pub contract_number: Option<String>,
    pub installment_amount: Option<i64>,
    pub total_installments: Option<i16>,
    pub current_installment: Option<i16>,
    pub ends_on: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PayrollLoanResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub income_id: Option<Uuid>,
    pub income_recurrence_id: Option<Uuid>,
    /// A categoria do sistema "Empréstimo" da pessoa (RF-05).
    pub category_id: Uuid,
    pub name: String,
    pub contract_number: Option<String>,
    pub installment_amount: i64,
    #[schema(example = "BRL")]
    pub currency: String,
    pub total_installments: Option<i16>,
    /// No prazo por parcelas, o número da parcela da entrada aberta; nulo no prazo por data
    /// e depois do fim.
    pub current_installment: Option<i16>,
    pub ends_on: Option<NaiveDate>,
    /// Data da parcela de onde a numeração parte.
    pub starts_on: NaiveDate,
    /// Calculado: ativo enquanto a entrada aberta tem parcela (RF-10).
    pub status: PayrollLoanStatusDto,
    /// Calculado: a data da entrada aberta, enquanto ativo.
    pub next_installment_on: Option<NaiveDate>,
    /// Calculado: a data da última parcela, pela regra atual da entrada.
    pub last_installment_on: Option<NaiveDate>,
    /// Calculado: as parcelas da aberta em diante.
    pub remaining_installments: u32,
}

impl From<PayrollLoanView> for PayrollLoanResponse {
    fn from(view: PayrollLoanView) -> Self {
        let loan = view.loan;
        let (income_id, income_recurrence_id) = match loan.income {
            IncomeLink::Transaction(id) => (Some(id), None),
            IncomeLink::Recurrence(id) => (None, Some(id)),
        };
        let (total_installments, ends_on) = match loan.term {
            LoanTerm::Installments { total, .. } => (Some(total), None),
            LoanTerm::EndsOn(ends_on) => (None, Some(ends_on)),
        };
        Self {
            id: loan.id,
            owner_id: loan.owner_id,
            visibility: loan.visibility,
            created_at: loan.created_at,
            updated_at: loan.updated_at,
            income_id,
            income_recurrence_id,
            category_id: loan.category_id,
            name: loan.name,
            contract_number: loan.contract_number,
            installment_amount: loan.installment_amount,
            currency: loan.currency.to_string(),
            total_installments,
            current_installment: view.current_installment,
            ends_on,
            starts_on: loan.starts_on,
            status: view.status.into(),
            next_installment_on: view.next_installment_on,
            last_installment_on: view.last_installment_on,
            remaining_installments: u32::try_from(view.remaining_installments).unwrap_or(u32::MAX),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PayrollLoanPage {
    pub items: Vec<PayrollLoanResponse>,
    pub next_cursor: Option<String>,
}

/// Consignados de uma entrada avulsa ou de uma recorrente.
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct PayrollLoanQuery {
    pub income_id: Option<Uuid>,
    pub income_recurrence_id: Option<Uuid>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}
