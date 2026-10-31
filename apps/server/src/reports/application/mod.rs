//! Casos de uso dos relatórios e da exportação, sobre portas que a `infrastructure`
//! implementa chamando os serviços de aplicação dos outros contextos
//! ([project/architecture-04]).

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value;
use uuid::Uuid;

use crate::reports::domain::{
    DataModule, FinanceData, GoalItem, GoalStatus, JournalItem, LibraryStatusData, Period,
    PeriodContext, ProjectItem, REPORT_CATALOG, ReadingData, Report, ReportCatalogEntry,
    ReportError, ReportFilters, ReportKind, TaskItem, build_fin_cat, build_fin_diff,
    build_fin_flow, build_goals_progress, build_journal_emo, build_lib_status, build_proj_cards,
    build_read_pages, build_tasks_done,
};
use crate::shared::clock::Clock;

/// Futuro em caixa das portas, para usá-las como `Arc<dyn ...>`.
pub type SourceFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, ReportError>> + Send + 'a>>;

/// Período e filtros de conta e categoria que o Financeiro aplica na leitura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FinanceQuery {
    pub period: Period,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
}

/// Dados dos relatórios, uma função por módulo. Toda leitura é do `owner_id`.
pub trait ReportDataSource: Send + Sync {
    /// Primeira data registrada do módulo, ou `None` sem registro.
    fn first_record_date(
        &self,
        owner_id: Uuid,
        module: DataModule,
    ) -> SourceFuture<'_, Option<NaiveDate>>;
    fn finance(&self, owner_id: Uuid, query: FinanceQuery) -> SourceFuture<'_, FinanceData>;
    fn reading(&self, owner_id: Uuid, period: Period) -> SourceFuture<'_, ReadingData>;
    fn library_status(&self, owner_id: Uuid) -> SourceFuture<'_, LibraryStatusData>;
    fn journal(&self, owner_id: Uuid, period: Period) -> SourceFuture<'_, Vec<JournalItem>>;
    fn goals(&self, owner_id: Uuid, status: Option<GoalStatus>) -> SourceFuture<'_, Vec<GoalItem>>;
    fn tasks(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<TaskItem>>;
    fn projects(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ProjectItem>>;
}

pub struct ReportService {
    source: Arc<dyn ReportDataSource>,
    clock: Arc<dyn Clock>,
}

impl ReportService {
    pub fn new(source: Arc<dyn ReportDataSource>, clock: Arc<dyn Clock>) -> Self {
        Self { source, clock }
    }

    pub fn catalog(&self) -> &'static [ReportCatalogEntry; 9] {
        &REPORT_CATALOG
    }

    /// Valida os filtros, resolve o período e só então lê os dados.
    pub async fn build(
        &self,
        owner_id: Uuid,
        kind: ReportKind,
        filters: ReportFilters,
    ) -> Result<Report, ReportError> {
        filters.validate(kind)?;
        let today = self.clock.now().date_naive();
        let ctx = self.period_context(owner_id, kind, &filters, today).await?;
        let report = match kind {
            ReportKind::FinFlow | ReportKind::FinCat | ReportKind::FinDiff => {
                let data = self
                    .source
                    .finance(
                        owner_id,
                        FinanceQuery {
                            period: ctx.period,
                            account_id: filters.account_id,
                            category_id: filters.category_id,
                        },
                    )
                    .await?;
                match kind {
                    ReportKind::FinFlow => Report::FinFlow(build_fin_flow(ctx, &filters, &data)),
                    ReportKind::FinCat => Report::FinCat(build_fin_cat(ctx, &filters, &data)),
                    _ => Report::FinDiff(build_fin_diff(ctx, &filters, &data)),
                }
            }
            ReportKind::ReadPages => {
                let data = self.source.reading(owner_id, ctx.period).await?;
                Report::ReadPages(build_read_pages(ctx, &filters, &data))
            }
            ReportKind::JournalEmo => {
                let items = self.source.journal(owner_id, ctx.period).await?;
                Report::JournalEmo(build_journal_emo(ctx, &filters, &items))
            }
            ReportKind::LibStatus => {
                let data = self.source.library_status(owner_id).await?;
                Report::LibStatus(build_lib_status(today, &filters, &data))
            }
            ReportKind::GoalsProgress => {
                let items = self.source.goals(owner_id, filters.goal_status).await?;
                Report::GoalsProgress(build_goals_progress(today, &filters, &items))
            }
            ReportKind::TasksDone => {
                let items = self.source.tasks(owner_id).await?;
                Report::TasksDone(build_tasks_done(today, &items))
            }
            ReportKind::ProjCards => {
                let items = self.source.projects(owner_id).await?;
                Report::ProjCards(build_proj_cards(today, &filters, &items))
            }
        };
        Ok(report)
    }

    /// Período dos relatórios que o têm; a primeira data só é lida quando falta `from`.
    async fn period_context(
        &self,
        owner_id: Uuid,
        kind: ReportKind,
        filters: &ReportFilters,
        today: NaiveDate,
    ) -> Result<PeriodContext, ReportError> {
        let Some(module) = kind.data_module() else {
            return Ok(PeriodContext {
                period: Period {
                    from: today,
                    to: today,
                },
                any_period: false,
                today,
            });
        };
        let first_record = if filters.period.from.is_none() {
            self.source.first_record_date(owner_id, module).await?
        } else {
            None
        };
        Ok(PeriodContext {
            period: Period::resolve(filters.period, first_record, today)?,
            any_period: filters.period.is_open(),
            today,
        })
    }
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

/// Tabela de um contexto: as linhas seguem a ordem das colunas.
#[derive(Debug, Clone, PartialEq)]
pub struct ExportTable {
    pub name: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    /// Tipo de ligação (`links`) das linhas, quando elas têm a coluna `id`.
    pub entity_type: Option<&'static str>,
}

impl ExportTable {
    pub fn new(name: &str, columns: &[&str]) -> Self {
        Self {
            name: name.to_owned(),
            columns: columns.iter().map(|c| (*c).to_owned()).collect(),
            rows: Vec::new(),
            entity_type: None,
        }
    }

    pub fn linked_as(mut self, entity_type: &'static str) -> Self {
        self.entity_type = Some(entity_type);
        self
    }
}

/// Entidade já exportada, para o contexto de ligações listar as dela.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExportEntity {
    pub entity_type: &'static str,
    pub id: Uuid,
}

pub trait ExportSource: Send + Sync {
    fn context(&self) -> &'static str;
    fn export(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>>;
    /// Como `export`, com as entidades dos contextos anteriores; só as ligações a usam.
    fn export_with<'a>(
        &'a self,
        owner_id: Uuid,
        _entities: &'a [ExportEntity],
    ) -> SourceFuture<'a, Vec<ExportTable>> {
        self.export(owner_id)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportContext {
    pub context: &'static str,
    pub tables: Vec<ExportTable>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExportBundle {
    pub exported_at: DateTime<Utc>,
    pub owner_id: Uuid,
    pub contexts: Vec<ExportContext>,
}

pub struct ExportService {
    sources: Vec<Arc<dyn ExportSource>>,
    clock: Arc<dyn Clock>,
}

impl ExportService {
    pub fn new(sources: Vec<Arc<dyn ExportSource>>, clock: Arc<dyn Clock>) -> Self {
        Self { sources, clock }
    }

    /// Reúne as tabelas de todos os contextos, na ordem das fontes.
    pub async fn collect(&self, owner_id: Uuid) -> Result<ExportBundle, ReportError> {
        let mut contexts = Vec::with_capacity(self.sources.len());
        let mut entities: Vec<ExportEntity> = Vec::new();
        for source in &self.sources {
            let tables = source.export_with(owner_id, &entities).await?;
            for table in &tables {
                entities.extend(entities_of(table));
            }
            contexts.push(ExportContext {
                context: source.context(),
                tables,
            });
        }
        Ok(ExportBundle {
            exported_at: self.clock.now(),
            owner_id,
            contexts,
        })
    }
}

fn entities_of(table: &ExportTable) -> Vec<ExportEntity> {
    let Some(entity_type) = table.entity_type else {
        return Vec::new();
    };
    let Some(index) = table.columns.iter().position(|column| column == "id") else {
        return Vec::new();
    };
    table
        .rows
        .iter()
        .filter_map(|row| row.get(index)?.as_str()?.parse::<Uuid>().ok())
        .map(|id| ExportEntity { entity_type, id })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;
    use crate::reports::domain::{BookRef, ReadingSessionItem};
    use crate::shared::clock::FixedClock;

    fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    fn clock() -> Arc<FixedClock> {
        Arc::new(FixedClock::new("2026-11-01T12:00:00Z".parse().unwrap()))
    }

    #[derive(Default)]
    struct FakeSource {
        owners: Mutex<Vec<Uuid>>,
        queries: Mutex<Vec<FinanceQuery>>,
        first_record_calls: Mutex<Vec<DataModule>>,
    }

    impl FakeSource {
        fn seen(&self, owner_id: Uuid) {
            self.owners.lock().unwrap().push(owner_id);
        }
    }

    fn ready<'a, T: Send + 'a>(value: T) -> SourceFuture<'a, T> {
        Box::pin(async move { Ok(value) })
    }

    impl ReportDataSource for FakeSource {
        fn first_record_date(
            &self,
            owner_id: Uuid,
            module: DataModule,
        ) -> SourceFuture<'_, Option<NaiveDate>> {
            self.seen(owner_id);
            self.first_record_calls.lock().unwrap().push(module);
            ready(Some(match module {
                DataModule::Finance => date("2026-02-10"),
                DataModule::Library => date("2026-03-11"),
                DataModule::Journal => date("2026-04-12"),
            }))
        }

        fn finance(&self, owner_id: Uuid, query: FinanceQuery) -> SourceFuture<'_, FinanceData> {
            self.seen(owner_id);
            self.queries.lock().unwrap().push(query);
            ready(FinanceData {
                currency: "BRL".to_owned(),
                accounts: Vec::new(),
                categories: Vec::new(),
                transactions: Vec::new(),
            })
        }

        fn reading(&self, owner_id: Uuid, _period: Period) -> SourceFuture<'_, ReadingData> {
            self.seen(owner_id);
            ready(ReadingData {
                books: vec![BookRef {
                    id: Uuid::from_u128(1),
                    title: "Livro".to_owned(),
                    page_count: Some(100),
                }],
                sessions: vec![ReadingSessionItem {
                    book_id: Uuid::from_u128(1),
                    read_on: date("2026-10-01"),
                    pages_read: 10,
                }],
            })
        }

        fn library_status(&self, owner_id: Uuid) -> SourceFuture<'_, LibraryStatusData> {
            self.seen(owner_id);
            ready(LibraryStatusData::default())
        }

        fn journal(&self, owner_id: Uuid, _period: Period) -> SourceFuture<'_, Vec<JournalItem>> {
            self.seen(owner_id);
            ready(Vec::new())
        }

        fn goals(
            &self,
            owner_id: Uuid,
            _status: Option<GoalStatus>,
        ) -> SourceFuture<'_, Vec<GoalItem>> {
            self.seen(owner_id);
            ready(Vec::new())
        }

        fn tasks(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<TaskItem>> {
            self.seen(owner_id);
            ready(Vec::new())
        }

        fn projects(&self, owner_id: Uuid) -> SourceFuture<'_, Vec<ProjectItem>> {
            self.seen(owner_id);
            ready(Vec::new())
        }
    }

    #[tokio::test]
    async fn report_service_builds_each_kind_for_owner_and_filters() {
        let source = Arc::new(FakeSource::default());
        let service = ReportService::new(source.clone(), clock());
        let owner = Uuid::from_u128(7);
        let account = Uuid::from_u128(5);
        let period_filters = ReportFilters {
            period: crate::reports::domain::PeriodRequest {
                from: Some(date("2026-10-01")),
                to: Some(date("2026-10-31")),
            },
            account_id: Some(account),
            ..ReportFilters::default()
        };

        for kind in ReportKind::ALL {
            let filters = match kind {
                ReportKind::FinFlow | ReportKind::FinDiff => period_filters.clone(),
                ReportKind::ReadPages | ReportKind::JournalEmo | ReportKind::FinCat => {
                    ReportFilters {
                        account_id: None,
                        ..period_filters.clone()
                    }
                }
                _ => ReportFilters::default(),
            };
            let report = service.build(owner, kind, filters).await.unwrap();

            assert_eq!(report.kind(), kind);
            assert_eq!(report.period().is_some(), kind.has_period(), "{kind:?}");
        }
        let rejected = service
            .build(owner, ReportKind::TasksDone, period_filters)
            .await;

        assert!(rejected.is_err());
        assert!(source.owners.lock().unwrap().iter().all(|o| *o == owner));
        let queries = source.queries.lock().unwrap();
        assert_eq!(queries[0].account_id, Some(account));
        assert_eq!(queries[0].period.from, date("2026-10-01"));
        assert!(source.first_record_calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn report_service_resolves_any_period_from_first_record_date() {
        let source = Arc::new(FakeSource::default());
        let service = ReportService::new(source.clone(), clock());
        let owner = Uuid::from_u128(7);
        let expected = [
            (ReportKind::FinFlow, "2026-02-10"),
            (ReportKind::FinCat, "2026-02-10"),
            (ReportKind::FinDiff, "2026-02-10"),
            (ReportKind::ReadPages, "2026-03-11"),
            (ReportKind::JournalEmo, "2026-04-12"),
        ];

        for (kind, first) in expected {
            let report = service
                .build(owner, kind, ReportFilters::default())
                .await
                .unwrap();
            let (period, any_period) = report.period().unwrap();

            assert_eq!(period.from, date(first), "{kind:?}");
            assert_eq!(period.to, date("2026-11-01"));
            assert!(any_period);
        }
    }

    struct FakeExport {
        name: &'static str,
        entity: Option<&'static str>,
    }

    impl ExportSource for FakeExport {
        fn context(&self) -> &'static str {
            self.name
        }

        fn export(&self, _owner_id: Uuid) -> SourceFuture<'_, Vec<ExportTable>> {
            let mut table = ExportTable::new("items", &["id", "name"]);
            if let Some(entity) = self.entity {
                table = table.linked_as(entity);
            }
            table.rows.push(vec![
                Value::String(Uuid::from_u128(9).to_string()),
                Value::String(self.name.to_owned()),
            ]);
            ready(vec![table])
        }

        fn export_with<'a>(
            &'a self,
            owner_id: Uuid,
            entities: &'a [ExportEntity],
        ) -> SourceFuture<'a, Vec<ExportTable>> {
            if self.name != "links" {
                return self.export(owner_id);
            }
            let mut table = ExportTable::new("links", &["count"]);
            table.rows.push(vec![Value::from(entities.len())]);
            ready(vec![table])
        }
    }

    #[tokio::test]
    async fn export_service_collects_every_source() {
        let sources: Vec<Arc<dyn ExportSource>> = vec![
            Arc::new(FakeExport {
                name: "finance",
                entity: Some("account"),
            }),
            Arc::new(FakeExport {
                name: "goals",
                entity: Some("goal"),
            }),
            Arc::new(FakeExport {
                name: "journal",
                entity: None,
            }),
            Arc::new(FakeExport {
                name: "links",
                entity: None,
            }),
        ];
        let service = ExportService::new(sources, clock());
        let owner = Uuid::from_u128(7);

        let bundle = service.collect(owner).await.unwrap();

        let names: Vec<&str> = bundle.contexts.iter().map(|c| c.context).collect();
        assert_eq!(names, vec!["finance", "goals", "journal", "links"]);
        assert_eq!(bundle.owner_id, owner);
        assert_eq!(bundle.exported_at.to_rfc3339(), "2026-11-01T12:00:00+00:00");
        // O contexto de ligações recebeu as duas entidades dos contextos anteriores.
        assert_eq!(bundle.contexts[3].tables[0].rows[0][0], Value::from(2));
    }
}
