//! Casos de uso da busca: consulta as fontes dos contextos escolhidos em paralelo e
//! agrupa os resultados por contexto (RF-16).

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use tokio::task::JoinSet;

use crate::search::domain::{
    HITS_PER_CONTEXT, SearchContext, SearchError, SearchGroup, SearchHit, SearchQuery,
};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Porta de um contexto: devolve até `limit` resultados do dono da consulta.
pub trait SearchSource: Send + Sync {
    fn context(&self) -> SearchContext;

    fn search<'a>(
        &'a self,
        query: &'a SearchQuery,
        limit: usize,
    ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>>;
}

pub struct SearchService {
    sources: Vec<Arc<dyn SearchSource>>,
}

impl SearchService {
    pub fn new(sources: Vec<Arc<dyn SearchSource>>) -> Self {
        Self { sources }
    }

    /// Grupos na ordem de `query.contexts`, sem os contextos sem resultado.
    pub async fn search(&self, query: &SearchQuery) -> Result<Vec<SearchGroup>, SearchError> {
        let shared = Arc::new(query.clone());
        let mut tasks: JoinSet<(SearchContext, Result<Vec<SearchHit>, SearchError>)> =
            JoinSet::new();
        let mut spawned = HashMap::new();
        for source in self
            .sources
            .iter()
            .filter(|source| query.contexts.contains(&source.context()))
        {
            let (source, query) = (source.clone(), shared.clone());
            let context = source.context();
            let handle = tasks
                .spawn(async move { (context, source.search(&query, HITS_PER_CONTEXT).await) });
            spawned.insert(handle.id(), context);
        }
        let mut results = HashMap::new();
        while let Some(joined) = tasks.join_next_with_id().await {
            match joined {
                Ok((_, (context, result))) => {
                    results.insert(context, result);
                }
                Err(error) => {
                    let context = spawned.get(&error.id()).copied();
                    return Err(context.map_or(SearchError::InvalidContext, |context| {
                        SearchError::Source { context }
                    }));
                }
            }
        }
        collect_groups(&query.contexts, results)
    }
}

fn collect_groups(
    order: &[SearchContext],
    mut results: HashMap<SearchContext, Result<Vec<SearchHit>, SearchError>>,
) -> Result<Vec<SearchGroup>, SearchError> {
    let mut groups = Vec::new();
    for context in order {
        let Some(result) = results.remove(context) else {
            continue;
        };
        let mut items = result?;
        items.truncate(HITS_PER_CONTEXT);
        if !items.is_empty() {
            groups.push(SearchGroup {
                context: *context,
                items,
            });
        }
    }
    Ok(groups)
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use uuid::Uuid;

    use super::*;

    const OWNER: Uuid = Uuid::from_u128(1);

    struct FakeSource {
        context: SearchContext,
        hits: usize,
        fails: bool,
        calls: Arc<Mutex<Vec<SearchContext>>>,
    }

    impl SearchSource for FakeSource {
        fn context(&self) -> SearchContext {
            self.context
        }

        fn search<'a>(
            &'a self,
            _query: &'a SearchQuery,
            _limit: usize,
        ) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>> {
            Box::pin(async move {
                if let Ok(mut calls) = self.calls.lock() {
                    calls.push(self.context);
                }
                if self.fails {
                    return Err(SearchError::Source {
                        context: self.context,
                    });
                }
                Ok((0..self.hits)
                    .map(|n| {
                        SearchHit::new(
                            self.context,
                            "fake",
                            Uuid::from_u128(n as u128),
                            format!("hit {n}"),
                            None,
                        )
                    })
                    .collect())
            })
        }
    }

    fn service(
        specs: &[(SearchContext, usize, bool)],
    ) -> (SearchService, Arc<Mutex<Vec<SearchContext>>>) {
        let calls = Arc::new(Mutex::new(Vec::new()));
        let sources = specs
            .iter()
            .map(|(context, hits, fails)| {
                Arc::new(FakeSource {
                    context: *context,
                    hits: *hits,
                    fails: *fails,
                    calls: calls.clone(),
                }) as Arc<dyn SearchSource>
            })
            .collect();
        (SearchService::new(sources), calls)
    }

    fn query(contexts: &str) -> SearchQuery {
        SearchQuery::new(OWNER, "café", Some(contexts)).unwrap()
    }

    #[tokio::test]
    async fn groups_hits_by_context_in_request_order() {
        let (service, _) = service(&[
            (SearchContext::Finance, 1, false),
            (SearchContext::Notes, 2, false),
        ]);
        let groups = service.search(&query("notes,finance")).await.unwrap();
        let contexts: Vec<_> = groups.iter().map(|g| g.context).collect();
        assert_eq!(contexts, vec![SearchContext::Notes, SearchContext::Finance]);
        assert_eq!(groups[0].items.len(), 2);
    }

    #[tokio::test]
    async fn omits_groups_without_hits() {
        let (service, _) = service(&[
            (SearchContext::Finance, 0, false),
            (SearchContext::Notes, 1, false),
        ]);
        let groups = service.search(&query("finance,notes")).await.unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].context, SearchContext::Notes);
    }

    #[tokio::test]
    async fn queries_only_selected_contexts() {
        let (service, calls) = service(&[
            (SearchContext::Finance, 1, false),
            (SearchContext::Notes, 1, false),
            (SearchContext::Goals, 1, false),
        ]);
        service.search(&query("goals")).await.unwrap();
        assert_eq!(*calls.lock().unwrap(), vec![SearchContext::Goals]);
    }

    #[tokio::test]
    async fn limits_hits_per_context() {
        let (service, _) = service(&[(SearchContext::Notes, 20, false)]);
        let groups = service.search(&query("notes")).await.unwrap();
        assert_eq!(groups[0].items.len(), HITS_PER_CONTEXT);
    }

    #[tokio::test]
    async fn propagates_source_error_as_search_error() {
        let (service, _) = service(&[
            (SearchContext::Finance, 1, false),
            (SearchContext::Journal, 0, true),
        ]);
        let error = service.search(&query("finance,journal")).await.unwrap_err();
        assert_eq!(
            error,
            SearchError::Source {
                context: SearchContext::Journal
            }
        );
    }
}
