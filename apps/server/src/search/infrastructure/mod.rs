//! Um adaptador `SearchSource` por contexto. Cada um chama só o serviço público do
//! contexto, montado do `AppState` como o `interface` dele monta o seu: a busca nunca
//! lê as tabelas dos outros contextos ([project/architecture-04]).

use std::collections::HashSet;
use std::sync::Arc;

use uuid::Uuid;

use crate::finance::application::ports::{
    RecurringTransactionRepository, Repetition, TransactionFilter, TransferFilter,
};
use crate::finance::application::{Env, accounts, categories, transactions, transfers};
use crate::finance::domain::forecast::FinanceItem;
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::transaction::Transaction;
use crate::finance::domain::transfer::Transfer;
use crate::finance::infrastructure::{
    PgAccounts, PgCategories, PgRecurringTransactions, PgTransactions, PgTransfers,
};
use crate::goals::application::goals::{GoalFilter, GoalsService};
use crate::goals::domain::goal::GoalView;
use crate::goals::infrastructure::pg_goals::PgGoalRepository;
use crate::http::AppState;
use crate::journal::{DecryptedJournalEntry, JournalReader};
use crate::library::{LibrarySearch, LibrarySearchHit};
use crate::notes::{DecryptedNote, NoteReader};
use crate::projects::{ProjectSearch, ProjectSearchHit};
use crate::reminders::application::ports::ReminderFilter;
use crate::reminders::application::reminders::ReminderService;
use crate::reminders::infrastructure::pg_reminders::PgReminderRepository;
use crate::search::application::{BoxFuture, SearchSource};
use crate::search::domain::{SearchContext, SearchError, SearchHit, SearchQuery, fold, label_term};
use crate::tasks::application::ports::TaskFilter;
use crate::tasks::application::tasks::TasksService;
use crate::tasks::domain::task::Task;
use crate::tasks::infrastructure::PgTasksRepository;

/// Os oito adaptadores, na ordem de `SearchContext::ALL`.
pub fn sources(state: &AppState) -> Vec<Arc<dyn SearchSource>> {
    let state = state.clone();
    vec![
        Arc::new(FinanceSearchSource::new(state.clone())),
        Arc::new(GoalsSearchSource::new(state.clone())),
        Arc::new(TasksSearchSource::new(state.clone())),
        Arc::new(RemindersSearchSource::new(state.clone())),
        Arc::new(NotesSearchSource::new(state.clone())),
        Arc::new(JournalSearchSource::new(state.clone())),
        Arc::new(LibrarySearchSource::new(state.clone())),
        Arc::new(ProjectsSearchSource::new(state)),
    ]
}

/// Falha de um contexto: o log leva só o contexto e o dono, nunca o texto nem o
/// conteúdo ([project/security-13]).
fn source_failed<E>(context: SearchContext, owner_id: Uuid) -> impl Fn(E) -> SearchError {
    move |_| {
        tracing::error!(context = context.as_str(), %owner_id, "falha na busca de um contexto");
        SearchError::Source { context }
    }
}

fn to_u32(limit: usize) -> u32 {
    u32::try_from(limit).unwrap_or(u32::MAX)
}

fn matches(haystack: &str, folded_text: &str) -> bool {
    fold(haystack).contains(folded_text)
}

/// Início do texto em uma linha só, para o trecho do resultado.
fn excerpt(text: &str) -> Option<String> {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    (!flat.is_empty()).then_some(flat)
}

/// Junta as listas sem repetir id, mantendo a ordem, até o limite.
fn merge_unique(lists: Vec<Vec<SearchHit>>, limit: usize) -> Vec<SearchHit> {
    let mut seen = HashSet::new();
    lists
        .into_iter()
        .flatten()
        .filter(|hit| seen.insert(hit.id))
        .take(limit)
        .collect()
}

// Finance --------------------------------------------------------------------

pub struct FinanceSearchSource {
    state: AppState,
}

impl FinanceSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn env(&self) -> Env<'_> {
        Env {
            clock: self.state.clock.as_ref(),
            ids: self.state.ids.as_ref(),
        }
    }

    async fn stored_transactions(
        &self,
        owner_id: Uuid,
        text: &str,
        limit: usize,
    ) -> Result<Vec<SearchHit>, crate::finance::domain::FinanceError> {
        let filter = TransactionFilter {
            q: Some(text.to_owned()),
            repetition: Repetition::OneOff,
            ..Default::default()
        };
        let recurring = PgRecurringTransactions::new(self.state.pool.clone());
        let repo = PgTransactions::new(self.state.pool.clone());
        let items = transactions::list(
            &recurring,
            &repo,
            self.env(),
            owner_id,
            &filter,
            None,
            to_u32(limit),
        )
        .await?;
        Ok(items.into_iter().filter_map(finance_item_hit).collect())
    }

    async fn transfers(
        &self,
        owner_id: Uuid,
        text: &str,
        limit: usize,
    ) -> Result<Vec<SearchHit>, crate::finance::domain::FinanceError> {
        let filter = TransferFilter {
            q: Some(text.to_owned()),
            ..Default::default()
        };
        let repo = PgTransfers::new(self.state.pool.clone());
        let items = transfers::list(&repo, owner_id, &filter, None, to_u32(limit)).await?;
        Ok(items.into_iter().map(transfer_hit).collect())
    }

    async fn recurring(
        &self,
        owner_id: Uuid,
        text: &str,
        limit: usize,
    ) -> Result<Vec<SearchHit>, crate::finance::domain::FinanceError> {
        let repo = PgRecurringTransactions::new(self.state.pool.clone());
        let items = repo.list(owner_id, Some(text), None, to_u32(limit)).await?;
        Ok(items.into_iter().map(recurring_hit).collect())
    }

    async fn accounts(
        &self,
        owner_id: Uuid,
        text: &str,
    ) -> Result<Vec<SearchHit>, crate::finance::domain::FinanceError> {
        let repo = PgAccounts::new(self.state.pool.clone());
        let folded = fold(text);
        let all = accounts::list_all(&repo, self.env(), owner_id).await?;
        Ok(all
            .into_iter()
            .filter(|account| matches(&account.name, &folded))
            .map(|account| named_hit("account", account.id, account.name))
            .collect())
    }

    async fn categories(
        &self,
        owner_id: Uuid,
        text: &str,
    ) -> Result<Vec<SearchHit>, crate::finance::domain::FinanceError> {
        let repo = PgCategories::new(self.state.pool.clone());
        let folded = fold(text);
        let all = categories::list_all(&repo, owner_id).await?;
        Ok(all
            .into_iter()
            .filter(|category| matches(&category.name, &folded))
            .map(|category| named_hit("category", category.id, category.name))
            .collect())
    }
}

fn named_hit(entity_type: &'static str, id: Uuid, name: String) -> SearchHit {
    SearchHit::new(SearchContext::Finance, entity_type, id, name, None)
}

/// Só a movimentação gravada vira resultado; a ocorrência virtual não tem id próprio
/// (DEC-003).
fn finance_item_hit(item: FinanceItem) -> Option<SearchHit> {
    match item {
        FinanceItem::Stored(transaction) => Some(transaction_hit(transaction)),
        FinanceItem::Virtual(_) => None,
    }
}

fn transaction_hit(transaction: Transaction) -> SearchHit {
    named_hit(
        "transaction",
        transaction.id,
        transaction.description.unwrap_or_default(),
    )
}

fn transfer_hit(transfer: Transfer) -> SearchHit {
    named_hit(
        "transfer",
        transfer.id,
        transfer.description.unwrap_or_default(),
    )
}

fn recurring_hit(recurring: RecurringTransaction) -> SearchHit {
    named_hit(
        "recurring_transaction",
        recurring.id,
        recurring.description.unwrap_or_default(),
    )
}

impl SearchSource for FinanceSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Finance
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let (owner, text) = (query.owner_id, query.text.as_str());
            let failed = source_failed(SearchContext::Finance, owner);
            let (stored, transfers, recurring, accounts, categories) = tokio::join!(
                self.stored_transactions(owner, text, limit),
                self.transfers(owner, text, limit),
                self.recurring(owner, text, limit),
                self.accounts(owner, text),
                self.categories(owner, text),
            );
            let lists = vec![
                stored.map_err(&failed)?,
                transfers.map_err(&failed)?,
                recurring.map_err(&failed)?,
                accounts.map_err(&failed)?,
                categories.map_err(&failed)?,
            ];
            Ok(merge_unique(lists, limit))
        })
    }
}

// Goals ----------------------------------------------------------------------

pub struct GoalsSearchSource {
    state: AppState,
}

impl GoalsSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn goal_hit(view: GoalView) -> SearchHit {
    SearchHit::new(
        SearchContext::Goals,
        "goal",
        view.goal.id,
        view.goal.title,
        None,
    )
}

impl SearchSource for GoalsSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Goals
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let service = GoalsService {
                repo: PgGoalRepository::new(self.state.pool.clone()),
                clock: self.state.clock.clone(),
                ids: self.state.ids.clone(),
            };
            let owner = query.owner_id;
            let by_title = GoalFilter {
                text: Some(query.text.clone()),
                limit: to_u32(limit),
                ..Default::default()
            };
            let by_label = GoalFilter {
                label: Some(label_term(&query.text).to_owned()),
                limit: to_u32(limit),
                ..Default::default()
            };
            let titled = service
                .list_goals(owner, by_title)
                .await
                .map_err(source_failed(SearchContext::Goals, owner))?;
            // Etiqueta inválida (vazia ou longa demais) só não acha nada.
            let labelled = service
                .list_goals(owner, by_label)
                .await
                .map(|page| page.items)
                .unwrap_or_default();
            let lists = vec![titled.items, labelled];
            Ok(merge_unique(
                lists
                    .into_iter()
                    .map(|views| views.into_iter().map(goal_hit).collect())
                    .collect(),
                limit,
            ))
        })
    }
}

// Tasks ----------------------------------------------------------------------

pub struct TasksSearchSource {
    state: AppState,
}

impl TasksSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn task_hit(task: Task) -> SearchHit {
    SearchHit::new(SearchContext::Tasks, "task", task.id, task.title, None)
}

impl SearchSource for TasksSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Tasks
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let repository =
                PgTasksRepository::new(self.state.pool.clone(), self.state.ids.clone());
            let service =
                TasksService::new(repository, self.state.clock.clone(), self.state.ids.clone());
            let owner = query.owner_id;
            let by_title = TaskFilter {
                query: Some(query.text.clone()),
                limit: to_u32(limit),
                ..Default::default()
            };
            let by_label = TaskFilter {
                label: Some(label_term(&query.text).to_owned()),
                limit: to_u32(limit),
                ..Default::default()
            };
            let titled = service
                .list(owner, by_title)
                .await
                .map_err(source_failed(SearchContext::Tasks, owner))?;
            let labelled = service
                .list(owner, by_label)
                .await
                .map(|page| page.items)
                .unwrap_or_default();
            let lists = vec![titled.items, labelled];
            Ok(merge_unique(
                lists
                    .into_iter()
                    .map(|views| views.into_iter().map(|v| task_hit(v.task)).collect())
                    .collect(),
                limit,
            ))
        })
    }
}

// Reminders ------------------------------------------------------------------

pub struct RemindersSearchSource {
    state: AppState,
}

impl RemindersSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

impl SearchSource for RemindersSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Reminders
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let repository = PgReminderRepository::new(self.state.pool.clone());
            let service = ReminderService {
                repository: &repository,
                clock: self.state.clock.as_ref(),
                ids: self.state.ids.as_ref(),
            };
            let owner = query.owner_id;
            let filter = ReminderFilter {
                query: Some(query.text.clone()),
                limit: to_u32(limit),
                ..Default::default()
            };
            let page = service
                .list(owner, filter)
                .await
                .map_err(source_failed(SearchContext::Reminders, owner))?;
            Ok(page
                .items
                .into_iter()
                .map(|record| {
                    let reminder = record.reminder;
                    SearchHit::new(
                        SearchContext::Reminders,
                        "reminder",
                        reminder.id,
                        reminder.title,
                        None,
                    )
                })
                .collect())
        })
    }
}

// Notes ----------------------------------------------------------------------

pub struct NotesSearchSource {
    state: AppState,
}

impl NotesSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

/// Notas cujo título ou corpo contêm o texto, sem diferenciar caixa nem acento, das
/// mais para as menos recentes.
fn match_notes(mut notes: Vec<DecryptedNote>, text: &str, limit: usize) -> Vec<SearchHit> {
    let folded = fold(text);
    notes.retain(|note| matches(&note.title, &folded) || matches(&note.body, &folded));
    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then(b.id.cmp(&a.id)));
    notes
        .into_iter()
        .take(limit)
        .map(|note| {
            SearchHit::new(
                SearchContext::Notes,
                "note",
                note.id,
                note.title,
                excerpt(&note.body),
            )
        })
        .collect()
}

impl SearchSource for NotesSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Notes
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let owner = query.owner_id;
            let notes = NoteReader::from_state(&self.state)
                .decrypted_notes_for_owner(owner)
                .await
                .map_err(source_failed(SearchContext::Notes, owner))?;
            Ok(match_notes(notes, &query.text, limit))
        })
    }
}

// Journal --------------------------------------------------------------------

pub struct JournalSearchSource {
    state: AppState,
}

impl JournalSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn first_line(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default()
        .to_owned()
}

fn journal_hit(entry: DecryptedJournalEntry) -> SearchHit {
    SearchHit::new(
        SearchContext::Journal,
        "journal_entry",
        entry.id,
        first_line(&entry.text),
        excerpt(&entry.text),
    )
}

/// Entradas cujo texto contém o termo, das mais para as menos recentes.
fn match_entries(
    mut entries: Vec<DecryptedJournalEntry>,
    text: &str,
    limit: usize,
) -> Vec<SearchHit> {
    let folded = fold(text);
    entries.retain(|entry| matches(&entry.text, &folded));
    entries.sort_by(|a, b| b.occurred_at.cmp(&a.occurred_at).then(b.id.cmp(&a.id)));
    entries.into_iter().take(limit).map(journal_hit).collect()
}

impl SearchSource for JournalSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Journal
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let owner = query.owner_id;
            let entries = JournalReader::from_state(&self.state)
                .decrypted_entries_for_owner(owner)
                .await
                .map_err(source_failed(SearchContext::Journal, owner))?;
            Ok(match_entries(entries, &query.text, limit))
        })
    }
}

// Library --------------------------------------------------------------------

pub struct LibrarySearchSource {
    state: AppState,
}

impl LibrarySearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn library_hit(hit: LibrarySearchHit) -> SearchHit {
    SearchHit::new(
        SearchContext::Library,
        hit.entity_type,
        hit.id,
        hit.title,
        None,
    )
}

impl SearchSource for LibrarySearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Library
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let owner = query.owner_id;
            let hits = LibrarySearch::from_state(&self.state)
                .search(owner, &query.text, limit as i64)
                .await
                .map_err(source_failed(SearchContext::Library, owner))?;
            Ok(hits.into_iter().map(library_hit).collect())
        })
    }
}

// Projects -------------------------------------------------------------------

pub struct ProjectsSearchSource {
    state: AppState,
}

impl ProjectsSearchSource {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

/// O cartão leva o projeto dele, para o link `/projects/<project_id>/cards/<id>`.
fn project_hit(hit: ProjectSearchHit) -> SearchHit {
    let result = SearchHit::new(
        SearchContext::Projects,
        hit.entity_type,
        hit.id,
        hit.title,
        None,
    );
    match hit.entity_type {
        "project_card" => result.with_project(hit.project_id),
        _ => result,
    }
}

impl SearchSource for ProjectsSearchSource {
    fn context(&self) -> SearchContext {
        SearchContext::Projects
    }

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
        Box::pin(async move {
            let owner = query.owner_id;
            let hits = ProjectSearch::from_state(&self.state)
                .search(owner, &query.text, limit as i64)
                .await
                .map_err(source_failed(SearchContext::Projects, owner))?;
            Ok(hits.into_iter().map(project_hit).collect())
        })
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};

    use super::*;
    use crate::finance::domain::forecast::VirtualOccurrence;
    use crate::finance::domain::transaction::{ItemStatus, TransactionKind, fixtures};
    use crate::shared::money::Currency;
    use crate::shared::visibility::Visibility;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn note(id: u128, title: &str, body: &str, updated: &str) -> DecryptedNote {
        DecryptedNote {
            id: Uuid::from_u128(id),
            title: title.to_owned(),
            body: body.to_owned(),
            visibility: Visibility::Personal,
            created_at: instant(updated),
            updated_at: instant(updated),
        }
    }

    #[test]
    fn skips_virtual_finance_items() {
        let virtual_item = FinanceItem::Virtual(VirtualOccurrence {
            recurrence_id: Uuid::from_u128(5),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            kind: TransactionKind::Expense,
            account_id: Uuid::from_u128(2),
            category_id: None,
            description: Some("Aluguel".to_owned()),
            expected_amount: 100,
            currency: Currency::default(),
            occurrence_date: fixtures::date("2026-12-05"),
            status: ItemStatus::Forecast,
        });
        assert!(finance_item_hit(virtual_item).is_none());
    }

    #[test]
    fn maps_stored_transaction_with_description() {
        let mut stored = fixtures::transaction(TransactionKind::Expense, 100);
        stored.description = Some("Café da manhã".to_owned());
        let id = stored.id;
        let hit = finance_item_hit(FinanceItem::Stored(stored)).unwrap();
        assert_eq!(hit.context, SearchContext::Finance);
        assert_eq!(hit.entity_type, "transaction");
        assert_eq!(hit.id, id);
        assert_eq!(hit.title, "Café da manhã");
    }

    #[test]
    fn maps_project_card_with_project_id() {
        let project = Uuid::from_u128(7);
        let card = project_hit(ProjectSearchHit {
            entity_type: "project_card",
            id: Uuid::from_u128(8),
            project_id: project,
            title: "Cartão".to_owned(),
            rank: 1.0,
        });
        assert_eq!(card.project_id, Some(project));
        let whole = project_hit(ProjectSearchHit {
            entity_type: "project",
            id: project,
            project_id: project,
            title: "Projeto".to_owned(),
            rank: 1.0,
        });
        assert_eq!(whole.project_id, None);
        assert_eq!(whole.entity_type, "project");
    }

    #[test]
    fn maps_library_hits_keeping_entity_type() {
        for entity_type in ["book", "article", "video"] {
            let hit = library_hit(LibrarySearchHit {
                entity_type,
                id: Uuid::from_u128(3),
                title: "Título".to_owned(),
                rank: 0.5,
            });
            assert_eq!(hit.entity_type, entity_type);
            assert_eq!(hit.context, SearchContext::Library);
            assert_eq!(hit.snippet, None);
        }
    }

    #[test]
    fn maps_journal_entry_title_from_first_line() {
        let entry = DecryptedJournalEntry {
            id: Uuid::from_u128(4),
            occurred_at: instant("2026-11-01T12:00:00Z"),
            text: "\n  Dia de sol \nfui à praia".to_owned(),
            emotions: Vec::new(),
            visibility: Visibility::Personal,
            created_at: instant("2026-11-01T12:00:00Z"),
            updated_at: instant("2026-11-01T12:00:00Z"),
        };
        let hit = journal_hit(entry);
        assert_eq!(hit.title, "Dia de sol");
        assert_eq!(hit.snippet.as_deref(), Some("Dia de sol fui à praia"));
    }

    #[test]
    fn matches_note_by_title_or_body_without_accents() {
        let notes = vec![
            note(1, "Receita de café", "outro texto", "2026-11-01T10:00:00Z"),
            note(2, "Lista", "comprar CAFÉ e pão", "2026-11-01T11:00:00Z"),
            note(3, "Sem relação", "nada", "2026-11-01T12:00:00Z"),
        ];
        let hits = match_notes(notes, "cafe", 8);
        let ids: Vec<_> = hits.iter().map(|hit| hit.id).collect();
        assert_eq!(ids, vec![Uuid::from_u128(2), Uuid::from_u128(1)]);
    }
}
