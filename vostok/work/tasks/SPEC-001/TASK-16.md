---
id: TASK-16
spec: SPEC-001
title: "Contexto search"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-07, TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13, TASK-14]
wave: 5
covers: [RF-16, CT-12]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 345d13f7bb95e04f8aa1e14a7adf145999e347d996f392077a2613eb5d91a2fc
adjustments: 1
adjusted_at: 2026-10-31T00:27:04Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: ccd5031e4ee769c9a62d1b6afd5029518f8f78d2b60df6bd1538f41bd1a8bc66
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T00:27:04Z
model: sonnet
---

# TASK-16: Contexto search

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-16, RF-59, CT-12, RNF-02, RNF-04, RN-17, decisões 12, 13 e 16, o risco da busca no diário e nas notas e o contrato `GET /search?q=&contexts=`.
- `vostok/memory/decisions.md`, pelo `vostok memory search decision busca financeiro etiquetas prototipo`: DEC-002 (o servidor segue o protótipo), DEC-003 (recorrente com ocorrência aberta e previsão virtual, sem linhas gravadas), DEC-005 (busca `q` no Financeiro) e DEC-006 (etiquetas em metas e tarefas).
- `prototype/atria-prototype.html`: a paleta de comandos (`buildRows`, `searchText`, `KINDS`, `#etiqueta`) e a preferência "Contextos padrão da busca" ("Sem nenhum marcado, a busca olha todos os módulos").
- `vostok/rules/project/architecture.md`, `vostok/rules/project/database.md`, `vostok/rules/project/security.md`, `vostok/rules/project/api.md`, `vostok/rules/project/testing.md` e `vostok/rules/project/code-style.md`.
- `vostok/work/tasks/SPEC-001/TASK-07.md`, `TASK-08.md`, `TASK-09.md`, `TASK-10.md`, `TASK-11.md`, `TASK-12.md`, `TASK-13.md`, `TASK-14.md` e `TASK-15.md`, com os históricos de ajuste: o que cada contexto entrega à busca.
- `vostok/work/tasks/SPEC-001/TASK-06.md` e `apps/server/src/auth/domain/preferences.rs`: `SEARCH_CONTEXTS` (`finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`), padrão com os oito, lista vazia aceita.
- `vostok/work/tasks/SPEC-001/TASK-18.md`: como o router, o migrator e o OpenAPI de cada contexto são registrados sob `/api/v1`.
- `apps/server/Cargo.toml`, `apps/server/build.rs` e `apps/server/src/main.rs`: dependências disponíveis e o `mod search;` já declarado sob `#[cfg(atria_context = "search")]`, ligado quando a pasta existe.
- `apps/server/src/http/session.rs` (`CurrentUser`), `apps/server/src/http/state.rs` (`AppState` com `pool`, `clock` e `ids`), `apps/server/src/http/test_support.rs` (`TestContext`, `sign_in_as`, `send`) e `apps/server/src/shared/error.rs` (`ApiError`, `FieldError`, `problem+json`).
- `apps/server/src/projects/mod.rs` e `apps/server/src/projects/tests/mod.rs`: exemplo de `router()`, `migrator()` com `set_ignore_missing(true)`, `openapi()` e do ambiente de teste de um contexto.
- Finance: `apps/server/src/finance/application/transactions.rs` (`list`, `FinanceItem`), `apps/server/src/finance/application/ports.rs` (`TransactionFilter` com `q`, `repetition` e `category_id`; `TransferFilter` com `q`; `RecurringTransactionRepository::list` com `q`), `apps/server/src/finance/application/transfers.rs`, `apps/server/src/finance/application/accounts.rs` e `apps/server/src/finance/application/categories.rs` (`list_all`), `apps/server/src/finance/domain/forecast.rs` (`FinanceItem::Stored` e `FinanceItem::Virtual`, este sem `id` próprio) e `apps/server/src/finance/infrastructure/mod.rs` (`finance_unaccent` na busca da descrição); `apps/server/src/finance/interface/handlers.rs`: como os handlers montam `PgAccounts`, `PgCategories`, `PgTransactions`, `PgTransfers`, `PgRecurringTransactions` e o `Env`.
- Goals: `apps/server/src/goals/application/goals.rs` (`GoalsService::list_goals`, `GoalFilter` com `text` e `label`) e `apps/server/src/goals/interface/handlers.rs` (`service`).
- Tasks: `apps/server/src/tasks/application/tasks.rs` (`TasksService::list`) e `apps/server/src/tasks/application/ports.rs` (`TaskFilter` com `query` e `label`); `apps/server/src/tasks/interface/handlers.rs` (`service`).
- Reminders: `apps/server/src/reminders/application/reminders.rs` (`ReminderService::list`) e `apps/server/src/reminders/application/ports.rs` (`ReminderFilter` com `query`); `apps/server/src/reminders/interface/handlers.rs` (`service`).
- Notes: `apps/server/src/notes/mod.rs`, `apps/server/src/notes/application/service.rs` (`NoteReader::decrypted_notes_for_owner`, `DecryptedNote`) e `apps/server/src/notes/infrastructure/pg_note_repository.rs` (`NoteReader::from_state`).
- Journal: `apps/server/src/journal/mod.rs`, `apps/server/src/journal/application/entries.rs` (`JournalReader::decrypted_entries_for_owner`, `DecryptedJournalEntry`) e `apps/server/src/journal/infrastructure/pg_journal_entry_repository.rs` (`JournalReader::from_state`).
- Library: `apps/server/src/library/application/search.rs` (`LibrarySearch::search`), `apps/server/src/library/application/ports.rs` (`LibrarySearchHit`), `apps/server/src/library/infrastructure/pg_books.rs` (`LibrarySearch::from_state` e o SQL com `library_unaccent`) e `apps/server/src/library/migrations/20261101130001_create-library.sql` (`search_vector` com `channel` no vídeo).
- Projects: `apps/server/src/projects/application/search.rs` (`ProjectSearch::search`), `apps/server/src/projects/application/ports.rs` (`ProjectSearchHit` com `project_id`) e `apps/server/src/projects/infrastructure/pg_project_repository.rs` (`ProjectSearch::from_state`).

### Mudar

- `apps/server/src/search/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()` e `openapi()`, no padrão dos outros contextos.
- `apps/server/src/search/domain/mod.rs` (criar): `SearchContext`, `SearchQuery`, `SearchHit`, `SearchGroup`, `SearchError`, a normalização para comparação em memória e as regras de validação da consulta, do título e do trecho.
- `apps/server/src/search/application/mod.rs` (criar): a porta `SearchSource` e o `SearchService`, que consulta as fontes escolhidas em paralelo e agrupa os resultados por contexto.
- `apps/server/src/search/infrastructure/mod.rs` (criar): um adaptador `SearchSource` por contexto, que chama o serviço público daquele contexto e converte o resultado em `SearchHit`.
- `apps/server/src/search/interface/mod.rs` (criar): o handler `GET /search`, os DTOs, a conversão de erros em `problem+json`, a anotação OpenAPI e `SearchApi`.
- `apps/server/src/search/migrations/.gitkeep` (criar): mantém a pasta de migrações do contexto, vazia: o contexto não tem tabela própria.
- `apps/server/src/search/tests.rs` (criar): testes de integração com PostgreSQL real, de isolamento, de índices e de desempenho.

### Passos

1. Leia os arquivos de "Ler". A busca nunca lê tabelas de outro contexto ([project/architecture-04]): só chama os serviços listados em "Ler", montados a partir do `AppState` do mesmo jeito que o `interface` de cada contexto monta o seu.
2. Escreva primeiro os testes unitários de `apps/server/src/search/domain/mod.rs` (`#[cfg(test)] mod tests`), que devem falhar: `parses_comma_separated_contexts`, `empty_contexts_mean_all_contexts` (ausente ou `contexts=` vazio vira `SearchContext::ALL`), `rejects_unknown_context` (código `invalid_search_context`), `rejects_blank_query` (código `search_query_empty`), `rejects_query_longer_than_200_chars` (código `search_query_too_long`), `trims_and_collapses_whitespace`, `truncates_title_to_64_chars`, `truncates_snippet_to_160_chars`, `folds_case_and_accents_for_in_memory_match` (`"Café Açúcar"` e `"cafe acucar"` dão o mesmo valor), `label_term_strips_leading_hash` (`"#saúde"` vira `"saúde"`) e `context_names_match_preference_contexts` (os nomes de `SearchContext::ALL`, na ordem, são iguais a `crate::auth::domain::preferences::SEARCH_CONTEXTS`).
3. Implemente o domínio:
   - `enum SearchContext { Finance, Goals, Tasks, Reminders, Notes, Journal, Library, Projects }`, serializado em `snake_case` (`finance`, `goals`, ...), com `SearchContext::ALL` nessa ordem.
   - `SearchQuery { owner_id, text, contexts }`: `text` aparado e com espaços repetidos reduzidos a um; `contexts` ausente ou vazio vira `SearchContext::ALL`, sem duplicatas e na ordem pedida.
   - `SearchHit { context, entity_type: &'static str, id: Uuid, project_id: Option<Uuid>, title: String, snippet: Option<String> }`, com `title` truncado em 64 caracteres e `snippet` em 160 (por caractere, nunca no meio de um caractere).
   - `SearchGroup { context, items }`, `SearchError` com `thiserror` (`InvalidContext`, `EmptyQuery`, `QueryTooLong`, `Source { context }`, este sem o texto da consulta) e o limite fixo `HITS_PER_CONTEXT: usize = 8`.
   - `pub fn fold(text: &str) -> String`: minúsculas com `to_lowercase` e acentos tirados por uma tabela local dos caracteres latinos acentuados (á à â ã ä é è ê ë í ì î ï ó ò ô õ ö ú ù û ü ç ñ e as maiúsculas), sem dependência nova; e `pub fn label_term(text: &str) -> &str`, que tira um `#` inicial.
4. Escreva os testes unitários de `apps/server/src/search/application/mod.rs`, com fontes falsas: `groups_hits_by_context_in_request_order`, `omits_groups_without_hits`, `queries_only_selected_contexts`, `limits_hits_per_context` e `propagates_source_error_as_search_error`.
5. Implemente a porta `pub trait SearchSource: Send + Sync { fn context(&self) -> SearchContext; fn search<'a>(&'a self, query: &'a SearchQuery, limit: usize) -> BoxFuture<'a, Result<Vec<SearchHit>, SearchError>>; }`, com `type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>` no próprio módulo (sem dependência nova), e o `SearchService`, que guarda `Vec<Arc<dyn SearchSource>>`, dispara as fontes escolhidas num `tokio::task::JoinSet`, corta cada uma em `HITS_PER_CONTEXT` e devolve `Vec<SearchGroup>` na ordem de `query.contexts`, omitindo grupos sem resultado.
6. Escreva os testes unitários de `apps/server/src/search/infrastructure/mod.rs` sobre as funções de conversão, sem banco: `skips_virtual_finance_items` (`FinanceItem::Virtual` não vira `SearchHit`), `maps_stored_transaction_with_description`, `maps_project_card_with_project_id` (`ProjectSearchHit` de `project_card` leva `project_id`; o de `project` leva `None`), `maps_library_hits_keeping_entity_type` (`book`, `article`, `video`), `maps_journal_entry_title_from_first_line` e `matches_note_by_title_or_body_without_accents`.
7. Implemente em `apps/server/src/search/infrastructure/mod.rs` um adaptador por contexto, cada um com `owner_id = query.owner_id` e limite `HITS_PER_CONTEXT`:
   - `FinanceSearchSource` (`context = finance`), com as chamadas em paralelo por `tokio::join!` e o resultado na ordem: movimentações, transferências, recorrentes, contas e categorias, até o limite:
     - movimentações gravadas: `finance::application::transactions::list` com `TransactionFilter { q: Some(text), repetition: Repetition::OneOff, ..Default::default() }`, `after = None`, o `Env` de `state.clock` e `state.ids`, e `PgRecurringTransactions` e `PgTransactions` sobre `state.pool`. Só `FinanceItem::Stored` vira hit (`entity_type = "transaction"`, `title` = descrição); `FinanceItem::Virtual` é descartado, inclusive as cópias de previsão. A cópia liquidada de uma recorrente é gravada e aparece como `transaction`.
     - transferências: `finance::application::transfers::list` com `TransferFilter { q: Some(text), ..Default::default() }` e `after = None` (`entity_type = "transfer"`, `title` = descrição).
     - recorrentes: `RecurringTransactionRepository::list(owner_id, Some(text), None, limit)` de `PgRecurringTransactions`, a porta pública da camada `application` do Financeiro, que já busca com `finance_unaccent` (`entity_type = "recurring_transaction"`, `id` = id da recorrente, `title` = descrição). Nenhuma previsão virtual é devolvida.
     - contas e categorias: `accounts::list_all` e `categories::list_all`, filtradas em memória por `fold(name)` contendo `fold(text)` (`entity_type = "account"` e `"category"`, `title` = `name`).
   - `GoalsSearchSource` (`goals`): `GoalsService::list_goals` com `GoalFilter { text: Some(text), limit: 8, ..Default::default() }` e, numa segunda chamada, `GoalFilter { label: Some(label_term(text)), limit: 8, ..Default::default() }`; junta as duas, primeiro as do título, sem repetir id. Um erro de validação da chamada por etiqueta (etiqueta longa demais) conta como lista vazia. `entity_type = "goal"`.
   - `TasksSearchSource` (`tasks`): `TasksService::list` com `TaskFilter { query: Some(text), limit: 8, .. }` e com `TaskFilter { label: Some(label_term(text)), limit: 8, .. }`, juntadas como nas metas. `entity_type = "task"`.
   - `RemindersSearchSource` (`reminders`): `ReminderService::list` com `ReminderFilter { query: Some(text), limit: 8, .. }`. `entity_type = "reminder"`.
   - `NotesSearchSource` (`notes`): `NoteReader::from_state(state).decrypted_notes_for_owner(owner_id)`, filtradas em memória por `fold(title)` ou `fold(body)` contendo `fold(text)`, ordenadas por `updated_at` decrescente; `title` = título, `snippet` = início do corpo. `entity_type = "note"`.
   - `JournalSearchSource` (`journal`): `JournalReader::from_state(state).decrypted_entries_for_owner(owner_id)`, filtradas por `fold(text)` da entrada, ordenadas por `occurred_at` decrescente; `title` = primeira linha não vazia do texto, `snippet` = início do texto. `entity_type = "journal_entry"`.
   - `LibrarySearchSource` (`library`): `LibrarySearch::from_state(state).search(owner_id, text, 8)`, na ordem de relevância devolvida; `entity_type` = o do hit (`book`, `article`, `video`), `title` = o do hit (o vídeo sem título já vem com a URL), sem `snippet`.
   - `ProjectsSearchSource` (`projects`): `ProjectSearch::from_state(state).search(owner_id, text, 8)`, na ordem devolvida; `entity_type` = `project` ou `project_card`; no `project_card`, `project_id` = o do hit. Sem `snippet`.
   - Todo erro de um contexto vira `SearchError::Source { context }`, registrado em log só com o contexto e o id do dono, nunca com o texto nem o conteúdo ([project/security-13]). Expõe `pub fn sources(state: &AppState) -> Vec<Arc<dyn SearchSource>>` com os oito adaptadores na ordem de `SearchContext::ALL`.
8. Escreva os testes de integração em `apps/server/src/search/tests.rs` (`#[cfg(test)] mod tests;` em `mod.rs`). O ambiente usa `TestContext` de `apps/server/src/http/test_support.rs`, roda o `migrator()` de `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library` e `projects`, monta `search::router()` com o `merge` dos `router()` desses oito contextos e cria os dados pelas rotas `POST` de cada contexto, com a sessão do dono (`ALICE`, `BOB`). Testes:
   - `search_returns_groups_from_all_contexts_when_contexts_absent` e `search_with_empty_contexts_param_searches_all` (`contexts=` vazio, como a preferência sem nenhum contexto marcado).
   - `search_respects_selected_contexts`.
   - `search_finds_journal_and_note_text_decrypted_in_memory`.
   - `search_finds_stored_transactions_and_transfers_without_accents` (`cafe` acha a movimentação e a transferência com "Café" na descrição).
   - `search_finds_recurring_transaction_but_not_virtual_occurrences` (a recorrente "Aluguel" aparece uma vez, como `recurring_transaction` com o id dela, e nenhum item `transaction` sem cópia gravada aparece para ela).
   - `search_finds_goals_and_tasks_by_label` (meta e tarefa com a etiqueta `saúde`, sem o termo no título, aparecem com `saúde` e com `#saúde`).
   - `search_finds_video_by_channel`.
   - `search_returns_project_card_with_project_id` (o item `project_card` traz o `project_id` do projeto dele).
   - `search_never_returns_other_users_entities` (BOB busca os termos de ALICE em todos os contextos e não recebe nenhum grupo).
   - `search_ignores_shared_visibility_of_other_users` (ALICE marca `visibility: "shared"`; BOB continua sem resultado, RN-17).
   - `search_rejects_unknown_context_with_problem_json`, `search_rejects_blank_query` e `search_requires_session` (401 sem sessão).
   - `library_and_projects_tables_have_gin_tsvector_index`: com `sqlx::query(...).bind(...)` sobre `pg_attribute` e `pg_indexes`, exige uma coluna `tsvector` com índice GIN em `books`, `articles`, `videos`, `projects` e `project_cards`.
   - `search_latency_with_ten_thousand_entities`, marcado com `#[ignore = "medição de desempenho: rodar em release"]`: cria 10 mil entidades de ALICE distribuídas pelos oito contextos (2 mil delas no diário e nas notas), faz 20 buscas pelo router com `tower::ServiceExt::oneshot`, imprime `search_latency p95_ms=<valor>` e falha se o p95 passar de 300 ms.
   Confirme que falham.
9. Implemente `apps/server/src/search/interface/mod.rs`: `GET /search` com `q` e `contexts` (lista separada por vírgula, opcional), sessão obrigatória pelo extrator `CurrentUser`, `SearchService::new(infrastructure::sources(&state))`, resposta `200` com `{ "groups": [{ "context": "projects", "items": [{ "entity_type": "project_card", "id": "...", "project_id": "...", "title": "...", "snippet": null }] }] }` em `snake_case`, `422 application/problem+json` com os códigos do domínio pelo `ApiError::unprocessable` e `500` pelo `ApiError::internal` em `SearchError::Source`. Anote com `#[utoipa::path(get, path = "/search", ...)]`, caminho relativo a `/api/v1`, e declare `#[derive(OpenApi)] pub struct SearchApi` com o caminho e os schemas.
10. Escreva `apps/server/src/search/mod.rs` com `pub mod domain; pub mod application; pub mod infrastructure; pub mod interface;`, `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` com `sqlx::migrate!("src/search/migrations")` e `set_ignore_missing(true)`, `pub fn openapi() -> utoipa::openapi::OpenApi` com `SearchApi::openapi()` e `#[allow(unused_imports)] pub use interface::SearchApi;`. Crie `apps/server/src/search/migrations/.gitkeep` vazio (o `sqlx::migrate!` ignora arquivos que não terminam em `.sql`). Não altere `main.rs`, `build.rs` nem `http`: o `mod search;` já existe e é ligado pela pasta. Se a declaração não existir, pare e registre o bloqueio: é ponto de integração.
11. Rode `cargo test -p atria-server search::` até passar, depois o teste de desempenho em release (comando da Verificação). Se `library_and_projects_tables_have_gin_tsvector_index` ou o p95 falharem por causa de outro contexto, não altere aquele contexto: pare e registre o bloqueio com a tabela ou o tempo medido.
12. Rode `cargo fmt` e `cargo clippy -p atria-server -- -D warnings` e corrija os avisos, sem `unwrap`, `expect` nem `panic!` fora dos testes.

### Baseline

- `cargo test -p atria-server search:: 2>&1 | grep -E "^test result|running [0-9]+ tests" || true`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# unitários e integração do contexto: todos passam
cargo test -p atria-server search::
# RNF-04: p95 de até 300 ms com 10 mil entidades
cargo test -p atria-server --release search::tests::search_latency_with_ten_thousand_entities -- --ignored --exact --nocapture
```

### Evidências

- `search-tests.txt` (automática): `cargo test -p atria-server search:: 2>&1`
  - Prova: a busca agrupa por contexto, respeita os contextos escolhidos e a lista vazia da preferência, acha diário e notas em memória, movimentações, transferências e recorrentes gravadas sem previsões virtuais, metas e tarefas pela etiqueta, vídeo pelo canal e cartão com o projeto, e nunca devolve dados de outro usuário (RF-16, RF-59, CT-12, RNF-02).
  - Trecho: as linhas `test search::tests::search_respects_selected_contexts ... ok`, `test search::tests::search_finds_recurring_transaction_but_not_virtual_occurrences ... ok`, `test search::tests::search_finds_goals_and_tasks_by_label ... ok`, `test search::tests::search_returns_project_card_with_project_id ... ok`, `test search::tests::search_never_returns_other_users_entities ... ok`, `test search::tests::search_finds_journal_and_note_text_decrypted_in_memory ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou nenhum teste `search::` listado.
- `search-latency.txt` (automática): `cargo test -p atria-server --release search::tests::search_latency_with_ten_thousand_entities -- --ignored --exact --nocapture 2>&1`
  - Prova: a busca responde dentro do limite com 10 mil entidades (RNF-04).
  - Trecho: a linha `search_latency p95_ms=` com valor até 300 e `test result: ok. 1 passed`.
  - Falha: `p95_ms=` acima de 300, `FAILED` ou `0 passed`.
  - Artefato: build `release` do crate `atria-server`.

### Concluída quando

- [x] `GET /api/v1/search` busca em todos os contextos quando `contexts` não é enviado ou vem vazio e só nos escolhidos quando é, com os resultados agrupados por contexto e os mesmos nomes de contexto da preferência "Contextos padrão da busca" (RF-16, RF-59, CT-12).

  > Como comprovar: em `search-tests.txt`, ver `search_returns_groups_from_all_contexts_when_contexts_absent`, `search_with_empty_contexts_param_searches_all`, `search_respects_selected_contexts` e `context_names_match_preference_contexts` como `ok`.

- [x] No Financeiro, a busca acha movimentações e transferências gravadas sem diferenciar acentos e a recorrente pela descrição, sem devolver previsões virtuais (RF-16).

  > Como comprovar: em `search-tests.txt`, ver `search_finds_stored_transactions_and_transfers_without_accents`, `search_finds_recurring_transaction_but_not_virtual_occurrences` e `skips_virtual_finance_items` como `ok`.

- [x] Metas e tarefas são achadas pelo título e pela etiqueta, o vídeo pelo canal, e o cartão de projeto vem com o `project_id` para o link `/projects/<project_id>/cards/<id>` (RF-16).

  > Como comprovar: em `search-tests.txt`, ver `search_finds_goals_and_tasks_by_label`, `search_finds_video_by_channel`, `search_returns_project_card_with_project_id` e `maps_project_card_with_project_id` como `ok`.

- [x] O texto do diário e das notas é encontrado pela busca, descriptografado em memória só para o dono, e as tabelas do Acervo e de Projetos têm coluna `tsvector` com índice GIN (RF-16).

  > Como comprovar: em `search-tests.txt`, ver `search_finds_journal_and_note_text_decrypted_in_memory` e `library_and_projects_tables_have_gin_tsvector_index` como `ok`.

- [x] Nenhum usuário recebe resultado de outro, mesmo de entidade marcada como compartilhada, e sem sessão a resposta é 401 (RF-16, RNF-02).

  > Como comprovar: em `search-tests.txt`, ver `search_never_returns_other_users_entities`, `search_ignores_shared_visibility_of_other_users` e `search_requires_session` como `ok`.

- [x] Consulta vazia ou contexto desconhecido devolvem 422 em `problem+json` com código estável (CT-12).

  > Como comprovar: em `search-tests.txt`, ver `search_rejects_blank_query` e `search_rejects_unknown_context_with_problem_json` como `ok`.

- [x] Com 10 mil entidades de um usuário, o p95 da busca fica em até 300 ms (RNF-04).

  > Como comprovar: abrir `search-latency.txt` e ver `search_latency p95_ms=` com número até 300 e o teste aprovado.

- [x] O código passa no `cargo fmt --check` e no `cargo clippy -- -D warnings` (RF-16).

  > Como comprovar: rodar a Verificação e ver os dois comandos terminarem sem erro nem aviso.

## Descrição

### Resumo executivo

Entrega a busca global do Atria: um único ponto que encontra finanças, metas, tarefas, lembretes, notas, diário, acervo e projetos, em tudo ou só nas áreas que a pessoa escolher.
No Financeiro, acha o que foi registrado e as recorrentes, sem misturar previsões; metas e tarefas também são achadas pela etiqueta.
O diário e as notas continuam protegidos: o conteúdo só é aberto em memória, para a própria pessoa, na hora de buscar.
Perfil padrão; o risco principal é a busca ficar lenta com muito volume, medido contra o limite de 300 ms.
Desbloqueia a integração do servidor e, depois dela, a paleta de comandos e a busca da barra superior.

### Detalhes técnicos

- **Abordagem:** o contexto `search` é um agregador. A porta `SearchSource` (camada `application`) tem um adaptador por contexto (camada `infrastructure`) que chama o serviço público daquele contexto; o `SearchService` consulta as fontes escolhidas em paralelo (`tokio::task::JoinSet`) e devolve grupos por contexto, com até 8 resultados cada.
- **O que cada contexto expõe e como é usado:**
  - Finance (TASK-07): `transactions::list` devolve `FinanceItem` (`Stored` ou `Virtual`, este sem `id` próprio), com `q`, `repetition` e `category_id`; `transfers::list` com `q`; `RecurringTransactionRepository::list` com `q`; `accounts::list_all` e `categories::list_all`. A descrição é buscada com `finance_unaccent` (DEC-005).
  - Goals (TASK-08) e Tasks (TASK-09): listagens com `text`/`query` no título e `label` exato (DEC-006).
  - Reminders (TASK-10): `ReminderService::list` com `query` no título.
  - Notes (TASK-11) e Journal (TASK-12): `NoteReader::from_state` e `JournalReader::from_state`, que entregam o conteúdo já descriptografado, só do dono.
  - Library (TASK-13): `LibrarySearch::from_state` e `LibrarySearchHit` (`book`, `article`, `video`), sobre `tsvector` com `library_unaccent`; o vídeo é achado também pelo `channel`.
  - Projects (TASK-14): `ProjectSearch::from_state` e `ProjectSearchHit` (`project`, `project_card`, com `project_id`).
- **Decisão: agregar pelos serviços dos contextos.** Descartado consultar direto as tabelas dos outros contextos, que viola [project/architecture-04], e descartado manter uma tabela própria de índice (`search_documents`), que exigiria que todos os contextos, já prontos, publicassem eventos de alteração. Nas recorrentes, a busca usa a porta `RecurringTransactionRepository::list`, da camada `application` do Financeiro, porque o caso de uso `recurring_transactions::list` não recebe `q`; descartado alterar o Financeiro, que está pronto.
- **Decisão: Financeiro só com o que está gravado.** Movimentações (inclusive as cópias liquidadas) e transferências gravadas são achadas; a recorrente é achada como `recurring_transaction`; as previsões virtuais (`FinanceItem::Virtual`) não entram, porque não têm `id` próprio nem tela e repetiriam a mesma recorrente uma vez por data (DEC-003). Descartado devolver a previsão com o id da recorrente, que duplicaria resultados. Contas e categorias seguem na busca, filtradas em memória pelo nome, como no protótipo.
- **Decisão: etiquetas de metas e tarefas entram na busca.** O protótipo busca pelo texto das etiquetas e oferece `#etiqueta` na paleta; o servidor só tem o filtro de etiqueta exata, então o adaptador faz uma segunda listagem com `label` = o termo sem `#` inicial e junta sem repetir. Descartado deixar as etiquetas fora, que contraria o protótipo (DEC-002), e alterar as listagens das TASK-08 e TASK-09 para buscar etiqueta por trecho.
- **Decisão: status do acervo fora do resultado.** O livro tem `reading_status` e o vídeo `watch_status`, mas a paleta do protótipo mostra só o título e o tipo, e o `LibrarySearchHit` não traz o status; descartado ampliar o hit, que mudaria o Library.
- **Decisão: `project_id` no resultado do cartão.** O item `project_card` leva `project_id`, e a paleta (TASK-32) monta o link `/projects/<project_id>/cards/<id>`, a mesma rota da TASK-30 e da TASK-31. Descartado o servidor devolver a URL da tela, que acoplaria a API às rotas do frontend.
- **Decisão: sem `updated_at` no resultado.** `LibrarySearchHit` e `ProjectSearchHit` não trazem a data de alteração; descartado pedi-la aos contextos prontos.
- **Decisão: diário e notas em memória.** Seguem a decisão 13 da spec e [project/security-18]: `NoteReader` e `JournalReader` descriptografam só os dados do dono, e a busca filtra em memória com `fold` (minúsculas e sem acentos, por tabela local). Descartado o índice cego, recusado na spec, e uma dependência de normalização Unicode ([project/stack-12]).
- **Decisão: grupos por contexto, sem ranking global.** As pontuações de `ts_rank`, do `LIKE` e da busca em memória não são comparáveis; a paleta (TASK-32) já mostra os resultados por contexto. Descartado um ranking único misturando as fontes.
- **Decisão: contextos padrão vêm do frontend.** As preferências da TASK-06 (`search_contexts`) usam os mesmos oito nomes de `SearchContext`, na mesma ordem, conferidos pelo teste `context_names_match_preference_contexts`; a paleta envia os contextos escolhidos ou os da preferência, e `contexts` ausente ou vazio busca em tudo, como o protótipo ("Sem nenhum marcado, a busca olha todos os módulos"). Descartado o servidor ler as preferências do contexto `auth`, que acoplaria os dois contextos.
- **Decisão: sem dependência nova.** O futuro da porta é um `Pin<Box<dyn Future>>` local, em vez de `async-trait` ([project/stack-12]).
- **Decisão: sem tabela própria.** O contexto só lê pelos serviços dos contextos, que abrem a transação com `set_config('app.current_user_id', $1, true)` e passam pelas políticas de RLS dos donos. A pasta de migrações fica vazia; uma migração futura usa o prefixo `2026110116000X_<descricao-kebab>.sql`, `sqlx::query` com `.bind` (a TASK-18 converte para macros) e, com tabela de dono, a política `owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid`, como os outros contextos.
- **O que a busca espera da TASK-18:** registrar `search::router()` no `merge` de `api_router()` sob `/api/v1` (rota relativa `/search`, como o `#[utoipa::path]`), dentro das camadas de sessão, CSRF, cabeçalhos e `auth::require_complete_account()`; incluir `search::migrator()` em `migrators()` entre `links` e `reports`, com `set_ignore_missing(true)`; juntar `search::openapi()` ao `ApiDoc` com o servidor `/api/v1`; trocar o `#[cfg(atria_context = "search")] #[allow(dead_code)] mod search;` do `main.rs` por `mod search;`; e cobrir `/search` no teste `search_reports_and_exports_never_leak_other_users_data`. A busca não precisa de `Extension`: nem `links::EntityDeletedHook` nem `reminders::WebPushPolicy`; tudo vem do `AppState` (`pool`, `cipher` dos leitores, `clock` e `ids`).
- **Riscos:** a busca em memória do diário e das notas pode passar de 300 ms com muito volume (risco médio da spec), coberto pelo teste `search_latency_with_ten_thousand_entities`. Finance, goals, tasks e reminders não têm `tsvector` ([project/database-06]) e buscam por `LIKE` nas listagens; o teste de índice cobre só o Acervo e Projetos, e a falta fica registrada como pendência daqueles contextos, sem correção aqui. As listagens do Financeiro vêm em ordem de data efetiva crescente, então os 8 primeiros resultados são os mais antigos. `accounts::list_all` garante a conta padrão, como a listagem de contas já faz. Um contexto com listagem lenta bloqueia a tarefa, porque a correção é no contexto dele.
- **Referências:** RF-16, RF-59, CT-12, RNF-02, RNF-04, RN-17, decisões 12, 13 e 16; DEC-002, DEC-003, DEC-005 e DEC-006; [project/architecture-04], [project/database-06], [project/database-09], [project/security-04], [project/security-13], [project/security-18], [project/api-01], [project/api-03], [project/testing-03].
- **Arquivos em comum na onda 5:** nenhum; a TASK-17 e a TASK-36 mexem em outras pastas.

### Card

- **Título:** Contexto search
- **Tipo:** historia
- **Descrição:** Busca global no servidor por todas as áreas ou pelos contextos escolhidos, sobre os serviços que cada contexto já expõe: Financeiro só com o que está gravado e as recorrentes, metas e tarefas também pela etiqueta, diário e notas buscados em memória e isolamento total entre usuários.
- **Critérios de aceite:**
  - [ ] A busca encontra entidades de todos os contextos ou só dos escolhidos, agrupadas por contexto, e lista vazia de contextos busca em tudo.
  - [ ] No Financeiro, acha movimentações e transferências gravadas e a recorrente, sem previsões virtuais.
  - [ ] Metas e tarefas são achadas pela etiqueta, o vídeo pelo canal, e o cartão traz o projeto para o link.
  - [ ] Diário e notas são encontrados sem guardar o texto em claro.
  - [ ] Nenhum usuário vê resultados de outro.
  - [ ] Responde em até 300 ms com 10 mil entidades.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-07, TASK-08, TASK-09, TASK-10, TASK-11, TASK-12, TASK-13, TASK-14

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-31 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-31 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): o comando conta os testes do módulo search criado pela tarefa (0 -> 38); aceito(s): 1 |
| 6 | 2026-10-31 | regressão | passed | 0 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 7 | 2026-10-31 | evidências | passed | 2 evidência(s) em evidence/TASK-16/ |
| 8 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 9 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-31 | agente | Ler com o código real de cada contexto, DEC-002 a DEC-006, protótipo, TASK-06 e TASK-18; Finance com FinanceItem: só gravadas (movimentações, cópias liquidadas e transferências) e a recorrente pela porta RecurringTransactionRepository::list, sem previsões virtuais; Library por LibrarySearch (vídeo pelo channel, status fora do resultado); Projects por ProjectSearch com project_id no project_card para /projects/<project_id>/cards/<id>; Notes e Journal por NoteReader::from_state e JournalReader::from_state com fold em memória; etiquetas de metas e tarefas na busca (inferência, protótipo); contextos alinhados a SEARCH_CONTEXTS da TASK-06, lista vazia busca tudo; SearchHit sem updated_at e com project_id; mod.rs com openapi() e migrator com set_ignore_missing; teste de índice restrito ao Acervo e Projetos; Detalhes técnicos com o que a busca espera da TASK-18; Passos, Verificação, Evidências, Concluída quando e card atualizados; linha de Baseline que citava apps/server/src/search/mod.rs, criado pela tarefa, removida (inferência) |
