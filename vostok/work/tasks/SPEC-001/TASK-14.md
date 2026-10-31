---
id: TASK-14
spec: SPEC-001
title: "Contexto projects"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-54, RF-55, RF-56, RF-57, CT-30]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 75d64790517402eb6689de754d77855952dbed1afa80b1b126b87e6f12433de7
adjustments: 3
adjusted_at: 2026-10-30T21:39:57Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 749ece7ff095294148601439f9430d56e6b4589d144ff2030d1864be3710ac19
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T21:39:57Z
---

# TASK-14: Contexto projects

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-54 a RF-57, RN-16, RN-20, CB-06, CB-07, CB-08, CT-30, contrato `GET|POST /projects, /projects/{id}/lanes, /projects/{id}/cards`, decisões 5 e 53 a 56.
- `docs/decisoes-do-prototipo.md`: linhas PD-12 (cor HEX livre), PD-41 a PD-46 (abas, Visão geral, conclusão por raia, raia, botão de cartão na raia e campos do cartão) e a seção "Decisões resolvidas em 30/10 (DEC-002)".
- Decisões DEC-002 e DEC-003 da memória, por `vostok memory search decision DEC-002 DEC-003` (não abra o arquivo de memória inteiro, [agent/memory-01]).
- `vostok/rules/project/architecture.md`
- `vostok/rules/project/security.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/frontend.md`: [project/frontend-14], para a prioridade e o prazo vencido, que o servidor só marca (`overdue`), sem tom de urgência.
- `apps/server/Cargo.toml`: dependências já declaradas pela TASK-04.
- `apps/server/src/main.rs`: como os módulos dos contextos são declarados (só leitura; não alterar).
- `apps/server/src/shared/mod.rs`: erro `problem+json`, UUID v7, relógio injetável, visibilidade e paginação por cursor opaco base64url (chave de ordenação + id) da TASK-04.
- `apps/server/src/http/mod.rs`: `AppState`, extrator do usuário autenticado e auxiliar de testes de `apps/server/src/http` da TASK-04, que monta o app com sessão e CSRF e cria sessões de usuários de teste (só leitura; não alterar).
- `apps/server/src/goals/application/ports.rs`: grafia exata do alias `EntityDeletedHook`, a ser copiada.
- `apps/server/src/goals/interface/handlers.rs`: exemplo de handler que extrai `Option<Extension<EntityDeletedHook>>` e chama o gancho depois do commit.
- `apps/server/src/links/domain/link.rs`: o tipo ligável `project_card` já existe; a ligação do cartão com a tarefa é do contexto `links` (só leitura; não alterar).
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato do gancho `EntityDeletedHook` (CB-06).
- `vostok/work/tasks/SPEC-001/TASK-31.md`: aba Conexões, que mostra o título e o link do cartão ligado a uma tarefa e só conhece o id do cartão, consumidora de `GET /cards/{card_id}`.
- Código parcial já existente em `apps/server/src/projects/` (`mod.rs`, `domain/*.rs`, `migrations/20261101140001_create-projects.sql`, `tests/*.rs`), escrito antes deste ajuste: é mantido e completado.

### Mudar

- `apps/server/src/projects/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()`, `openapi()` e o `ProjectSearch` para a busca; já existe parcial e é completado.
- `apps/server/src/projects/domain/mod.rs` (criar): módulo do domínio, com o novo `summary`; já existe parcial.
- `apps/server/src/projects/domain/project.rs` (criar): agregação `Project` com raias padrão (Pronto marcada como concluída), regras de raia (RN-16, CB-07, CB-08), cartão criado na raia escolhida (PD-45) e progresso pelas raias marcadas (PD-43), com testes unitários; já existe parcial.
- `apps/server/src/projects/domain/lane.rs` (criar): `Lane` com `counts_as_done`, `LaneColor` como HEX `#rrggbb` validado (PD-12) e `SystemLane`, com testes unitários; já existe parcial com a cor em token, que é trocada.
- `apps/server/src/projects/domain/card.rs` (criar): `Card` com prioridade, etiquetas, prazo e checklist (PD-46), `ChecklistItem`, `CardPriority` e a movimentação entre raias, com testes unitários; já existe parcial.
- `apps/server/src/projects/domain/summary.rs` (criar): `ProjectSummary` da Visão geral (PD-42), calculado em memória a partir do projeto e da data de hoje, com testes unitários.
- `apps/server/src/projects/domain/error.rs` (criar): `ProjectError` tipado com `thiserror`; já existe.
- `apps/server/src/projects/application/mod.rs` (criar): módulo da aplicação.
- `apps/server/src/projects/application/ports.rs` (criar): trait `ProjectRepository`, com `find_card_project` para a leitura do cartão só pelo id, e alias `EntityDeletedHook`.
- `apps/server/src/projects/application/service.rs` (criar): casos de uso de projetos, raias, cartões (inclusive `get_card_by_id`) e resumo.
- `apps/server/src/projects/application/search.rs` (criar): `ProjectSearch` sobre o `tsvector` para a TASK-16.
- `apps/server/src/projects/infrastructure/mod.rs` (criar): módulo da infraestrutura.
- `apps/server/src/projects/infrastructure/pg_project_repository.rs` (criar): repositório PostgreSQL de projetos, raias, cartões e itens do checklist.
- `apps/server/src/projects/interface/mod.rs` (criar): montagem do `router()`, com a rota `GET /cards/{card_id}`.
- `apps/server/src/projects/interface/dto.rs` (criar): corpos de requisição e resposta com `utoipa::ToSchema`.
- `apps/server/src/projects/interface/handlers.rs` (criar): handlers axum, inclusive `get_card_by_id`, e conversão de `ProjectError` em `problem+json`.
- `apps/server/src/projects/interface/openapi.rs` (criar): `ProjectsApi` (`utoipa::OpenApi`) do contexto, com o caminho `GET /cards/{card_id}`.
- `apps/server/src/projects/migrations/20261101140001_create-projects.sql` (criar): tabelas `projects`, `project_lanes`, `project_cards` e `project_card_checklist_items`, `tsvector`, índices e Row Level Security; já existe parcial e ganha a cor HEX, `counts_as_done`, os campos do cartão e a tabela do checklist.
- `apps/server/src/projects/tests/mod.rs` (criar): módulo de testes de integração do contexto; já existe vazio.
- `apps/server/src/projects/tests/api.rs` (criar): testes de integração HTTP contra PostgreSQL em container, inclusive os de `GET /cards/{card_id}`; já existe vazio.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes reais que a TASK-04 criou: `AppState` e seus campos (pool, relógio, gerador de ids), extrator do usuário autenticado, erro `problem+json`, enum de visibilidade, paginação por cursor opaco base64url (chave de ordenação + id), transação que abre com `set_config('app.current_user_id', $1, true)` e auxiliar de testes de `apps/server/src/http` (sessões de usuários de teste com CSRF, pool em container, app de teste, requisição autenticada com CSRF). Use esses nomes; não crie equivalentes. O código parcial de `apps/server/src/projects/` é mantido: altere-o nos pontos abaixo, sem recriar do zero o que já segue a tarefa.
2. Ajuste `apps/server/src/projects/migrations/20261101140001_create-projects.sql` (a migração ainda não foi aplicada em nenhum banco fora dos containers de teste, então é editada no lugar). Todas as tabelas com `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared'))`, `created_at` e `updated_at TIMESTAMPTZ NOT NULL`:
   - `projects`: como está (`name` 1 a 200, `description` até 10000, `deleted_at`, `search_vector` com nome e descrição).
   - `project_lanes`: como está, trocando a coluna `color` por `color TEXT NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$')` (sem `DEFAULT`; o domínio grava em minúsculas) e acrescentando `counts_as_done BOOLEAN NOT NULL DEFAULT false`.
   - `project_cards`: como está, acrescentando `priority TEXT NULL CHECK (priority IN ('low','medium','high'))`, `labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20)`, `due_date DATE NULL` e o índice `project_cards_due_idx ON project_cards (project_id, due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL`. Nenhuma coluna de tarefa ligada (DEC-003).
   - `project_card_checklist_items` (nova): `card_id UUID NOT NULL REFERENCES project_cards(id) ON DELETE CASCADE`, `text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300)`, `done BOOLEAN NOT NULL DEFAULT false`, `position INT NOT NULL CHECK (position >= 0)`, `CONSTRAINT project_card_checklist_items_position_uniq UNIQUE (card_id, position) DEFERRABLE INITIALLY DEFERRED` e o índice `project_card_checklist_items_card_idx ON project_card_checklist_items (card_id)`.
   - Mantenha os índices, a extensão `unaccent` e a função `projects_unaccent(text)`. `ENABLE` e `FORCE ROW LEVEL SECURITY` nas quatro tabelas, com políticas `<tabela>_owner_isolation` comparando `owner_id` a `NULLIF(current_setting('app.current_user_id', true), '')::uuid` em `USING` e `WITH CHECK`, como já está nas três primeiras. Sem FK para tarefas nem para outro contexto: a ligação cartão-tarefa é do contexto `links` (RN-20, DEC-003).
3. Escreva primeiro os testes unitários novos ou alterados, que devem falhar:
   - em `lane.rs`: troque `lane_color_accepts_only_palette` por `lane_color_accepts_only_hex_rrggbb` (aceita `#1A2b3C` e grava `#1a2b3c`; recusa `neutral`, `#fff`, `#12345g`, `123456`, `#1234567` e vazio com `ProjectError::Validation`); mantenha `renaming_system_lane_keeps_system_key` e `lane_name_limited_to_100_chars`.
   - em `project.rs`: altere `new_project_has_default_lanes_waiting_in_progress_done` para conferir também as cores padrão `#92400e`, `#6d28d9` e `#047857`; acrescente `new_project_marks_only_done_lane_as_counting_done`, `toggling_counts_as_done_changes_progress`, `progress_counts_cards_in_lanes_marked_done`, `card_is_created_in_chosen_lane` e `card_in_lane_of_other_project_is_rejected`; mantenha os demais (`cannot_delete_last_lane`, `deleting_lane_with_cards_requires_target`, `target_lane_must_differ_and_belong_to_project`, `deleting_lane_moves_cards_to_end_of_target`, `reorder_must_contain_all_lanes_exactly_once`, `reorder_assigns_positions_in_given_order`, `name_is_required`).
   - em `card.rs`: mantenha `card_title_is_required`, `moving_card_reindexes_source_and_target_lanes` e `moving_card_within_same_lane_reorders`; acrescente `card_priority_accepts_low_medium_high`, `card_labels_are_trimmed_deduplicated_and_limited`, `checklist_items_get_positions_in_given_order`, `checklist_item_text_is_required` e `checklist_progress_counts_done_items`.
   - em `summary.rs`: `summary_lists_lane_progress_in_order`, `summary_counts_done_cards_over_total`, `upcoming_due_includes_overdue_and_next_14_days_only`, `upcoming_due_excludes_cards_in_done_lanes`, `in_progress_lists_middle_lanes_with_checklist_and_priority`.
4. Ajuste o domínio, sem `sqlx` nem `axum` na lógica das regras:
   - `lane.rs`: `LaneColor(String)` com `LaneColor::parse(text)` que aceita só `^#[0-9A-Fa-f]{6}$` e guarda em minúsculas; tire o `enum` de tokens e o `sqlx::Type` dele. `Lane` ganha `counts_as_done: bool`. `SystemLane::default_color()` devolve `#92400e` (`waiting`), `#6d28d9` (`in_progress`) e `#047857` (`done`), os HEX dos tokens `--warning`, `--primary` e `--success` do tema claro, usados no protótipo.
   - `project.rs`: `Project::new` cria as três raias de `SystemLane::DEFAULTS` nas posições 0, 1 e 2, `name` nulo, a cor de `default_color()` e `counts_as_done` verdadeiro só em `done`. `add_lane` e `update_lane` recebem `counts_as_done` (padrão falso na criação). `add_card` recebe um `NewCard { lane_id, title, description, priority, labels, due_date, checklist, position }` e recusa raia fora do projeto com `ProjectError::InvalidTargetLane`. `update_card` recebe `CardPatch { title, description, priority, labels, due_date, checklist }` (cada campo `Option`; os anuláveis como `Option<Option<_>>`; `checklist` substitui a lista inteira) e não move mais o cartão. Novo `move_card_to(card_id, lane_id, position: Option<i32>, now)`, que valida a raia (`InvalidTargetLane`) e chama `card::move_card`. `progress() -> (done_cards, total_cards)` conta os cartões vivos e os que estão em raias com `counts_as_done`.
   - `card.rs`: `CardPriority { Low, Medium, High }` (`low`, `medium`, `high`; `None` é sem prioridade); `validate_labels` (sem espaços nas pontas, sem vazias, sem repetidas ignorando maiúsculas, até 20, cada uma até 50 caracteres); `ChecklistItem { id, text, done, position }` com `validate_checklist` (texto 1 a 300, até 100 itens, `position` = índice na lista); `checklist_progress() -> (done, total)`. `Card` ganha `priority`, `labels`, `due_date: Option<NaiveDate>` e `checklist`.
   - `summary.rs`: `ProjectSummary::build(&Project, today: NaiveDate)` devolve `progress { done_cards, total_cards }`, `lanes` (por posição: `lane_id`, `system_key`, `name`, `color`, `counts_as_done`, `card_count`), `upcoming_due` (cartões fora das raias marcadas com `due_date <= today + 14 dias`, inclusive os vencidos, com `overdue = due_date < today`, por `due_date` e id, até 20) e `in_progress` (cartões das raias do meio: posição maior que a da primeira raia e sem `counts_as_done`; com `priority`, `due_date` e `checklist_done`/`checklist_total`; por prioridade alta, média, baixa, sem prioridade, e depois por posição da raia e do cartão).
   - `error.rs`: mantenha as variantes. Rode `cargo test -p atria-server projects::domain` até passar.
5. Escreva os testes de integração em `apps/server/src/projects/tests/api.rs` (registrados em `tests/mod.rs` e em `mod.rs` com `#[cfg(test)] mod tests;`), com `projects::router()` sobre o `AppState` de teste, `projects::migrator()` aplicado no container e relógio e ids fixos: `ct30_projects_list_with_default_lanes` (dois projetos na listagem; cada um com as três raias padrão, `done` com `counts_as_done` verdadeiro, e `progress` no item da lista), `ct30_create_colored_lane_and_reorder` (nova raia `#0ea5e9` reordenada para a segunda posição), `create_lane_with_invalid_hex_returns_422` (`color: "accent"`, código `validation_failed`), `ct30_create_card_and_move_between_lanes` (pelo `POST .../move`), `pd45_create_card_in_chosen_lane` (cartão criado direto em `in_progress`), `create_card_in_lane_of_other_project_returns_422` (código `invalid_target_lane`), `pd46_card_crud_with_priority_labels_due_date_and_checklist` (cria, lê, edita trocando o checklist e exclui), `pd43_lane_counts_as_done_drives_project_progress` (marcar uma segunda raia muda o `progress`), `pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress` (com `?today=` fixo: "2 de 5", um vencido marcado `overdue`, um prazo em 14 dias, um em 15 dias fora, e os cartões da raia do meio com checklist e prioridade), `rf56_rename_and_delete_lane`, `cb07_delete_lane_with_cards_moves_them_to_target`, `cb07_delete_lane_with_cards_without_target_returns_409` (código `lane_has_cards`), `cb08_delete_last_lane_returns_409` (código `last_lane`), `reorder_with_missing_lane_returns_422`, `other_user_project_lanes_and_cards_return_404` (inclui ler, editar, mover e excluir cartão e o resumo), `project_and_card_deletion_call_entity_deleted_hook` (espera `(owner_id, "project", id)` e `(owner_id, "project_card", id)`), `delete_without_hook_still_succeeds`, `listing_filters_by_query_and_paginates_by_cursor`, `project_search_finds_card_by_unaccented_title`, `rls_is_enabled_on_projects_tables` (as quatro tabelas). Rode e confirme que falham.
6. Em `application/ports.rs`, declare `ProjectRepository` (`insert_with_lanes`, `update`, `find_live`, `list_live` com cursor, `q` e `visibility`, `soft_delete`, `insert_lane`, `update_lane`, `reorder_lanes`, `delete_lane_moving_cards`, `insert_card`, `update_card`, `replace_checklist`, `move_card`, `soft_delete_card`, `lock_project`) e o alias `EntityDeletedHook` copiado de `apps/server/src/goals/application/ports.rs`, com a mesma grafia e o mesmo comentário (`std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>`, argumentos `(owner_id, entity_type, entity_id)`): só com a grafia idêntica é o mesmo tipo na `Extension`.
7. Em `application/service.rs`, implemente `ProjectService` com os casos de uso de projetos, raias, cartões e o resumo; toda operação de raia ou cartão roda numa transação que trava a linha do projeto (`SELECT ... FOR UPDATE`) antes de aplicar as regras do domínio, para que duas exclusões simultâneas não deixem o projeto sem raia (RN-16). `summary(owner, project_id, today)` carrega o projeto com raias, cartões e checklists e chama `ProjectSummary::build`. Em `application/search.rs`, implemente `ProjectSearch::search(owner_id, query, limit) -> Vec<ProjectSearchHit { entity_type, id, project_id, title, rank }>` com `websearch_to_tsquery('portuguese', projects_unaccent(query))` sobre projetos e cartões, para a TASK-16.
8. Em `infrastructure/pg_project_repository.rs`, implemente `PgProjectRepository` com queries parametrizadas com `sqlx::query`/`sqlx::query_as` e `.bind` (checadas em execução, sem SQL montado por concatenação; a troca pelas macros checadas na compilação, exigidas por [project/stack-04], fica com a TASK-18, que gera a pasta `.sqlx`), dentro da transação que abre com `set_config('app.current_user_id', $1, true)` e sempre filtrando por `owner_id` ([project/security-04]); exclusão lógica em projetos e cartões ([project/database-08]) e física em raias (os cartões são movidos antes); o checklist é regravado inteiro (`DELETE` dos itens do cartão e `INSERT` na ordem) na mesma transação da edição do cartão. A contagem do `progress` da listagem usa um `LEFT JOIN` agregado sobre `project_cards` e `project_lanes` do próprio contexto.
9. Em `interface/dto.rs`, declare os DTOs em `snake_case` com `utoipa::ToSchema`/`IntoParams`: projeto (campos comuns + `name`, `description`, `progress { done_cards, total_cards }`, e `lanes` no detalhe), raia (campos comuns + `system_key`, `name`, `color` HEX, `counts_as_done`, `position`), cartão (campos comuns + `lane_id`, `title`, `description`, `priority`, `labels`, `due_date`, `checklist [{ id, text, done, position }]`, `position`; sem tarefa ligada, que vem de `GET /links`), `CreateLaneRequest { name, color, counts_as_done? }`, `UpdateLaneRequest { name?, color?, counts_as_done? }`, `ReorderLanesRequest { lane_ids }`, `DeleteLaneQuery { move_cards_to? }`, `CreateCardRequest { lane_id, title, description?, priority?, labels?, due_date?, checklist? [{ text, done? }], position? }`, `UpdateCardRequest { title?, description?, priority?, labels?, due_date?, checklist? }`, `MoveCardRequest { lane_id, position? }`, `ProjectSummaryQuery { today? }`, `ProjectSummaryResponse` (o `ProjectSummary`) e `ProjectListQuery { cursor?, limit? (1 a 100, padrão 50), q?, visibility? }`. As raias padrão vêm com `name` nulo e `system_key`: a tradução é do frontend ([project/language-06]).
10. Em `interface/handlers.rs`, implemente com `#[utoipa::path]` e caminhos relativos (a TASK-18 monta sob `/api/v1`): `GET|POST /projects`, `GET|PATCH|DELETE /projects/{id}`, `GET /projects/{id}/summary` (`?today=AAAA-MM-DD` enviado pelo frontend no fuso da pessoa; sem ele, a data UTC do relógio injetado), `GET|POST /projects/{id}/lanes`, `PATCH|DELETE /projects/{id}/lanes/{lane_id}` (`DELETE` com `?move_cards_to=`), `PUT /projects/{id}/lanes/order`, `GET|POST /projects/{id}/cards`, `GET|PATCH|DELETE /projects/{id}/cards/{card_id}` e `POST /projects/{id}/cards/{card_id}/move`. Os `DELETE` de projeto e de cartão extraem `Option<Extension<EntityDeletedHook>>` e chamam o gancho depois do commit com `"project"` ou `"project_card"`; ao excluir um projeto, chame o gancho também com `"project_card"` para cada cartão vivo dele. Erros só aqui em `problem+json`: `project_not_found`, `lane_not_found`, `card_not_found` (404, também para dado de outro usuário), `last_lane` e `lane_has_cards` (409), `invalid_target_lane`, `invalid_lane_order` e `validation_failed` (422, também para cor fora de `#rrggbb`, prioridade desconhecida, etiquetas e checklist fora dos limites).
11. Em `interface/openapi.rs`, declare `#[derive(utoipa::OpenApi)] pub struct ProjectsApi`; em `interface/mod.rs`, monte o `Router<AppState>`; em `mod.rs`, exponha `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` (`sqlx::migrate!("src/projects/migrations")`, como já está), `pub fn openapi() -> utoipa::openapi::OpenApi` e `pub use application::search::{ProjectSearch, ProjectSearchHit}`.
12. Não altere `apps/server/src/main.rs`, `apps/server/src/http` nem `apps/server/src/links`: o `mod projects;` já é declarado em `apps/server/src/main.rs` pela TASK-04, e esta tarefa só trabalha em `apps/server/src/projects/`. Se `cargo test -p atria-server projects:: -- --list` não listar os testes por falta dessa declaração, **PARE** e peça o ajuste da tarefa (skill `adjust-task`).
13. Leitura do cartão só pelo id, para a aba Conexões (TASK-31), sobre o código já pronto:
    - Testes primeiro, em `tests/api.rs`, que devem falhar: `card_by_id_returns_card_with_project_id` (cartão com prioridade, etiquetas, prazo e checklist: `GET /cards/{card_id}` responde 200 com o mesmo corpo de `GET /projects/{id}/cards/{card_id}`, inclusive `project_id`, `lane_id`, `title` e `checklist`), `card_by_id_of_other_user_returns_404` (o cartão da Alice pedido pelo Bob responde 404 `card_not_found`, sem dizer que existe), `card_by_id_of_deleted_card_or_project_returns_404` (cartão excluído, e cartão vivo de projeto excluído, respondem 404 `card_not_found`) e `card_by_id_unknown_returns_404` (UUID v7 inexistente). Inclua `GET /cards/{card_id}` no `other_user_project_lanes_and_cards_return_404`. Rode e confirme que falham.
    - `application/ports.rs`: `ProjectRepository` ganha `async fn find_card_project(&self, owner: Uuid, card_id: CardId) -> Result<Uuid, ProjectError>`, que devolve o `project_id` do cartão vivo de um projeto vivo do dono, ou `ProjectError::CardNotFound`.
    - `infrastructure/pg_project_repository.rs`: implemente com `sqlx::query_scalar` e `.bind`, dentro da transação que abre com `set_config('app.current_user_id', $1, true)`: `SELECT pc.project_id FROM project_cards pc JOIN projects p ON p.id = pc.project_id WHERE pc.id = $1 AND pc.owner_id = $2 AND pc.deleted_at IS NULL AND p.deleted_at IS NULL`; sem linha, `ProjectError::CardNotFound`.
    - `application/service.rs`: `get_card_by_id(owner, card_id) -> Result<Card, ProjectError>` chama `find_card_project` e depois o `get_card(owner, project_id, card_id)` já existente, para devolver o cartão com o checklist pelo mesmo caminho.
    - `interface/handlers.rs`: `get_card_by_id` com `#[utoipa::path(get, path = "/cards/{card_id}")]`, no mesmo molde de `get_card`, devolvendo `Json<CardResponse>` (que já traz `project_id`); 404 `card_not_found` e 401 sem sessão. `interface/mod.rs`: `.route("/cards/{card_id}", get(handlers::get_card_by_id))`. `interface/openapi.rs`: o caminho novo em `ProjectsApi`. Nenhum DTO novo.
14. Rode os comandos da Verificação até todos passarem, com Docker disponível para o testcontainers.

### Baseline

- `test -d apps/server/src/projects && echo existe || echo ausente`
- `cargo test -q -p atria-server shared:: 2>/dev/null`
- `cargo test -q -p atria-server http:: 2>/dev/null`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server projects:: -- --list | grep -q 'projects::tests::api::ct30_create_card_and_move_between_lanes'
cargo test -p atria-server projects:: -- --list | grep -q 'projects::tests::api::pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress'
cargo test -p atria-server projects:: -- --list | grep -q 'projects::domain::lane::tests::lane_color_accepts_only_hex_rrggbb'
cargo test -p atria-server projects::
cargo test -p atria-server projects::tests::api::cb08_delete_last_lane_returns_409 -- --exact
cargo test -p atria-server projects::tests::api::pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress -- --exact
cargo test -p atria-server projects::tests::api::pd46_card_crud_with_priority_labels_due_date_and_checklist -- --exact
cargo test -p atria-server projects::tests::api::card_by_id_
```

Resultado esperado: formatação e clippy sem aviso, os testes novos listados, `test result: ok` em todos os testes do contexto e os testes da última raia, do resumo, do cartão completo e da leitura do cartão pelo id (4 testes `card_by_id_`) passando.

### Evidências

- `projects-tests.txt` (automática): `cargo test -p atria-server projects::`
  - Prova: os testes unitários e de integração de Projetos passam: listagem com progresso, raias padrão com Pronto concluída, raia com cor HEX e reordenada, cartão criado na raia escolhida, com prioridade, etiquetas, prazo e checklist, movido entre raias, conclusão por raia, resumo da Visão geral, exclusão de raia com e sem cartões, autorização, gancho de ligações, busca e RLS (RF-54, RF-55, RF-56, RF-57, CT-30, CB-07, CB-08; PD-12, PD-42, PD-43, PD-45, PD-46).
  - Trecho: as linhas `test projects::tests::api::ct30_projects_list_with_default_lanes ... ok`, `test projects::tests::api::ct30_create_colored_lane_and_reorder ... ok`, `test projects::tests::api::ct30_create_card_and_move_between_lanes ... ok`, `test projects::tests::api::pd43_lane_counts_as_done_drives_project_progress ... ok`, `test projects::domain::lane::tests::lane_color_accepts_only_hex_rrggbb ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, `running 0 tests` (contexto inexistente) ou a ausência das linhas `pd43_` e `lane_color_accepts_only_hex_rrggbb` (ajuste não aplicado).
- `projects-last-lane.txt` (automática): `cargo test -p atria-server projects::tests::api::cb08_delete_last_lane_returns_409 -- --exact`
  - Prova: o projeto nunca fica sem raia; excluir a última é recusado (RN-16, CB-08).
  - Trecho: `test projects::tests::api::cb08_delete_last_lane_returns_409 ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ausente).
- `projects-summary.txt` (automática): `cargo test -p atria-server projects::tests::api::pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress -- --exact`
  - Prova: o resumo do projeto entrega os dados da Visão geral: andamento por raia e total de prontos, próximos prazos de 14 dias com os vencidos e os cartões em andamento com checklist e prioridade (PD-42, PD-43, RF-57).
  - Trecho: `test projects::tests::api::pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ou endpoint ausente).
- `projects-card.txt` (automática): `cargo test -p atria-server projects::tests::api::pd46_card_crud_with_priority_labels_due_date_and_checklist -- --exact`
  - Prova: o cartão tem endpoints próprios de ler, criar, editar e excluir, com prioridade, etiquetas, prazo e checklist, sem campo de tarefa ligada (PD-46, RF-57, RN-20, DEC-003).
  - Trecho: `test projects::tests::api::pd46_card_crud_with_priority_labels_due_date_and_checklist ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ou endpoint ausente).
- `projects-card-by-id.txt` (automática): `cargo test -p atria-server projects::tests::api::card_by_id_`
  - Prova: o cartão é lido só pelo id em `GET /cards/{card_id}`, com o `project_id`, para a aba Conexões mostrar o título e o link; cartão de outra pessoa, excluído, de projeto excluído ou inexistente responde 404 (TASK-31, RF-57, RN-20, DEC-003, [project/testing-03]).
  - Trecho: as linhas `test projects::tests::api::card_by_id_returns_card_with_project_id ... ok`, `test projects::tests::api::card_by_id_of_other_user_returns_404 ... ok` e `test result: ok. 4 passed`.
  - Falha: `FAILED`, `0 passed` ou menos de 4 passados (teste ou endpoint ausente).

### Concluída quando

- [x] A API lista os projetos da pessoa com filtro, busca, cursor e o progresso de cada um, para o frontend mostrar em lista e em grade (RF-54, CT-30).

  > Como comprovar: rodar `cargo test -p atria-server projects::` e ver `ct30_projects_list_with_default_lanes ... ok` e `listing_filters_by_query_and_paginates_by_cursor ... ok` em `projects-tests.txt`.

- [x] Todo projeto novo nasce com as raias Aguardando, Em progresso e Pronto, nessa ordem, cada uma com uma cor HEX padrão, e só Pronto conta como concluída (RF-55, CT-30, PD-43).

  > Como comprovar: ver `ct30_projects_list_with_default_lanes ... ok`, `new_project_has_default_lanes_waiting_in_progress_done ... ok` e `new_project_marks_only_done_lane_as_counting_done ... ok` em `projects-tests.txt`.

- [x] A pessoa cria, renomeia, reordena, colore com qualquer HEX `#RRGGBB` e exclui raias, e marca quais contam como concluídas; uma cor fora do formato é recusada; excluir uma raia com cartões pede a raia de destino, e excluir a última é recusado (RF-56, CT-30, CB-07, CB-08, PD-12, PD-43).

  > Como comprovar: ver `ok` em `ct30_create_colored_lane_and_reorder`, `create_lane_with_invalid_hex_returns_422`, `lane_color_accepts_only_hex_rrggbb`, `pd43_lane_counts_as_done_drives_project_progress`, `rf56_rename_and_delete_lane`, `cb07_delete_lane_with_cards_moves_them_to_target` e `cb07_delete_lane_with_cards_without_target_returns_409` em `projects-tests.txt`, e `cb08_delete_last_lane_returns_409 ... ok` em `projects-last-lane.txt`.

- [x] A pessoa cria cartões próprios do projeto na raia escolhida, com título, descrição, prioridade, etiquetas, prazo e checklist, e os lê, edita, exclui e move entre as raias por endpoints próprios; a tarefa ligada fica no contexto de ligações, não no cartão (RF-57, CT-30, RN-20, PD-45, PD-46, DEC-003).

  > Como comprovar: ver `ct30_create_card_and_move_between_lanes ... ok`, `pd45_create_card_in_chosen_lane ... ok` e `create_card_in_lane_of_other_project_returns_422 ... ok` em `projects-tests.txt`, e `pd46_card_crud_with_priority_labels_due_date_and_checklist ... ok` em `projects-card.txt`.

- [x] Um cartão é lido só pelo id, com o projeto a que pertence, para a aba Conexões mostrar o título e abrir o cartão; o de outra pessoa, excluído ou de projeto excluído responde 404 (RF-57, RN-20, DEC-003).

  > Como comprovar: em `projects-card-by-id.txt`, ver `ok` em `card_by_id_returns_card_with_project_id`, `card_by_id_of_other_user_returns_404`, `card_by_id_of_deleted_card_or_project_returns_404` e `card_by_id_unknown_returns_404`, com `4 passed`.

- [x] O resumo do projeto traz o andamento por raia com o total de cartões prontos, os próximos prazos de 14 dias com os vencidos e os cartões em andamento com checklist e prioridade (PD-42, PD-43).

  > Como comprovar: ver `pd42_project_summary_returns_lane_progress_upcoming_due_and_in_progress ... ok` em `projects-summary.txt` e `ok` nos testes de `summary.rs` (`upcoming_due_includes_overdue_and_next_14_days_only`, `in_progress_lists_middle_lanes_with_checklist_and_priority`) em `projects-tests.txt`.

- [x] Projetos, raias, cartões e o resumo de outra pessoa respondem 404, as quatro tabelas têm Row Level Security ativa, e excluir projeto ou cartão avisa o contexto de ligações com `project` e `project_card` (RF-54, RF-57, CB-06).

  > Como comprovar: ver `ok` em `other_user_project_lanes_and_cards_return_404`, `rls_is_enabled_on_projects_tables`, `project_and_card_deletion_call_entity_deleted_hook` e `delete_without_hook_still_succeeds` em `projects-tests.txt`.

- [x] O contexto expõe `router()`, `migrator()`, `openapi()` e a busca para a TASK-16, não altera `main.rs`, `http` nem `links`, passa limpo em `cargo fmt --check` e `cargo clippy -- -D warnings`, e as camadas `domain` e `application` têm pelo menos 80% de cobertura (RF-54).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminando sem erro; ver `project_search_finds_card_by_unaccented_title ... ok` em `projects-tests.txt`; rodar `cargo llvm-cov -p atria-server --summary-only -- projects::` e ver 80% ou mais nos arquivos de `projects/domain` e `projects/application`.

## Descrição

### Resumo executivo

Entrega no servidor o módulo de Projetos: lista de projetos com progresso, quadro Kanban com as raias padrão Aguardando, Em progresso e Pronto, raias que a pessoa cria, renomeia, colore com qualquer cor, reordena, exclui e marca como concluídas, e cartões completos (prioridade, etiquetas, prazo e checklist) que mudam de raia.
Entrega também os dados da Visão geral do projeto: andamento por raia, próximos prazos e cartões em andamento, como no protótipo.
Garante as regras do quadro: um projeto nunca fica sem raia e os cartões de uma raia excluída vão para outra escolhida.
Perfil padrao: decisões locais já tomadas; risco médio, pelo escopo maior do cartão e do resumo.
Depende do núcleo do servidor e libera a busca global, os relatórios, a integração do servidor e as telas de Projetos.

### Detalhes técnicos

**Abordagem.** Contexto DDD `apps/server/src/projects` com a agregação `Project` dona das raias e dos cartões, para que as regras de raia (RN-16, CB-07, CB-08), a conclusão por raia e o resumo fiquem no domínio e rodem numa transação com a linha do projeto travada. TDD contra PostgreSQL real em container. Rotas relativas, montadas sob `/api/v1` pela TASK-18; a TASK-18 registra `router()`, `migrator()` e `openapi()`. O código parcial escrito antes deste ajuste é mantido e completado; a migração ainda não saiu dos containers de teste e é editada no lugar. Segue a DEC-002: o servidor adota as decisões do protótipo (PD-12, PD-42, PD-43, PD-45 e PD-46).

**Decisões locais já tomadas.**

- Raias padrão com `system_key` (`waiting`, `in_progress`, `done`) e `name` nulo até a pessoa renomear; a tradução é do frontend ([project/language-06]). Descartado gravar os nomes em pt-br no banco, que prende o dado a um idioma.
- Cor da raia como HEX livre `#rrggbb`, validado no domínio e por `CHECK` no banco e gravado em minúsculas (PD-12, DEC-002). As raias padrão recebem os HEX dos tokens `--warning`, `--primary` e `--success` do tema claro, as cores do protótipo. Descartados a paleta de tokens (contradiz a PD-12) e o HEX de 3 dígitos ou com alfa (o seletor do protótipo produz `#RRGGBB`).
- Conclusão por raia com `counts_as_done` (PD-43, DEC-002): Pronto vem marcada ao criar o projeto, qualquer raia pode ser marcada ou desmarcada, e o progresso do projeto é "cartões em raias marcadas sobre o total". Descartado "Pronto é a última raia", recusado pelo usuário na DEC-002.
- Cartão com prioridade (`low`, `medium`, `high` ou nula), etiquetas em `TEXT[]` (até 20, cada uma até 50 caracteres), prazo `DATE` e checklist numa tabela própria `project_card_checklist_items` (texto, feito e posição) (PD-46). Descartados o checklist em `JSONB` (sem `CHECK` por item e sem a convenção de dono e RLS em cada linha) e endpoints por item (o formulário do cartão salva tudo de uma vez, então o `PATCH` substitui a lista).
- A tarefa ligada não é campo do cartão: é uma ligação `project_card` com `task` do contexto `links`, lida pelo frontend em `GET /links` (DEC-003, RN-20, [project/architecture-05]). Descartado guardar o id da tarefa no cartão, recusado na DEC-003.
- Endpoints próprios do cartão: `GET|PATCH|DELETE /projects/{id}/cards/{card_id}`, `POST /projects/{id}/cards` com `lane_id` obrigatório (PD-45) e `POST /projects/{id}/cards/{card_id}/move` com `lane_id` e `position`, reindexando as duas raias. Isso substitui a decisão anterior de mover pelo `PATCH`: separar o movimento deixa a edição do formulário sem efeito colateral de posição e casa com o seletor de raia do pé do cartão (PD-46).
- Leitura do cartão só pelo id em `GET /cards/{card_id}`, para a aba Conexões (TASK-31), que recebe das ligações só o id do cartão (DEC-003): devolve o mesmo `CardResponse` do detalhe, com `project_id` para montar o link. O repositório acha o projeto do cartão (`find_card_project`) e o serviço reaproveita o `get_card` existente. Descartados exigir o `project_id` na rota (as ligações não o guardam) e uma consulta própria do cartão com o checklist (duplicaria o mapeamento de `cards_of`). Cartão excluído ou de projeto excluído responde 404, como o de outra pessoa ([project/testing-03]).
- Resumo da Visão geral em `GET /projects/{id}/summary` (PD-42), calculado em memória por `ProjectSummary::build` sobre o projeto já carregado: `progress`, `lanes` com contagem, `upcoming_due` (até 14 dias à frente, com os vencidos marcados `overdue`, fora das raias concluídas) e `in_progress` (raias do meio: depois da primeira e sem `counts_as_done`, com checklist e prioridade). A data de hoje vem em `?today=` no fuso da pessoa ([project/code-style-06]) e, sem ela, do relógio injetado ([project/testing-07]). Descartados agregar em SQL (regra fora do domínio, sem teste unitário) e um endpoint por bloco (três chamadas para uma tela).
- Ordem por `position` inteira com `UNIQUE` adiável, reordenação por `PUT /projects/{id}/lanes/order` com a lista completa de ids; descartado mudar a posição de uma raia por vez, que exige várias chamadas e deixa estados intermediários.
- Exclusão de raia com `?move_cards_to=`: sem destino e com cartões responde 409 `lane_has_cards`, para o frontend pedir a raia (CB-07); a última raia responde 409 `last_lane` (CB-08). Cartão criado ou movido para raia fora do projeto responde 422 `invalid_target_lane`.
- `tsvector` em projetos e cartões com `projects_unaccent` própria e `ProjectSearch` exposto à TASK-16, que não lê as tabelas do contexto ([project/architecture-04], [project/database-06]).
- Queries `sqlx::query`/`query_as` com `.bind`, checadas em execução (ajuste 1; as macros ficam com a TASK-18), e RLS com `NULLIF(current_setting('app.current_user_id', true), '')::uuid` nas quatro tabelas, a convenção da onda.
- Exclusão lógica de projetos e cartões ([project/database-08]) e física de raias e itens do checklist (os itens seguem o cartão); a exclusão de projeto e de cartão avisa o contexto de ligações pelo gancho `EntityDeletedHook` com `"project"` e `"project_card"` (CB-06), com a grafia de `apps/server/src/goals/application/ports.rs`, como nas TASK-11 a TASK-13.

**Riscos técnicos.** Corrida entre duas exclusões de raia, coberta pelo `FOR UPDATE` no projeto. O alias do gancho tem de ter a mesma grafia da TASK-15 e dos outros contextos. O resumo carrega o projeto inteiro em memória, aceitável para quadros pessoais; um quadro muito grande pediria agregação em SQL. As rotas são relativas, e o prefixo `/api/v1` é da TASK-18. A TASK-30 (telas de Projetos) precisa consumir o `summary`, o `move` e os campos novos do cartão, e a TASK-31 (aba Conexões), o `GET /cards/{card_id}`.

**Referências da spec e do protótipo.** RF-54, RF-55, RF-56, RF-57, CT-30, RN-16, RN-20, CB-06, CB-07, CB-08; decisões 5, 53, 55 e 56; contrato `GET|POST /projects, /projects/{id}/lanes, /projects/{id}/cards`; PD-12, PD-42, PD-43, PD-45 e PD-46 de `docs/decisoes-do-prototipo.md`; DEC-002 e DEC-003 da memória.

**Arquivos em comum na onda 4.** Nenhum: a tarefa só muda arquivos sob `apps/server/src/projects/`.

### Card

- **Título:** Contexto projects
- **Tipo:** historia
- **Descrição:** Projetos no servidor: listagem com progresso, Kanban com raias padrão customizáveis (criar, renomear, reordenar, colorir com HEX, marcar como concluída, excluir), cartões completos com endpoints próprios, leitura do cartão só pelo id e o resumo da Visão geral.
- **Critérios de aceite:**
  - [ ] Projeto novo nasce com Aguardando, Em progresso e Pronto, e só Pronto conta como concluída.
  - [ ] Raia nova com cor HEX entra na ordem escolhida; cor fora de `#RRGGBB` é recusada.
  - [ ] Marcar ou desmarcar uma raia como concluída muda o progresso do projeto.
  - [ ] Cartão é criado na raia escolhida, com prioridade, etiquetas, prazo e checklist, e é lido, editado, excluído e movido entre raias.
  - [ ] O cartão é lido só pelo id, com o projeto dele; o de outra pessoa responde 404.
  - [ ] O resumo do projeto traz andamento por raia, próximos prazos com vencidos e cartões em andamento.
  - [ ] Excluir raia com cartões pede o destino; a última raia não é excluída.
  - [ ] Dados de outra pessoa respondem 404, com Row Level Security ativa, e a exclusão de projeto e cartão avisa as ligações.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 4 | 2026-10-30 | ajuste | in_progress | Cor da raia como HEX livre #rrggbb validado, no lugar do token (PD-12); conclusão por raia com counts_as_done, Pronto marcada ao criar e progresso pelas raias marcadas (PD-43); cartão com prioridade, etiquetas, prazo e checklist, endpoints próprios de ler, criar na raia escolhida, editar, excluir e mover, tarefa ligada só pelo links e gancho project_card (PD-45, PD-46, DEC-003); resumo GET /projects/{id}/summary com andamento por raia, próximos prazos de 14 dias com vencidos e cartões em andamento (PD-42); Ler, Mudar, Passos, Verificação, Evidências, Concluída quando, Detalhes técnicos e Card atualizados com testes novos, mantendo o código parcial e a Baseline (DEC-002) |
| 5 | 2026-10-30 | ajuste | in_progress | GET /cards/{card_id} (TASK-31, aba Conexões): lê o cartão só pelo id e devolve o CardResponse com project_id, via find_card_project no repositório e get_card_by_id no serviço reaproveitando get_card; 404 card_not_found para outro usuário, cartão ou projeto excluído e id inexistente; novo passo 13 com 4 testes card_by_id_ antes do código, Ler, Mudar, Verificação, evidência projects-card-by-id.txt, Concluída quando, Detalhes técnicos e card; Baseline inalterado |
| 6 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-31 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 8 | 2026-10-31 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta projects criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 9 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 10 | 2026-10-31 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 11 | 2026-10-31 | evidências | passed | 5 evidência(s) em evidence/TASK-14/ |
| 12 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 2 | 2026-10-30 | agente | Cor da raia como HEX livre #rrggbb validado, no lugar do token (PD-12); conclusão por raia com counts_as_done, Pronto marcada ao criar e progresso pelas raias marcadas (PD-43); cartão com prioridade, etiquetas, prazo e checklist, endpoints próprios de ler, criar na raia escolhida, editar, excluir e mover, tarefa ligada só pelo links e gancho project_card (PD-45, PD-46, DEC-003); resumo GET /projects/{id}/summary com andamento por raia, próximos prazos de 14 dias com vencidos e cartões em andamento (PD-42); Ler, Mudar, Passos, Verificação, Evidências, Concluída quando, Detalhes técnicos e Card atualizados com testes novos, mantendo o código parcial e a Baseline (DEC-002) |
| 3 | 2026-10-30 | agente | GET /cards/{card_id} (TASK-31, aba Conexões): lê o cartão só pelo id e devolve o CardResponse com project_id, via find_card_project no repositório e get_card_by_id no serviço reaproveitando get_card; 404 card_not_found para outro usuário, cartão ou projeto excluído e id inexistente; novo passo 13 com 4 testes card_by_id_ antes do código, Ler, Mudar, Verificação, evidência projects-card-by-id.txt, Concluída quando, Detalhes técnicos e card; Baseline inalterado |
