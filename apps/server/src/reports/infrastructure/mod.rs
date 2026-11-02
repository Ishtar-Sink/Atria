//! Adaptadores das portas dos relatórios e da exportação: cada um chama os serviços
//! de aplicação dos outros contextos, nunca as tabelas deles ([project/architecture-04]).
//! O contexto `reports` não escreve SQL.

pub mod export;
pub mod html;
pub mod palette;
pub mod pdf;

use std::collections::HashSet;
use std::future::Future;
use std::sync::Arc;

use chrono::NaiveDate;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::auth::application::AuthService;
use crate::auth::infrastructure::argon2_hasher::Argon2Hasher;
use crate::auth::infrastructure::smtp_mail_sender::SmtpMailSender;
use crate::finance::application::ports::{
    Repetition, TransactionFilter, TransferFilter, TransferRepository,
};
use crate::finance::application::summaries::{SummaryRequest, SummarySources};
use crate::finance::application::{Env, SCAN_PAGE, accounts, categories, summaries, transactions};
use crate::finance::domain::transaction::TransactionKind;
use crate::finance::infrastructure::pg_accounts::PgAccounts;
use crate::finance::infrastructure::pg_categories::PgCategories;
use crate::finance::infrastructure::pg_payroll_loans::PgPayrollLoans;
use crate::finance::infrastructure::pg_recurring_transactions::PgRecurringTransactions;
use crate::finance::infrastructure::pg_transactions::PgTransactions;
use crate::finance::infrastructure::pg_transfers::PgTransfers;
use crate::goals::application::goals::{GoalFilter, GoalsService};
use crate::goals::application::ports::GoalSort;
use crate::goals::domain::goal::GoalStatus as GoalsGoalStatus;
use crate::goals::infrastructure::pg_goals::PgGoalRepository;
use crate::http::AppState;
use crate::journal::application::entries::JournalReader;
use crate::journal::domain::emotion::SystemEmotion;
use crate::journal::infrastructure::pg_journal_entry_repository::PgJournalEntryRepository;
use crate::library::application::ListQuery;
use crate::library::domain::ItemRef;
use crate::library::interface::{
    article_service, book_service, file_service, item_ops, video_service,
};
use crate::links::application::service::{LinkService, ListLinks};
use crate::links::domain::link::{EntityRef, EntityType};
use crate::links::infrastructure::pg_link_repository::PgLinkRepository;
use crate::notes::application::service::NoteReader;
use crate::notes::infrastructure::pg_note_repository::PgNoteRepository;
use crate::projects::application::service::{ProjectFilter, ProjectService};
use crate::projects::domain::lane::SystemLane;
use crate::projects::infrastructure::pg_project_repository::PgProjectRepository;
use crate::reminders::application::ports::ReminderRepository;
use crate::reminders::domain::reminder::Schedule;
use crate::reminders::infrastructure::pg_reminders::PgReminderRepository;
use crate::reports::application::{
    ExportEntity, ExportService, ExportSource, ExportTable, FinanceQuery, ReportDataSource,
    ReportService, SourceFuture,
};
use crate::reports::domain::{
    BookRef, DataModule, FinanceData, FinanceTx, FlowKind, GoalItem, GoalStatus,
    JournalEmotionMark, JournalItem, LaneItem, LibraryStatusData, NamedRef, Period, ProjectItem,
    ReadingData, ReadingSessionItem, ReportError, TaskItem,
};
use crate::shared::pagination::Cursor;
use crate::tasks::application::ports::TaskFilter;
use crate::tasks::application::tasks::TasksService;
use crate::tasks::infrastructure::PgTasksRepository;

/// Escala das listagens: o limite máximo das páginas dos outros contextos.
const PAGE: u32 = 100;

fn source_error(error: impl std::fmt::Display) -> ReportError {
    ReportError::Source(error.to_string())
}

/// Percorre uma listagem paginada por cursor até o fim.
async fn collect_pages<T, F, Fut>(mut fetch: F) -> Result<Vec<T>, ReportError>
where
    F: FnMut(Option<Cursor>) -> Fut,
    Fut: Future<Output = Result<(Vec<T>, Option<Cursor>), ReportError>>,
{
    let mut all = Vec::new();
    let mut cursor = None;
    loop {
        let (items, next) = fetch(cursor).await?;
        all.extend(items);
        match next {
            Some(next) => cursor = Some(next),
            None => return Ok(all),
        }
    }
}

fn decode_cursor(text: Option<String>) -> Result<Option<Cursor>, ReportError> {
    text.map(|text| Cursor::decode(&text).map_err(source_error))
        .transpose()
}

fn to_goals_status(status: GoalStatus) -> GoalsGoalStatus {
    match status {
        GoalStatus::Planned => GoalsGoalStatus::Planned,
        GoalStatus::InProgress => GoalsGoalStatus::InProgress,
        GoalStatus::Completed => GoalsGoalStatus::Completed,
        GoalStatus::Abandoned => GoalsGoalStatus::Abandoned,
    }
}

fn from_goals_status(status: GoalsGoalStatus) -> GoalStatus {
    match status {
        GoalsGoalStatus::Planned => GoalStatus::Planned,
        GoalsGoalStatus::InProgress => GoalStatus::InProgress,
        GoalsGoalStatus::Completed => GoalStatus::Completed,
        GoalsGoalStatus::Abandoned => GoalStatus::Abandoned,
    }
}

fn system_emotion_label(emotion: SystemEmotion) -> &'static str {
    match emotion {
        SystemEmotion::Joy => "Alegria",
        SystemEmotion::Sadness => "Tristeza",
        SystemEmotion::Anger => "Raiva",
        SystemEmotion::Fear => "Medo",
        SystemEmotion::Anxiety => "Ansiedade",
        SystemEmotion::Calm => "Calma",
        SystemEmotion::Gratitude => "Gratidão",
    }
}

fn system_lane_label(lane: SystemLane) -> &'static str {
    match lane {
        SystemLane::Waiting => "Aguardando",
        SystemLane::InProgress => "Em andamento",
        SystemLane::Done => "Concluído",
    }
}

// ---------------------------------------------------------------------------
// Leitura dos dados dos relatórios
// ---------------------------------------------------------------------------

/// Fonte dos relatórios sobre o estado da aplicação.
pub struct StateReportSource {
    state: AppState,
}

impl StateReportSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn finance_env(state: &AppState) -> Env<'_> {
        Env {
            clock: state.clock.as_ref(),
            ids: state.ids.as_ref(),
        }
    }

    /// A data efetiva da primeira movimentação gravada: o `period.from` do resumo do
    /// Financeiro pedido sem `from` (DEC-004).
    async fn finance_first_record(
        state: &AppState,
        owner_id: Uuid,
    ) -> Result<Option<NaiveDate>, ReportError> {
        let accounts_repo = PgAccounts::new(state.pool.clone());
        let categories_repo = PgCategories::new(state.pool.clone());
        let transactions_repo = PgTransactions::new(state.pool.clone());
        let transfers_repo = PgTransfers::new(state.pool.clone());
        let recurring_repo = PgRecurringTransactions::new(state.pool.clone());
        let summary = summaries::period(
            SummarySources {
                accounts: &accounts_repo,
                categories: &categories_repo,
                transactions: &transactions_repo,
                transfers: &transfers_repo,
                recurring: &recurring_repo,
                loans: &PgPayrollLoans::new(state.pool.clone()),
            },
            Self::finance_env(state),
            owner_id,
            SummaryRequest::default(),
        )
        .await
        .map_err(source_error)?;
        Ok(Some(summary.period.from))
    }

    async fn finance_data(
        state: &AppState,
        owner_id: Uuid,
        query: FinanceQuery,
    ) -> Result<FinanceData, ReportError> {
        let accounts_repo = PgAccounts::new(state.pool.clone());
        let categories_repo = PgCategories::new(state.pool.clone());
        let transactions_repo = PgTransactions::new(state.pool.clone());
        let account_list = accounts::list_all(&accounts_repo, Self::finance_env(state), owner_id)
            .await
            .map_err(source_error)?;
        let category_list = categories::list_all(&categories_repo, owner_id)
            .await
            .map_err(source_error)?;
        // `q` fica sempre ausente: a busca por texto recortaria os totais (DEC-005). As
        // transferências moram à parte e a listagem nunca as devolve (RN-05).
        let filter = TransactionFilter {
            account_id: query.account_id,
            category_id: query.category_id,
            from: Some(query.period.from),
            to: Some(query.period.to),
            settled: Some(true),
            repetition: Repetition::All,
            ..TransactionFilter::default()
        };
        let stored = transactions::list_all(&transactions_repo, owner_id, &filter)
            .await
            .map_err(source_error)?;
        let transactions = stored
            .into_iter()
            .filter_map(|item| {
                // Só as liquidadas entram; um item sem liquidação é descartado.
                let settlement = item.settlement?;
                Some(FinanceTx {
                    kind: match item.kind {
                        TransactionKind::Income => FlowKind::Income,
                        TransactionKind::Expense => FlowKind::Expense,
                    },
                    settled: true,
                    account_id: item.account_id,
                    category_id: item.category_id,
                    settled_on: settlement.settled_at,
                    settled_amount: settlement.settled_amount,
                    expected_amount: item.expected_amount,
                })
            })
            .collect();
        Ok(FinanceData {
            currency: account_list
                .first()
                .map_or_else(|| "BRL".to_owned(), |account| account.currency.to_string()),
            accounts: account_list
                .into_iter()
                .map(|account| NamedRef {
                    id: account.id,
                    name: account.name,
                })
                .collect(),
            categories: category_list
                .into_iter()
                .map(|category| NamedRef {
                    id: category.id,
                    name: category.name,
                })
                .collect(),
            transactions,
        })
    }

    async fn reading_data(state: &AppState, owner_id: Uuid) -> Result<ReadingData, ReportError> {
        let service = book_service(state);
        let books = collect_pages(|cursor| {
            let service = &service;
            async move {
                let page = service
                    .list(
                        owner_id,
                        ListQuery {
                            cursor,
                            limit: PAGE,
                            ..ListQuery::default()
                        },
                    )
                    .await
                    .map_err(source_error)?;
                Ok((page.items, page.next_cursor))
            }
        })
        .await?;
        let mut sessions = Vec::new();
        for book in &books {
            let list = service
                .list_sessions(owner_id, book.id)
                .await
                .map_err(source_error)?;
            sessions.extend(list.into_iter().map(|session| ReadingSessionItem {
                book_id: session.book_id,
                read_on: session.read_on,
                pages_read: i64::from(session.pages_read),
            }));
        }
        Ok(ReadingData {
            books: books
                .into_iter()
                .map(|book| BookRef {
                    id: book.id,
                    title: book.title,
                    page_count: book.page_count,
                })
                .collect(),
            sessions,
        })
    }

    async fn library_status(
        state: &AppState,
        owner_id: Uuid,
    ) -> Result<LibraryStatusData, ReportError> {
        let books = book_service(state);
        let articles = article_service(state);
        let videos = video_service(state, None);
        let book_status = collect_pages(|cursor| {
            let service = &books;
            async move {
                let page = service
                    .list(owner_id, list_query(cursor))
                    .await
                    .map_err(source_error)?;
                let statuses = page
                    .items
                    .iter()
                    .map(|book| book.reading_status.as_str().to_owned())
                    .collect();
                Ok((statuses, page.next_cursor))
            }
        })
        .await?;
        let article_status = collect_pages(|cursor| {
            let service = &articles;
            async move {
                let page = service
                    .list(owner_id, list_query(cursor))
                    .await
                    .map_err(source_error)?;
                let statuses = page
                    .items
                    .iter()
                    .map(|article| article.reading_status.as_str().to_owned())
                    .collect();
                Ok((statuses, page.next_cursor))
            }
        })
        .await?;
        let video_status = collect_pages(|cursor| {
            let service = &videos;
            async move {
                let page = service
                    .list(owner_id, list_query(cursor))
                    .await
                    .map_err(source_error)?;
                let statuses = page
                    .items
                    .iter()
                    .map(|video| video.watch_status.as_str().to_owned())
                    .collect();
                Ok((statuses, page.next_cursor))
            }
        })
        .await?;
        Ok(LibraryStatusData {
            books: book_status,
            articles: article_status,
            videos: video_status,
        })
    }

    async fn journal_items(
        state: &AppState,
        owner_id: Uuid,
    ) -> Result<Vec<JournalItem>, ReportError> {
        let reader = JournalReader::new(PgJournalEntryRepository::new(
            state.pool.clone(),
            state.cipher.clone(),
        ));
        // O texto das entradas chega em claro só até aqui: o item do relatório não o leva.
        let entries = reader
            .decrypted_entries_for_owner(owner_id)
            .await
            .map_err(source_error)?;
        Ok(entries
            .into_iter()
            .map(|entry| JournalItem {
                occurred_on: entry.occurred_at.date_naive(),
                emotions: entry
                    .emotions
                    .into_iter()
                    .map(|mark| JournalEmotionMark {
                        emotion_id: mark.emotion_id,
                        name: mark
                            .name
                            .or_else(|| {
                                mark.system_key
                                    .map(|key| system_emotion_label(key).to_owned())
                            })
                            .unwrap_or_else(|| "Emoção".to_owned()),
                        intensity: mark.intensity,
                    })
                    .collect(),
            })
            .collect())
    }

    async fn goal_items(
        state: &AppState,
        owner_id: Uuid,
        status: Option<GoalStatus>,
    ) -> Result<Vec<GoalItem>, ReportError> {
        let service = goals_service(state);
        let views = collect_pages(|cursor| {
            let service = &service;
            async move {
                let page = service
                    .list_goals(
                        owner_id,
                        GoalFilter {
                            status: status.map(to_goals_status),
                            sort: GoalSort::CreatedAt,
                            cursor,
                            limit: PAGE,
                            ..GoalFilter::default()
                        },
                    )
                    .await
                    .map_err(source_error)?;
                Ok((page.items, decode_cursor(page.next_cursor)?))
            }
        })
        .await?;
        // O progresso é o que o contexto de metas devolve; nunca é recalculado aqui (RN-15).
        Ok(views
            .into_iter()
            .map(|view| GoalItem {
                progress_percent: view.progress_percent(),
                milestone_count: view.milestone_count,
                completed_milestone_count: view.completed_milestone_count,
                id: view.goal.id,
                title: view.goal.title,
                status: from_goals_status(view.goal.status),
                deadline: view.goal.deadline,
            })
            .collect())
    }

    async fn task_items(state: &AppState, owner_id: Uuid) -> Result<Vec<TaskItem>, ReportError> {
        let service = tasks_service(state);
        let mut items = Vec::new();
        let mut after = None;
        loop {
            // As recorrentes nem são lidas: não guardam histórico.
            let page = service
                .list(
                    owner_id,
                    TaskFilter {
                        recurring: Some(false),
                        after,
                        limit: PAGE,
                        ..TaskFilter::default()
                    },
                )
                .await
                .map_err(source_error)?;
            items.extend(page.items.into_iter().map(|view| TaskItem {
                due_on: view.task.due_on,
                completed: view.task.completed_at.is_some(),
            }));
            match page.next {
                Some(next) => after = Some(next),
                None => return Ok(items),
            }
        }
    }

    async fn project_items(
        state: &AppState,
        owner_id: Uuid,
    ) -> Result<Vec<ProjectItem>, ReportError> {
        let service = projects_service(state);
        let listed = collect_pages(|cursor| {
            let service = &service;
            async move {
                let page = service
                    .list_projects(
                        owner_id,
                        ProjectFilter {
                            cursor,
                            limit: PAGE,
                            ..ProjectFilter::default()
                        },
                    )
                    .await
                    .map_err(source_error)?;
                Ok((page.items, decode_cursor(page.next_cursor)?))
            }
        })
        .await?;
        let mut items = Vec::with_capacity(listed.len());
        for entry in listed {
            let project = service
                .get_project(owner_id, entry.project.id)
                .await
                .map_err(source_error)?;
            let lanes = project
                .lanes
                .iter()
                .map(|lane| LaneItem {
                    id: lane.id,
                    name: lane
                        .name
                        .clone()
                        .or_else(|| lane.system_key.map(|key| system_lane_label(key).to_owned()))
                        .unwrap_or_else(|| "Raia".to_owned()),
                    color: lane.color.as_str().to_owned(),
                    card_count: u32::try_from(project.cards_in(lane.id).len()).unwrap_or(u32::MAX),
                })
                .collect();
            items.push(ProjectItem {
                id: project.id,
                name: project.name,
                lanes,
            });
        }
        Ok(items)
    }
}

fn list_query(cursor: Option<Cursor>) -> ListQuery {
    ListQuery {
        cursor,
        limit: PAGE,
        ..ListQuery::default()
    }
}

fn goals_service(state: &AppState) -> GoalsService<PgGoalRepository> {
    GoalsService {
        repo: PgGoalRepository::new(state.pool.clone()),
        clock: state.clock.clone(),
        ids: state.ids.clone(),
    }
}

fn tasks_service(state: &AppState) -> TasksService<PgTasksRepository> {
    TasksService::new(
        PgTasksRepository::new(state.pool.clone(), state.ids.clone()),
        state.clock.clone(),
        state.ids.clone(),
    )
}

fn projects_service(state: &AppState) -> ProjectService<PgProjectRepository> {
    ProjectService {
        repo: PgProjectRepository::new(state.pool.clone()),
        clock: state.clock.clone(),
        ids: state.ids.clone(),
    }
}

impl ReportDataSource for StateReportSource {
    fn first_record_date(
        &self,
        owner_id: Uuid,
        module: DataModule,
    ) -> SourceFuture<'_, Option<NaiveDate>> {
        let state = self.state.clone();
        Box::pin(async move {
            match module {
                DataModule::Finance => Self::finance_first_record(&state, owner_id).await,
                DataModule::Library => {
                    let data = Self::reading_data(&state, owner_id).await?;
                    Ok(data.sessions.iter().map(|session| session.read_on).min())
                }
                DataModule::Journal => {
                    let items = Self::journal_items(&state, owner_id).await?;
                    Ok(items.iter().map(|entry| entry.occurred_on).min())
                }
            }
        })
    }

    fn finance(&self, owner_id: Uuid, query: FinanceQuery) -> SourceFuture<'_, FinanceData> {
        let state = self.state.clone();
        Box::pin(async move { Self::finance_data(&state, owner_id, query).await })
    }

    fn reading(&self, owner_id: Uuid, _period: Period) -> SourceFuture<'_, ReadingData> {
        let state = self.state.clone();
        Box::pin(async move { Self::reading_data(&state, owner_id).await })
    }

    fn library_status(&self, owner_id: Uuid) -> SourceFuture<'_, LibraryStatusData> {
        let state = self.state.clone();
        Box::pin(async move { Self::library_status(&state, owner_id).await })
    }

    fn journal(&self, owner_id: Uuid, _period: Period) -> SourceFuture<'_, Vec<JournalItem>> {
        let state = self.state.clone();
        Box::pin(async move { Self::journal_items(&state, owner_id).await })
    }

    fn goals(&self, owner_id: Uuid, status: Option<GoalStatus>) -> SourceFuture<'_, Vec<GoalItem>> {
        let state = self.state.clone();
        Box::pin(async move { Self::goal_items(&state, owner_id, status).await })
    }

    fn tasks(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<TaskItem>> {
        let state = self.state.clone();
        Box::pin(async move { Self::task_items(&state, owner_id).await })
    }

    fn projects(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ProjectItem>> {
        let state = self.state.clone();
        Box::pin(async move { Self::project_items(&state, owner_id).await })
    }
}

/// Serviço de relatórios montado a partir do estado da aplicação.
pub fn report_service(state: &AppState) -> ReportService {
    ReportService::new(
        Arc::new(StateReportSource::new(state.clone())),
        state.clock.clone(),
    )
}

// ---------------------------------------------------------------------------
// Exportação: uma fonte por contexto
// ---------------------------------------------------------------------------

/// Serviço de exportação com as dez fontes, as ligações por último.
pub fn export_service(state: &AppState) -> ExportService {
    let sources: Vec<Arc<dyn ExportSource>> = vec![
        Arc::new(AuthExport(state.clone())),
        Arc::new(FinanceExport(state.clone())),
        Arc::new(GoalsExport(state.clone())),
        Arc::new(TasksExport(state.clone())),
        Arc::new(RemindersExport(state.clone())),
        Arc::new(NotesExport(state.clone())),
        Arc::new(JournalExport(state.clone())),
        Arc::new(LibraryExport(state.clone())),
        Arc::new(ProjectsExport(state.clone())),
        Arc::new(LinksExport(state.clone())),
    ];
    ExportService::new(sources, state.clock.clone())
}

struct AuthExport(AppState);
struct FinanceExport(AppState);
struct GoalsExport(AppState);
struct TasksExport(AppState);
struct RemindersExport(AppState);
struct NotesExport(AppState);
struct JournalExport(AppState);
struct LibraryExport(AppState);
struct ProjectsExport(AppState);
struct LinksExport(AppState);

impl ExportSource for AuthExport {
    fn context(&self) -> &'static str {
        "auth"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let service = AuthService {
                pool: state.pool.clone(),
                clock: state.clock.clone(),
                ids: state.ids.clone(),
                cipher: state.cipher.clone(),
                config: state.config.clone(),
                hasher: Arc::new(Argon2Hasher::new()),
                mailer: Arc::new(SmtpMailSender),
            };
            // Sem hash de senha, segredo TOTP nem sessões.
            let user = service.active_user(owner_id).await.map_err(source_error)?;
            let preferences = service.preferences(owner_id).await.map_err(source_error)?;
            let mut profile = ExportTable::new(
                "profile",
                &[
                    "id",
                    "email",
                    "role",
                    "is_active",
                    "totp_enabled",
                    "created_at",
                ],
            );
            profile.rows.push(vec![
                json!(user.id),
                json!(user.email),
                json!(user.role.as_str()),
                json!(user.is_active),
                json!(user.totp_enabled()),
                json!(user.created_at),
            ]);
            let mut prefs = ExportTable::new(
                "preferences",
                &[
                    "theme",
                    "locale",
                    "timezone",
                    "currency",
                    "palette_shortcut",
                    "search_contexts",
                ],
            );
            prefs.rows.push(vec![
                json!(preferences.theme),
                json!(preferences.locale),
                json!(preferences.timezone),
                json!(preferences.currency),
                json!(preferences.palette_shortcut),
                json!(preferences.search_contexts),
            ]);
            Ok(vec![profile, prefs])
        })
    }
}

impl ExportSource for FinanceExport {
    fn context(&self) -> &'static str {
        "finance"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let accounts_repo = PgAccounts::new(state.pool.clone());
            let categories_repo = PgCategories::new(state.pool.clone());
            let transactions_repo = PgTransactions::new(state.pool.clone());
            let recurring_repo = PgRecurringTransactions::new(state.pool.clone());
            let transfers_repo = PgTransfers::new(state.pool.clone());
            let env = StateReportSource::finance_env(&state);

            let mut accounts_table = ExportTable::new(
                "accounts",
                &[
                    "id",
                    "name",
                    "is_default",
                    "balance_amount",
                    "currency",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("account");
            for account in accounts::list_all(&accounts_repo, env, owner_id)
                .await
                .map_err(source_error)?
            {
                accounts_table.rows.push(vec![
                    json!(account.id),
                    json!(account.name),
                    json!(account.is_default),
                    json!(account.balance_amount),
                    json!(account.currency),
                    json!(account.visibility),
                    json!(account.created_at),
                    json!(account.updated_at),
                ]);
            }

            let mut categories_table = ExportTable::new(
                "categories",
                &["id", "name", "kind", "color", "visibility", "created_at"],
            );
            for category in categories::list_all(&categories_repo, owner_id)
                .await
                .map_err(source_error)?
            {
                categories_table.rows.push(vec![
                    json!(category.id),
                    json!(category.name),
                    json!(category.kind.as_str()),
                    json!(category.color.as_str()),
                    json!(category.visibility),
                    json!(category.created_at),
                ]);
            }

            let mut transactions_table = ExportTable::new(
                "transactions",
                &[
                    "id",
                    "kind",
                    "account_id",
                    "category_id",
                    "description",
                    "expected_amount",
                    "expected_date",
                    "settled_amount",
                    "settled_at",
                    "difference_amount",
                    "currency",
                    "generated_from",
                    "occurrence_date",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("transaction");
            let all =
                transactions::list_all(&transactions_repo, owner_id, &TransactionFilter::default())
                    .await
                    .map_err(source_error)?;
            for item in all {
                transactions_table.rows.push(vec![
                    json!(item.id),
                    json!(item.kind.as_str()),
                    json!(item.account_id),
                    json!(item.category_id),
                    json!(item.description),
                    json!(item.expected_amount),
                    json!(item.expected_date),
                    json!(item.settlement.map(|s| s.settled_amount)),
                    json!(item.settlement.map(|s| s.settled_at)),
                    json!(item.settlement.map(|s| s.difference_amount)),
                    json!(item.currency),
                    json!(item.generated_from),
                    json!(item.occurrence_date),
                    json!(item.visibility),
                    json!(item.created_at),
                    json!(item.updated_at),
                ]);
            }

            let mut recurring_table = ExportTable::new(
                "recurring_transactions",
                &[
                    "id",
                    "kind",
                    "account_id",
                    "category_id",
                    "expected_amount",
                    "currency",
                    "rule",
                    "description",
                    "last_closed_on",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            );
            for item in transactions::list_all_recurring(&recurring_repo, owner_id)
                .await
                .map_err(source_error)?
            {
                recurring_table.rows.push(vec![
                    json!(item.id),
                    json!(item.kind.as_str()),
                    json!(item.account_id),
                    json!(item.category_id),
                    json!(item.expected_amount),
                    json!(item.currency),
                    json!(item.rule),
                    json!(item.description),
                    json!(item.last_closed_on),
                    json!(item.visibility),
                    json!(item.created_at),
                    json!(item.updated_at),
                ]);
            }

            let mut transfers_table = ExportTable::new(
                "transfers",
                &[
                    "id",
                    "from_account_id",
                    "to_account_id",
                    "amount",
                    "currency",
                    "transferred_on",
                    "description",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("transfer");
            let mut after = None;
            loop {
                let page = transfers_repo
                    .list(owner_id, &TransferFilter::default(), after, SCAN_PAGE)
                    .await
                    .map_err(source_error)?;
                let done = page.len() < SCAN_PAGE as usize;
                after = page.last().map(|transfer| transfer.id);
                for transfer in page {
                    transfers_table.rows.push(vec![
                        json!(transfer.id),
                        json!(transfer.from_account_id),
                        json!(transfer.to_account_id),
                        json!(transfer.amount),
                        json!(transfer.currency),
                        json!(transfer.transferred_on),
                        json!(transfer.description),
                        json!(transfer.visibility),
                        json!(transfer.created_at),
                        json!(transfer.updated_at),
                    ]);
                }
                if done {
                    break;
                }
            }
            Ok(vec![
                accounts_table,
                categories_table,
                transactions_table,
                recurring_table,
                transfers_table,
            ])
        })
    }
}

impl ExportSource for GoalsExport {
    fn context(&self) -> &'static str {
        "goals"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let service = goals_service(&state);
            let views = collect_pages(|cursor| {
                let service = &service;
                async move {
                    let page = service
                        .list_goals(
                            owner_id,
                            GoalFilter {
                                cursor,
                                limit: PAGE,
                                ..GoalFilter::default()
                            },
                        )
                        .await
                        .map_err(source_error)?;
                    Ok((page.items, decode_cursor(page.next_cursor)?))
                }
            })
            .await?;
            let mut goals_table = ExportTable::new(
                "goals",
                &[
                    "id",
                    "title",
                    "description",
                    "deadline",
                    "status",
                    "labels",
                    "progress_percent",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("goal");
            let mut milestones_table = ExportTable::new(
                "milestones",
                &[
                    "id",
                    "goal_id",
                    "title",
                    "position",
                    "completed_at",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("milestone");
            for view in views {
                goals_table.rows.push(vec![
                    json!(view.goal.id),
                    json!(view.goal.title),
                    json!(view.goal.description),
                    json!(view.goal.deadline),
                    json!(view.goal.status),
                    json!(view.goal.labels),
                    json!(view.progress_percent()),
                    json!(view.goal.visibility),
                    json!(view.goal.created_at),
                    json!(view.goal.updated_at),
                ]);
                for milestone in service
                    .list_milestones(owner_id, view.goal.id)
                    .await
                    .map_err(source_error)?
                {
                    milestones_table.rows.push(vec![
                        json!(milestone.id),
                        json!(milestone.goal_id),
                        json!(milestone.title),
                        json!(milestone.position),
                        json!(milestone.completed_at),
                        json!(milestone.visibility),
                        json!(milestone.created_at),
                        json!(milestone.updated_at),
                    ]);
                }
            }
            Ok(vec![goals_table, milestones_table])
        })
    }
}

impl ExportSource for TasksExport {
    fn context(&self) -> &'static str {
        "tasks"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let service = tasks_service(&state);
            let mut table = ExportTable::new(
                "tasks",
                &[
                    "id",
                    "title",
                    "description",
                    "due_on",
                    "is_recurring",
                    "recurrence",
                    "completed_at",
                    "labels",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("task");
            let mut after = None;
            loop {
                let page = service
                    .list(
                        owner_id,
                        TaskFilter {
                            after,
                            limit: PAGE,
                            ..TaskFilter::default()
                        },
                    )
                    .await
                    .map_err(source_error)?;
                for view in page.items {
                    table.rows.push(vec![
                        json!(view.task.id),
                        json!(view.task.title),
                        json!(view.task.description),
                        json!(view.task.due_on),
                        json!(view.task.is_recurring),
                        json!(view.recurrence),
                        json!(view.task.completed_at),
                        json!(view.task.labels),
                        json!(view.task.visibility),
                        json!(view.task.created_at),
                        json!(view.task.updated_at),
                    ]);
                }
                match page.next {
                    Some(next) => after = Some(next),
                    None => break,
                }
            }
            Ok(vec![table])
        })
    }
}

impl ExportSource for RemindersExport {
    fn context(&self) -> &'static str {
        "reminders"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let repository = PgReminderRepository::new(state.pool.clone());
            let reminders = repository.all_live(owner_id).await.map_err(source_error)?;
            let mut table = ExportTable::new(
                "reminders",
                &[
                    "id",
                    "title",
                    "notes",
                    "timezone",
                    "kind",
                    "remind_at",
                    "recurrence",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("reminder");
            for reminder in reminders {
                let (kind, remind_at, rule) = match &reminder.schedule {
                    Schedule::OneOff { remind_at } => ("one_off", json!(remind_at), Value::Null),
                    Schedule::Recurring { rule } => ("recurring", Value::Null, json!(rule)),
                };
                table.rows.push(vec![
                    json!(reminder.id),
                    json!(reminder.title),
                    json!(reminder.notes),
                    json!(reminder.timezone),
                    json!(kind),
                    remind_at,
                    rule,
                    json!(reminder.visibility),
                    json!(reminder.created_at),
                    json!(reminder.updated_at),
                ]);
            }
            Ok(vec![table])
        })
    }
}

impl ExportSource for NotesExport {
    fn context(&self) -> &'static str {
        "notes"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            // O texto sai em claro só para o dono (RNF-02); nada vai para log.
            let reader = NoteReader::new(PgNoteRepository::new(
                state.pool.clone(),
                state.cipher.clone(),
            ));
            let notes = reader
                .decrypted_notes_for_owner(owner_id)
                .await
                .map_err(source_error)?;
            let mut table = ExportTable::new(
                "notes",
                &[
                    "id",
                    "title",
                    "body",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("note");
            for note in notes {
                table.rows.push(vec![
                    json!(note.id),
                    json!(note.title),
                    json!(note.body),
                    json!(note.visibility),
                    json!(note.created_at),
                    json!(note.updated_at),
                ]);
            }
            Ok(vec![table])
        })
    }
}

impl ExportSource for JournalExport {
    fn context(&self) -> &'static str {
        "journal"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            // O texto sai em claro só para o dono (RNF-02); nada vai para log.
            let reader = JournalReader::new(PgJournalEntryRepository::new(
                state.pool.clone(),
                state.cipher.clone(),
            ));
            let entries = reader
                .decrypted_entries_for_owner(owner_id)
                .await
                .map_err(source_error)?;
            let mut entries_table = ExportTable::new(
                "entries",
                &[
                    "id",
                    "occurred_at",
                    "text",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("journal_entry");
            let mut emotions_table = ExportTable::new(
                "entry_emotions",
                &["entry_id", "emotion_id", "system_key", "name", "intensity"],
            );
            for entry in entries {
                entries_table.rows.push(vec![
                    json!(entry.id),
                    json!(entry.occurred_at),
                    json!(entry.text),
                    json!(entry.visibility),
                    json!(entry.created_at),
                    json!(entry.updated_at),
                ]);
                for mark in entry.emotions {
                    emotions_table.rows.push(vec![
                        json!(entry.id),
                        json!(mark.emotion_id),
                        json!(mark.system_key.map(SystemEmotion::key)),
                        json!(mark.name),
                        json!(mark.intensity),
                    ]);
                }
            }
            Ok(vec![entries_table, emotions_table])
        })
    }
}

impl ExportSource for LibraryExport {
    fn context(&self) -> &'static str {
        "library"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move { library_tables(&state, owner_id).await })
    }
}

async fn library_tables(state: &AppState, owner_id: Uuid) -> Result<Vec<ExportTable>, ReportError> {
    let books_service = book_service(state);
    let articles_service = article_service(state);
    let videos_service = video_service(state, None);
    let ops = item_ops(state);
    let files = file_service(state);

    let books = collect_pages(|cursor| {
        let service = &books_service;
        async move {
            let page = service
                .list(owner_id, list_query(cursor))
                .await
                .map_err(source_error)?;
            Ok((page.items, page.next_cursor))
        }
    })
    .await?;
    let articles = collect_pages(|cursor| {
        let service = &articles_service;
        async move {
            let page = service
                .list(owner_id, list_query(cursor))
                .await
                .map_err(source_error)?;
            Ok((page.items, page.next_cursor))
        }
    })
    .await?;
    let videos = collect_pages(|cursor| {
        let service = &videos_service;
        async move {
            let page = service
                .list(owner_id, list_query(cursor))
                .await
                .map_err(source_error)?;
            Ok((page.items, page.next_cursor))
        }
    })
    .await?;

    let mut books_table = ExportTable::new(
        "books",
        &[
            "id",
            "title",
            "author",
            "publisher",
            "page_count",
            "tags",
            "reading_status",
            "cover_file_id",
            "pdf_file_id",
            "pages_read_total",
            "visibility",
            "created_at",
            "updated_at",
        ],
    )
    .linked_as("book");
    let mut sessions_table = ExportTable::new(
        "reading_sessions",
        &[
            "id",
            "book_id",
            "read_on",
            "pages_read",
            "from_page",
            "to_page",
            "observation",
            "created_at",
        ],
    );
    let mut articles_table = ExportTable::new(
        "articles",
        &[
            "id",
            "title",
            "url",
            "author",
            "source",
            "tags",
            "reading_status",
            "cover_file_id",
            "pdf_file_id",
            "visibility",
            "created_at",
            "updated_at",
        ],
    )
    .linked_as("article");
    let mut videos_table = ExportTable::new(
        "videos",
        &[
            "id",
            "url",
            "title",
            "channel",
            "watch_status",
            "tags",
            "thumbnail_file_id",
            "visibility",
            "created_at",
            "updated_at",
        ],
    )
    .linked_as("video");
    let mut notes_table = ExportTable::new(
        "item_notes",
        &[
            "id",
            "item_type",
            "item_id",
            "quote",
            "page",
            "comment",
            "created_at",
            "updated_at",
        ],
    );
    let mut highlights_table = ExportTable::new(
        "highlights",
        &[
            "id",
            "item_type",
            "item_id",
            "file_id",
            "page",
            "color",
            "text",
            "rects",
            "created_at",
        ],
    );
    // Arquivos: só os metadados (id, nome, tipo, tamanho e SHA-256), sem o binário.
    let mut file_refs: Vec<(Uuid, String)> = Vec::new();

    for book in &books {
        books_table.rows.push(vec![
            json!(book.id),
            json!(book.title),
            json!(book.author),
            json!(book.publisher),
            json!(book.page_count),
            json!(book.tags),
            json!(book.reading_status.as_str()),
            json!(book.cover_file_id),
            json!(book.pdf_file_id),
            json!(book.pages_read_total),
            json!(book.visibility),
            json!(book.created_at),
            json!(book.updated_at),
        ]);
        file_refs.extend(
            book.cover_file_id
                .map(|id| (id, format!("{} (capa)", book.title))),
        );
        file_refs.extend(
            book.pdf_file_id
                .map(|id| (id, format!("{} (PDF)", book.title))),
        );
        for session in books_service
            .list_sessions(owner_id, book.id)
            .await
            .map_err(source_error)?
        {
            sessions_table.rows.push(vec![
                json!(session.id),
                json!(session.book_id),
                json!(session.read_on),
                json!(session.pages_read),
                json!(session.from_page),
                json!(session.to_page),
                json!(session.observation),
                json!(session.created_at),
            ]);
        }
        add_item_children(
            &ops,
            owner_id,
            ItemRef::Book(book.id),
            "book",
            &mut notes_table,
            &mut highlights_table,
        )
        .await?;
    }
    for article in &articles {
        articles_table.rows.push(vec![
            json!(article.id),
            json!(article.title),
            json!(article.url),
            json!(article.author),
            json!(article.source),
            json!(article.tags),
            json!(article.reading_status.as_str()),
            json!(article.cover_file_id),
            json!(article.pdf_file_id),
            json!(article.visibility),
            json!(article.created_at),
            json!(article.updated_at),
        ]);
        file_refs.extend(
            article
                .cover_file_id
                .map(|id| (id, format!("{} (capa)", article.title))),
        );
        file_refs.extend(
            article
                .pdf_file_id
                .map(|id| (id, format!("{} (PDF)", article.title))),
        );
        add_item_children(
            &ops,
            owner_id,
            ItemRef::Article(article.id),
            "article",
            &mut notes_table,
            &mut highlights_table,
        )
        .await?;
    }
    for video in &videos {
        videos_table.rows.push(vec![
            json!(video.id),
            json!(video.url),
            json!(video.title),
            json!(video.channel),
            json!(video.watch_status.as_str()),
            json!(video.tags),
            json!(video.thumbnail_file_id),
            json!(video.visibility),
            json!(video.created_at),
            json!(video.updated_at),
        ]);
        file_refs.extend(video.thumbnail_file_id.map(|id| {
            (
                id,
                format!("{} (miniatura)", video.title.clone().unwrap_or_default()),
            )
        }));
    }

    let mut files_table = ExportTable::new(
        "files",
        &[
            "id",
            "name",
            "kind",
            "content_type",
            "size_bytes",
            "sha256",
            "created_at",
        ],
    );
    let mut seen = HashSet::new();
    for (id, name) in file_refs {
        if !seen.insert(id) {
            continue;
        }
        // O conteúdo é lido só para conferir o dono; ele não entra na exportação.
        let (file, _content) = files.read(owner_id, id).await.map_err(source_error)?;
        files_table.rows.push(vec![
            json!(file.id),
            json!(name),
            json!(file.kind.as_str()),
            json!(file.content_type),
            json!(file.size_bytes),
            json!(file.sha256),
            json!(file.created_at),
        ]);
    }
    Ok(vec![
        books_table,
        sessions_table,
        articles_table,
        videos_table,
        notes_table,
        highlights_table,
        files_table,
    ])
}

async fn add_item_children(
    ops: &crate::library::application::ItemOps<
        crate::library::infrastructure::pg_item_notes::PgItemRepository,
    >,
    owner_id: Uuid,
    item: ItemRef,
    item_type: &str,
    notes: &mut ExportTable,
    highlights: &mut ExportTable,
) -> Result<(), ReportError> {
    let item_id = match item {
        ItemRef::Book(id) | ItemRef::Article(id) | ItemRef::Video(id) => id,
    };
    for note in ops.list_notes(owner_id, item).await.map_err(source_error)? {
        notes.rows.push(vec![
            json!(note.id),
            json!(item_type),
            json!(item_id),
            json!(note.quote),
            json!(note.page),
            json!(note.comment),
            json!(note.created_at),
            json!(note.updated_at),
        ]);
    }
    for view in ops
        .list_highlights(owner_id, item)
        .await
        .map_err(source_error)?
    {
        let highlight = view.highlight;
        highlights.rows.push(vec![
            json!(highlight.id),
            json!(item_type),
            json!(item_id),
            json!(highlight.file_id),
            json!(highlight.page),
            json!(highlight.color.as_str()),
            json!(highlight.text),
            json!(highlight.rects),
            json!(highlight.created_at),
        ]);
    }
    Ok(())
}

impl ExportSource for ProjectsExport {
    fn context(&self) -> &'static str {
        "projects"
    }

    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let service = projects_service(&state);
            let listed = collect_pages(|cursor| {
                let service = &service;
                async move {
                    let page = service
                        .list_projects(
                            owner_id,
                            ProjectFilter {
                                cursor,
                                limit: PAGE,
                                ..ProjectFilter::default()
                            },
                        )
                        .await
                        .map_err(source_error)?;
                    Ok((page.items, decode_cursor(page.next_cursor)?))
                }
            })
            .await?;
            let mut projects_table = ExportTable::new(
                "projects",
                &[
                    "id",
                    "name",
                    "description",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("project");
            let mut lanes_table = ExportTable::new(
                "lanes",
                &[
                    "id",
                    "project_id",
                    "system_key",
                    "name",
                    "color",
                    "counts_as_done",
                    "position",
                ],
            );
            let mut cards_table = ExportTable::new(
                "cards",
                &[
                    "id",
                    "project_id",
                    "lane_id",
                    "title",
                    "description",
                    "priority",
                    "labels",
                    "due_date",
                    "checklist",
                    "position",
                    "visibility",
                    "created_at",
                    "updated_at",
                ],
            )
            .linked_as("project_card");
            for entry in listed {
                let project = service
                    .get_project(owner_id, entry.project.id)
                    .await
                    .map_err(source_error)?;
                projects_table.rows.push(vec![
                    json!(project.id),
                    json!(project.name),
                    json!(project.description),
                    json!(project.visibility),
                    json!(project.created_at),
                    json!(project.updated_at),
                ]);
                for lane in &project.lanes {
                    lanes_table.rows.push(vec![
                        json!(lane.id),
                        json!(lane.project_id),
                        json!(lane.system_key),
                        json!(lane.name),
                        json!(lane.color.as_str()),
                        json!(lane.counts_as_done),
                        json!(lane.position),
                    ]);
                }
                for card in &project.cards {
                    let checklist: Vec<Value> = card
                        .checklist
                        .iter()
                        .map(|item| {
                            json!({
                                "id": item.id,
                                "text": item.text,
                                "done": item.done,
                                "position": item.position,
                            })
                        })
                        .collect();
                    cards_table.rows.push(vec![
                        json!(card.id),
                        json!(card.project_id),
                        json!(card.lane_id),
                        json!(card.title),
                        json!(card.description),
                        json!(card.priority.map(|priority| priority.as_str())),
                        json!(card.labels),
                        json!(card.due_date),
                        Value::Array(checklist),
                        json!(card.position),
                        json!(card.visibility),
                        json!(card.created_at),
                        json!(card.updated_at),
                    ]);
                }
            }
            Ok(vec![projects_table, lanes_table, cards_table])
        })
    }
}

fn entity_type(name: &str) -> Option<EntityType> {
    EntityType::ALL
        .into_iter()
        .find(|kind| kind.as_str() == name)
}

impl ExportSource for LinksExport {
    fn context(&self) -> &'static str {
        "links"
    }

    fn export(&self, _owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
        Box::pin(async move { Ok(vec![links_table()]) })
    }

    fn export_with<'a>(
        &'a self,
        owner_id: Uuid,
        entities: &'a [ExportEntity],
    ) -> SourceFuture<'a, Vec<ExportTable>> {
        let state = self.0.clone();
        Box::pin(async move {
            let service = LinkService::new(
                PgLinkRepository::new(state.pool.clone()),
                state.clock.clone(),
                state.ids.clone(),
            );
            let mut table = links_table();
            let mut seen = HashSet::new();
            // O contexto só lista as ligações de uma entidade: percorre as já exportadas.
            for entity in entities {
                let Some(kind) = entity_type(entity.entity_type) else {
                    continue;
                };
                let mut after = None;
                loop {
                    let page = service
                        .list_for_entity(
                            owner_id,
                            ListLinks {
                                entity: EntityRef::new(kind, entity.id),
                                linked_type: None,
                                after,
                                limit: PAGE,
                            },
                        )
                        .await
                        .map_err(source_error)?;
                    for link in page.items {
                        if !seen.insert(link.id) {
                            continue;
                        }
                        table.rows.push(vec![
                            json!(link.id),
                            json!(link.source.entity_type.as_str()),
                            json!(link.source.entity_id),
                            json!(link.target.entity_type.as_str()),
                            json!(link.target.entity_id),
                            json!(link.visibility),
                            json!(link.created_at),
                        ]);
                    }
                    match page.next_cursor {
                        Some(next) => after = Some(next),
                        None => break,
                    }
                }
            }
            Ok(vec![table])
        })
    }
}

fn links_table() -> ExportTable {
    ExportTable::new(
        "links",
        &[
            "id",
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "visibility",
            "created_at",
        ],
    )
}
