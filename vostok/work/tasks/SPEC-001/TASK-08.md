---
id: TASK-08
spec: SPEC-001
title: "Contexto goals"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-36, RF-37, CT-23]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 01abffbae03b69192c751f2b508c85287788fec1586d244484af5693d8176585
adjustments: 1
adjusted_at: 2026-10-30T21:59:26Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 642ef5bb1f6ebb9dc1817a888f994fbbf19ef808172397eb94e1f7de3484413c
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T21:59:26Z
---

# TASK-08: Contexto goals

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-36, RF-37, RN-15, CT-23, recursos `/goals` e `/goals/{id}/milestones`, campos comuns de entidade, decisões 8, 55, 56)
- `vostok/work/tasks/SPEC-001/TASK-15.md` (contrato do gancho `EntityDeletedHook` chamado ao excluir, CB-06)
- `vostok/memory/decisions.md` (DEC-006: etiquetas em metas e filtro por prazo; consultar com `vostok memory search decision etiquetas metas`)
- `apps/server/src/projects/domain/card.rs` (`validate_labels`, `LABELS_MAX`, `LABEL_MAX_CHARS` e o teste `card_labels_are_trimmed_deduplicated_and_limited`: a mesma regra de etiquetas da TASK-14, a copiar)
- `apps/server/src/projects/migrations/20261101140001_create-projects.sql` (coluna `labels TEXT[]` do cartão, a seguir)
- `apps/server/Cargo.toml`
- `apps/server/src/main.rs`
- `apps/server/src/shared` (erros `problem+json`, UUID v7, relógio injetável, visibilidade)
- `apps/server/src/http` (`AppState`, extrator da sessão, CSRF e auxiliares de teste)
- `vostok/rules/project/api.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/security.md`

### Mudar

- `apps/server/src/goals/mod.rs` (criar): declara as camadas e expõe `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` e `pub struct GoalsApi` (`utoipa::OpenApi`).
- `apps/server/src/goals/domain/mod.rs` (criar): módulo do domínio, sem axum nem sqlx.
- `apps/server/src/goals/domain/goal.rs` (criar): meta com título, descrição, prazo opcional, status, etiquetas (`labels`, DEC-006) e cálculo do progresso (RN-15); já existe, recebe `validate_labels` e o campo `labels`.
- `apps/server/src/goals/domain/milestone.rs` (criar): marco com título, ordem e conclusão.
- `apps/server/src/goals/domain/error.rs` (criar): `GoalsError` com `thiserror` e códigos estáveis em inglês.
- `apps/server/src/goals/application/mod.rs` (criar): serviços de aplicação.
- `apps/server/src/goals/application/ports.rs` (criar): trait do repositório, e o alias `EntityDeletedHook` copiado da TASK-15; já existe, `GoalQuery` recebe `label` e `has_deadline` e a alteração da meta recebe `labels`.
- `apps/server/src/goals/application/goals.rs` (criar): casos de uso de metas e marcos; já existe, `NewGoal` e `GoalFilter` recebem as etiquetas e os filtros novos.
- `apps/server/src/goals/infrastructure/mod.rs` (criar): implementação PostgreSQL.
- `apps/server/src/goals/infrastructure/pg_goals.rs` (criar): repositório de metas e marcos; já existe, grava e lê `labels` e filtra por `label` e `has_deadline`.
- `apps/server/src/goals/interface/mod.rs` (criar): montagem das rotas.
- `apps/server/src/goals/interface/dto.rs` (criar): corpos em `snake_case` com `utoipa::ToSchema`; já existe, recebe `labels` nos corpos e na resposta e `label` e `has_deadline` em `GoalListQuery`.
- `apps/server/src/goals/interface/handlers.rs` (criar): handlers, validação na borda e conversão de `GoalsError` em `problem+json`; já existe, repassa as etiquetas e os filtros novos.
- `apps/server/src/goals/interface/openapi.rs` (criar): `GoalsApi` com todas as rotas e esquemas; já existe, recebe o teste `documents_goal_labels_and_has_deadline_filter`.
- `apps/server/src/goals/migrations/20261101080001_create-goals.sql` (criar): tabelas `goals` e `milestones`, índices e RLS; já existe e é editada no lugar, com a coluna `labels` e os índices dos filtros novos (DEC-006).
- `apps/server/src/goals/tests/mod.rs` (criar): auxiliar dos testes de integração (PostgreSQL em container, migrator, app de teste e sessões de dois usuários).
- `apps/server/src/goals/tests/goals.rs` (criar): testes de integração de metas e marcos (CT-23); já existe, recebe os testes de etiquetas e dos filtros `label` e `has_deadline`.
- `apps/server/src/goals/tests/deletion_hook.rs` (criar): testes do gancho de exclusão (CB-06).
- `apps/server/src/goals/tests/authorization.rs` (criar): 404 para dado de outro usuário e RLS ativa; já existe, recebe `goal_label_filter_ignores_other_user_goals`.

### Passos

1. Confira as pré-condições da TASK-04: `apps/server/src/main.rs` declara o módulo `goals` (o registro do `router()` e do `migrator()` fica com a TASK-18); `apps/server/src/shared` tem o erro `problem+json`, o gerador de UUID v7, o relógio injetável e a visibilidade; `apps/server/src/http` tem o `AppState`, o extrator do usuário da sessão, o CSRF e o auxiliar de testes que monta um app com sessão; `apps/server/Cargo.toml` tem `sqlx`, `utoipa`, `thiserror` e, em dev-dependencies, `testcontainers` com o módulo postgres. Se algo faltar, PARE e reporte ao Coordenador: esta tarefa não altera `main.rs`, `http`, `shared` nem `Cargo.toml`.
2. Crie `apps/server/src/goals/mod.rs` com `pub mod domain; pub mod application; pub mod infrastructure; pub mod interface;` e `#[cfg(test)] mod tests;`, as funções `router()`, `migrator()` (`sqlx::migrate!("src/goals/migrations")`) e o reexport de `interface::openapi::GoalsApi`. Crie os `mod.rs` das camadas.
3. Escreva primeiro os testes unitários em `domain/goal.rs` e confirme que falham (`cargo test -p atria-server goals::domain`): `progress_with_milestones_is_percentage_of_completed` (1 de 4 dá 25), `progress_rounds_down` (2 de 3 dá 66), `progress_without_milestones_follows_status` (`completed` dá 100, os outros dão 0), `deleted_milestones_do_not_count`, `title_is_required_and_limited_to_200_chars`, `deadline_is_optional`.
4. Implemente o domínio: status `planned`, `in_progress`, `completed` e `abandoned`, padrão `planned`; `deadline` é uma data opcional (`NaiveDate`); o progresso é um inteiro de 0 a 100, `floor(concluídos * 100 / total)` com marcos e, sem marcos, 100 para `completed` e 0 para os demais (RN-15); o progresso é calculado, nunca gravado. Marco tem `title` (até 200 caracteres), `position` e `completed_at` nulo.
5. Escreva a migração `20261101080001_create-goals.sql`: `goals` com `id`, `owner_id`, `visibility CHECK IN ('personal','shared') DEFAULT 'personal'`, `title`, `description TEXT NULL`, `deadline DATE NULL`, `status CHECK IN (...)`, `created_at`, `updated_at`, `deleted_at`; `milestones` com `id`, `owner_id`, `visibility`, `goal_id REFERENCES goals ON DELETE CASCADE`, `title`, `position INT`, `completed_at`, `created_at`, `updated_at`, `deleted_at`; índices em `milestones(goal_id)` e `goals(owner_id, status)`; `ENABLE` e `FORCE ROW LEVEL SECURITY` nas duas tabelas, com a política `USING (owner_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid)`. Sem FK para tabelas de outro contexto.
6. Escreva os testes de integração antes dos serviços e handlers, com PostgreSQL em container, o `migrator()` do contexto e o auxiliar de testes de `apps/server/src/http`, e confirme que falham:
   - `tests/goals.rs`: `goal_with_four_milestones_and_one_done_shows_25_percent` (CT-23: cria meta com prazo, acrescenta 4 marcos, conclui 1 e lê `progress_percent: 25` no `GET /goals/{id}` e no `GET /goals`), `creates_updates_and_deletes_goal` (RF-36), `reopening_milestone_lowers_progress`, `goal_list_filters_by_status_and_paginates`, `visibility_is_saved` (RF-21).
   - `tests/deletion_hook.rs`: `deleting_goal_calls_entity_deleted_hook_for_goal_and_milestones` (camada `Extension<EntityDeletedHook>` que grava as chamadas e espera `(owner_id, "goal", id)` e um `(owner_id, "milestone", id)` por marco, só depois do commit), `deleting_milestone_calls_entity_deleted_hook`, `delete_without_hook_still_succeeds` (CB-06).
   - `tests/authorization.rs`: `other_user_goal_and_milestones_return_404` (GET, PATCH e DELETE da meta, GET e POST dos marcos, PATCH e DELETE do marco), `row_level_security_hides_other_owner_rows`, `mutation_without_csrf_is_refused`.
7. Implemente a porta, o serviço e o repositório: cada transação executa `SELECT set_config('app.current_user_id', $1, true)` com o id do usuário da sessão e toda query filtra também por `owner_id` e `deleted_at IS NULL` (security-04); registro inexistente ou de outro dono vira `GoalsError::NotFound`. A exclusão é lógica (`deleted_at`) e a da meta marca também os marcos.
8. Implemente `interface` sob `/api/v1`: `GET|POST /goals` (filtros `status`, busca `q` no título, ordenação `sort=deadline|created_at`, paginação por cursor `cursor` e `limit`; o cursor é opaco, com a chave de ordenação e o `id` da última linha em base64url), `GET|PATCH|DELETE /goals/{id}`, `GET|POST /goals/{id}/milestones` e `PATCH|DELETE /goals/{id}/milestones/{milestone_id}` (`PATCH` aceita `title`, `position` e `completed`). A resposta da meta traz os campos comuns de entidade, `progress_percent` e a contagem de marcos. Converta `GoalsError` em `problem+json` (códigos `not_found` e `validation_failed`).
9. Remoção das ligações ao excluir (CB-06): em `application/ports.rs`, declare o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15 para ser o mesmo tipo na `Extension`, e um comentário dizendo por que a grafia tem de ser idêntica. Os handlers de exclusão extraem `Option<Extension<EntityDeletedHook>>` e, só depois do commit da transação, chamam o gancho (com `.await`) para cada entidade excluída; sem o gancho, a exclusão segue igual. Tipos usados: `goal` e `milestone`. `DELETE /goals/{id}` chama o gancho com `(owner_id, "goal", id)` e, para cada marco excluído junto, com `(owner_id, "milestone", milestone_id)`; `DELETE /goals/{id}/milestones/{milestone_id}` chama com `"milestone"`. Este contexto não chama o `links` direto nem instala o gancho real: a TASK-18 instala `Extension(links::entity_deleted_hook(pool))`.
10. Escreva `interface/openapi.rs` com `GoalsApi` e o teste `documents_all_goals_routes`.
11. Rode `cargo fmt`, `cargo clippy -p atria-server -- -D warnings` e `cargo test -p atria-server goals::` até passarem sem aviso, sem `unwrap`, `expect` ou `panic!` fora dos testes.
12. Etiquetas e filtro por prazo (DEC-006), sobre o código que já existe, sem refazer o resto. Testes primeiro: escreva todos os testes deste passo e confirme que falham com `cargo test -p atria-server -- goal_label has_deadline` antes de mudar o código.
   1. Teste unitário em `domain/goal.rs`: `goal_labels_are_trimmed_deduplicated_and_limited`, no molde de `card_labels_are_trimmed_deduplicated_and_limited` de `apps/server/src/projects/domain/card.rs`: `[" casa ", "obra"]` vira `["casa", "obra"]`; `["casa", "CASA"]`, `["  "]`, uma etiqueta de 51 caracteres e 21 etiquetas dão `GoalsError::Validation`.
   2. Testes de integração em `tests/goals.rs`: `goal_labels_are_saved_and_replaced` (`POST /goals` com `labels: [" casa ", "obra"]` responde `labels: ["casa", "obra"]`; sem `labels`, responde `[]`; `PATCH` com `labels: ["leitura"]` troca a lista inteira; `PATCH` sem `labels` mantém a lista; `GET /goals/{id}` e `GET /goals` trazem `labels`), `goal_labels_out_of_limits_return_422` (`["casa", "CASA"]`, 21 etiquetas e uma de 51 caracteres, no `POST` e no `PATCH`, respondem 422 `validation_failed`), `goal_label_filter_lists_only_tagged_goals` (três metas, com `["casa"]`, `["casa", "obra"]` e `[]`: `GET /goals?label=casa` traz as duas primeiras, `?label=obra` só a segunda, `?label=nada` nenhuma; combinado com `status` e com a paginação por cursor `limit=1`, sem repetir nem pular meta), `goal_label_filter_rejects_invalid_value_with_422` (`?label=` vazio ou com 51 caracteres responde 422 `validation_failed`), `goal_list_filters_by_has_deadline` (uma meta com prazo e outra sem: `?has_deadline=true` traz só a com prazo, `?has_deadline=false` só a sem prazo, sem o parâmetro as duas, com `sort=deadline` e `sort=created_at`) e `goal_has_deadline_rejects_invalid_value_with_422` (`?has_deadline=talvez` responde 422 `validation_failed`).
   3. Teste de autorização em `tests/authorization.rs`: `goal_label_filter_ignores_other_user_goals` (a Alice tem uma meta com `["casa"]`; o Bob pede `GET /goals?label=casa` e recebe a lista vazia; o mesmo com `?has_deadline=true`).
   4. Teste em `interface/openapi.rs`: `documents_goal_labels_and_has_deadline_filter` (o esquema `GoalResponse` tem `labels` como lista de texto, `CreateGoalRequest` e `UpdateGoalRequest` têm `labels` opcional e `GET /api/v1/goals` documenta os parâmetros `label` e `has_deadline`).
   5. Migração: edite no lugar `migrations/20261101080001_create-goals.sql` (não crie migração nova): na tabela `goals`, depois de `status`, acrescente `labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20)`, igual ao cartão da TASK-14; acrescente `CREATE INDEX goals_labels_idx ON goals USING GIN (labels);` e `CREATE INDEX goals_owner_deadline_idx ON goals (owner_id, deadline);` (database-07). A RLS e as políticas com `NULLIF` ficam como estão.
   6. Domínio, em `domain/goal.rs`: constantes `LABELS_MAX: usize = 20` e `LABEL_MAX_CHARS: usize = 50`; `pub fn validate_labels(labels: &[String]) -> Result<Vec<String>, GoalsError>` com a mesma regra de `projects::domain::card::validate_labels` (tira os espaços das pontas; vazia dá `GoalsError::invalid("labels", "required")`; mais de 50 caracteres, `"too_long"`; repetida sem diferenciar maiúsculas, `"duplicated"`; mais de 20, `"too_many"`), copiada e não importada do contexto `projects` ([project/architecture-04]); campo `pub labels: Vec<String>` em `Goal`.
   7. Aplicação e porta: `NewGoal` recebe `labels: Vec<String>`; a alteração da meta recebe `labels: Option<Vec<String>>` (`None` mantém, `Some` troca a lista inteira); o serviço chama `validate_labels` ao criar e ao alterar. `GoalFilter` e `GoalQuery` recebem `label: Option<String>` e `has_deadline: Option<bool>`; o serviço valida `label` (sem espaços nas pontas, não vazia, até 50 caracteres; senão `GoalsError::invalid("label", "required" | "too_long")`).
   8. Repositório, em `infrastructure/pg_goals.rs`, só com `sqlx::query`/`sqlx::query_as` e `.bind`: `GOAL_COLUMNS` e `GoalRow` passam a ler `g.labels` (`Vec<String>`); `insert_goal` grava `labels`; `update_goal` faz `labels = COALESCE($n::text[], labels)`; nas duas consultas de `list_goals` (`Deadline` e `CreatedAt`), acrescente `AND ($n::text IS NULL OR g.labels @> ARRAY[$n::text])` e `AND ($m::boolean IS NULL OR (g.deadline IS NOT NULL) = $m)`, renumerando os parâmetros seguintes e mantendo a ordem dos `.bind` igual à dos `$`. A comparação da etiqueta no filtro é exata, para usar o índice GIN.
   9. Interface: em `interface/dto.rs`, `CreateGoalRequest.labels: Option<Vec<String>>` (sem ele, `[]`), `UpdateGoalRequest.labels: Option<Vec<String>>`, `GoalResponse.labels: Vec<String>` e, em `GoalListQuery`, `label: Option<String>` e `has_deadline: Option<bool>`, com a descrição de cada parâmetro no `IntoParams`; valor de `has_deadline` fora de `true|false` cai no `ValidQuery` e responde 422 `validation_failed`. Em `interface/handlers.rs`, repasse os campos novos ao serviço; os erros de `labels` e `label` saem como 422 `validation_failed`.
   10. Rode de novo o passo 11 até passar sem aviso.

### Baseline

- `test -e apps/server/src/goals && echo goals-existe || echo goals-ausente`
- `test -e apps/server/src/shared && echo shared-existe || echo shared-ausente`

### Verificação

```bash
# Formatação e lint sem aviso (code-style-02)
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# Testes unitários e de integração do contexto: esperado "test result: ok" e 0 failed
cargo test -p atria-server goals::
```

### Evidências

- `cargo-test-goals.txt` (automática): `cargo test -p atria-server goals::`
  - Prova: metas e marcos têm o ciclo completo, o progresso segue os marcos concluídos ou o status, e dado alheio responde 404 (RF-36, RF-37, CT-23).
  - Trecho: as linhas `test goals::tests::goals::goal_with_four_milestones_and_one_done_shows_25_percent ... ok`, `test goals::tests::authorization::other_user_goal_and_milestones_return_404 ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests`.
- `cargo-test-goals-labels.txt` (automática): `cargo test -p atria-server -- goal_label has_deadline`
  - Prova: a meta tem etiquetas com os limites do cartão da TASK-14, a listagem filtra por etiqueta e por "com prazo", e o filtro não mostra metas de outro usuário (RF-36, DEC-006).
  - Trecho: as linhas `test goals::domain::goal::tests::goal_labels_are_trimmed_deduplicated_and_limited ... ok`, `test goals::tests::goals::goal_label_filter_lists_only_tagged_goals ... ok`, `test goals::tests::goals::goal_list_filters_by_has_deadline ... ok`, `test goals::tests::authorization::goal_label_filter_ignores_other_user_goals ... ok` e `test result: ok`, com 9 testes executados.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests` (os testes não foram escritos).

### Concluída quando

- [x] Uma meta é cadastrada com título, descrição, prazo opcional e status, editada e excluída (RF-36).

  > Como comprovar: rodar `cargo test -p atria-server goals::` e ver `ok` em `creates_updates_and_deletes_goal` e `deadline_is_optional` (evidência `cargo-test-goals.txt`).

- [x] Com 4 marcos e 1 concluído o progresso é 25%, e sem marcos o progresso segue o status (RF-37, CT-23).

  > Como comprovar: ver `ok` em `goal_with_four_milestones_and_one_done_shows_25_percent`, `progress_with_milestones_is_percentage_of_completed` e `progress_without_milestones_follows_status`.

- [x] Meta e marcos de outro usuário respondem 404, a RLS está forçada e mutações sem CSRF são recusadas (RNF-01, RNF-02).

  > Como comprovar: ver `ok` em `other_user_goal_and_milestones_return_404`, `row_level_security_hides_other_owner_rows` e `mutation_without_csrf_is_refused`.

- [x] Excluir uma meta ou um marco chama o gancho de exclusão depois do commit, com `goal` e `milestone`, para as ligações sumirem dos dois lados; sem o gancho a exclusão funciona igual (CB-06).

  > Como comprovar: ver `ok` em `deleting_goal_calls_entity_deleted_hook_for_goal_and_milestones`, `deleting_milestone_calls_entity_deleted_hook` e `delete_without_hook_still_succeeds` (evidência `cargo-test-goals.txt`).

- [x] A meta tem etiquetas (até 20, cada uma até 50 caracteres, sem repetidas sem diferenciar maiúsculas), gravadas, trocadas pelo `PATCH` e devolvidas na leitura e na listagem; fora dos limites, 422 (RF-36, DEC-006).

  > Como comprovar: rodar `cargo test -p atria-server -- goal_label has_deadline` e ver `ok` em `goal_labels_are_trimmed_deduplicated_and_limited`, `goal_labels_are_saved_and_replaced` e `goal_labels_out_of_limits_return_422` (evidência `cargo-test-goals-labels.txt`).

- [x] A listagem de metas filtra por etiqueta (`label`) e por prazo (`has_deadline=true|false`), junto com o status e a paginação, sem mostrar metas de outro usuário (RF-36, DEC-006).

  > Como comprovar: ver `ok` em `goal_label_filter_lists_only_tagged_goals`, `goal_label_filter_rejects_invalid_value_with_422`, `goal_list_filters_by_has_deadline`, `goal_has_deadline_rejects_invalid_value_with_422`, `goal_label_filter_ignores_other_user_goals` e `documents_goal_labels_and_has_deadline_filter` (evidência `cargo-test-goals-labels.txt`).

- [x] O contexto expõe `router()`, `migrator()` e `GoalsApi` com todas as rotas, e passa no `cargo fmt --check` e no `cargo clippy` sem aviso.

  > Como comprovar: ver `ok` em `documents_all_goals_routes` e a verificação terminar sem erro.

## Descrição

### Resumo executivo

Entrega Metas no servidor: metas com prazo opcional, status e etiquetas, marcos opcionais e o progresso calculado pelos marcos concluídos, com a lista filtrável por etiqueta e por ter ou não prazo.
O benefício é acompanhar objetivos de forma simples, sem pressão, com o progresso sempre coerente com o que foi feito.
Perfil padrão: as decisões locais (status, arredondamento do progresso) já estão fixadas nos passos; o risco é baixo.
Depende do núcleo do servidor e libera a busca, os relatórios e, depois da integração do servidor, as telas de Metas.

### Detalhes técnicos

**Abordagem.** Contexto `goals` em `apps/server/src/goals`, nas quatro camadas de [project/architecture-02], expondo `router()`, `migrator()` e `GoalsApi`; o registro no `main.rs` é da TASK-18.

**Decisões locais.**
- Progresso calculado na leitura, nunca gravado, para não divergir dos marcos. Descartado: coluna de progresso atualizada a cada mudança de marco.
- Progresso inteiro arredondado para baixo, para só chegar a 100% com todos os marcos concluídos. Descartado: arredondamento comum, que mostraria 100% antes da hora em metas com muitos marcos.
- Status `planned`, `in_progress`, `completed` e `abandoned`; sem marcos, só `completed` vale 100% (RN-15). Descartado: progresso parcial por status.
- Rotas do marco `PATCH|DELETE /goals/{id}/milestones/{milestone_id}`, além do contrato, porque concluir um marco é a ação do RF-37.
- Marcos com `owner_id` e RLS próprios, para a autorização não depender de junção com a meta.
- Remoção das ligações ao excluir (CB-06) pelo gancho `EntityDeletedHook` da TASK-15, opcional via `Option<Extension<EntityDeletedHook>>` e chamado depois do commit, com os tipos `goal` e `milestone`. Descartados: chamar o contexto `links` direto, que acopla e cria dependência entre tarefas da mesma onda ([project/architecture-04]); `NOTIFY` do PostgreSQL, que perde o evento sem ouvinte. Critério: sem acoplamento e testável com um gancho falso; a TASK-18 instala o gancho real. O alias precisa ter a mesma grafia da TASK-15 para a `Extension` casar.

- Etiquetas (DEC-006) em `labels TEXT[]` na própria `goals`, com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada com 422) copiada para o domínio de `goals`. Descartados: tabela própria de etiquetas, que exigiria junção e um contrato a mais sem ganho no MVP; importar `validate_labels` do contexto `projects`, que acopla contextos ([project/architecture-04]); juntar as repetidas em silêncio, que divergiria do cartão. O nome do campo é `labels`, como no cartão, para o mesmo padrão em todas as entidades ([project/api-04]); descartado `tags`, que deixaria dois nomes para a mesma coisa.
- Filtro `label` com uma etiqueta por pedido e comparação exata (`labels @> ARRAY[$n]`), servido pelo índice GIN `goals_labels_idx`. Descartados: comparação sem diferenciar maiúsculas com `unnest`, que não usa índice (database-07), e várias etiquetas por pedido, que o protótipo não pede. A tela escolhe a etiqueta entre as existentes, então a grafia confere.
- Filtro `has_deadline=true|false` (usado pela TASK-23) como `(deadline IS NOT NULL) = $m`, com o índice `goals_owner_deadline_idx`; ausente, não filtra. Descartado: filtro por intervalo de prazo, que a TASK-23 não usa.
- Migração editada no lugar, conforme a convenção da onda (o contexto ainda não foi liberado). Descartado: migração nova de `ALTER TABLE`, que só faz sentido depois de um banco em uso.

**Riscos técnicos.** Baixos; o principal é o 404 para dado alheio nos marcos aninhados, coberto pelo teste de autorização. Pré-condição: o módulo `goals` declarado no `main.rs` da TASK-04.

**Referências da spec.** RF-36, RF-37, RN-15, CT-23, CB-06, RF-21 (visibilidade), RNF-01, RNF-02, decisões 8, 55 e 56; memória DEC-006 (etiquetas e filtro por prazo) e DEC-002.

**Arquivos em comum na onda.** Nenhum: a tarefa só cria arquivos em `apps/server/src/goals`.

### Card

- **Título:** Contexto goals
- **Tipo:** historia
- **Descrição:** Implementa no servidor o contexto de Metas, com etiquetas, marcos opcionais e o progresso calculado pela porcentagem de marcos concluídos, e a listagem filtrável por etiqueta e por prazo.
- **Critérios de aceite:**
  - [ ] Metas com título, descrição, prazo opcional e status, com edição e exclusão.
  - [ ] Progresso de 25% com 1 de 4 marcos concluídos, e pelo status sem marcos.
  - [ ] Dado de outro usuário responde 404.
  - [ ] Etiquetas na meta, com até 20 de até 50 caracteres e sem repetidas.
  - [ ] Listagem filtrada por etiqueta e por "com prazo" ou "sem prazo".
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Etiquetas na meta em labels TEXT[] com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada), gravadas, trocadas pelo PATCH e devolvidas, com filtro label na listagem (DEC-006); filtro has_deadline=true\|false na listagem para a TASK-23 (DEC-006); testes novos de domínio, integração, autorização e OpenAPI, evidência cargo-test-goals-labels.txt, Ler, Mudar, passo 12, Concluída quando, Detalhes técnicos e Card atualizados, migração editada no lugar e Baseline mantida |
| 4 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-10-30 | retomada | validating | decisão do usuário: usuário aceitou [1]: pasta goals criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 7 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-30 | regressão | passed | 1 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-10-30 | evidências | passed | 2 evidência(s) em evidence/TASK-08/ |
| 10 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Etiquetas na meta em labels TEXT[] com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada), gravadas, trocadas pelo PATCH e devolvidas, com filtro label na listagem (DEC-006); filtro has_deadline=true\|false na listagem para a TASK-23 (DEC-006); testes novos de domínio, integração, autorização e OpenAPI, evidência cargo-test-goals-labels.txt, Ler, Mudar, passo 12, Concluída quando, Detalhes técnicos e Card atualizados, migração editada no lugar e Baseline mantida |
