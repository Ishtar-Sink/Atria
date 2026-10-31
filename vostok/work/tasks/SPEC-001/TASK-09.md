---
id: TASK-09
spec: SPEC-001
title: "Contexto tasks"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-38, RF-39, CT-24]
type: historia
labels: [SPEC-001, julgamento]
status: done
content_hash: 4e8278b2edeff6c523559bead59aa4f40c82c1859a99a912e876a52155f5e2aa
adjustments: 2
adjusted_at: 2026-10-30T22:00:30Z
approved_at: 2026-10-30T16:30:53Z
approved_hash: 93861a804655defaa82c5339a12ca06e0b7744c6c685e7aed592853004560c17
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-30T22:00:30Z
model: opus
---

# TASK-09: Contexto tasks

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-38, RF-39, RN-08, RN-09, RN-19, CB-02, CB-03, CT-24, contrato "Regra de recorrência", recursos `/tasks` e `/tasks/{id}/completion`, decisões 3, 18, 55, 56)
- `vostok/work/tasks/SPEC-001/TASK-15.md` (contrato do gancho `EntityDeletedHook` chamado ao excluir, CB-06)
- `vostok/memory/decisions.md` (DEC-006: etiquetas em tarefas; consultar com `vostok memory search decision etiquetas tarefas`)
- `apps/server/src/projects/domain/card.rs` (`validate_labels`, `LABELS_MAX`, `LABEL_MAX_CHARS` e o teste `card_labels_are_trimmed_deduplicated_and_limited`: a mesma regra de etiquetas da TASK-14, a copiar)
- `apps/server/src/projects/migrations/20261101140001_create-projects.sql` (coluna `labels TEXT[]` do cartão, a seguir)
- `apps/server/Cargo.toml`
- `apps/server/src/main.rs`
- `apps/server/src/shared` (erros `problem+json`, UUID v7, relógio injetável, regra de recorrência, visibilidade)
- `apps/server/src/http` (`AppState`, extrator da sessão, CSRF e auxiliares de teste)
- `vostok/rules/project/api.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/security.md`

### Mudar

- `apps/server/src/tasks/mod.rs` (criar): declara as camadas e expõe `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` e `pub struct TasksApi` (`utoipa::OpenApi`).
- `apps/server/src/tasks/domain/mod.rs` (criar): módulo do domínio, sem axum nem sqlx.
- `apps/server/src/tasks/domain/task.rs` (criar): tarefa pontual ou recorrente, conclusão e reabertura (RF-38, RN-19); já existe, recebe `validate_labels` e o campo `labels` (DEC-006).
- `apps/server/src/tasks/domain/schedule.rs` (criar): segmentos de regra com vigência e cálculo das ocorrências num intervalo (RN-08).
- `apps/server/src/tasks/domain/occurrence.rs` (criar): ocorrência identificada pela data local e conclusão separada (RN-09).
- `apps/server/src/tasks/domain/error.rs` (criar): `TasksError` com `thiserror` e códigos estáveis em inglês.
- `apps/server/src/tasks/application/mod.rs` (criar): serviços de aplicação.
- `apps/server/src/tasks/application/ports.rs` (criar): trait do repositório, e o alias `EntityDeletedHook` copiado da TASK-15; já existe, `TaskFilter` recebe `label`.
- `apps/server/src/tasks/application/tasks.rs` (criar): casos de uso de tarefas, mudança de regra, conclusão, reabertura e listagem de ocorrências; já existe, `NewTask` e `TaskChanges` recebem `labels`.
- `apps/server/src/tasks/infrastructure/mod.rs` (criar): implementação PostgreSQL.
- `apps/server/src/tasks/infrastructure/pg_tasks.rs` (criar): repositório de tarefas, segmentos e conclusões; já existe, grava e lê `labels` e filtra por `label`.
- `apps/server/src/tasks/interface/mod.rs` (criar): montagem das rotas.
- `apps/server/src/tasks/interface/dto.rs` (criar): corpos em `snake_case` com `utoipa::ToSchema`; já existe, recebe `labels` nos corpos e na resposta e `label` em `TaskListQuery`.
- `apps/server/src/tasks/interface/handlers.rs` (criar): handlers, validação na borda e conversão de `TasksError` em `problem+json`; já existe, repassa as etiquetas e o filtro novo.
- `apps/server/src/tasks/interface/openapi.rs` (criar): `TasksApi` com todas as rotas e esquemas; já existe, recebe o teste `documents_task_labels_and_label_filter`.
- `apps/server/src/tasks/migrations/20261101090001_create-tasks.sql` (criar): tabelas `tasks`, `task_recurrence_segments` e `task_completions`, índices e RLS; já existe e é editada no lugar, com a coluna `labels` e o índice GIN (DEC-006).
- `apps/server/src/tasks/tests/mod.rs` (criar): auxiliar dos testes de integração (PostgreSQL em container, migrator, app de teste com relógio fixo e sessões de dois usuários).
- `apps/server/src/tasks/tests/tasks.rs` (criar): testes de integração de tarefas pontuais e recorrentes (CT-24); já existe, recebe os testes de etiquetas e do filtro `label`.
- `apps/server/src/tasks/tests/deletion_hook.rs` (criar): testes do gancho de exclusão (CB-06).
- `apps/server/src/tasks/tests/authorization.rs` (criar): 404 para dado de outro usuário e RLS ativa; já existe, recebe `task_label_filter_ignores_other_user_tasks`.

### Passos

1. Confira as pré-condições da TASK-04: `apps/server/src/main.rs` declara o módulo `tasks` (o registro do `router()` e do `migrator()` fica com a TASK-18); `apps/server/src/shared` tem o erro `problem+json`, o gerador de UUID v7, o relógio injetável, a regra de recorrência do contrato com o cálculo das ocorrências num intervalo e a visibilidade; `apps/server/src/http` tem o `AppState`, o extrator do usuário da sessão, o CSRF e o auxiliar de testes; `apps/server/Cargo.toml` tem `sqlx`, `utoipa`, `thiserror`, `chrono-tz` e, em dev-dependencies, `testcontainers` com o módulo postgres. Se algo faltar, PARE e reporte ao Coordenador: esta tarefa não altera `main.rs`, `http`, `shared` nem `Cargo.toml`.
2. Crie `apps/server/src/tasks/mod.rs` com `pub mod domain; pub mod application; pub mod infrastructure; pub mod interface;` e `#[cfg(test)] mod tests;`, as funções `router()`, `migrator()` (`sqlx::migrate!("src/tasks/migrations")`) e o reexport de `interface::openapi::TasksApi`. Crie os `mod.rs` das camadas.
3. Escreva primeiro os testes unitários do domínio e confirme que falham (`cargo test -p atria-server tasks::domain`):
   - `task.rs`: `one_off_task_completes_and_reopens`, `completing_completed_task_is_refused`, `one_off_task_refuses_occurrence_date`.
   - `schedule.rs`: `monthly_on_31_falls_on_last_day_of_short_months` (CB-02), `yearly_on_feb_29_falls_on_feb_28_in_common_year` (CB-03), `rule_change_keeps_past_occurrences_of_old_rule` (RN-08), `rule_change_applies_new_rule_from_effective_date`, `occurrence_date_uses_rule_timezone` (relógio em `2026-11-01T01:00:00Z` é 31/10 em `America/Sao_Paulo`), `weekly_rule_across_dst_change_keeps_local_date` (`America/New_York`, semana de 01/11/2026), `ends_on_stops_occurrences`.
   - `occurrence.rs`: `each_occurrence_is_completed_separately` (RN-09), `completing_date_outside_rule_is_refused`, `completed_occurrence_outside_new_rule_is_kept`, `completing_past_occurrence_is_refused`, `occurrences_before_today_are_not_listed`.
   Os testes usam relógio fixo, nunca a data atual (testing-07).
4. Implemente o domínio sobre a regra de recorrência de `shared`, sem reimplementar o cálculo de datas:
   - Tarefa pontual: `due_on DATE` opcional e `completed_at` nulo; concluir preenche, reabrir limpa.
   - Tarefa recorrente: uma lista de segmentos `{ rule, effective_from, effective_until }`; a ocorrência é identificada pela data local (`occurrence_date`) no fuso da regra. As ocorrências de um intervalo são as datas geradas por cada segmento dentro da sua vigência, unidas às datas já concluídas no intervalo.
   - Mudar a regra a partir de `effective_from` (padrão: hoje no fuso da regra, pelo relógio injetado) fecha o segmento vigente em `effective_from - 1 dia` e abre um novo; as conclusões já gravadas, de hoje em diante, nunca mudam (RN-08).
   - Concluir uma ocorrência exige que a data seja gerada por algum segmento; reabrir remove só a conclusão daquela data.
   - Tarefa recorrente não guarda histórico: só existem ocorrências de hoje em diante, com "hoje" sendo a data local no fuso da regra pelo relógio injetado. Concluir ou reabrir uma data anterior a hoje é recusado com `TasksError::OccurrenceInPast`, e as conclusões de datas passadas são descartadas. A tarefa pontual vencida e não concluída continua existindo até ser concluída ou excluída.
   - Uma tarefa não tem notificação: lembrete é do contexto `reminders` (RN-19).
5. Escreva a migração `20261101090001_create-tasks.sql`: `tasks` com `id`, `owner_id`, `visibility CHECK IN ('personal','shared') DEFAULT 'personal'`, `title`, `description TEXT NULL`, `due_on DATE NULL`, `is_recurring BOOLEAN`, `completed_at TIMESTAMPTZ NULL`, `CHECK (NOT is_recurring OR completed_at IS NULL)`, `created_at`, `updated_at`, `deleted_at`; `task_recurrence_segments` com `id`, `owner_id`, `task_id REFERENCES tasks ON DELETE CASCADE`, `rule JSONB`, `effective_from DATE`, `effective_until DATE NULL`, `CHECK (effective_until IS NULL OR effective_until >= effective_from)`, `created_at`; `task_completions` com `id`, `owner_id`, `task_id REFERENCES tasks ON DELETE CASCADE`, `occurrence_date DATE`, `completed_at TIMESTAMPTZ`, `UNIQUE (task_id, occurrence_date)`; índices em toda FK e em `tasks(owner_id, due_on)`; `ENABLE` e `FORCE ROW LEVEL SECURITY` nas três tabelas, com a política `USING (owner_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid)`.
6. Escreva os testes de integração antes dos serviços e handlers, com PostgreSQL em container, o `migrator()` do contexto e o auxiliar de testes de `apps/server/src/http` com relógio fixo, e confirme que falham:
   - `tests/tasks.rs`: `one_off_task_completes_and_reopens_via_api` (CT-24, RF-38), `daily_task_completes_only_today_occurrence` (CT-24, RF-39: tarefa diária, `POST /tasks/{id}/completion` com a data de hoje, e `GET /tasks/occurrences` mostra só hoje concluída), `reopening_occurrence_keeps_others`, `rule_change_affects_only_future_occurrences` (RN-08), `monthly_task_on_31_lists_last_day_of_february` (CB-02), `task_list_filters_paginates_and_searches`, `visibility_is_saved` (RF-21), `duplicate_completion_is_idempotent`, `occurrences_start_today_without_history` (relógio num dia, conclusão de hoje, relógio avançado um dia: `GET /tasks/occurrences` com `from` uma semana antes começa no novo hoje e a conclusão de ontem não existe mais em `task_completions`), `completing_yesterday_occurrence_is_refused` (422 com `occurrence_in_past`), `overdue_one_off_task_is_kept` (tarefa pontual vencida ontem e não concluída continua em `GET /tasks`).
   - `tests/deletion_hook.rs`: `deleting_task_calls_entity_deleted_hook` (camada `Extension<EntityDeletedHook>` que grava as chamadas e espera `(owner_id, "task", id)`, só depois do commit), `delete_without_hook_still_succeeds` (CB-06).
   - `tests/authorization.rs`: `other_user_task_returns_404` (GET, PATCH, DELETE, conclusão, reabertura e ocorrências), `row_level_security_hides_other_owner_rows`, `mutation_without_csrf_is_refused`.
7. Implemente a porta, o serviço e o repositório: cada transação executa `SELECT set_config('app.current_user_id', $1, true)` com o id do usuário da sessão e toda query filtra também por `owner_id` e `deleted_at IS NULL` (security-04); registro inexistente ou de outro dono vira `TasksError::NotFound`. A conclusão usa `INSERT ... ON CONFLICT (task_id, occurrence_date) DO NOTHING`, de modo que repetir a conclusão não falha. Na mesma transação de cada conclusão ou reabertura de tarefa recorrente, e na listagem de ocorrências, apague as linhas de `task_completions` da tarefa com `occurrence_date` anterior a hoje, sem agendador.
8. Implemente `interface` sob `/api/v1`: `GET|POST /tasks` (filtros `status=open|completed`, `recurring`, `due_from`, `due_to`, busca `q` no título, paginação por cursor `cursor` e `limit`, cursor opaco com `created_at` e `id` em base64url), `GET|PATCH|DELETE /tasks/{id}` (`PATCH` aceita `recurrence` com `effective_from`), `POST /tasks/{id}/completion` (corpo com `occurrence_date`, obrigatório na recorrente), `DELETE /tasks/{id}/completion` (`occurrence_date` na query, obrigatório na recorrente) e `GET /tasks/occurrences?from=&to=` (intervalo de até 366 dias, com `task_id`, `occurrence_date` e `completed`; nas recorrentes, `from` anterior a hoje vale como hoje). Converta `TasksError` em `problem+json` (códigos `not_found`, `occurrence_not_found`, `occurrence_date_required`, `occurrence_in_past`, `validation_failed`).
9. Remoção das ligações ao excluir (CB-06): em `application/ports.rs`, declare o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15 para ser o mesmo tipo na `Extension`, e um comentário dizendo por que a grafia tem de ser idêntica. Os handlers de exclusão extraem `Option<Extension<EntityDeletedHook>>` e, só depois do commit da transação, chamam o gancho (com `.await`) para cada entidade excluída; sem o gancho, a exclusão segue igual. Tipos usados: `task`. `DELETE /tasks/{id}` chama o gancho com `(owner_id, "task", id)`. Este contexto não chama o `links` direto nem instala o gancho real: a TASK-18 instala `Extension(links::entity_deleted_hook(pool))`.
10. Escreva `interface/openapi.rs` com `TasksApi` e o teste `documents_all_tasks_routes`.
11. Rode `cargo fmt`, `cargo clippy -p atria-server -- -D warnings` e `cargo test -p atria-server tasks::` até passarem sem aviso, sem `unwrap`, `expect` ou `panic!` fora dos testes.
12. Etiquetas na tarefa (DEC-006), sobre o código que já existe, sem refazer o resto. Testes primeiro: escreva todos os testes deste passo e confirme que falham com `cargo test -p atria-server -- task_label` antes de mudar o código.
   1. Teste unitário em `domain/task.rs`: `task_labels_are_trimmed_deduplicated_and_limited`, no molde de `card_labels_are_trimmed_deduplicated_and_limited` de `apps/server/src/projects/domain/card.rs`: `[" casa ", "obra"]` vira `["casa", "obra"]`; `["casa", "CASA"]`, `["  "]`, uma etiqueta de 51 caracteres e 21 etiquetas dão `TasksError::Validation`.
   2. Testes de integração em `tests/tasks.rs`: `task_labels_are_saved_and_replaced` (`POST /tasks` pontual com `labels: [" casa ", "obra"]` responde `labels: ["casa", "obra"]`; sem `labels`, responde `[]`; `PATCH` com `labels: ["leitura"]` troca a lista inteira; `PATCH` sem `labels` mantém a lista; uma recorrente diária com `labels: ["saude"]` grava e devolve igual, e o `PATCH` de `recurrence` não mexe nas etiquetas; `GET /tasks/{id}` e `GET /tasks` trazem `labels`), `task_labels_out_of_limits_return_422` (`["casa", "CASA"]`, 21 etiquetas e uma de 51 caracteres, no `POST` e no `PATCH`, respondem 422 `validation_failed`), `task_label_filter_lists_only_tagged_tasks` (três tarefas, com `["casa"]`, `["casa", "obra"]` e `[]`: `GET /tasks?label=casa` traz as duas primeiras, `?label=obra` só a segunda, `?label=nada` nenhuma; combinado com `status=open`, com `recurring` e com a paginação por cursor `limit=1`, sem repetir nem pular tarefa) e `task_label_filter_rejects_invalid_value_with_422` (`?label=` vazio ou com 51 caracteres responde 422 `validation_failed`).
   3. Teste de autorização em `tests/authorization.rs`: `task_label_filter_ignores_other_user_tasks` (a Alice tem uma tarefa com `["casa"]`; o Bob pede `GET /tasks?label=casa` e recebe a lista vazia).
   4. Teste em `interface/openapi.rs`: `documents_task_labels_and_label_filter` (o esquema `TaskResponse` tem `labels` como lista de texto, `CreateTaskRequest` e `UpdateTaskRequest` têm `labels` opcional e `GET /api/v1/tasks` documenta o parâmetro `label`). O nome contém `task_label` para entrar no filtro da evidência.
   5. Migração: edite no lugar `migrations/20261101090001_create-tasks.sql` (não crie migração nova): na tabela `tasks`, depois de `completed_at`, acrescente `labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 20)`, igual ao cartão da TASK-14, e `CREATE INDEX tasks_labels_idx ON tasks USING GIN (labels);` (database-07). A RLS e as políticas com `NULLIF` ficam como estão.
   6. Domínio, em `domain/task.rs`: constantes `LABELS_MAX: usize = 20` e `LABEL_MAX_CHARS: usize = 50`; `pub fn validate_labels(labels: &[String]) -> Result<Vec<String>, TasksError>` com a mesma regra de `projects::domain::card::validate_labels` (tira os espaços das pontas; vazia dá `TasksError::invalid("labels", "required")`; mais de 50 caracteres, `"too_long"`; repetida sem diferenciar maiúsculas, `"duplicated"`; mais de 20, `"too_many"`), copiada e não importada do contexto `projects` ([project/architecture-04]); campo `pub labels: Vec<String>` em `Task`.
   7. Aplicação e porta: `NewTask` recebe `labels: Vec<String>`; `TaskChanges` recebe `labels: Option<Vec<String>>` (`None` mantém, `Some` troca a lista inteira); o serviço chama `validate_labels` ao criar e ao alterar. `TaskFilter` recebe `label: Option<String>`; o serviço valida `label` (sem espaços nas pontas, não vazia, até 50 caracteres; senão `TasksError::invalid("label", "required" | "too_long")`).
   8. Repositório, em `infrastructure/pg_tasks.rs`: `TASK_COLUMNS` e `TaskRow` passam a ler `labels` (`Vec<String>`); `insert_task` grava `labels` com mais um `$n` e `.bind(&task.labels)`; `update_task` faz `labels = $n` com `.bind(&task.labels)`, ambos em `sqlx::query` com `.bind`, como hoje. Em `list_tasks`, que já monta a consulta com `QueryBuilder`, acrescente, depois do filtro `due_to`, `if let Some(label) = &filter.label { query.push(" AND labels @> ARRAY[").push_bind(label.clone()).push("]::text[]"); }`: `push_bind` gera um parâmetro, como o `.bind`; não troque a função por outra forma de consulta. A comparação é exata, para usar o índice GIN.
   9. Interface: em `interface/dto.rs`, `CreateTaskRequest.labels: Option<Vec<String>>` (sem ele, `[]`), `UpdateTaskRequest.labels: Option<Vec<String>>`, `TaskResponse.labels: Vec<String>` e, em `TaskListQuery`, `label: Option<String>`, com a descrição do parâmetro no `IntoParams`. Em `interface/handlers.rs`, repasse os campos novos ao serviço; os erros de `labels` e `label` saem como 422 `validation_failed`.
   10. Rode de novo o passo 11 até passar sem aviso.

### Baseline

- `test -e apps/server/src/tasks && echo tasks-existe || echo tasks-ausente`
- `test -e apps/server/src/shared && echo shared-existe || echo shared-ausente`

### Verificação

```bash
# Formatação e lint sem aviso (code-style-02)
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# Testes unitários e de integração do contexto: esperado "test result: ok" e 0 failed
cargo test -p atria-server tasks::
```

### Evidências

- `cargo-test-tasks.txt` (automática): `cargo test -p atria-server tasks::`
  - Prova: tarefas pontuais concluem e reabrem, tarefas recorrentes concluem cada ocorrência separadamente, a mudança de regra só afeta o futuro e dado alheio responde 404 (RF-38, RF-39, CT-24).
  - Trecho: as linhas `test tasks::tests::tasks::one_off_task_completes_and_reopens_via_api ... ok`, `test tasks::tests::tasks::daily_task_completes_only_today_occurrence ... ok`, `test tasks::domain::schedule::tests::monthly_on_31_falls_on_last_day_of_short_months ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests`.
- `cargo-test-tasks-labels.txt` (automática): `cargo test -p atria-server -- task_label`
  - Prova: a tarefa, pontual ou recorrente, tem etiquetas com os limites do cartão da TASK-14, a listagem filtra por etiqueta e o filtro não mostra tarefas de outro usuário (RF-38, DEC-006).
  - Trecho: as linhas `test tasks::domain::task::tests::task_labels_are_trimmed_deduplicated_and_limited ... ok`, `test tasks::tests::tasks::task_labels_are_saved_and_replaced ... ok`, `test tasks::tests::tasks::task_label_filter_lists_only_tagged_tasks ... ok`, `test tasks::tests::authorization::task_label_filter_ignores_other_user_tasks ... ok` e `test result: ok`, com 7 testes executados.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests` (os testes não foram escritos).

### Concluída quando

- [x] Uma tarefa pontual é cadastrada, concluída e reaberta (RF-38, CT-24).

  > Como comprovar: rodar `cargo test -p atria-server tasks::` e ver `ok` em `one_off_task_completes_and_reopens_via_api` e `one_off_task_completes_and_reopens` (evidência `cargo-test-tasks.txt`).

- [x] Numa tarefa diária, concluir a ocorrência de hoje deixa só ela concluída, e cada ocorrência é concluída e reaberta separadamente (RF-39, CT-24).

  > Como comprovar: ver `ok` em `daily_task_completes_only_today_occurrence`, `reopening_occurrence_keeps_others` e `each_occurrence_is_completed_separately`.

- [x] Tarefa recorrente não guarda histórico: as ocorrências começam hoje, concluir uma data passada é recusado e as conclusões passadas são descartadas, enquanto a tarefa pontual vencida continua guardada (RF-39, CT-24).

  > Como comprovar: ver `ok` em `occurrences_start_today_without_history`, `completing_yesterday_occurrence_is_refused`, `overdue_one_off_task_is_kept`, `completing_past_occurrence_is_refused` e `occurrences_before_today_are_not_listed`.

- [x] A recorrência respeita fim de mês, 29/02, fuso e horário de verão, e mudar a regra só afeta as ocorrências futuras não concluídas (RF-39).

  > Como comprovar: ver `ok` em `monthly_on_31_falls_on_last_day_of_short_months`, `yearly_on_feb_29_falls_on_feb_28_in_common_year`, `occurrence_date_uses_rule_timezone`, `weekly_rule_across_dst_change_keeps_local_date` e `rule_change_affects_only_future_occurrences`.

- [x] Tarefa de outro usuário responde 404, a RLS está forçada e mutações sem CSRF são recusadas (RNF-01, RNF-02).

  > Como comprovar: ver `ok` em `other_user_task_returns_404`, `row_level_security_hides_other_owner_rows` e `mutation_without_csrf_is_refused`.

- [x] Excluir uma tarefa chama o gancho de exclusão depois do commit, com `task`, para as ligações sumirem dos dois lados; sem o gancho a exclusão funciona igual (CB-06).

  > Como comprovar: ver `ok` em `deleting_task_calls_entity_deleted_hook` e `delete_without_hook_still_succeeds` (evidência `cargo-test-tasks.txt`).

- [x] A tarefa, pontual ou recorrente, tem etiquetas (até 20, cada uma até 50 caracteres, sem repetidas sem diferenciar maiúsculas), gravadas, trocadas pelo `PATCH` e devolvidas na leitura e na listagem; fora dos limites, 422 (RF-38, DEC-006).

  > Como comprovar: rodar `cargo test -p atria-server -- task_label` e ver `ok` em `task_labels_are_trimmed_deduplicated_and_limited`, `task_labels_are_saved_and_replaced` e `task_labels_out_of_limits_return_422` (evidência `cargo-test-tasks-labels.txt`).

- [x] A listagem de tarefas filtra por etiqueta (`label`), junto com os outros filtros e a paginação, sem mostrar tarefas de outro usuário (RF-38, DEC-006).

  > Como comprovar: ver `ok` em `task_label_filter_lists_only_tagged_tasks`, `task_label_filter_rejects_invalid_value_with_422`, `task_label_filter_ignores_other_user_tasks` e `documents_task_labels_and_label_filter` (evidência `cargo-test-tasks-labels.txt`).

- [x] O contexto expõe `router()`, `migrator()` e `TasksApi` com todas as rotas, e passa no `cargo fmt --check` e no `cargo clippy` sem aviso.

  > Como comprovar: ver `ok` em `documents_all_tasks_routes` e a verificação terminar sem erro.

## Descrição

### Resumo executivo

Entrega Tarefas no servidor: tarefas pontuais que se concluem e reabrem, e tarefas recorrentes em que cada ocorrência é concluída separadamente, todas com etiquetas e a lista filtrável por etiqueta.
O benefício é acompanhar hábitos e obrigações repetidas olhando só para hoje e para a frente: a tarefa recorrente não guarda histórico, e só a tarefa pontual vencida continua guardada.
Perfil julgamento: a recorrência tem risco alto de erro em fuso, fim de mês e horário de verão, e o desenho das ocorrências exige escolha.
Depende do núcleo do servidor e libera a busca, os relatórios e, depois da integração do servidor, as telas de Tarefas e o Dashboard.

### Detalhes técnicos

**Abordagem.** Contexto `tasks` em `apps/server/src/tasks`, nas quatro camadas de [project/architecture-02], expondo `router()`, `migrator()` e `TasksApi`; o registro no `main.rs` é da TASK-18. O cálculo das datas é a regra de recorrência de `apps/server/src/shared` (TASK-04); o contexto acrescenta a vigência por segmentos e as conclusões.

**Alternativas e critérios de escolha.**
- Escolhida: ocorrências virtuais, calculadas dos segmentos de regra na leitura, com só as conclusões gravadas. Critérios: cada ocorrência concluída separadamente (RN-09), mudança de regra só para o futuro sem reescrever o passado (RN-08), nenhum agendador e nenhuma linha por dia para tarefas diárias sem fim.
- Descartada: materializar cada ocorrência como linha, sob demanda ou por job. Faz sentido no Financeiro, onde cada ocorrência tem valor e liquidação, mas aqui só multiplicaria linhas e exigiria regenerar o futuro a cada mudança.
- Descartada: gerar a próxima ocorrência ao concluir a atual. Perde as ocorrências futuras não concluídas e não deixa concluir "só a de hoje" (CT-24).
- Tarefa recorrente sem histórico, decidido no protótipo (TASK-01): as ocorrências começam hoje, a conclusão de data passada é recusada e as conclusões passadas são apagadas na própria transação de conclusão, reabertura e listagem. Descartado: um job diário de limpeza, que exigiria agendador. Critério: a tarefa recorrente é um compromisso do dia, e o que importa é hoje e o futuro; só a pontual vencida continua, porque ainda precisa ser feita.
- Vigência por segmentos (`effective_from`, `effective_until`) em vez de uma regra única editada no lugar, porque a regra editada mudaria também as ocorrências passadas não concluídas, contra o RN-08.
- Ocorrência identificada pela data local no fuso da regra, não por instante UTC, porque a tarefa é do dia, e a data local é estável no horário de verão ([project/code-style-06]).
- Conclusão idempotente pelo `UNIQUE (task_id, occurrence_date)`, para um clique repetido na interface otimista não gerar erro.
- Recursos além do contrato, exigidos pelos RF: `GET|PATCH|DELETE /tasks/{id}`, `DELETE /tasks/{id}/completion` (reabrir, RF-38) e `GET /tasks/occurrences` (listar ocorrências, RF-39).
- Remoção das ligações ao excluir (CB-06) pelo gancho `EntityDeletedHook` da TASK-15, opcional via `Option<Extension<EntityDeletedHook>>` e chamado depois do commit, com os tipos `task`. Descartados: chamar o contexto `links` direto, que acopla e cria dependência entre tarefas da mesma onda ([project/architecture-04]); `NOTIFY` do PostgreSQL, que perde o evento sem ouvinte. Critério: sem acoplamento e testável com um gancho falso; a TASK-18 instala o gancho real. O alias precisa ter a mesma grafia da TASK-15 para a `Extension` casar.

- Etiquetas (DEC-006) em `labels TEXT[]` na própria `tasks`, com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada com 422) copiada para o domínio de `tasks`. Descartados: tabela própria de etiquetas, que exigiria junção sem ganho no MVP; importar `validate_labels` do contexto `projects`, que acopla contextos ([project/architecture-04]); juntar as repetidas em silêncio, que divergiria do cartão. O nome do campo é `labels`, como no cartão e nas metas (TASK-08), para o mesmo padrão em todas as entidades ([project/api-04]); descartado `tags`.
- Filtro `label` com uma etiqueta por pedido e comparação exata (`labels @> ARRAY[...]`), servido pelo índice GIN `tasks_labels_idx`. Descartados: comparação sem diferenciar maiúsculas com `unnest`, que não usa índice (database-07), e várias etiquetas por pedido, que o protótipo não pede. O filtro entra no `QueryBuilder` que `list_tasks` já usa, com `push_bind`; descartado reescrever a listagem em `sqlx::query` só por isso, que mudaria código fora do ajuste.
- Migração editada no lugar, conforme a convenção da onda. Descartado: migração nova de `ALTER TABLE`, que só faz sentido depois de um banco em uso.

**Riscos técnicos.** Recorrência errada em fuso, fim de mês e horário de verão (risco alto da spec), coberta pelos testes de CB-02, CB-03, fuso e horário de verão ([project/testing-08]); intervalo de ocorrências grande demais, limitado a 366 dias. Pré-condição: o módulo `tasks` declarado no `main.rs` e a regra de recorrência em `shared`, da TASK-04.

**Referências da spec.** RF-38, RF-39, RN-08, RN-09, RN-19, CB-02, CB-03, CT-24, CB-06, RF-21 (visibilidade), RNF-01, RNF-02, decisões 3, 18, 55 e 56; memória DEC-006 (etiquetas) e DEC-002.

**Arquivos em comum na onda.** Nenhum: a tarefa só cria arquivos em `apps/server/src/tasks`.

### Card

- **Título:** Contexto tasks
- **Tipo:** historia
- **Descrição:** Implementa no servidor o contexto de Tarefas, com tarefas pontuais que concluem e reabrem, tarefas recorrentes concluídas por ocorrência e etiquetas, com a listagem filtrável por etiqueta.
- **Critérios de aceite:**
  - [ ] Tarefa pontual conclui e reabre.
  - [ ] Na tarefa diária, só a ocorrência concluída fica concluída.
  - [ ] Tarefa recorrente sem histórico: só hoje e o futuro; a pontual vencida continua guardada.
  - [ ] Recorrência certa em fim de mês, 29/02, fuso e horário de verão, e mudança de regra só no futuro.
  - [ ] Dado de outro usuário responde 404.
  - [ ] Etiquetas na tarefa, com até 20 de até 50 caracteres e sem repetidas.
  - [ ] Listagem filtrada por etiqueta.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T16:30:53Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Etiquetas na tarefa pontual e recorrente em labels TEXT[] com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada), gravadas, trocadas pelo PATCH e devolvidas, com filtro label na listagem (DEC-006); testes novos de domínio, integração, autorização e OpenAPI, evidência cargo-test-tasks-labels.txt, Ler, Mudar, passo 12, Concluída quando, Detalhes técnicos e Card atualizados, migração editada no lugar e Baseline mantida |
| 4 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-10-30 | retomada | validating | decisão do usuário: usuário aceitou [1]: pasta tasks criada pela própria tarefa (defeito da issue 6); aceite geral para regressões desse tipo; aceito(s): 1 |
| 7 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-30 | regressão | passed | 1 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-10-30 | evidências | passed | 2 evidência(s) em evidence/TASK-09/ |
| 10 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Recorrente sem histórico: ocorrências a partir de hoje, conclusão de data passada recusada (occurrence_in_past) e conclusões passadas descartadas; pontual vencida mantida; testes e critério novos |
| 2 | 2026-10-30 | agente | Etiquetas na tarefa pontual e recorrente em labels TEXT[] com a regra do cartão da TASK-14 (até 20, até 50 caracteres, repetida sem diferenciar maiúsculas recusada), gravadas, trocadas pelo PATCH e devolvidas, com filtro label na listagem (DEC-006); testes novos de domínio, integração, autorização e OpenAPI, evidência cargo-test-tasks-labels.txt, Ler, Mudar, passo 12, Concluída quando, Detalhes técnicos e Card atualizados, migração editada no lugar e Baseline mantida |
