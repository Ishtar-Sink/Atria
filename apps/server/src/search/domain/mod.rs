//! Tipos e regras da busca global: contextos, consulta, resultado e a normalização
//! para a comparação em memória (RF-16, CT-12). Sem framework, banco nem HTTP.

use uuid::Uuid;

/// Limite de resultados por contexto.
pub const HITS_PER_CONTEXT: usize = 8;
pub const QUERY_MAX_CHARS: usize = 200;
pub const TITLE_MAX_CHARS: usize = 64;
pub const SNIPPET_MAX_CHARS: usize = 160;

/// Contexto onde a busca procura; os nomes são os da preferência "Contextos padrão
/// da busca".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SearchContext {
    Finance,
    Goals,
    Tasks,
    Reminders,
    Notes,
    Journal,
    Library,
    Projects,
}

impl SearchContext {
    pub const ALL: [SearchContext; 8] = [
        Self::Finance,
        Self::Goals,
        Self::Tasks,
        Self::Reminders,
        Self::Notes,
        Self::Journal,
        Self::Library,
        Self::Projects,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Finance => "finance",
            Self::Goals => "goals",
            Self::Tasks => "tasks",
            Self::Reminders => "reminders",
            Self::Notes => "notes",
            Self::Journal => "journal",
            Self::Library => "library",
            Self::Projects => "projects",
        }
    }

    fn parse(name: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|context| context.as_str() == name)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SearchError {
    #[error("invalid_search_context")]
    InvalidContext,
    #[error("search_query_empty")]
    EmptyQuery,
    #[error("search_query_too_long")]
    QueryTooLong,
    /// Sem o texto da consulta: ele nunca vai para log nem para erro ([project/security-13]).
    #[error("search_source_failed")]
    Source { context: SearchContext },
}

impl SearchError {
    /// Código estável da API.
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidContext => "invalid_search_context",
            Self::EmptyQuery => "search_query_empty",
            Self::QueryTooLong => "search_query_too_long",
            Self::Source { .. } => "search_source_failed",
        }
    }
}

/// Consulta validada: texto aparado e contextos sem repetição.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchQuery {
    pub owner_id: Uuid,
    pub text: String,
    pub contexts: Vec<SearchContext>,
}

impl SearchQuery {
    /// `contexts` é a lista separada por vírgula do pedido; ausente ou vazia busca em
    /// todos os contextos.
    pub fn new(owner_id: Uuid, text: &str, contexts: Option<&str>) -> Result<Self, SearchError> {
        let text = collapse_whitespace(text);
        if text.is_empty() {
            return Err(SearchError::EmptyQuery);
        }
        if text.chars().count() > QUERY_MAX_CHARS {
            return Err(SearchError::QueryTooLong);
        }
        Ok(Self {
            owner_id,
            text,
            contexts: parse_contexts(contexts)?,
        })
    }
}

fn parse_contexts(raw: Option<&str>) -> Result<Vec<SearchContext>, SearchError> {
    let mut contexts: Vec<SearchContext> = Vec::new();
    for name in raw.unwrap_or_default().split(',').map(str::trim) {
        if name.is_empty() {
            continue;
        }
        let context = SearchContext::parse(name).ok_or(SearchError::InvalidContext)?;
        if !contexts.contains(&context) {
            contexts.push(context);
        }
    }
    if contexts.is_empty() {
        return Ok(SearchContext::ALL.to_vec());
    }
    Ok(contexts)
}

/// Aparado e com cada sequência de espaços reduzida a um.
fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_chars(text: String, max: usize) -> String {
    match text.char_indices().nth(max) {
        Some((end, _)) => text[..end].to_owned(),
        None => text,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchHit {
    pub context: SearchContext,
    pub entity_type: &'static str,
    pub id: Uuid,
    /// Só no cartão de projeto: o projeto dele, para o link do cartão.
    pub project_id: Option<Uuid>,
    pub title: String,
    pub snippet: Option<String>,
}

impl SearchHit {
    pub fn new(
        context: SearchContext,
        entity_type: &'static str,
        id: Uuid,
        title: String,
        snippet: Option<String>,
    ) -> Self {
        Self {
            context,
            entity_type,
            id,
            project_id: None,
            title: truncate_chars(title, TITLE_MAX_CHARS),
            snippet: snippet
                .filter(|text| !text.is_empty())
                .map(|text| truncate_chars(text, SNIPPET_MAX_CHARS)),
        }
    }

    pub fn with_project(mut self, project_id: Uuid) -> Self {
        self.project_id = Some(project_id);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchGroup {
    pub context: SearchContext,
    pub items: Vec<SearchHit>,
}

/// Minúsculas e sem acento (letras latinas), para comparar texto já em memória, como o
/// diário e as notas, que o banco só guarda cifrados.
pub fn fold(text: &str) -> String {
    text.to_lowercase().chars().map(strip_accent).collect()
}

fn strip_accent(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        'ñ' => 'n',
        other => other,
    }
}

/// O termo sem o `#` inicial, para procurar por etiqueta.
pub fn label_term(text: &str) -> &str {
    text.strip_prefix('#').unwrap_or(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::domain::preferences::SEARCH_CONTEXTS;

    const OWNER: Uuid = Uuid::from_u128(1);

    fn query(text: &str, contexts: Option<&str>) -> Result<SearchQuery, SearchError> {
        SearchQuery::new(OWNER, text, contexts)
    }

    #[test]
    fn parses_comma_separated_contexts() {
        let parsed = query("café", Some("notes, finance,notes")).unwrap();
        assert_eq!(
            parsed.contexts,
            vec![SearchContext::Notes, SearchContext::Finance]
        );
    }

    #[test]
    fn empty_contexts_mean_all_contexts() {
        assert_eq!(
            query("café", None).unwrap().contexts,
            SearchContext::ALL.to_vec()
        );
        assert_eq!(
            query("café", Some("")).unwrap().contexts,
            SearchContext::ALL.to_vec()
        );
    }

    #[test]
    fn rejects_unknown_context() {
        let error = query("café", Some("notes,mail")).unwrap_err();
        assert_eq!(error.code(), "invalid_search_context");
    }

    #[test]
    fn rejects_blank_query() {
        assert_eq!(
            query("  \t ", None).unwrap_err().code(),
            "search_query_empty"
        );
    }

    #[test]
    fn rejects_query_longer_than_200_chars() {
        assert!(query(&"a".repeat(200), None).is_ok());
        let error = query(&"a".repeat(201), None).unwrap_err();
        assert_eq!(error.code(), "search_query_too_long");
    }

    #[test]
    fn trims_and_collapses_whitespace() {
        assert_eq!(
            query("  pagar   a \t luz ", None).unwrap().text,
            "pagar a luz"
        );
    }

    #[test]
    fn truncates_title_to_64_chars() {
        let hit = SearchHit::new(SearchContext::Notes, "note", OWNER, "é".repeat(100), None);
        assert_eq!(hit.title.chars().count(), 64);
    }

    #[test]
    fn truncates_snippet_to_160_chars() {
        let hit = SearchHit::new(
            SearchContext::Notes,
            "note",
            OWNER,
            "t".to_owned(),
            Some("ç".repeat(300)),
        );
        assert_eq!(hit.snippet.unwrap().chars().count(), 160);
    }

    #[test]
    fn folds_case_and_accents_for_in_memory_match() {
        assert_eq!(fold("Café Açúcar"), "cafe acucar");
        assert_eq!(fold("cafe acucar"), "cafe acucar");
    }

    #[test]
    fn label_term_strips_leading_hash() {
        assert_eq!(label_term("#saúde"), "saúde");
        assert_eq!(label_term("saúde"), "saúde");
    }

    #[test]
    fn context_names_match_preference_contexts() {
        let names: Vec<&str> = SearchContext::ALL.iter().map(|c| c.as_str()).collect();
        assert_eq!(names, SEARCH_CONTEXTS.to_vec());
    }
}
