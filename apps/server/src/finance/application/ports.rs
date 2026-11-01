//! Portas do Financeiro: os repositórios e o registro de idempotência que a
//! infraestrutura implementa. Cada operação que muda saldo acontece inteira numa
//! única transação do banco ([project/database-03]), por isso os métodos são
//! operações completas, e não leituras e escritas soltas.

use std::future::Future;

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::FinanceError;
use crate::finance::domain::account::Account;
use crate::finance::domain::category::Category;
use crate::finance::domain::credit_card::StatementPeriod;
use crate::finance::domain::recurring_transaction::{OccurrenceSettlement, RecurringTransaction};
use crate::finance::domain::transaction::{Transaction, TransactionEdit, TransactionKind};
use crate::finance::domain::transfer::Transfer;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type,
/// entity_id)`, para o contexto `links` remover as ligações dos dois lados (CB-06).
///
/// A grafia tem de ser idêntica à do alias declarado na TASK-15 (`links`): a
/// `Extension` do axum procura o valor pelo `TypeId`, e só um tipo idêntico encontra
/// o gancho que a TASK-18 instala.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

pub type Outcome<T> = Result<T, FinanceError>;

pub trait AccountRepository: Send + Sync {
    /// Cria a "Conta principal" do dono se ela ainda não existir (idempotente).
    fn ensure_default(
        &self,
        owner_id: Uuid,
        candidate: &Account,
    ) -> impl Future<Output = Outcome<()>> + Send;
    fn list(
        &self,
        owner_id: Uuid,
        after: Option<Uuid>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<Account>>> + Send;
    fn get(&self, owner_id: Uuid, id: Uuid) -> impl Future<Output = Outcome<Account>> + Send;
    fn insert(&self, account: &Account) -> impl Future<Output = Outcome<()>> + Send;
    fn update(&self, account: &Account) -> impl Future<Output = Outcome<()>> + Send;
    /// Exclusão lógica; recusa a conta padrão e a conta com movimentações.
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<()>> + Send;
}

pub trait CategoryRepository: Send + Sync {
    fn list(
        &self,
        owner_id: Uuid,
        kind: Option<TransactionKind>,
        after: Option<Uuid>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<Category>>> + Send;
    fn get(&self, owner_id: Uuid, id: Uuid) -> impl Future<Output = Outcome<Category>> + Send;
    fn insert(&self, category: &Category) -> impl Future<Output = Outcome<()>> + Send;
    fn update(&self, category: &Category) -> impl Future<Output = Outcome<()>> + Send;
    /// Conta também as excluídas: quem excluiu as categorias padrão não as recebe de
    /// novo (RN-01).
    fn count_all_including_deleted(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Outcome<i64>> + Send;
    /// Grava todas numa só transação e ignora as que já existem.
    fn insert_defaults(
        &self,
        owner_id: Uuid,
        categories: &[Category],
    ) -> impl Future<Output = Outcome<()>> + Send;
    /// Exclusão lógica; uma categoria em uso passa as movimentações e as
    /// recorrências para a categoria de destino, do mesmo tipo (CB-15, PD-49).
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        replacement_id: Option<Uuid>,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<()>> + Send;
}

/// Filtro de repetição (PD-52): as cópias liquidadas são pontuais, "sem
/// recorrência", e as recorrentes são a aberta e as previsões delas.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Repetition {
    #[default]
    All,
    Recurring,
    OneOff,
}

/// Filtros da listagem de movimentações; o período vale para a data efetiva, a da
/// liquidação ou a prevista (PD-55), e os limites são opcionais (DEC-004).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransactionFilter {
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub kind: Option<TransactionKind>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub settled: Option<bool>,
    pub repetition: Repetition,
    /// Busca na descrição, já aparada, sem diferenciar maiúsculas e acentos.
    pub q: Option<String>,
}

/// Intervalo de datas com limites opcionais.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DateRange {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

/// Filtros da listagem de transferências: período por `transferred_on` e busca.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransferFilter {
    pub range: DateRange,
    pub q: Option<String>,
}

/// Resultado de desfazer a liquidação: a comum volta a ficar prevista; a cópia de
/// uma recorrente é apagada (DEC-005).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UndoneSettlement {
    Reopened(Transaction),
    CopyDeleted(Uuid),
}

/// Pedido de liquidação.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettlementRequest {
    pub settled_amount: i64,
    pub settled_at: NaiveDate,
}

/// Resultado do pagamento da fatura: a transferência e as movimentações liquidadas.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatementPayment {
    pub transfer: Transfer,
    pub settled_transaction_ids: Vec<Uuid>,
}

pub trait TransactionRepository: Send + Sync {
    fn insert_many(&self, items: &[Transaction]) -> impl Future<Output = Outcome<()>> + Send;
    fn get(&self, owner_id: Uuid, id: Uuid) -> impl Future<Output = Outcome<Transaction>> + Send;
    /// Gravadas do filtro, pela data efetiva e pelo id, depois de `after`.
    fn list(
        &self,
        owner_id: Uuid,
        filter: &TransactionFilter,
        after: Option<(NaiveDate, Uuid)>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<Transaction>>> + Send;
    /// Liquida e atualiza o saldo da conta na mesma transação (RN-01).
    fn settle(
        &self,
        owner_id: Uuid,
        id: Uuid,
        request: SettlementRequest,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<Transaction>> + Send;
    /// Edita numa transação, com a movimentação e a conta travadas, sem mexer no
    /// saldo (DEC-005).
    fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        edit: &TransactionEdit,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<Transaction>> + Send;
    /// Desfaz a liquidação numa transação, revertendo o saldo; recusa a de uma fatura
    /// já paga (DEC-005).
    fn undo_settlement(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<UndoneSettlement>> + Send;
    /// Exclusão lógica; uma movimentação liquidada devolve o efeito no saldo. A cópia
    /// do último fechamento de uma recorrente reabre aquela ocorrência (DEC-004).
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<()>> + Send;
    /// Movimentações do cartão com período de fatura, para montar as faturas.
    fn statement_items(
        &self,
        owner_id: Uuid,
        card_id: Uuid,
    ) -> impl Future<Output = Outcome<Vec<Transaction>>> + Send;
    /// Períodos de fatura do cartão já pagos por transferência.
    fn paid_periods(
        &self,
        owner_id: Uuid,
        card_id: Uuid,
    ) -> impl Future<Output = Outcome<Vec<StatementPeriod>>> + Send;
    /// Paga a fatura (RN-06): cria a transferência para o cartão e liquida pelo
    /// valor previsto as movimentações não liquidadas do período, numa transação.
    /// A transferência chega sem valor; o valor sai das movimentações em aberto.
    fn pay_statement(
        &self,
        draft: Transfer,
        period: StatementPeriod,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<StatementPayment>> + Send;
}

pub trait TransferRepository: Send + Sync {
    /// Grava a transferência e muda os dois saldos na mesma transação.
    fn insert(&self, transfer: &Transfer) -> impl Future<Output = Outcome<()>> + Send;
    fn get(&self, owner_id: Uuid, id: Uuid) -> impl Future<Output = Outcome<Transfer>> + Send;
    fn list(
        &self,
        owner_id: Uuid,
        filter: &TransferFilter,
        after: Option<Uuid>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<Transfer>>> + Send;
    /// Transferências do dono no intervalo, para o resumo do período.
    fn between(
        &self,
        owner_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> impl Future<Output = Outcome<Vec<Transfer>>> + Send;
    /// Exclusão lógica com a reversão dos dois saldos.
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<()>> + Send;
}

pub trait RecurringTransactionRepository: Send + Sync {
    fn insert(&self, recurring: &RecurringTransaction) -> impl Future<Output = Outcome<()>> + Send;
    fn get(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Outcome<RecurringTransaction>> + Send;
    /// Recorrentes do dono, com a busca opcional na descrição.
    fn list(
        &self,
        owner_id: Uuid,
        q: Option<&str>,
        after: Option<Uuid>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<RecurringTransaction>>> + Send;
    /// Cópias liquidadas da recorrente, da ocorrência mais recente para a mais antiga,
    /// depois de `after` (DEC-005).
    fn settled_copies(
        &self,
        owner_id: Uuid,
        id: Uuid,
        after: Option<(NaiveDate, Uuid)>,
        limit: u32,
    ) -> impl Future<Output = Outcome<Vec<Transaction>>> + Send;
    /// Grava o modelo e a regra; vale para a aberta e as seguintes (RN-08).
    fn update(&self, recurring: &RecurringTransaction) -> impl Future<Output = Outcome<()>> + Send;
    /// Liquida a aberta numa transação: trava a recorrente, confere a data, grava a
    /// cópia `copy_id`, muda o saldo e avança `last_closed_on`.
    fn settle_occurrence(
        &self,
        owner_id: Uuid,
        id: Uuid,
        request: OccurrenceSettlement,
        copy_id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<Transaction>> + Send;
    /// Pula a aberta numa transação, sem cópia.
    fn skip_occurrence(
        &self,
        owner_id: Uuid,
        id: Uuid,
        occurrence_date: NaiveDate,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<RecurringTransaction>> + Send;
}

/// Resposta gravada para uma `Idempotency-Key`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredResponse {
    pub request_hash: String,
    pub status: u16,
    pub body: serde_json::Value,
}

pub trait IdempotencyStore: Send + Sync {
    fn find(
        &self,
        owner_id: Uuid,
        key: &str,
    ) -> impl Future<Output = Outcome<Option<StoredResponse>>> + Send;
    fn save(
        &self,
        owner_id: Uuid,
        key: &str,
        response: &StoredResponse,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Outcome<()>> + Send;
}
