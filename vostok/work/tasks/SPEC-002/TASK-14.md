---
id: TASK-14
spec: SPEC-002
title: "Tarefas no servidor: horário opcional e próxima ocorrência"
profile: padrao
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-35, RF-38, CT-34, CT-37, CB-05, CB-06]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: a2106f4e8a77326c869b8a27d18bb9ae4b01864c09b96c92fcfa5438db4c8f01
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 8ec2b7ba055b4fb97fed547a7731414bec09cff98f3eae682e736663fc096438
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-14: Tarefas no servidor: horário opcional e próxima ocorrência

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Tarefas: `RecurrenceRule.time` obrigatório e `buildRows`), RF-35, RF-38, CT-34, CT-37, CB-05, CB-06, RN-04, RN-05, os contratos `GET /tasks` (`next_occurrence`) e `POST /tasks, PATCH /tasks/{id}` (`recurrence.rule.time` opcional só em tarefas) em "Contratos e interfaces", e as decisões 5 (resposta 5A) e 17 (inferência I) do "Registro de decisões".
- `vostok/work/.archive/SPEC-001/spec.md`: RN-08 (troca de regra só vale para o futuro) e RN-09 (cada ocorrência é concluída separadamente).
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-06], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-07] e [project/testing-08].
- `vostok/rules/project/api.md`: [project/api-02] e [project/development-methodology-03] em `vostok/rules/project/development-methodology.md`.
- `vostok/memory/knowledge.md` (KNW-007): uma compilação pesada do servidor por vez.
- `apps/server/src/shared/recurrence.rs` (struct `RecurrenceRule`, fns `validate`, `occurrences_between` e `to_utc`, mod `hour_minute` e os testes, linhas 1 a 240).
- `apps/server/src/tasks/domain/schedule.rs`: `Segment`, `Schedule` (`start`, `current_rule`, `timezone`, `today`, `dates_between`, `change_rule`), `validate_rule`, `segment_dates` e os testes do arquivo.
- `apps/server/src/tasks/domain/occurrence.rs`: `CompletionLog` e o teste com a fn `rule` (linhas 107 a 130).
- `apps/server/src/tasks/application/tasks.rs`: `NewTask`, `TaskChanges`, `TaskView`, `TasksService::{create, get, list, update, occurrences}`, `with_rule`, `new_schedule` e `today_in`.
- `apps/server/src/tasks/application/ports.rs` (`TaskStatus`, `TaskFilter` e `TasksTransaction::{current_rules, load_schedule, recurring_schedules, load_completions}`, linhas 25 a 150).
- `apps/server/src/tasks/infrastructure/pg_tasks.rs` (struct `SegmentRow` e fn `current_rules`, linhas 85 a 215): a regra é gravada como JSON.
- `apps/server/src/tasks/interface/dto.rs`: `CreateTaskRequest`, `UpdateTaskRequest` e `TaskResponse`.
- `apps/server/src/tasks/interface/openapi.rs`: `TasksApi` e os testes `documents_all_tasks_routes` e `documents_task_labels_and_label_filter`.
- `apps/server/src/tasks/tests/mod.rs` (`TestApp`, relógio em 2026-11-01T12:00:00Z, `daily_rule`, `id_of`) e `apps/server/src/tasks/tests/tasks.rs` (testes `daily_task_completes_only_today_occurrence` e `task_list_filters_paginates_and_searches`).
- `apps/server/src/reminders/interface/dto.rs` e `apps/server/src/finance/interface/dto.rs`: usam `RecurrenceRule` e continuam exigindo `time` (não mudar).

### Mudar

- `apps/server/src/shared/recurrence.rs` (alterar): `TaskRecurrenceRule`, a regra das tarefas com `time` opcional, convertida para `RecurrenceRule` só no cálculo; a `RecurrenceRule` de lembretes e Financeiro continua exigindo `time` (RF-35, RN-04).
- `apps/server/src/tasks/interface/dto.rs` (alterar): pedidos e resposta com `TaskRecurrenceRule` e `next_occurrence` em `TaskResponse` (RF-35, RF-38).
- `apps/server/src/tasks/domain/schedule.rs` (alterar): segmentos com `TaskRecurrenceRule`, ocorrência sem horário no dia inteiro e a próxima data em aberto da agenda (RF-35, RF-38, CB-05, CB-06).
- `apps/server/src/tasks/application/tasks.rs` (alterar): `next_occurrence` nas visões da tarefa e, na listagem `status=open`, sem as recorrentes terminadas (RF-38, CB-06).
- `apps/server/src/tasks/application/ports.rs` (alterar): `current_rules` devolve `TaskRecurrenceRule`; necessário porque a regra gravada passa a ser a das tarefas.
- `apps/server/src/tasks/infrastructure/pg_tasks.rs` (alterar): `SegmentRow.rule` lê e grava `TaskRecurrenceRule` em JSON, sem mudar o texto das queries.
- `apps/server/src/tasks/interface/openapi.rs` (alterar): `TaskRecurrenceRule` nos schemas e teste do horário opcional e do `next_occurrence` ([project/development-methodology-03]).
- `apps/server/src/tasks/domain/occurrence.rs` (alterar): só a regra de teste do `mod tests`, convertida para `TaskRecurrenceRule`.
- `apps/server/src/tasks/tests/tasks.rs` (alterar): testes de integração da tarefa sem horário e de `next_occurrence` (CT-34, CT-37, CB-05, CB-06).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Testes primeiro.
   - Em `apps/server/src/shared/recurrence.rs`, no `mod tests`: `task_rule_without_time_round_trips_without_time` (JSON de regra diária sem `time` desserializa em `TaskRecurrenceRule` com `time: None` e serializa sem a chave `time`), `task_rule_with_time_keeps_time` (`"time": "08:00"` vira `Some` e volta como `"08:00"`), `recurrence_rule_still_requires_time` (o mesmo JSON sem `time` falha ao desserializar em `RecurrenceRule`: lembretes e Financeiro continuam exigindo, CT-34) e `all_day_task_rule_falls_on_local_date_on_dst_start` (regra diária sem horário em `America/Sao_Paulo` começando em 2018-11-03: `to_rule().occurrences_between` de 2018-11-03 a 2018-11-06 dá uma ocorrência por dia, cada uma na mesma data local, inclusive em 2018-11-04, quando o horário de verão começou à meia-noite, [project/testing-08]).
   - Em `apps/server/src/tasks/domain/schedule.rs`, no `mod tests`: `rule_without_time_generates_every_local_date` (diária sem horário de 2026-11-01 a 2026-11-03 em `America/Sao_Paulo` e em `Asia/Tokyo`: as três datas), `next_open_date_skips_completed_dates` (diária, hoje 2026-11-01, com 2026-11-01 concluída: 2026-11-02), `next_open_date_finds_weekly_beyond_seven_days` (semanal começando em 2026-11-11: 2026-11-11, CB-05), `next_open_date_finds_yearly_after_a_year` (anual começando em 2026-10-15: 2027-10-15) e `next_open_date_is_none_after_end` (diária de 2026-10-20 com `ends_on` 2026-10-31, hoje 2026-11-01: `None`, CB-06). Converta as regras de teste existentes com `.into()` (passo 3).
   - Em `apps/server/src/tasks/tests/tasks.rs` (relógio do `TestApp` em 2026-11-01, domingo, 09:00 em `America/Sao_Paulo`):
     - `ct34_recurring_task_without_time_is_saved`: `POST /api/v1/tasks` com a regra de `daily_rule("2026-11-01")` sem a chave `time` devolve 201, `recurrence` sem `time` e `next_occurrence` `2026-11-01`; `GET /api/v1/tasks/occurrences?from=2026-11-01&to=2026-11-03` lista as três datas da tarefa; `PATCH` com outra regra sem `time` devolve 200.
     - `ct37_list_has_one_row_per_task_with_next_occurrence`: cria uma diária sem horário, uma semanal (`frequency` `weekly`, `weekdays` `["wed"]`, `starts_on` 2026-11-01) e uma pontual com `due_on` 2026-11-02; `GET /api/v1/tasks` devolve 3 itens, com `next_occurrence` `2026-11-01`, `2026-11-04` e `2026-11-02`.
     - `ct37_completing_today_moves_next_occurrence`: conclui a ocorrência de 2026-11-01 da diária; a listagem passa a mostrar `next_occurrence` `2026-11-02`.
     - `cb05_weekly_task_without_occurrence_in_seven_days_shows_next`: semanal com `starts_on` 2026-11-11 e `weekdays` `["wed"]`: `next_occurrence` `2026-11-11`.
     - `cb06_ended_recurring_task_is_not_open`: diária com `starts_on` 2026-10-20 e `ends_on` 2026-10-31: `GET /api/v1/tasks` mostra a tarefa com `next_occurrence` nulo e `GET /api/v1/tasks?status=open` não a mostra.
   - Em `apps/server/src/tasks/interface/openapi.rs`, no `mod tests`: troque `"RecurrenceRule"` por `"TaskRecurrenceRule"` na lista de `documents_all_tasks_routes` e acrescente `documents_optional_time_and_next_occurrence` (`TaskRecurrenceRule.required` não contém `time`; `TaskResponse.properties.next_occurrence` existe e não está em `required`).
   Rode `cargo test -p atria-server -- tasks:: shared::recurrence` e confira que os testes novos falham.
3. Em `apps/server/src/shared/recurrence.rs`:
   - Crie `pub struct TaskRecurrenceRule` (`Debug`, `Clone`, `PartialEq`, `Eq`, `Serialize`, `Deserialize`, `ToSchema`) com os mesmos campos e atributos de `RecurrenceRule`, menos `time`, que vira `#[serde(default, skip_serializing_if = "Option::is_none", with = "optional_hour_minute")] #[schema(value_type = Option<String>, example = "08:00")] pub time: Option<NaiveTime>`, e o doc: "Regra das tarefas (RN-04): sem horário, a ocorrência vale o dia inteiro na data. Lembretes e Financeiro usam `RecurrenceRule`, que exige o horário".
   - Crie o `mod optional_hour_minute` (mesmo formato `%H:%M` de `hour_minute`, sobre `Option<NaiveTime>`).
   - `impl TaskRecurrenceRule`: `pub fn to_rule(&self) -> RecurrenceRule`, que usa o horário ou, sem ele, `all_day_time()`; `pub fn validate(&self) -> Result<(), RecurrenceError>` (= `self.to_rule().validate()`); e `fn all_day_time() -> NaiveTime`, 12:00 (`NaiveTime::from_hms_opt(12, 0, 0).unwrap_or(NaiveTime::MIN)`), com o comentário: o meio-dia nunca cai num salto de horário de verão nem muda a data local, ao contrário da meia-noite.
   - `impl From<RecurrenceRule> for TaskRecurrenceRule` (com `time: Some(rule.time)`), para os testes e para quem já tem uma regra completa.
   - `RecurrenceRule` não muda.
4. Em `apps/server/src/tasks/domain/schedule.rs`:
   - `Segment.rule`, `Schedule::start`, `current_rule`, `change_rule` e `validate_rule` passam a usar `TaskRecurrenceRule`; `segment_dates` calcula com `segment.rule.to_rule().occurrences_between(...)`.
   - Crie `pub const NEXT_LOOKAHEAD_DAYS: u64 = 3660` (dez anos, o mesmo teto de período do resumo do Financeiro) e `pub fn next_open_date(&self, today: NaiveDate, is_completed: impl Fn(NaiveDate) -> bool) -> Option<NaiveDate>`: percorre janelas de 366 dias a partir de `today` com `dates_between` e devolve a primeira data não concluída; para no fim da agenda (o último segmento com `effective_until`, ou a regra vigente com `ends_on`, anterior à janela) ou em `today + NEXT_LOOKAHEAD_DAYS`.
5. Em `apps/server/src/tasks/domain/occurrence.rs`, no `mod tests`, a fn `rule` devolve `TaskRecurrenceRule` (constrói a `RecurrenceRule` e chama `.into()`); nada muda fora do `mod tests`.
6. Em `apps/server/src/tasks/application/ports.rs`, `current_rules` devolve `HashMap<Uuid, TaskRecurrenceRule>`; em `apps/server/src/tasks/infrastructure/pg_tasks.rs`, `SegmentRow.rule` vira `Json<TaskRecurrenceRule>` e o `use` muda. Não mude o texto de nenhuma query (assim a `.sqlx` continua válida): as regras já gravadas, com `"time": "08:00"`, continuam sendo lidas.
7. Em `apps/server/src/tasks/application/tasks.rs`:
   - `NewTask.recurrence`, `TaskChanges.recurrence`, `TaskView.recurrence`, `new_schedule` e `today_in` passam a `TaskRecurrenceRule`.
   - `TaskView` ganha `pub next_occurrence: Option<NaiveDate>`.
   - Crie `fn next_of(task: &Task, schedule: Option<&Schedule>, log: &CompletionLog, now: DateTime<Utc>) -> Option<NaiveDate>`: pontual → `task.due_on`; recorrente → `schedule.next_open_date(schedule.today(now), |date| log.is_completed(date))`.
   - `create`: `next_occurrence` com a agenda nova e um `CompletionLog::default()`.
   - `with_rule` (usada por `get` e `update`) recebe `now`, carrega a agenda e `load_completions(task.id, schedule.today(now))` da recorrente e preenche `next_occurrence`.
   - `list`: depois de `current_rules`, carregue `tx.recurring_schedules()` num `HashMap`, e para cada recorrente da página `load_completions(id, schedule.today(now))`; preencha `next_occurrence` de cada `TaskView`. Calcule o `next` do cursor antes de filtrar; quando `filter.status == Some(TaskStatus::Open)`, tire as recorrentes com `next_occurrence` nulo (terminadas, CB-06), com um comentário dizendo que a página pode vir com menos itens e o cursor continua válido.
8. Em `apps/server/src/tasks/interface/dto.rs`: `CreateTaskRequest.recurrence`, `UpdateTaskRequest.recurrence` e `TaskResponse.recurrence` passam a `Option<TaskRecurrenceRule>`, com o doc "`time` opcional: sem ele, a ocorrência vale o dia inteiro (RN-04)"; `TaskResponse` ganha, depois de `due_on`, `/// Recorrente: a próxima data não concluída a partir de hoje; pontual: igual a `due_on`; terminada: nulo (RF-38).` `pub next_occurrence: Option<NaiveDate>`, preenchido no `From<TaskView>`.
9. Em `apps/server/src/tasks/interface/openapi.rs`, troque `RecurrenceRule` por `TaskRecurrenceRule` no `use` e nos `schemas`.
10. Rode `cargo test -p atria-server -- tasks:: shared::recurrence reminders::` até passar; depois `cargo fmt` e a Verificação inteira.

### Baseline

- `cargo test -p atria-server tasks:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server shared:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server -- reminders:: finance::tests::recurring_transactions 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: task-recurrence-tests.txt
cargo test -p atria-server -- tasks::tests::tasks::ct34_ tasks::tests::tasks::ct37_ tasks::tests::tasks::cb05_ tasks::tests::tasks::cb06_ tasks::domain::schedule::tests::next_open_date tasks::domain::schedule::tests::rule_without_time shared::recurrence::tests::task_rule shared::recurrence::tests::recurrence_rule_still_requires_time shared::recurrence::tests::all_day tasks::interface::openapi::tests
cargo test -p atria-server tasks::
cargo test -p atria-server shared::
cargo test -p atria-server -- reminders:: finance::tests::recurring_transactions
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando sem mudar a `.sqlx` e `test result: ok` nos testes da regra sem horário e de `next_occurrence`, de Tarefas, do `shared`, de Lembretes, das recorrentes do Financeiro e do `http` (OpenAPI juntado sem conflito de schema).

### Evidências

- `task-recurrence-tests.txt` (automática, da verificação)
  - Prova: a tarefa recorrente sem horário é salva e gera uma ocorrência por dia, inclusive no início do horário de verão, enquanto a regra de lembretes e do Financeiro continua exigindo o horário; a listagem traz uma linha por tarefa com `next_occurrence` (a próxima data não concluída da recorrente, mesmo além de 7 dias, e o `due_on` da pontual), e a recorrente terminada vem com `next_occurrence` nulo e fora das abertas (RF-35, RF-38, CT-34, CT-37, CB-05, CB-06, RN-04, RN-05).
  - Trecho: as linhas `test tasks::tests::tasks::ct34_recurring_task_without_time_is_saved ... ok`, `test tasks::tests::tasks::ct37_list_has_one_row_per_task_with_next_occurrence ... ok`, `cb05_weekly_task_without_occurrence_in_seven_days_shows_next ... ok`, `cb06_ended_recurring_task_is_not_open ... ok`, `test shared::recurrence::tests::recurrence_rule_still_requires_time ... ok` e `test tasks::interface::openapi::tests::documents_optional_time_and_next_occurrence ... ok`, e `test result: ok` sem falhas.
  - Falha: `FAILED`, `test result: FAILED` ou a ausência das linhas `ct34_`, `ct37_`, `cb05_` e `cb06_` (testes novos ausentes).

### Concluída quando

- [x] Uma tarefa recorrente pode ser criada e editada sem horário, e cada ocorrência vale o dia inteiro na data local, inclusive em dia de início do horário de verão (RF-35, CT-34, RN-04).

  > Como comprovar: em `task-recurrence-tests.txt`, ver `ct34_recurring_task_without_time_is_saved`, `rule_without_time_generates_every_local_date` e `all_day_task_rule_falls_on_local_date_on_dst_start` com `ok`.

- [x] Lembretes e Financeiro continuam recusando a regra sem horário (CT-34).

  > Como comprovar: em `task-recurrence-tests.txt`, ver `recurrence_rule_still_requires_time ... ok`; rodar `cargo test -p atria-server -- reminders:: finance::tests::recurring_transactions` e ver `test result: ok`.

- [x] A listagem de tarefas traz uma linha por tarefa com `next_occurrence`: a próxima data não concluída da recorrente a partir de hoje, mesmo depois de 7 dias, e o `due_on` da pontual (RF-38, CT-37, CB-05, RN-05).

  > Como comprovar: em `task-recurrence-tests.txt`, ver `ct37_list_has_one_row_per_task_with_next_occurrence`, `ct37_completing_today_moves_next_occurrence`, `cb05_weekly_task_without_occurrence_in_seven_days_shows_next` e os `next_open_date_*` com `ok`.

- [x] A recorrente terminada vem com `next_occurrence` nulo e não aparece em `status=open` (RF-38, CB-06).

  > Como comprovar: em `task-recurrence-tests.txt`, ver `cb06_ended_recurring_task_is_not_open` e `next_open_date_is_none_after_end` com `ok`.

- [x] O OpenAPI de Tarefas traz `TaskRecurrenceRule` com `time` opcional e `next_occurrence` em `TaskResponse`, sem conflito com a `RecurrenceRule` dos outros contextos, e o servidor passa em fmt, clippy e nos testes (RF-35, RF-38).

  > Como comprovar: em `task-recurrence-tests.txt`, ver `documents_optional_time_and_next_occurrence ... ok`; rodar a Verificação e ver `openapi_schema_names_do_not_conflict ... ok` e todos os comandos sem erro.

## Descrição

### Resumo executivo

O servidor passa a aceitar tarefas recorrentes sem horário (valem o dia inteiro) e a informar, para cada tarefa da lista, a próxima data em aberto.
É a base para a tela de Tarefas mostrar uma linha por tarefa, sem repetições e sem esconder a próxima ocorrência.
Perfil padrão: muda o contrato de Tarefas, sem banco; lembretes e Financeiro continuam exigindo horário.
Desbloqueia a geração do contrato (TASK-15) e, por ela, a tela de Tarefas (TASK-28).

### Detalhes técnicos

**Abordagem.** Um tipo novo em `shared/recurrence.rs`, `TaskRecurrenceRule`, igual à `RecurrenceRule` mas com `time` opcional, só para Tarefas; o cálculo continua na `RecurrenceRule` (`to_rule()`), usando 12:00 quando não há horário. A agenda (`Schedule`) ganha `next_open_date`, e a aplicação preenche `next_occurrence` em todas as visões da tarefa (listagem, detalhe, criação e edição).

**Decisões tomadas.**
- Tipo próprio das tarefas, e não `time: Option` na `RecurrenceRule`: a regra comum é usada por lembretes e Financeiro, que continuam exigindo o horário (inferência I); com o tipo próprio o contrato deles não muda, e não é preciso mexer nos literais de regra dos testes de `finance` e `reminders`. O schema novo tem outro nome (`TaskRecurrenceRule`) para não conflitar no OpenAPI juntado (`openapi_schema_names_do_not_conflict`).
- 12:00 como horário de cálculo do dia inteiro, e não 00:00: a meia-noite cai no salto do horário de verão em fusos como `America/Sao_Paulo` (até 2019) e pode mudar a data local.
- Regras já gravadas (JSON com `time`) continuam válidas: o campo opcional aceita o valor; o texto das queries não muda e a `.sqlx` continua válida.
- `next_occurrence` olha até dez anos à frente (o teto de período do resumo do Financeiro); além disso, nulo.
- A listagem `status=open` tira as recorrentes terminadas depois de buscar a página (CB-06): a página pode vir com menos itens, mas o cursor continua certo. Descartado filtrar no SQL, porque o fim depende da regra em JSON e do fuso de cada tarefa.
- A listagem carrega as agendas com `recurring_schedules()` (uma query) e as conclusões de cada recorrente da página; sem gravar nada, ao contrário de `occurrences`, que descarta as conclusões passadas.

**Componentes fora do plano.** `application/ports.rs`, `infrastructure/pg_tasks.rs`, `interface/openapi.rs`, o `mod tests` de `domain/occurrence.rs` e `tests/tasks.rs` entram em "Mudar" porque trocam o tipo da regra ou testam a entrega.

**Riscos técnicos.** Os tipos gerados mudam de `RecurrenceRule` para `TaskRecurrenceRule` nas rotas de Tarefas: o `apps/web/src/features/tasks/hooks/use-tasks.ts`, que usa `Schemas['RecurrenceRule']`, deixa de bater depois da TASK-15 e é ajustado pela TASK-28. Um `with_rule` que agora lê as conclusões acrescenta uma query por tarefa recorrente aberta no detalhe.

**Referências da spec.** RF-35, RF-38, CT-34, CT-37, CB-05, CB-06, RN-04, RN-05; contratos de `GET /tasks`, `POST /tasks` e `PATCH /tasks/{id}`; decisões 5 (resposta 5A) e 17 (inferência I).

**Arquivos em comum na onda 1.** Nenhum arquivo com outra tarefa; as demais tarefas de servidor da onda compilam o `atria-server` e rodam uma por vez (KNW-007).

### Card

- **Título:** Tarefas no servidor: horário opcional e próxima ocorrência
- **Tipo:** tarefa
- **Descrição:** Tarefas recorrentes passam a aceitar regra sem horário (dia inteiro) e a listagem de tarefas traz `next_occurrence`, com as recorrentes terminadas fora das abertas.
- **Critérios de aceite:**
  - [ ] Tarefa recorrente sem horário é criada e editada, com uma ocorrência por dia.
  - [ ] Lembretes e Financeiro continuam exigindo o horário.
  - [ ] Cada tarefa da lista traz `next_occurrence`, mesmo além de 7 dias.
  - [ ] A recorrente terminada vem com `next_occurrence` nulo e fora das abertas.
  - [ ] OpenAPI com `TaskRecurrenceRule` e `next_occurrence`; fmt, clippy e testes sem falha.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 2 com acréscimo |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-14/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
