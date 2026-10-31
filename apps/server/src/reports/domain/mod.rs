//! Domínio dos relatórios: catálogo, período ("Qualquer período"), filtros e os
//! cálculos puros dos nove relatórios (RF-61, RN-02, RN-03, RN-05, RN-14, RN-15).
//!
//! Nada aqui depende de banco, de HTTP nem de outro contexto: os adaptadores da
//! `infrastructure` entregam listas de itens simples e as funções `build_*` somam.

use std::collections::BTreeMap;

use chrono::{Datelike, NaiveDate};
use serde::Serialize;
use uuid::Uuid;

/// Mensagem do aviso das tarefas recorrentes, que não guardam histórico.
pub const RECURRING_NOTICE: &str =
    "As tarefas recorrentes ficam fora deste relatório porque não guardam histórico.";

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ReportError {
    #[error("report_not_found")]
    NotFound,
    #[error("report_period_invalid")]
    PeriodInvalid,
    /// O campo (nome do parâmetro de consulta) que o relatório não aceita ou que veio inválido.
    #[error("report_filter_invalid")]
    FilterInvalid(&'static str),
    #[error("export_format_invalid")]
    ExportFormatInvalid,
    #[error("falha ao gerar o documento: {0}")]
    Render(String),
    #[error("falha ao ler os dados: {0}")]
    Source(String),
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportFilter {
    Period,
    Account,
    Category,
    Book,
    Type,
    Emotion,
    Goal,
    GoalStatus,
    Project,
}

impl ReportFilter {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Period => "period",
            Self::Account => "account",
            Self::Category => "category",
            Self::Book => "book",
            Self::Type => "type",
            Self::Emotion => "emotion",
            Self::Goal => "goal",
            Self::GoalStatus => "goal_status",
            Self::Project => "project",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Period => "Período",
            Self::Account => "Conta",
            Self::Category => "Categoria",
            Self::Book => "Livro",
            Self::Type => "Tipo",
            Self::Emotion => "Emoção",
            Self::Goal => "Meta",
            Self::GoalStatus => "Status",
            Self::Project => "Projeto",
        }
    }

    /// Parâmetro de consulta do filtro (o período tem dois: `from` e `to`).
    pub fn param(self) -> &'static str {
        match self {
            Self::Period => "from",
            Self::Account => "account_id",
            Self::Category => "category_id",
            Self::Book => "book_id",
            Self::Type => "type",
            Self::Emotion => "emotion_id",
            Self::Goal => "goal_id",
            Self::GoalStatus => "goal_status",
            Self::Project => "project_id",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum ReportKind {
    #[serde(rename = "fin-flow")]
    FinFlow,
    #[serde(rename = "fin-cat")]
    FinCat,
    #[serde(rename = "fin-diff")]
    FinDiff,
    #[serde(rename = "read-pages")]
    ReadPages,
    #[serde(rename = "lib-status")]
    LibStatus,
    #[serde(rename = "journal-emo")]
    JournalEmo,
    #[serde(rename = "goals-progress")]
    GoalsProgress,
    #[serde(rename = "tasks-done")]
    TasksDone,
    #[serde(rename = "proj-cards")]
    ProjCards,
}

/// Módulo que guarda a primeira data registrada de um relatório de período.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataModule {
    Finance,
    Library,
    Journal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ReportCatalogEntry {
    pub id: &'static str,
    pub module: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub filters: &'static [ReportFilter],
}

use ReportFilter as F;

pub const REPORT_CATALOG: [ReportCatalogEntry; 9] = [
    ReportCatalogEntry {
        id: "fin-flow",
        module: "finance",
        title: "Entradas e saídas por mês",
        description: "O que entrou e saiu em cada mês, pelo valor liquidado.",
        filters: &[F::Period, F::Account],
    },
    ReportCatalogEntry {
        id: "fin-cat",
        module: "finance",
        title: "Gastos por categoria",
        description: "Para onde foi o dinheiro, das saídas liquidadas.",
        filters: &[F::Period, F::Account, F::Category],
    },
    ReportCatalogEntry {
        id: "fin-diff",
        module: "finance",
        title: "Economias e perdas",
        description: "Diferença entre o previsto e o liquidado.",
        filters: &[F::Period, F::Account],
    },
    ReportCatalogEntry {
        id: "read-pages",
        module: "library",
        title: "Páginas lidas",
        description: "Páginas lidas por livro, somando as sessões.",
        filters: &[F::Period, F::Book],
    },
    ReportCatalogEntry {
        id: "lib-status",
        module: "library",
        title: "Acervo por status",
        description: "Livros, artigos e vídeos em cada status.",
        filters: &[F::Type],
    },
    ReportCatalogEntry {
        id: "journal-emo",
        module: "journal",
        title: "Emoções no período",
        description: "Entradas escritas, emoções mais frequentes e intensidade média.",
        filters: &[F::Period, F::Emotion],
    },
    ReportCatalogEntry {
        id: "goals-progress",
        module: "goals",
        title: "Progresso das metas",
        description: "Quanto de cada meta já foi feito e quantas há em cada status.",
        filters: &[F::Goal, F::GoalStatus],
    },
    ReportCatalogEntry {
        id: "tasks-done",
        module: "tasks",
        title: "Tarefas concluídas e abertas",
        description: "Tarefas pontuais; as recorrentes não guardam histórico.",
        filters: &[],
    },
    ReportCatalogEntry {
        id: "proj-cards",
        module: "projects",
        title: "Cartões por raia",
        description: "Quantos cartões há em cada raia dos projetos.",
        filters: &[F::Project],
    },
];

/// Nome do módulo em português, para os cabeçalhos.
pub fn module_label(module: &str) -> &'static str {
    match module {
        "finance" => "Financeiro",
        "library" => "Acervo",
        "journal" => "Diário",
        "goals" => "Metas",
        "tasks" => "Tarefas",
        "projects" => "Projetos",
        _ => "Atria",
    }
}

impl ReportKind {
    pub const ALL: [Self; 9] = [
        Self::FinFlow,
        Self::FinCat,
        Self::FinDiff,
        Self::ReadPages,
        Self::LibStatus,
        Self::JournalEmo,
        Self::GoalsProgress,
        Self::TasksDone,
        Self::ProjCards,
    ];

    fn index(self) -> usize {
        Self::ALL.iter().position(|kind| *kind == self).unwrap_or(0)
    }

    pub fn entry(self) -> &'static ReportCatalogEntry {
        &REPORT_CATALOG[self.index()]
    }

    pub fn id(self) -> &'static str {
        self.entry().id
    }

    pub fn parse(text: &str) -> Result<Self, ReportError> {
        Self::ALL
            .into_iter()
            .find(|kind| kind.id() == text)
            .ok_or(ReportError::NotFound)
    }

    pub fn accepts(self, filter: ReportFilter) -> bool {
        self.entry().filters.contains(&filter)
    }

    #[cfg(test)]
    pub fn has_period(self) -> bool {
        self.accepts(ReportFilter::Period)
    }

    /// Módulo da primeira data registrada, só nos relatórios de período.
    pub fn data_module(self) -> Option<DataModule> {
        match self {
            Self::FinFlow | Self::FinCat | Self::FinDiff => Some(DataModule::Finance),
            Self::ReadPages => Some(DataModule::Library),
            Self::JournalEmo => Some(DataModule::Journal),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

/// Período inclusivo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Period {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PeriodRequest {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

impl PeriodRequest {
    /// Verdadeiro quando faltou `from` ou `to` ("Qualquer período").
    pub fn is_open(self) -> bool {
        self.from.is_none() || self.to.is_none()
    }
}

impl Period {
    /// Sem `to`, hoje; sem `from`, a primeira data registrada (ou hoje, sem registro),
    /// nunca depois do fim. Um `from` explícito depois do fim é inválido (DEC-004).
    pub fn resolve(
        request: PeriodRequest,
        first_record: Option<NaiveDate>,
        today: NaiveDate,
    ) -> Result<Self, ReportError> {
        let to = request.to.unwrap_or(today);
        let from = match request.from {
            Some(from) if from > to => return Err(ReportError::PeriodInvalid),
            Some(from) => from,
            None => first_record.unwrap_or(today).min(to),
        };
        Ok(Self { from, to })
    }

    pub fn contains(self, date: NaiveDate) -> bool {
        date >= self.from && date <= self.to
    }
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LibraryItemType {
    Book,
    Article,
    Video,
}

impl LibraryItemType {
    pub const ALL: [Self; 3] = [Self::Book, Self::Article, Self::Video];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Book => "book",
            Self::Article => "article",
            Self::Video => "video",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Book => "Livros",
            Self::Article => "Artigos",
            Self::Video => "Vídeos",
        }
    }

    pub fn parse(text: &str) -> Result<Self, ReportError> {
        Self::ALL
            .into_iter()
            .find(|kind| kind.as_str() == text)
            .ok_or(ReportError::FilterInvalid("type"))
    }

    /// Status do tipo, com a chave estável e o rótulo (PD-35).
    pub fn statuses(self) -> [(&'static str, &'static str); 3] {
        match self {
            Self::Book => [
                ("want_to_read", "Quero ler"),
                ("reading", "Lendo"),
                ("read", "Lido"),
            ],
            Self::Article => [
                ("to_read", "Para ler"),
                ("reading", "Lendo"),
                ("read", "Lido"),
            ],
            Self::Video => [
                ("to_watch", "Para assistir"),
                ("watching", "Assistindo"),
                ("watched", "Assistido"),
            ],
        }
    }
}

/// Status da meta: os quatro do servidor (TASK-08), na ordem de exibição.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalStatus {
    Planned,
    InProgress,
    Completed,
    Abandoned,
}

impl GoalStatus {
    pub const ALL: [Self; 4] = [
        Self::Planned,
        Self::InProgress,
        Self::Completed,
        Self::Abandoned,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Planned => "planned",
            Self::InProgress => "in_progress",
            Self::Completed => "completed",
            Self::Abandoned => "abandoned",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Planned => "Planejada",
            Self::InProgress => "Em andamento",
            Self::Completed => "Concluída",
            Self::Abandoned => "Abandonada",
        }
    }

    pub fn parse(text: &str) -> Result<Self, ReportError> {
        Self::ALL
            .into_iter()
            .find(|status| status.as_str() == text)
            .ok_or(ReportError::FilterInvalid("goal_status"))
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ReportFilters {
    pub period: PeriodRequest,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub book_id: Option<Uuid>,
    pub emotion_id: Option<Uuid>,
    pub goal_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub item_type: Option<LibraryItemType>,
    pub goal_status: Option<GoalStatus>,
}

impl ReportFilters {
    /// Os filtros presentes, com o parâmetro que os trouxe.
    fn present(&self) -> Vec<(ReportFilter, &'static str)> {
        let mut found = Vec::new();
        if self.period.from.is_some() {
            found.push((ReportFilter::Period, "from"));
        }
        if self.period.to.is_some() {
            found.push((ReportFilter::Period, "to"));
        }
        let singles = [
            (ReportFilter::Account, self.account_id.is_some()),
            (ReportFilter::Category, self.category_id.is_some()),
            (ReportFilter::Book, self.book_id.is_some()),
            (ReportFilter::Emotion, self.emotion_id.is_some()),
            (ReportFilter::Goal, self.goal_id.is_some()),
            (ReportFilter::Project, self.project_id.is_some()),
            (ReportFilter::Type, self.item_type.is_some()),
            (ReportFilter::GoalStatus, self.goal_status.is_some()),
        ];
        for (filter, present) in singles {
            if present {
                found.push((filter, filter.param()));
            }
        }
        found
    }

    /// Recusa o filtro que o relatório não aceita (`report_filter_invalid`).
    pub fn validate(&self, kind: ReportKind) -> Result<(), ReportError> {
        for (filter, param) in self.present() {
            if !kind.accepts(filter) {
                return Err(ReportError::FilterInvalid(param));
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Itens de entrada (entregues pelos adaptadores)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NamedRef {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FlowKind {
    Income,
    Expense,
    /// Nunca entra nos totais (RN-05).
    Transfer,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinanceTx {
    pub kind: FlowKind,
    /// Só as liquidadas entram nos totais; os itens virtuais ficam de fora.
    pub settled: bool,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub settled_on: NaiveDate,
    pub settled_amount: i64,
    pub expected_amount: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinanceData {
    pub currency: String,
    pub accounts: Vec<NamedRef>,
    pub categories: Vec<NamedRef>,
    pub transactions: Vec<FinanceTx>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookRef {
    pub id: Uuid,
    pub title: String,
    pub page_count: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadingSessionItem {
    pub book_id: Uuid,
    pub read_on: NaiveDate,
    pub pages_read: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadingData {
    pub books: Vec<BookRef>,
    pub sessions: Vec<ReadingSessionItem>,
}

/// Status de cada item do Acervo, pela chave estável (`want_to_read`, `to_watch`...).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LibraryStatusData {
    pub books: Vec<String>,
    pub articles: Vec<String>,
    pub videos: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalEmotionMark {
    pub emotion_id: Uuid,
    pub name: String,
    pub intensity: Option<u8>,
}

/// Entrada do diário sem o texto: os relatórios nunca o recebem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalItem {
    pub occurred_on: NaiveDate,
    pub emotions: Vec<JournalEmotionMark>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoalItem {
    pub id: Uuid,
    pub title: String,
    pub status: GoalStatus,
    pub deadline: Option<NaiveDate>,
    /// O progresso da meta como o contexto `goals` o devolve; nunca recalculado aqui.
    pub progress_percent: u8,
    pub milestone_count: u32,
    pub completed_milestone_count: u32,
}

/// Tarefa pontual, sem o título.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskItem {
    pub due_on: Option<NaiveDate>,
    pub completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaneItem {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub card_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectItem {
    pub id: Uuid,
    pub name: String,
    pub lanes: Vec<LaneItem>,
}

// ---------------------------------------------------------------------------
// Modelos dos relatórios
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppliedFilter {
    pub filter: ReportFilter,
    pub label: &'static str,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FlowTotals {
    pub income: i64,
    pub expense: i64,
    pub net: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FlowMonth {
    pub month: String,
    pub income: i64,
    pub expense: i64,
    pub net: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FlowAccount {
    pub account_id: Uuid,
    pub name: String,
    pub income: i64,
    pub expense: i64,
    pub net: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinFlowReport {
    pub report: &'static str,
    pub period: Period,
    pub any_period: bool,
    pub generated_on: NaiveDate,
    pub currency: String,
    pub filters: Vec<AppliedFilter>,
    pub totals: FlowTotals,
    pub months: Vec<FlowMonth>,
    pub accounts: Vec<FlowAccount>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CategoryAmount {
    pub category_id: Option<Uuid>,
    pub name: String,
    pub amount: i64,
    pub percent: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinCatReport {
    pub report: &'static str,
    pub period: Period,
    pub any_period: bool,
    pub generated_on: NaiveDate,
    pub currency: String,
    pub filters: Vec<AppliedFilter>,
    pub total_expense: i64,
    pub categories: Vec<CategoryAmount>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct DiffTotals {
    pub savings: i64,
    pub gains: i64,
    pub losses: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiffMonth {
    pub month: String,
    pub savings: i64,
    pub gains: i64,
    pub losses: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinDiffReport {
    pub report: &'static str,
    pub period: Period,
    pub any_period: bool,
    pub generated_on: NaiveDate,
    pub currency: String,
    pub filters: Vec<AppliedFilter>,
    pub totals: DiffTotals,
    pub months: Vec<DiffMonth>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BookPages {
    pub book_id: Uuid,
    pub title: String,
    pub pages: i64,
    pub sessions: u32,
    /// Páginas do período sobre o total do livro, limitado a 100% (RN-14).
    pub progress_percent: Option<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReadPagesReport {
    pub report: &'static str,
    pub period: Period,
    pub any_period: bool,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub total_pages: i64,
    pub session_count: u32,
    pub books: Vec<BookPages>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StatusCount<S> {
    pub status: S,
    pub label: &'static str,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StatusGroup {
    pub item_type: LibraryItemType,
    pub label: &'static str,
    pub total: u32,
    pub statuses: Vec<StatusCount<&'static str>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibStatusReport {
    pub report: &'static str,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub groups: Vec<StatusGroup>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DayCount {
    pub date: NaiveDate,
    pub entries: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EmotionStat {
    pub emotion_id: Uuid,
    pub name: String,
    pub count: u32,
    pub average_intensity: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct JournalEmoReport {
    pub report: &'static str,
    pub period: Period,
    pub any_period: bool,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub entry_count: u32,
    pub average_intensity: Option<f64>,
    pub days: Vec<DayCount>,
    pub emotions: Vec<EmotionStat>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GoalProgress {
    pub goal_id: Uuid,
    pub title: String,
    pub status: GoalStatus,
    pub deadline: Option<NaiveDate>,
    pub progress_percent: u8,
    pub milestone_count: u32,
    pub completed_milestone_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GoalsProgressReport {
    pub report: &'static str,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub goals: Vec<GoalProgress>,
    pub by_status: Vec<StatusCount<GoalStatus>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TasksDoneReport {
    pub report: &'static str,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub completed: u32,
    pub open: u32,
    /// Das abertas, as com `due_on` antes de hoje.
    pub overdue: u32,
    pub recurring_notice: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LaneCount {
    pub lane_id: Uuid,
    pub name: String,
    pub color: String,
    pub card_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjectLanes {
    pub project_id: Uuid,
    pub name: String,
    pub total_cards: u32,
    pub lanes: Vec<LaneCount>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProjCardsReport {
    pub report: &'static str,
    pub generated_on: NaiveDate,
    pub filters: Vec<AppliedFilter>,
    pub projects: Vec<ProjectLanes>,
}

/// Qualquer um dos nove relatórios; a serialização é o próprio modelo.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum Report {
    FinFlow(FinFlowReport),
    FinCat(FinCatReport),
    FinDiff(FinDiffReport),
    ReadPages(ReadPagesReport),
    LibStatus(LibStatusReport),
    JournalEmo(JournalEmoReport),
    GoalsProgress(GoalsProgressReport),
    TasksDone(TasksDoneReport),
    ProjCards(ProjCardsReport),
}

// ---------------------------------------------------------------------------
// Utilitários de cálculo
// ---------------------------------------------------------------------------

fn month_key(date: NaiveDate) -> String {
    format!("{:04}-{:02}", date.year(), date.month())
}

/// Porcentagem arredondada, limitada a 100.
fn percent_of(part: i64, whole: i64) -> u8 {
    if whole <= 0 || part <= 0 {
        return 0;
    }
    let value = (i128::from(part) * 100 + i128::from(whole) / 2) / i128::from(whole);
    u8::try_from(value.min(100)).unwrap_or(100)
}

fn count_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn name_of(list: &[NamedRef], id: Uuid) -> Option<&str> {
    list.iter()
        .find(|item| item.id == id)
        .map(|item| item.name.as_str())
}

fn id_filter(
    filter: ReportFilter,
    id: Option<Uuid>,
    names: impl Fn(Uuid) -> Option<String>,
) -> Option<AppliedFilter> {
    id.map(|id| AppliedFilter {
        filter,
        label: filter.label(),
        value: names(id).unwrap_or_else(|| id.to_string()),
    })
}

// ---------------------------------------------------------------------------
// Relatórios financeiros
// ---------------------------------------------------------------------------

/// Contexto comum dos relatórios de período.
#[derive(Debug, Clone, Copy)]
pub struct PeriodContext {
    pub period: Period,
    pub any_period: bool,
    pub today: NaiveDate,
}

/// Movimentações liquidadas do período e da conta; transferências e itens
/// virtuais nunca entram (RN-05).
fn settled_in<'a>(
    data: &'a FinanceData,
    ctx: PeriodContext,
    filters: &'a ReportFilters,
) -> impl Iterator<Item = &'a FinanceTx> {
    data.transactions.iter().filter(move |tx| {
        tx.settled
            && tx.kind != FlowKind::Transfer
            && ctx.period.contains(tx.settled_on)
            && filters.account_id.is_none_or(|id| id == tx.account_id)
    })
}

fn finance_filters(data: &FinanceData, filters: &ReportFilters) -> Vec<AppliedFilter> {
    let mut applied = Vec::new();
    applied.extend(id_filter(ReportFilter::Account, filters.account_id, |id| {
        name_of(&data.accounts, id).map(str::to_owned)
    }));
    applied.extend(id_filter(
        ReportFilter::Category,
        filters.category_id,
        |id| name_of(&data.categories, id).map(str::to_owned),
    ));
    applied
}

pub fn build_fin_flow(
    ctx: PeriodContext,
    filters: &ReportFilters,
    data: &FinanceData,
) -> FinFlowReport {
    let mut months: BTreeMap<String, (i64, i64)> = BTreeMap::new();
    let mut accounts: Vec<(Uuid, i64, i64)> = Vec::new();
    let mut totals = (0i64, 0i64);
    for tx in settled_in(data, ctx, filters) {
        let income = tx.kind == FlowKind::Income;
        let amount = tx.settled_amount;
        let month = months.entry(month_key(tx.settled_on)).or_default();
        let slot = match accounts.iter().position(|(id, _, _)| *id == tx.account_id) {
            Some(index) => index,
            None => {
                accounts.push((tx.account_id, 0, 0));
                accounts.len() - 1
            }
        };
        if income {
            month.0 = month.0.saturating_add(amount);
            accounts[slot].1 = accounts[slot].1.saturating_add(amount);
            totals.0 = totals.0.saturating_add(amount);
        } else {
            month.1 = month.1.saturating_add(amount);
            accounts[slot].2 = accounts[slot].2.saturating_add(amount);
            totals.1 = totals.1.saturating_add(amount);
        }
    }
    FinFlowReport {
        report: "fin-flow",
        period: ctx.period,
        any_period: ctx.any_period,
        generated_on: ctx.today,
        currency: data.currency.clone(),
        filters: finance_filters(data, filters),
        totals: FlowTotals {
            income: totals.0,
            expense: totals.1,
            net: totals.0.saturating_sub(totals.1),
        },
        months: months
            .into_iter()
            .map(|(month, (income, expense))| FlowMonth {
                month,
                income,
                expense,
                net: income.saturating_sub(expense),
            })
            .collect(),
        accounts: accounts
            .into_iter()
            .map(|(account_id, income, expense)| FlowAccount {
                account_id,
                name: name_of(&data.accounts, account_id)
                    .unwrap_or("Conta")
                    .to_owned(),
                income,
                expense,
                net: income.saturating_sub(expense),
            })
            .collect(),
    }
}

pub const UNCATEGORIZED: &str = "Sem categoria";

pub fn build_fin_cat(
    ctx: PeriodContext,
    filters: &ReportFilters,
    data: &FinanceData,
) -> FinCatReport {
    let mut by_category: BTreeMap<Option<Uuid>, i64> = BTreeMap::new();
    let mut total = 0i64;
    for tx in settled_in(data, ctx, filters).filter(|tx| {
        tx.kind == FlowKind::Expense
            && filters
                .category_id
                .is_none_or(|id| Some(id) == tx.category_id)
    }) {
        let sum = by_category.entry(tx.category_id).or_default();
        *sum = sum.saturating_add(tx.settled_amount);
        total = total.saturating_add(tx.settled_amount);
    }
    let mut categories: Vec<CategoryAmount> = by_category
        .into_iter()
        .map(|(category_id, amount)| CategoryAmount {
            category_id,
            name: category_id
                .and_then(|id| name_of(&data.categories, id))
                .unwrap_or(UNCATEGORIZED)
                .to_owned(),
            amount,
            percent: percent_of(amount, total),
        })
        .collect();
    categories.sort_by(|a, b| b.amount.cmp(&a.amount).then_with(|| a.name.cmp(&b.name)));
    FinCatReport {
        report: "fin-cat",
        period: ctx.period,
        any_period: ctx.any_period,
        generated_on: ctx.today,
        currency: data.currency.clone(),
        filters: finance_filters(data, filters),
        total_expense: total,
        categories,
    }
}

pub fn build_fin_diff(
    ctx: PeriodContext,
    filters: &ReportFilters,
    data: &FinanceData,
) -> FinDiffReport {
    let mut totals = DiffTotals::default();
    let mut months: BTreeMap<String, DiffTotals> = BTreeMap::new();
    for tx in settled_in(data, ctx, filters) {
        let difference = tx.settled_amount.saturating_sub(tx.expected_amount);
        // Saída: pagar menos é economia, pagar mais é perda (RN-02). Entrada: receber
        // mais é ganho, receber menos é perda (RN-03).
        let (savings, gains, losses) = match (tx.kind, difference.signum()) {
            (_, 0) => continue,
            (FlowKind::Expense, -1) => (difference.saturating_abs(), 0, 0),
            (FlowKind::Income, 1) => (0, difference, 0),
            _ => (0, 0, difference.saturating_abs()),
        };
        let month = months.entry(month_key(tx.settled_on)).or_default();
        for sums in [&mut totals, month] {
            sums.savings = sums.savings.saturating_add(savings);
            sums.gains = sums.gains.saturating_add(gains);
            sums.losses = sums.losses.saturating_add(losses);
        }
    }
    FinDiffReport {
        report: "fin-diff",
        period: ctx.period,
        any_period: ctx.any_period,
        generated_on: ctx.today,
        currency: data.currency.clone(),
        filters: finance_filters(data, filters),
        totals,
        months: months
            .into_iter()
            .map(|(month, sums)| DiffMonth {
                month,
                savings: sums.savings,
                gains: sums.gains,
                losses: sums.losses,
            })
            .collect(),
    }
}

// ---------------------------------------------------------------------------
// Leitura, acervo e diário
// ---------------------------------------------------------------------------

pub fn build_read_pages(
    ctx: PeriodContext,
    filters: &ReportFilters,
    data: &ReadingData,
) -> ReadPagesReport {
    let mut per_book: Vec<(Uuid, i64, u32)> = Vec::new();
    for session in data.sessions.iter().filter(|session| {
        ctx.period.contains(session.read_on)
            && filters.book_id.is_none_or(|id| id == session.book_id)
    }) {
        match per_book
            .iter_mut()
            .find(|(id, _, _)| *id == session.book_id)
        {
            Some(entry) => {
                entry.1 = entry.1.saturating_add(session.pages_read);
                entry.2 += 1;
            }
            None => per_book.push((session.book_id, session.pages_read, 1)),
        }
    }
    let books: Vec<BookPages> = per_book
        .into_iter()
        .filter_map(|(book_id, pages, sessions)| {
            let book = data.books.iter().find(|book| book.id == book_id)?;
            Some(BookPages {
                book_id,
                title: book.title.clone(),
                pages,
                sessions,
                progress_percent: book
                    .page_count
                    .filter(|count| *count > 0)
                    .map(|count| percent_of(pages, i64::from(count))),
            })
        })
        .collect();
    let mut books = books;
    books.sort_by(|a, b| b.pages.cmp(&a.pages).then_with(|| a.title.cmp(&b.title)));
    ReadPagesReport {
        report: "read-pages",
        period: ctx.period,
        any_period: ctx.any_period,
        generated_on: ctx.today,
        filters: id_filter(ReportFilter::Book, filters.book_id, |id| {
            data.books
                .iter()
                .find(|book| book.id == id)
                .map(|book| book.title.clone())
        })
        .into_iter()
        .collect(),
        total_pages: books.iter().fold(0, |sum, b| sum.saturating_add(b.pages)),
        session_count: books.iter().map(|b| b.sessions).sum(),
        books,
    }
}

pub fn build_lib_status(
    today: NaiveDate,
    filters: &ReportFilters,
    data: &LibraryStatusData,
) -> LibStatusReport {
    let groups = LibraryItemType::ALL
        .into_iter()
        .filter(|kind| filters.item_type.is_none_or(|wanted| wanted == *kind))
        .map(|kind| {
            let items = match kind {
                LibraryItemType::Book => &data.books,
                LibraryItemType::Article => &data.articles,
                LibraryItemType::Video => &data.videos,
            };
            StatusGroup {
                item_type: kind,
                label: kind.label(),
                total: count_u32(items.len()),
                statuses: kind
                    .statuses()
                    .into_iter()
                    .map(|(key, label)| StatusCount {
                        status: key,
                        label,
                        count: count_u32(items.iter().filter(|status| *status == key).count()),
                    })
                    .collect(),
            }
        })
        .collect();
    LibStatusReport {
        report: "lib-status",
        generated_on: today,
        filters: filters
            .item_type
            .map(|kind| AppliedFilter {
                filter: ReportFilter::Type,
                label: ReportFilter::Type.label(),
                value: kind.label().to_owned(),
            })
            .into_iter()
            .collect(),
        groups,
    }
}

pub fn build_journal_emo(
    ctx: PeriodContext,
    filters: &ReportFilters,
    items: &[JournalItem],
) -> JournalEmoReport {
    let entries: Vec<&JournalItem> = items
        .iter()
        .filter(|entry| {
            ctx.period.contains(entry.occurred_on)
                && filters
                    .emotion_id
                    .is_none_or(|id| entry.emotions.iter().any(|mark| mark.emotion_id == id))
        })
        .collect();
    let mut days: BTreeMap<NaiveDate, u32> = BTreeMap::new();
    let mut stats: Vec<(Uuid, String, u32, Vec<u8>)> = Vec::new();
    let mut all_intensities: Vec<u8> = Vec::new();
    for entry in &entries {
        *days.entry(entry.occurred_on).or_default() += 1;
        for mark in entry
            .emotions
            .iter()
            .filter(|mark| filters.emotion_id.is_none_or(|id| id == mark.emotion_id))
        {
            let slot = match stats.iter().position(|(id, ..)| *id == mark.emotion_id) {
                Some(index) => index,
                None => {
                    stats.push((mark.emotion_id, mark.name.clone(), 0, Vec::new()));
                    stats.len() - 1
                }
            };
            stats[slot].2 += 1;
            if let Some(intensity) = mark.intensity {
                stats[slot].3.push(intensity);
                all_intensities.push(intensity);
            }
        }
    }
    let average = |values: &[u8]| -> Option<f64> {
        (!values.is_empty()).then(|| {
            round1(values.iter().map(|v| f64::from(*v)).sum::<f64>() / values.len() as f64)
        })
    };
    let mut emotions: Vec<EmotionStat> = stats
        .iter()
        .map(|(emotion_id, name, count, intensities)| EmotionStat {
            emotion_id: *emotion_id,
            name: name.clone(),
            count: *count,
            average_intensity: average(intensities),
        })
        .collect();
    emotions.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
    let emotion_name = |id: Uuid| {
        items
            .iter()
            .flat_map(|entry| entry.emotions.iter())
            .find(|mark| mark.emotion_id == id)
            .map(|mark| mark.name.clone())
    };
    JournalEmoReport {
        report: "journal-emo",
        period: ctx.period,
        any_period: ctx.any_period,
        generated_on: ctx.today,
        filters: id_filter(ReportFilter::Emotion, filters.emotion_id, emotion_name)
            .into_iter()
            .collect(),
        entry_count: count_u32(entries.len()),
        average_intensity: average(&all_intensities),
        days: days
            .into_iter()
            .map(|(date, entries)| DayCount { date, entries })
            .collect(),
        emotions,
    }
}

// ---------------------------------------------------------------------------
// Metas, tarefas e projetos
// ---------------------------------------------------------------------------

pub fn build_goals_progress(
    today: NaiveDate,
    filters: &ReportFilters,
    items: &[GoalItem],
) -> GoalsProgressReport {
    let goals: Vec<GoalProgress> = items
        .iter()
        .filter(|goal| {
            filters.goal_id.is_none_or(|id| id == goal.id)
                && filters
                    .goal_status
                    .is_none_or(|status| status == goal.status)
        })
        .map(|goal| GoalProgress {
            goal_id: goal.id,
            title: goal.title.clone(),
            status: goal.status,
            deadline: goal.deadline,
            progress_percent: goal.progress_percent,
            milestone_count: goal.milestone_count,
            completed_milestone_count: goal.completed_milestone_count,
        })
        .collect();
    let by_status = GoalStatus::ALL
        .into_iter()
        .map(|status| StatusCount {
            status,
            label: status.label(),
            count: count_u32(goals.iter().filter(|goal| goal.status == status).count()),
        })
        .collect();
    let mut applied = Vec::new();
    applied.extend(id_filter(ReportFilter::Goal, filters.goal_id, |id| {
        items
            .iter()
            .find(|goal| goal.id == id)
            .map(|goal| goal.title.clone())
    }));
    applied.extend(filters.goal_status.map(|status| AppliedFilter {
        filter: ReportFilter::GoalStatus,
        label: ReportFilter::GoalStatus.label(),
        value: status.label().to_owned(),
    }));
    GoalsProgressReport {
        report: "goals-progress",
        generated_on: today,
        filters: applied,
        goals,
        by_status,
    }
}

pub fn build_tasks_done(today: NaiveDate, items: &[TaskItem]) -> TasksDoneReport {
    let completed = items.iter().filter(|task| task.completed).count();
    let open: Vec<&TaskItem> = items.iter().filter(|task| !task.completed).collect();
    let overdue = open
        .iter()
        .filter(|task| task.due_on.is_some_and(|due| due < today))
        .count();
    TasksDoneReport {
        report: "tasks-done",
        generated_on: today,
        filters: Vec::new(),
        completed: count_u32(completed),
        open: count_u32(open.len()),
        overdue: count_u32(overdue),
        recurring_notice: RECURRING_NOTICE,
    }
}

pub fn build_proj_cards(
    today: NaiveDate,
    filters: &ReportFilters,
    items: &[ProjectItem],
) -> ProjCardsReport {
    let projects = items
        .iter()
        .filter(|project| filters.project_id.is_none_or(|id| id == project.id))
        .map(|project| ProjectLanes {
            project_id: project.id,
            name: project.name.clone(),
            total_cards: project.lanes.iter().map(|lane| lane.card_count).sum(),
            lanes: project
                .lanes
                .iter()
                .map(|lane| LaneCount {
                    lane_id: lane.id,
                    name: lane.name.clone(),
                    color: lane.color.clone(),
                    card_count: lane.card_count,
                })
                .collect(),
        })
        .collect();
    ProjCardsReport {
        report: "proj-cards",
        generated_on: today,
        filters: id_filter(ReportFilter::Project, filters.project_id, |id| {
            items
                .iter()
                .find(|project| project.id == id)
                .map(|project| project.name.clone())
        })
        .into_iter()
        .collect(),
        projects,
    }
}

// ---------------------------------------------------------------------------
// Documento: a visão comum que o HTML e o PDF desenham
// ---------------------------------------------------------------------------

pub fn format_date(date: NaiveDate) -> String {
    format!("{:02}/{:02}/{:04}", date.day(), date.month(), date.year())
}

/// "2026-10" vira "10/2026".
pub fn format_month(key: &str) -> String {
    match key.split_once('-') {
        Some((year, month)) => format!("{month}/{year}"),
        None => key.to_owned(),
    }
}

/// Dinheiro em centavos no formato brasileiro: `R$ 1.234,56`.
pub fn format_money(cents: i64, currency: &str) -> String {
    let abs = cents.unsigned_abs();
    let digits = (abs / 100).to_string();
    let mut grouped = String::new();
    for (index, ch) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let symbol = if currency == "BRL" { "R$" } else { currency };
    let sign = if cents < 0 { "-" } else { "" };
    format!("{sign}{symbol} {grouped},{:02}", abs % 100)
}

fn format_decimal(value: f64) -> String {
    format!("{value:.1}").replace('.', ",")
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocPeriod {
    pub from: String,
    pub to: String,
    pub any_period: bool,
    /// "Qualquer período" ou "01/10/2026 a 31/10/2026".
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocFilter {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocStat {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocBar {
    pub label: String,
    pub value_text: String,
    /// De 0 a 1, sobre o maior valor do bloco.
    pub fraction: f64,
    /// `primary`, `accent`, `success`, `warning` ou `info`.
    pub tone: &'static str,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocTable {
    pub caption: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DocSection {
    pub title: String,
    pub stats: Vec<DocStat>,
    pub bars: Vec<DocBar>,
    pub table: Option<DocTable>,
}

impl DocSection {
    pub fn is_empty(&self) -> bool {
        self.stats.is_empty() && self.bars.is_empty() && self.table.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReportDocument {
    pub id: &'static str,
    pub module: &'static str,
    pub module_label: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub generated_on: String,
    pub period: Option<DocPeriod>,
    pub filters: Vec<DocFilter>,
    pub sections: Vec<DocSection>,
    pub notes: Vec<String>,
}

fn bars_of(rows: Vec<(String, f64, String, &'static str)>) -> Vec<DocBar> {
    let max = rows.iter().map(|row| row.1).fold(0.0_f64, f64::max);
    rows.into_iter()
        .map(|(label, value, value_text, tone)| DocBar {
            label,
            value_text,
            fraction: if max > 0.0 { value / max } else { 0.0 },
            tone,
        })
        .collect()
}

fn section(title: &str) -> DocSection {
    DocSection {
        title: title.to_owned(),
        stats: Vec::new(),
        bars: Vec::new(),
        table: None,
    }
}

fn table(caption: &str, columns: &[&str], rows: Vec<Vec<String>>) -> Option<DocTable> {
    (!rows.is_empty()).then(|| DocTable {
        caption: caption.to_owned(),
        columns: columns.iter().map(|c| (*c).to_owned()).collect(),
        rows,
    })
}

fn stat(label: &str, value: String) -> DocStat {
    DocStat {
        label: label.to_owned(),
        value,
    }
}

fn doc_period(period: Period, any_period: bool) -> DocPeriod {
    let range = format!("{} a {}", format_date(period.from), format_date(period.to));
    DocPeriod {
        from: format_date(period.from),
        to: format_date(period.to),
        any_period,
        label: if any_period {
            format!("Qualquer período ({range})")
        } else {
            range
        },
    }
}

impl Report {
    pub fn kind(&self) -> ReportKind {
        match self {
            Self::FinFlow(_) => ReportKind::FinFlow,
            Self::FinCat(_) => ReportKind::FinCat,
            Self::FinDiff(_) => ReportKind::FinDiff,
            Self::ReadPages(_) => ReportKind::ReadPages,
            Self::LibStatus(_) => ReportKind::LibStatus,
            Self::JournalEmo(_) => ReportKind::JournalEmo,
            Self::GoalsProgress(_) => ReportKind::GoalsProgress,
            Self::TasksDone(_) => ReportKind::TasksDone,
            Self::ProjCards(_) => ReportKind::ProjCards,
        }
    }

    /// Período resolvido, só nos relatórios de período.
    pub fn period(&self) -> Option<(Period, bool)> {
        match self {
            Self::FinFlow(r) => Some((r.period, r.any_period)),
            Self::FinCat(r) => Some((r.period, r.any_period)),
            Self::FinDiff(r) => Some((r.period, r.any_period)),
            Self::ReadPages(r) => Some((r.period, r.any_period)),
            Self::JournalEmo(r) => Some((r.period, r.any_period)),
            _ => None,
        }
    }

    pub fn generated_on(&self) -> NaiveDate {
        match self {
            Self::FinFlow(r) => r.generated_on,
            Self::FinCat(r) => r.generated_on,
            Self::FinDiff(r) => r.generated_on,
            Self::ReadPages(r) => r.generated_on,
            Self::LibStatus(r) => r.generated_on,
            Self::JournalEmo(r) => r.generated_on,
            Self::GoalsProgress(r) => r.generated_on,
            Self::TasksDone(r) => r.generated_on,
            Self::ProjCards(r) => r.generated_on,
        }
    }

    fn applied_filters(&self) -> &[AppliedFilter] {
        match self {
            Self::FinFlow(r) => &r.filters,
            Self::FinCat(r) => &r.filters,
            Self::FinDiff(r) => &r.filters,
            Self::ReadPages(r) => &r.filters,
            Self::LibStatus(r) => &r.filters,
            Self::JournalEmo(r) => &r.filters,
            Self::GoalsProgress(r) => &r.filters,
            Self::TasksDone(r) => &r.filters,
            Self::ProjCards(r) => &r.filters,
        }
    }

    pub fn document(&self) -> ReportDocument {
        let entry = self.kind().entry();
        ReportDocument {
            id: entry.id,
            module: entry.module,
            module_label: module_label(entry.module),
            title: entry.title,
            description: entry.description,
            generated_on: format_date(self.generated_on()),
            period: self.period().map(|(p, any)| doc_period(p, any)),
            filters: self
                .applied_filters()
                .iter()
                .map(|f| DocFilter {
                    label: f.label.to_owned(),
                    value: f.value.clone(),
                })
                .collect(),
            sections: self.sections(),
            notes: self.notes(),
        }
    }

    fn notes(&self) -> Vec<String> {
        match self {
            Self::TasksDone(r) => vec![r.recurring_notice.to_owned()],
            Self::FinDiff(_) => vec![
                "Economia: saída paga abaixo do previsto. Ganho: entrada recebida acima do previsto. Perda: o contrário."
                    .to_owned(),
            ],
            _ => Vec::new(),
        }
    }

    fn sections(&self) -> Vec<DocSection> {
        match self {
            Self::FinFlow(r) => fin_flow_sections(r),
            Self::FinCat(r) => fin_cat_sections(r),
            Self::FinDiff(r) => fin_diff_sections(r),
            Self::ReadPages(r) => read_pages_sections(r),
            Self::LibStatus(r) => lib_status_sections(r),
            Self::JournalEmo(r) => journal_emo_sections(r),
            Self::GoalsProgress(r) => goals_progress_sections(r),
            Self::TasksDone(r) => tasks_done_sections(r),
            Self::ProjCards(r) => proj_cards_sections(r),
        }
    }
}

fn fin_flow_sections(report: &FinFlowReport) -> Vec<DocSection> {
    let money = |value| format_money(value, &report.currency);
    let mut totals = section("Totais do período");
    if !report.months.is_empty() {
        totals.stats = vec![
            stat("Entradas", money(report.totals.income)),
            stat("Saídas", money(report.totals.expense)),
            stat("Saldo", money(report.totals.net)),
        ];
    }
    let mut months = section("Entradas e saídas por mês");
    months.table = table(
        "Entradas e saídas por mês",
        &["Mês", "Entradas", "Saídas", "Saldo"],
        report
            .months
            .iter()
            .map(|m| {
                vec![
                    format_month(&m.month),
                    money(m.income),
                    money(m.expense),
                    money(m.net),
                ]
            })
            .collect(),
    );
    let mut bars = Vec::new();
    for month in &report.months {
        bars.push((
            format!("{} · entradas", format_month(&month.month)),
            month.income as f64,
            money(month.income),
            "success",
        ));
        bars.push((
            format!("{} · saídas", format_month(&month.month)),
            month.expense as f64,
            money(month.expense),
            "warning",
        ));
    }
    months.bars = bars_of(bars);
    let mut accounts = section("Por conta");
    accounts.table = table(
        "Entradas e saídas por conta",
        &["Conta", "Entradas", "Saídas", "Saldo"],
        report
            .accounts
            .iter()
            .map(|a| {
                vec![
                    a.name.clone(),
                    money(a.income),
                    money(a.expense),
                    money(a.net),
                ]
            })
            .collect(),
    );
    vec![totals, months, accounts]
}

fn fin_cat_sections(report: &FinCatReport) -> Vec<DocSection> {
    let money = |value| format_money(value, &report.currency);
    let mut totals = section("Total das saídas");
    if !report.categories.is_empty() {
        totals.stats = vec![stat("Saídas liquidadas", money(report.total_expense))];
    }
    let mut by_category = section("Gastos por categoria");
    by_category.bars = bars_of(
        report
            .categories
            .iter()
            .map(|c| (c.name.clone(), c.amount as f64, money(c.amount), "primary"))
            .collect(),
    );
    by_category.table = table(
        "Gastos por categoria",
        &["Categoria", "Valor", "Parte do total"],
        report
            .categories
            .iter()
            .map(|c| vec![c.name.clone(), money(c.amount), format!("{}%", c.percent)])
            .collect(),
    );
    vec![totals, by_category]
}

fn fin_diff_sections(report: &FinDiffReport) -> Vec<DocSection> {
    let money = |value| format_money(value, &report.currency);
    let mut totals = section("Economias, ganhos e perdas");
    if !report.months.is_empty() {
        totals.stats = vec![
            stat("Economias", money(report.totals.savings)),
            stat("Ganhos", money(report.totals.gains)),
            stat("Perdas", money(report.totals.losses)),
        ];
    }
    let mut months = section("Por mês");
    months.table = table(
        "Diferença entre o previsto e o liquidado por mês",
        &["Mês", "Economias", "Ganhos", "Perdas"],
        report
            .months
            .iter()
            .map(|m| {
                vec![
                    format_month(&m.month),
                    money(m.savings),
                    money(m.gains),
                    money(m.losses),
                ]
            })
            .collect(),
    );
    vec![totals, months]
}

fn read_pages_sections(report: &ReadPagesReport) -> Vec<DocSection> {
    let mut totals = section("Total do período");
    if !report.books.is_empty() {
        totals.stats = vec![
            stat("Páginas lidas", report.total_pages.to_string()),
            stat("Sessões", report.session_count.to_string()),
        ];
    }
    let mut books = section("Páginas lidas por livro");
    books.bars = bars_of(
        report
            .books
            .iter()
            .map(|b| {
                (
                    b.title.clone(),
                    b.pages as f64,
                    format!("{} pág.", b.pages),
                    "accent",
                )
            })
            .collect(),
    );
    books.table = table(
        "Páginas lidas por livro",
        &["Livro", "Páginas", "Sessões", "Progresso"],
        report
            .books
            .iter()
            .map(|b| {
                vec![
                    b.title.clone(),
                    b.pages.to_string(),
                    b.sessions.to_string(),
                    b.progress_percent
                        .map_or_else(|| "—".to_owned(), |p| format!("{p}%")),
                ]
            })
            .collect(),
    );
    vec![totals, books]
}

fn lib_status_sections(report: &LibStatusReport) -> Vec<DocSection> {
    report
        .groups
        .iter()
        .map(|group| {
            let tone = match group.item_type {
                LibraryItemType::Book => "primary",
                LibraryItemType::Article => "info",
                LibraryItemType::Video => "accent",
            };
            let mut block = section(&format!("{} por status", group.label));
            block.bars = bars_of(
                group
                    .statuses
                    .iter()
                    .map(|s| {
                        (
                            s.label.to_owned(),
                            f64::from(s.count),
                            s.count.to_string(),
                            tone,
                        )
                    })
                    .collect(),
            );
            block.table = table(
                &format!("{} por status", group.label),
                &["Status", "Itens"],
                group
                    .statuses
                    .iter()
                    .map(|s| vec![s.label.to_owned(), s.count.to_string()])
                    .collect(),
            );
            block
        })
        .collect()
}

fn journal_emo_sections(report: &JournalEmoReport) -> Vec<DocSection> {
    let mut entries = section("Entradas no período");
    if report.entry_count > 0 {
        entries.stats = vec![stat("Entradas escritas", report.entry_count.to_string())];
        if let Some(average) = report.average_intensity {
            entries
                .stats
                .push(stat("Intensidade média", format_decimal(average)));
        }
    }
    entries.table = table(
        "Entradas por dia",
        &["Dia", "Entradas"],
        report
            .days
            .iter()
            .map(|d| vec![format_date(d.date), d.entries.to_string()])
            .collect(),
    );
    let mut emotions = section("Emoções mais frequentes");
    emotions.bars = bars_of(
        report
            .emotions
            .iter()
            .map(|e| {
                (
                    e.name.clone(),
                    f64::from(e.count),
                    e.count.to_string(),
                    "accent",
                )
            })
            .collect(),
    );
    emotions.table = table(
        "Emoções mais frequentes",
        &["Emoção", "Vezes", "Intensidade média"],
        report
            .emotions
            .iter()
            .map(|e| {
                vec![
                    e.name.clone(),
                    e.count.to_string(),
                    e.average_intensity
                        .map_or_else(|| "—".to_owned(), format_decimal),
                ]
            })
            .collect(),
    );
    vec![entries, emotions]
}

fn goals_progress_sections(report: &GoalsProgressReport) -> Vec<DocSection> {
    let mut goals = section("Progresso por meta");
    goals.bars = bars_of(
        report
            .goals
            .iter()
            .map(|g| {
                (
                    g.title.clone(),
                    f64::from(g.progress_percent),
                    format!("{}%", g.progress_percent),
                    if g.status == GoalStatus::Completed {
                        "success"
                    } else {
                        "primary"
                    },
                )
            })
            .collect(),
    );
    goals.table = table(
        "Progresso por meta",
        &["Meta", "Status", "Marcos", "Progresso", "Prazo"],
        report
            .goals
            .iter()
            .map(|g| {
                vec![
                    g.title.clone(),
                    g.status.label().to_owned(),
                    format!("{}/{}", g.completed_milestone_count, g.milestone_count),
                    format!("{}%", g.progress_percent),
                    g.deadline.map_or_else(|| "—".to_owned(), format_date),
                ]
            })
            .collect(),
    );
    let mut by_status = section("Metas por status");
    by_status.bars = bars_of(
        report
            .by_status
            .iter()
            .map(|s| {
                (
                    s.label.to_owned(),
                    f64::from(s.count),
                    s.count.to_string(),
                    "info",
                )
            })
            .collect(),
    );
    vec![goals, by_status]
}

fn tasks_done_sections(report: &TasksDoneReport) -> Vec<DocSection> {
    let mut tasks = section("Tarefas pontuais");
    tasks.stats = vec![
        stat("Concluídas", report.completed.to_string()),
        stat("Abertas", report.open.to_string()),
        stat("Abertas e vencidas", report.overdue.to_string()),
    ];
    tasks.bars = bars_of(vec![
        (
            "Concluídas".to_owned(),
            f64::from(report.completed),
            report.completed.to_string(),
            "success",
        ),
        (
            "Abertas".to_owned(),
            f64::from(report.open),
            report.open.to_string(),
            "warning",
        ),
    ]);
    vec![tasks]
}

fn proj_cards_sections(report: &ProjCardsReport) -> Vec<DocSection> {
    let mut sections = Vec::new();
    if report.projects.len() > 1 {
        let mut totals = section("Cartões por projeto");
        totals.bars = bars_of(
            report
                .projects
                .iter()
                .map(|p| {
                    (
                        p.name.clone(),
                        f64::from(p.total_cards),
                        p.total_cards.to_string(),
                        "primary",
                    )
                })
                .collect(),
        );
        sections.push(totals);
    }
    for project in &report.projects {
        let mut block = section(&format!("Cartões por raia · {}", project.name));
        block.bars = bars_of(
            project
                .lanes
                .iter()
                .map(|l| {
                    (
                        l.name.clone(),
                        f64::from(l.card_count),
                        l.card_count.to_string(),
                        "accent",
                    )
                })
                .collect(),
        );
        block.table = table(
            &format!("Cartões por raia · {}", project.name),
            &["Raia", "Cartões"],
            project
                .lanes
                .iter()
                .map(|l| vec![l.name.clone(), l.card_count.to_string()])
                .collect(),
        );
        sections.push(block);
    }
    if sections.is_empty() {
        sections.push(section("Cartões por raia"));
    }
    sections
}

/// Os nove relatórios com dados de exemplo, na ordem do catálogo, para os testes de
/// renderização (HTML e PDF).
#[cfg(test)]
pub fn sample_reports() -> Vec<Report> {
    let date = |text: &str| -> NaiveDate { text.parse().unwrap() };
    let id = Uuid::from_u128;
    let today = date("2026-11-01");
    let ctx = PeriodContext {
        period: Period {
            from: date("2026-09-01"),
            to: today,
        },
        any_period: true,
        today,
    };
    let tx = |kind, account, category: Option<u128>, on: &str, settled, expected| FinanceTx {
        kind,
        settled: true,
        account_id: id(account),
        category_id: category.map(id),
        settled_on: date(on),
        settled_amount: settled,
        expected_amount: expected,
    };
    let finance = FinanceData {
        currency: "BRL".to_owned(),
        accounts: vec![
            NamedRef {
                id: id(1),
                name: "Conta principal".to_owned(),
            },
            NamedRef {
                id: id(2),
                name: "Poupança".to_owned(),
            },
        ],
        categories: vec![
            NamedRef {
                id: id(10),
                name: "Mercado".to_owned(),
            },
            NamedRef {
                id: id(11),
                name: "Transporte".to_owned(),
            },
        ],
        transactions: vec![
            tx(FlowKind::Income, 1, None, "2026-09-05", 500_000, 480_000),
            tx(FlowKind::Expense, 1, Some(10), "2026-09-10", 20_000, 21_000),
            tx(FlowKind::Expense, 2, Some(11), "2026-10-02", 13_000, 12_000),
            tx(FlowKind::Expense, 1, Some(10), "2026-10-12", 18_750, 18_750),
        ],
    };
    let filtered = ReportFilters {
        category_id: Some(id(10)),
        ..ReportFilters::default()
    };
    let reading = ReadingData {
        books: vec![BookRef {
            id: id(20),
            title: "Dom Casmurro".to_owned(),
            page_count: Some(250),
        }],
        sessions: vec![ReadingSessionItem {
            book_id: id(20),
            read_on: date("2026-10-03"),
            pages_read: 40,
        }],
    };
    let library = LibraryStatusData {
        books: vec!["reading".to_owned(), "read".to_owned()],
        articles: vec!["to_read".to_owned()],
        videos: vec!["watched".to_owned()],
    };
    let journal = vec![JournalItem {
        occurred_on: date("2026-10-04"),
        emotions: vec![JournalEmotionMark {
            emotion_id: id(30),
            name: "Gratidão".to_owned(),
            intensity: Some(4),
        }],
    }];
    let goals = vec![GoalItem {
        id: id(40),
        title: "Correr 10 km".to_owned(),
        status: GoalStatus::InProgress,
        deadline: Some(date("2027-03-01")),
        progress_percent: 25,
        milestone_count: 4,
        completed_milestone_count: 1,
    }];
    let tasks = vec![
        TaskItem {
            due_on: Some(date("2026-10-20")),
            completed: true,
        },
        TaskItem {
            due_on: Some(date("2026-10-30")),
            completed: false,
        },
    ];
    let projects = vec![ProjectItem {
        id: id(50),
        name: "Reforma".to_owned(),
        lanes: vec![
            LaneItem {
                id: id(51),
                name: "Aguardando".to_owned(),
                color: "#92400e".to_owned(),
                card_count: 2,
            },
            LaneItem {
                id: id(52),
                name: "Concluído".to_owned(),
                color: "#047857".to_owned(),
                card_count: 1,
            },
        ],
    }];
    let none = ReportFilters::default();
    vec![
        Report::FinFlow(build_fin_flow(ctx, &none, &finance)),
        Report::FinCat(build_fin_cat(ctx, &filtered, &finance)),
        Report::FinDiff(build_fin_diff(ctx, &none, &finance)),
        Report::ReadPages(build_read_pages(ctx, &none, &reading)),
        Report::LibStatus(build_lib_status(today, &none, &library)),
        Report::JournalEmo(build_journal_emo(ctx, &none, &journal)),
        Report::GoalsProgress(build_goals_progress(today, &none, &goals)),
        Report::TasksDone(build_tasks_done(today, &tasks)),
        Report::ProjCards(build_proj_cards(today, &none, &projects)),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn request(from: Option<&str>, to: Option<&str>) -> PeriodRequest {
        PeriodRequest {
            from: from.map(date),
            to: to.map(date),
        }
    }

    fn ctx(from: &str, to: &str) -> PeriodContext {
        PeriodContext {
            period: Period {
                from: date(from),
                to: date(to),
            },
            any_period: false,
            today: date("2026-11-01"),
        }
    }

    #[test]
    fn period_rejects_from_after_to() {
        let result = Period::resolve(
            request(Some("2026-11-10"), Some("2026-11-01")),
            None,
            date("2026-11-20"),
        );

        assert_eq!(result, Err(ReportError::PeriodInvalid));
    }

    #[test]
    fn parses_report_kind() {
        for (kind, entry) in ReportKind::ALL.into_iter().zip(REPORT_CATALOG) {
            assert_eq!(ReportKind::parse(entry.id), Ok(kind));
        }
        assert_eq!(ReportKind::parse("outro"), Err(ReportError::NotFound));
        assert_eq!(ReportKind::parse(""), Err(ReportError::NotFound));
    }

    #[test]
    fn catalog_lists_nine_reports_grouped_by_module() {
        let summary: Vec<(&str, &str, Vec<&str>)> = REPORT_CATALOG
            .iter()
            .map(|e| {
                (
                    e.id,
                    e.module,
                    e.filters.iter().map(|f| f.as_str()).collect(),
                )
            })
            .collect();

        assert_eq!(
            summary,
            vec![
                ("fin-flow", "finance", vec!["period", "account"]),
                ("fin-cat", "finance", vec!["period", "account", "category"]),
                ("fin-diff", "finance", vec!["period", "account"]),
                ("read-pages", "library", vec!["period", "book"]),
                ("lib-status", "library", vec!["type"]),
                ("journal-emo", "journal", vec!["period", "emotion"]),
                ("goals-progress", "goals", vec!["goal", "goal_status"]),
                ("tasks-done", "tasks", vec![]),
                ("proj-cards", "projects", vec!["project"]),
            ]
        );
        let with_period: Vec<&str> = ReportKind::ALL
            .into_iter()
            .filter(|kind| kind.has_period())
            .map(ReportKind::id)
            .collect();
        assert_eq!(
            with_period,
            vec![
                "fin-flow",
                "fin-cat",
                "fin-diff",
                "read-pages",
                "journal-emo"
            ]
        );
    }

    #[test]
    fn filters_accept_period_only_in_period_reports() {
        let with_period = ReportFilters {
            period: request(Some("2026-01-01"), Some("2026-01-31")),
            ..ReportFilters::default()
        };

        for kind in [
            ReportKind::FinFlow,
            ReportKind::FinCat,
            ReportKind::FinDiff,
            ReportKind::ReadPages,
            ReportKind::JournalEmo,
        ] {
            assert_eq!(ReportFilters::default().validate(kind), Ok(()));
            assert_eq!(with_period.validate(kind), Ok(()));
        }
        for kind in [
            ReportKind::LibStatus,
            ReportKind::GoalsProgress,
            ReportKind::TasksDone,
            ReportKind::ProjCards,
        ] {
            assert_eq!(ReportFilters::default().validate(kind), Ok(()));
            assert_eq!(
                with_period.validate(kind),
                Err(ReportError::FilterInvalid("from"))
            );
        }
    }

    #[test]
    fn any_period_goes_from_first_record_to_today() {
        let period = Period::resolve(
            PeriodRequest::default(),
            Some(date("2026-03-15")),
            date("2026-11-01"),
        )
        .unwrap();

        assert_eq!(period.from, date("2026-03-15"));
        assert_eq!(period.to, date("2026-11-01"));
        assert!(PeriodRequest::default().is_open());
    }

    #[test]
    fn missing_from_uses_first_record_and_missing_to_uses_today() {
        let today = date("2026-11-01");
        let first = Some(date("2026-03-15"));

        let only_to = Period::resolve(request(None, Some("2026-05-31")), first, today).unwrap();
        let only_from = Period::resolve(request(Some("2026-06-01"), None), first, today).unwrap();
        let before_first =
            Period::resolve(request(None, Some("2026-01-31")), first, today).unwrap();

        assert_eq!(
            (only_to.from, only_to.to),
            (date("2026-03-15"), date("2026-05-31"))
        );
        assert_eq!((only_from.from, only_from.to), (date("2026-06-01"), today));
        assert_eq!(before_first.from, date("2026-01-31"));
    }

    #[test]
    fn any_period_without_records_starts_and_ends_today() {
        let today = date("2026-11-01");

        let period = Period::resolve(PeriodRequest::default(), None, today).unwrap();

        assert_eq!((period.from, period.to), (today, today));
    }

    #[test]
    fn resolved_period_with_from_after_today_is_invalid() {
        let result = Period::resolve(
            request(Some("2026-12-01"), None),
            Some(date("2026-03-15")),
            date("2026-11-01"),
        );

        assert_eq!(result, Err(ReportError::PeriodInvalid));
    }

    #[test]
    fn filters_reject_filter_not_accepted_by_report() {
        let book = ReportFilters {
            book_id: Some(id(1)),
            ..ReportFilters::default()
        };
        let kind = ReportFilters {
            item_type: Some(LibraryItemType::Book),
            ..ReportFilters::default()
        };
        let account_in_cat = ReportFilters {
            account_id: Some(id(1)),
            ..ReportFilters::default()
        };

        assert_eq!(
            book.validate(ReportKind::FinFlow),
            Err(ReportError::FilterInvalid("book_id"))
        );
        assert_eq!(
            kind.validate(ReportKind::GoalsProgress),
            Err(ReportError::FilterInvalid("type"))
        );
        assert_eq!(account_in_cat.validate(ReportKind::FinCat), Ok(()));
        assert_eq!(
            account_in_cat.validate(ReportKind::TasksDone),
            Err(ReportError::FilterInvalid("account_id"))
        );
    }

    #[test]
    fn filters_reject_unknown_type_and_goal_status() {
        assert_eq!(
            LibraryItemType::parse("music"),
            Err(ReportError::FilterInvalid("type"))
        );
        for value in ["book", "article", "video"] {
            assert!(LibraryItemType::parse(value).is_ok());
        }
        for value in ["planned", "in_progress", "completed", "abandoned"] {
            assert_eq!(GoalStatus::parse(value).unwrap().as_str(), value);
        }
        for value in ["active", "paused", "done", ""] {
            assert_eq!(
                GoalStatus::parse(value),
                Err(ReportError::FilterInvalid("goal_status"))
            );
        }
    }

    fn tx(
        kind: FlowKind,
        account: u128,
        category: Option<u128>,
        on: &str,
        settled_amount: i64,
        expected_amount: i64,
    ) -> FinanceTx {
        FinanceTx {
            kind,
            settled: true,
            account_id: id(account),
            category_id: category.map(id),
            settled_on: date(on),
            settled_amount,
            expected_amount,
        }
    }

    fn finance(transactions: Vec<FinanceTx>) -> FinanceData {
        FinanceData {
            currency: "BRL".to_owned(),
            accounts: vec![
                NamedRef {
                    id: id(1),
                    name: "Conta principal".to_owned(),
                },
                NamedRef {
                    id: id(2),
                    name: "Poupança".to_owned(),
                },
            ],
            categories: vec![
                NamedRef {
                    id: id(10),
                    name: "Mercado".to_owned(),
                },
                NamedRef {
                    id: id(11),
                    name: "Transporte".to_owned(),
                },
            ],
            transactions,
        }
    }

    #[test]
    fn fin_flow_sums_settled_income_and_expense_by_month_and_account() {
        let mut open = tx(FlowKind::Expense, 1, None, "2026-10-12", 9_999, 9_999);
        open.settled = false;
        let data = finance(vec![
            tx(FlowKind::Income, 1, None, "2026-09-05", 500_000, 500_000),
            tx(FlowKind::Expense, 1, Some(10), "2026-09-10", 20_000, 21_000),
            tx(FlowKind::Expense, 2, Some(11), "2026-10-02", 3_000, 3_000),
            tx(FlowKind::Income, 2, None, "2026-10-03", 1_000, 1_000),
            tx(FlowKind::Transfer, 1, None, "2026-10-04", 777_000, 777_000),
            tx(FlowKind::Income, 1, None, "2026-12-01", 42, 42),
            open,
        ]);

        let report = build_fin_flow(
            ctx("2026-09-01", "2026-10-31"),
            &ReportFilters::default(),
            &data,
        );

        assert_eq!(
            report.totals,
            FlowTotals {
                income: 501_000,
                expense: 23_000,
                net: 478_000
            }
        );
        assert_eq!(report.months.len(), 2);
        assert_eq!(report.months[0].month, "2026-09");
        assert_eq!(
            (report.months[0].income, report.months[0].expense),
            (500_000, 20_000)
        );
        assert_eq!(
            (report.months[1].income, report.months[1].expense),
            (1_000, 3_000)
        );
        assert_eq!(report.accounts.len(), 2);
        assert_eq!(report.accounts[0].name, "Conta principal");
        assert_eq!(
            (report.accounts[0].income, report.accounts[0].expense),
            (500_000, 20_000)
        );
        let filtered = ReportFilters {
            account_id: Some(id(2)),
            ..ReportFilters::default()
        };
        let one = build_fin_flow(ctx("2026-09-01", "2026-10-31"), &filtered, &data);
        assert_eq!(one.totals.income, 1_000);
        assert_eq!(one.filters[0].value, "Poupança");
    }

    #[test]
    fn fin_cat_sums_settled_expenses_by_category_with_account_and_category_filters() {
        let data = finance(vec![
            tx(FlowKind::Expense, 1, Some(10), "2026-10-02", 6_000, 6_000),
            tx(FlowKind::Expense, 2, Some(10), "2026-10-03", 2_000, 2_000),
            tx(FlowKind::Expense, 1, Some(11), "2026-10-04", 1_500, 1_500),
            tx(FlowKind::Expense, 1, None, "2026-10-05", 500, 500),
            tx(FlowKind::Income, 1, Some(10), "2026-10-06", 99_000, 99_000),
        ]);
        let all = ReportFilters::default();

        let report = build_fin_cat(ctx("2026-10-01", "2026-10-31"), &all, &data);
        let by_account = build_fin_cat(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters {
                account_id: Some(id(1)),
                ..all.clone()
            },
            &data,
        );
        let by_category = build_fin_cat(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters {
                category_id: Some(id(11)),
                ..all
            },
            &data,
        );

        assert_eq!(report.total_expense, 10_000);
        let names: Vec<(&str, i64, u8)> = report
            .categories
            .iter()
            .map(|c| (c.name.as_str(), c.amount, c.percent))
            .collect();
        assert_eq!(
            names,
            vec![
                ("Mercado", 8_000, 80),
                ("Transporte", 1_500, 15),
                ("Sem categoria", 500, 5)
            ]
        );
        assert_eq!(by_account.categories[0].amount, 6_000);
        assert_eq!(by_category.categories.len(), 1);
        assert_eq!(by_category.categories[0].name, "Transporte");
        assert_eq!(by_category.filters[0].value, "Transporte");
    }

    #[test]
    fn fin_diff_sums_savings_gains_and_losses() {
        let data = finance(vec![
            tx(FlowKind::Expense, 1, None, "2026-10-02", 145_000, 150_000),
            tx(FlowKind::Expense, 1, None, "2026-10-03", 12_500, 10_000),
            tx(FlowKind::Income, 1, None, "2026-11-01", 520_000, 500_000),
            tx(FlowKind::Income, 1, None, "2026-11-02", 90_000, 100_000),
            tx(FlowKind::Expense, 1, None, "2026-11-03", 8_000, 8_000),
            tx(FlowKind::Expense, 2, None, "2026-11-04", 1_000, 5_000),
        ]);

        let report = build_fin_diff(
            ctx("2026-10-01", "2026-11-30"),
            &ReportFilters::default(),
            &data,
        );
        let account = build_fin_diff(
            ctx("2026-10-01", "2026-11-30"),
            &ReportFilters {
                account_id: Some(id(1)),
                ..ReportFilters::default()
            },
            &data,
        );

        assert_eq!(
            report.totals,
            DiffTotals {
                savings: 9_000,
                gains: 20_000,
                losses: 12_500
            }
        );
        assert_eq!(account.totals.savings, 5_000);
        assert_eq!(report.months.len(), 2);
        assert_eq!(
            (report.months[0].savings, report.months[0].losses),
            (5_000, 2_500)
        );
        assert_eq!(
            (report.months[1].gains, report.months[1].losses),
            (20_000, 10_000)
        );
    }

    #[test]
    fn read_pages_sums_pages_in_period_by_book_and_caps_progress() {
        let data = ReadingData {
            books: vec![
                BookRef {
                    id: id(1),
                    title: "Dom Casmurro".to_owned(),
                    page_count: Some(200),
                },
                BookRef {
                    id: id(2),
                    title: "Sem total".to_owned(),
                    page_count: None,
                },
            ],
            sessions: vec![
                ReadingSessionItem {
                    book_id: id(1),
                    read_on: date("2026-10-01"),
                    pages_read: 150,
                },
                ReadingSessionItem {
                    book_id: id(1),
                    read_on: date("2026-10-02"),
                    pages_read: 120,
                },
                ReadingSessionItem {
                    book_id: id(1),
                    read_on: date("2026-12-02"),
                    pages_read: 999,
                },
                ReadingSessionItem {
                    book_id: id(2),
                    read_on: date("2026-10-05"),
                    pages_read: 30,
                },
            ],
        };

        let all = build_read_pages(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters::default(),
            &data,
        );
        let one = build_read_pages(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters {
                book_id: Some(id(2)),
                ..ReportFilters::default()
            },
            &data,
        );

        assert_eq!((all.total_pages, all.session_count), (300, 3));
        assert_eq!(all.books[0].title, "Dom Casmurro");
        assert_eq!(all.books[0].pages, 270);
        assert_eq!(all.books[0].progress_percent, Some(100));
        assert_eq!(all.books[1].progress_percent, None);
        assert_eq!(one.books.len(), 1);
        assert_eq!(one.filters[0].value, "Sem total");
    }

    fn statuses(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).to_owned()).collect()
    }

    #[test]
    fn lib_status_counts_books_articles_and_videos_per_status_with_type_filter() {
        let data = LibraryStatusData {
            books: statuses(&["want_to_read", "reading", "reading", "read"]),
            articles: statuses(&["to_read", "read"]),
            videos: statuses(&["watched"]),
        };

        let all = build_lib_status(date("2026-11-01"), &ReportFilters::default(), &data);
        let articles = build_lib_status(
            date("2026-11-01"),
            &ReportFilters {
                item_type: Some(LibraryItemType::Article),
                ..ReportFilters::default()
            },
            &data,
        );

        assert_eq!(all.groups.len(), 3);
        let counts = |group: &StatusGroup| -> Vec<(&str, u32)> {
            group.statuses.iter().map(|s| (s.status, s.count)).collect()
        };
        assert_eq!(
            counts(&all.groups[0]),
            vec![("want_to_read", 1), ("reading", 2), ("read", 1)]
        );
        assert_eq!(
            counts(&all.groups[1]),
            vec![("to_read", 1), ("reading", 0), ("read", 1)]
        );
        assert_eq!(
            counts(&all.groups[2]),
            vec![("to_watch", 0), ("watching", 0), ("watched", 1)]
        );
        assert_eq!(articles.groups.len(), 1);
        assert_eq!(articles.groups[0].item_type, LibraryItemType::Article);
        assert_eq!(articles.groups[0].total, 2);
        let empty = build_lib_status(
            date("2026-11-01"),
            &ReportFilters::default(),
            &LibraryStatusData::default(),
        );
        assert!(
            empty
                .groups
                .iter()
                .all(|g| g.total == 0 && g.statuses.len() == 3)
        );
    }

    fn mark(emotion: u128, name: &str, intensity: Option<u8>) -> JournalEmotionMark {
        JournalEmotionMark {
            emotion_id: id(emotion),
            name: name.to_owned(),
            intensity,
        }
    }

    #[test]
    fn journal_emo_counts_emotions_and_average_intensity_with_emotion_filter() {
        let items = vec![
            JournalItem {
                occurred_on: date("2026-10-01"),
                emotions: vec![mark(1, "Alegria", Some(4)), mark(2, "Calma", Some(2))],
            },
            JournalItem {
                occurred_on: date("2026-10-01"),
                emotions: vec![mark(1, "Alegria", Some(5))],
            },
            JournalItem {
                occurred_on: date("2026-10-09"),
                emotions: vec![mark(2, "Calma", None)],
            },
            JournalItem {
                occurred_on: date("2026-12-09"),
                emotions: vec![mark(1, "Alegria", Some(1))],
            },
        ];

        let all = build_journal_emo(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters::default(),
            &items,
        );
        let joy = build_journal_emo(
            ctx("2026-10-01", "2026-10-31"),
            &ReportFilters {
                emotion_id: Some(id(1)),
                ..ReportFilters::default()
            },
            &items,
        );

        assert_eq!(all.entry_count, 3);
        assert_eq!(all.days.len(), 2);
        assert_eq!(all.days[0].entries, 2);
        assert_eq!(all.emotions[0].name, "Alegria");
        assert_eq!(all.emotions[0].count, 2);
        assert_eq!(all.emotions[0].average_intensity, Some(4.5));
        assert_eq!(all.emotions[1].average_intensity, Some(2.0));
        assert_eq!(all.average_intensity, Some(3.7));
        assert_eq!(joy.entry_count, 2);
        assert_eq!(joy.emotions.len(), 1);
        assert_eq!(joy.filters[0].value, "Alegria");
    }

    fn goal(n: u128, title: &str, status: GoalStatus, progress: u8) -> GoalItem {
        GoalItem {
            id: id(n),
            title: title.to_owned(),
            status,
            deadline: None,
            progress_percent: progress,
            milestone_count: 4,
            completed_milestone_count: u32::from(progress) / 25,
        }
    }

    #[test]
    fn goals_progress_uses_milestone_progress_with_goal_and_status_filters() {
        let items = vec![
            goal(1, "Correr 10 km", GoalStatus::InProgress, 25),
            goal(2, "Ler 12 livros", GoalStatus::Completed, 100),
            goal(3, "Aprender violão", GoalStatus::Abandoned, 50),
            goal(4, "Viajar", GoalStatus::Planned, 0),
        ];
        let today = date("2026-11-01");

        let all = build_goals_progress(today, &ReportFilters::default(), &items);
        let abandoned = build_goals_progress(
            today,
            &ReportFilters {
                goal_status: Some(GoalStatus::Abandoned),
                ..ReportFilters::default()
            },
            &items,
        );
        let one = build_goals_progress(
            today,
            &ReportFilters {
                goal_id: Some(id(1)),
                ..ReportFilters::default()
            },
            &items,
        );

        let order: Vec<&str> = all.by_status.iter().map(|s| s.status.as_str()).collect();
        assert_eq!(
            order,
            vec!["planned", "in_progress", "completed", "abandoned"]
        );
        assert_eq!(
            all.by_status.iter().map(|s| s.count).collect::<Vec<_>>(),
            vec![1, 1, 1, 1]
        );
        assert_eq!(all.goals[0].progress_percent, 25);
        assert_eq!(abandoned.goals.len(), 1);
        assert_eq!(abandoned.goals[0].title, "Aprender violão");
        assert_eq!(abandoned.goals[0].progress_percent, 50);
        assert_eq!(
            abandoned
                .by_status
                .iter()
                .map(|s| s.count)
                .collect::<Vec<_>>(),
            vec![0, 0, 0, 1]
        );
        assert_eq!(one.goals.len(), 1);
        assert_eq!(one.filters[0].value, "Correr 10 km");
    }

    #[test]
    fn tasks_done_counts_one_off_done_and_open_tasks() {
        let today = date("2026-11-01");
        let items = vec![
            TaskItem {
                due_on: Some(date("2026-10-20")),
                completed: true,
            },
            TaskItem {
                due_on: None,
                completed: false,
            },
            TaskItem {
                due_on: Some(date("2026-10-31")),
                completed: false,
            },
            TaskItem {
                due_on: Some(date("2026-11-01")),
                completed: false,
            },
        ];

        let report = build_tasks_done(today, &items);

        assert_eq!((report.completed, report.open, report.overdue), (1, 3, 1));
    }

    #[test]
    fn tasks_done_leaves_recurring_tasks_out() {
        let report = build_tasks_done(date("2026-11-01"), &[]);
        let document = Report::TasksDone(report.clone()).document();

        assert_eq!((report.completed, report.open, report.overdue), (0, 0, 0));
        assert_eq!(report.recurring_notice, RECURRING_NOTICE);
        assert_eq!(document.notes, vec![RECURRING_NOTICE.to_owned()]);
    }

    #[test]
    fn proj_cards_counts_cards_per_lane_with_project_filter() {
        let lane = |n: u128, name: &str, cards: u32| LaneItem {
            id: id(n),
            name: name.to_owned(),
            color: "#6d28d9".to_owned(),
            card_count: cards,
        };
        let items = vec![
            ProjectItem {
                id: id(1),
                name: "Reforma".to_owned(),
                lanes: vec![
                    lane(11, "Aguardando", 3),
                    lane(12, "Em andamento", 1),
                    lane(13, "Concluído", 0),
                ],
            },
            ProjectItem {
                id: id(2),
                name: "Site".to_owned(),
                lanes: vec![lane(21, "Aguardando", 2)],
            },
        ];
        let today = date("2026-11-01");

        let all = build_proj_cards(today, &ReportFilters::default(), &items);
        let one = build_proj_cards(
            today,
            &ReportFilters {
                project_id: Some(id(2)),
                ..ReportFilters::default()
            },
            &items,
        );

        assert_eq!(all.projects.len(), 2);
        assert_eq!(all.projects[0].total_cards, 4);
        assert_eq!(all.projects[0].lanes[0].card_count, 3);
        assert_eq!(one.projects.len(), 1);
        assert_eq!(one.projects[0].name, "Site");
        assert_eq!(one.filters[0].value, "Site");
    }

    #[test]
    fn money_and_dates_use_brazilian_format() {
        assert_eq!(format_money(123_456, "BRL"), "R$ 1.234,56");
        assert_eq!(format_money(-5, "BRL"), "-R$ 0,05");
        assert_eq!(format_money(100_000_000, "USD"), "USD 1.000.000,00");
        assert_eq!(format_date(date("2026-03-05")), "05/03/2026");
        assert_eq!(format_month("2026-10"), "10/2026");
    }
}
