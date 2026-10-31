---
id: TASK-10
spec: SPEC-001
title: "Contexto reminders"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-40, RF-41, RF-42, CT-25]
type: historia
labels: [SPEC-001, julgamento]
status: done
content_hash: 67227ceff550d1dab4fcf3d7cbacf42b4043aa93a1111f05730930278ac41e9f
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: 89bff0b082e5aaf43e95036da44086497028b8f59154d42dd8ab0ea1a838437a
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
---

# TASK-10: Contexto reminders

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-40, RF-41, RF-42, RN-08, RN-19, CB-02, CB-03, CB-04, CB-14, CT-25, contrato "Regra de recorrência", variável `ATRIA_WEB_PUSH_VAPID_KEY_FILE`, recurso `/reminders`, premissa do Web Push opcional, risco "Web Push indisponível na rede interna", decisões 3, 11, 18, 55, 56)
- `vostok/work/tasks/SPEC-001/TASK-15.md` (contrato do gancho `EntityDeletedHook` chamado ao excluir, CB-06)
- `apps/server/Cargo.toml`
- `apps/server/src/main.rs`
- `apps/server/src/shared` (erros `problem+json`, UUID v7, relógio injetável, regra de recorrência, visibilidade)
- `apps/server/src/http` (`AppState`, configuração `ATRIA_`, extrator da sessão, CSRF e auxiliares de teste)
- `vostok/rules/project/architecture.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/security.md`

### Mudar

- `apps/server/src/reminders/mod.rs` (criar): declara as camadas e expõe `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator`, `pub struct RemindersApi` (`utoipa::OpenApi`), a porta `WebPushPolicy` e `pub async fn run_dispatcher(...)`, o laço de disparo que a TASK-18 inicia.
- `apps/server/src/reminders/domain/mod.rs` (criar): módulo do domínio, sem axum nem sqlx.
- `apps/server/src/reminders/domain/reminder.rs` (criar): lembrete pontual ou recorrente, sem conclusão (RN-19).
- `apps/server/src/reminders/domain/firing.rs` (criar): instantes de disparo em UTC a partir da data e hora locais no fuso da regra, com horário de verão (CB-04).
- `apps/server/src/reminders/domain/push_subscription.rs` (criar): inscrição Web Push (endpoint, `p256dh`, `auth`) validada.
- `apps/server/src/reminders/domain/error.rs` (criar): `RemindersError` com `thiserror` e códigos estáveis em inglês.
- `apps/server/src/reminders/application/mod.rs` (criar): serviços de aplicação.
- `apps/server/src/reminders/application/ports.rs` (criar): traits do repositório, da fila de disparo, do `PushSender` e da `WebPushPolicy`, e o alias `EntityDeletedHook` copiado da TASK-15.
- `apps/server/src/reminders/application/reminders.rs` (criar): casos de uso de lembretes e listagem dos próximos disparos.
- `apps/server/src/reminders/application/dispatcher.rs` (criar): `dispatch_due(now)`, que dispara cada ocorrência uma vez e envia o Web Push quando ligado.
- `apps/server/src/reminders/application/subscriptions.rs` (criar): inscrição e remoção no Web Push.
- `apps/server/src/reminders/infrastructure/mod.rs` (criar): implementações das portas.
- `apps/server/src/reminders/infrastructure/pg_reminders.rs` (criar): repositório de lembretes, entregas e inscrições.
- `apps/server/src/reminders/infrastructure/pg_schedule.rs` (criar): fila `reminder_schedule` com o próximo disparo de cada lembrete.
- `apps/server/src/reminders/infrastructure/web_push_sender.rs` (criar): envio Web Push com VAPID lido de `ATRIA_WEB_PUSH_VAPID_KEY_FILE`.
- `apps/server/src/reminders/interface/mod.rs` (criar): montagem das rotas.
- `apps/server/src/reminders/interface/dto.rs` (criar): corpos em `snake_case` com `utoipa::ToSchema`.
- `apps/server/src/reminders/interface/handlers.rs` (criar): handlers, validação na borda e conversão de `RemindersError` em `problem+json`.
- `apps/server/src/reminders/interface/openapi.rs` (criar): `RemindersApi` com todas as rotas e esquemas.
- `apps/server/src/reminders/migrations/20261101100001_create-reminders.sql` (criar): tabelas `reminders`, `reminder_schedule` e `reminder_deliveries`, índices e RLS.
- `apps/server/src/reminders/migrations/20261101100002_create-push-subscriptions.sql` (criar): tabela `push_subscriptions` e RLS.
- `apps/server/src/reminders/tests/mod.rs` (criar): auxiliar dos testes de integração (PostgreSQL em container, migrator, app de teste com relógio fixo, `PushSender` em memória e `WebPushPolicy` configurável).
- `apps/server/src/reminders/tests/reminders.rs` (criar): testes de integração do cadastro e dos próximos disparos (RF-40, RF-41).
- `apps/server/src/reminders/tests/dispatcher.rs` (criar): testes de integração do disparo e do Web Push (CT-25, CB-04).
- `apps/server/src/reminders/tests/deletion_hook.rs` (criar): testes do gancho de exclusão (CB-06).
- `apps/server/src/reminders/tests/authorization.rs` (criar): 404 para dado de outro usuário e RLS ativa.

### Passos

1. Confira as pré-condições da TASK-04: `apps/server/src/main.rs` declara o módulo `reminders` (o registro do `router()` e do `migrator()`, a camada `Extension<Arc<dyn WebPushPolicy>>` ligada às configurações da instância do contexto `auth` e o início do `run_dispatcher` ficam com a TASK-18); `apps/server/src/shared` tem o erro `problem+json`, o gerador de UUID v7, o relógio injetável, a regra de recorrência do contrato e a visibilidade; `apps/server/src/http` tem o `AppState`, a configuração `ATRIA_` (com `ATRIA_WEB_PUSH_VAPID_KEY_FILE`), o extrator do usuário da sessão, o CSRF e o auxiliar de testes; `apps/server/Cargo.toml` tem `sqlx`, `utoipa`, `thiserror`, `chrono-tz`, `tokio` (com `time`), o crate `web-push` (com cliente HTTP) e, em dev-dependencies, `testcontainers` com o módulo postgres. Se algo faltar, PARE e reporte ao Coordenador: esta tarefa não altera `main.rs`, `http`, `shared` nem `Cargo.toml`.
2. Crie `apps/server/src/reminders/mod.rs` com `pub mod domain; pub mod application; pub mod infrastructure; pub mod interface;` e `#[cfg(test)] mod tests;`, as funções `router()`, `migrator()` (`sqlx::migrate!("src/reminders/migrations")`), `run_dispatcher(state: AppState, policy: Arc<dyn WebPushPolicy>)`, o reexport de `application::ports::WebPushPolicy` (`async fn is_enabled(&self) -> bool`) e de `interface::openapi::RemindersApi`. Crie os `mod.rs` das camadas.
3. Escreva primeiro os testes unitários do domínio e confirme que falham (`cargo test -p atria-server reminders::domain`):
   - `firing.rs`: `one_off_fires_at_local_time_in_its_timezone`, `monthly_on_31_fires_on_last_day_of_short_months` (CB-02), `yearly_on_feb_29_fires_on_feb_28_in_common_year` (CB-03), `nonexistent_local_time_in_spring_forward_fires_once_shifted_by_gap` (CB-04: 02:30 em `America/New_York` em 14/03/2027 dispara uma vez às 03:30 locais), `ambiguous_local_time_in_fall_back_fires_once_at_first_instant` (CB-04: 01:30 em `America/New_York` em 01/11/2026 dispara uma vez, no primeiro instante), `next_fire_after_returns_following_occurrence`, `ends_on_stops_firing`.
   - `reminder.rs`: `reminder_has_no_completion` (RN-19), `one_off_requires_remind_at_and_recurring_requires_rule`, `title_is_required_and_limited_to_200_chars`.
   - `push_subscription.rs`: `subscription_requires_https_endpoint_and_keys`.
   Os testes usam relógio fixo, nunca a data atual (testing-07).
4. Implemente o domínio sobre a regra de recorrência de `shared`: o lembrete pontual guarda `remind_at` (UTC) e `timezone`; o recorrente guarda a regra com `time` e `timezone` obrigatórios. Cada ocorrência é a data local da regra mais `time`, convertida para UTC no fuso da regra: horário inexistente avança pelo tamanho do salto; horário ambíguo usa o primeiro instante. Mudar a regra só recalcula o próximo disparo a partir de agora (RN-08); o lembrete não tem conclusão (RN-19).
5. Escreva as migrações nos nomes da lista "Mudar":
   - `reminders`: `id`, `owner_id`, `visibility CHECK IN ('personal','shared') DEFAULT 'personal'`, `title`, `notes TEXT NULL`, `timezone TEXT NOT NULL`, `remind_at TIMESTAMPTZ NULL`, `rule JSONB NULL`, `CHECK ((remind_at IS NULL) <> (rule IS NULL))`, `created_at`, `updated_at`, `deleted_at`.
   - `reminder_schedule`: `reminder_id UUID PRIMARY KEY REFERENCES reminders ON DELETE CASCADE`, `owner_id UUID NOT NULL`, `next_fire_at TIMESTAMPTZ NOT NULL`, índice em `next_fire_at`. Esta tabela não tem conteúdo pessoal (só ids e instante) e fica sem RLS, para o disparo achar os lembretes vencidos de todos os usuários sem contornar a RLS das outras tabelas.
   - `reminder_deliveries`: `id`, `owner_id`, `reminder_id REFERENCES reminders ON DELETE CASCADE`, `fire_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`, `push_status CHECK IN ('sent','skipped','failed')`, `UNIQUE (reminder_id, fire_at)`.
   - `push_subscriptions`: `id`, `owner_id`, `endpoint TEXT`, `p256dh TEXT`, `auth TEXT`, `created_at`, `UNIQUE (owner_id, endpoint)`.
   - Índices em toda FK e em `reminders(owner_id)`. `ENABLE` e `FORCE ROW LEVEL SECURITY` em `reminders`, `reminder_deliveries` e `push_subscriptions`, com a política `USING (owner_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid)`.
6. Escreva os testes de integração antes dos serviços e handlers, com PostgreSQL em container, o `migrator()` do contexto, o auxiliar de testes de `apps/server/src/http`, relógio fixo, um `PushSender` em memória que guarda as mensagens e uma `WebPushPolicy` configurável na camada `Extension`. Confirme que falham:
   - `tests/reminders.rs`: `creates_one_off_and_recurring_reminders` (RF-40), `upcoming_fires_list_next_occurrences_for_open_tab` (RF-41: `GET /reminders/upcoming?from=&to=` traz `reminder_id`, `title` e `fire_at` em UTC), `rule_change_recomputes_next_fire_only`, `reminder_list_filters_paginates_and_searches`, `visibility_is_saved` (RF-21).
   - `tests/dispatcher.rs`: `recurring_reminder_due_in_one_minute_is_pushed_once` (CT-25: lembrete recorrente para daqui a 1 minuto, relógio avançado, `dispatch_due` chamado duas vezes e uma única mensagem no `PushSender`), `push_is_not_sent_when_admin_disabled` (RF-42: com a política desligada, a entrega fica `skipped` e nada é enviado), `push_is_not_sent_without_subscription` (CB-14), `dst_gap_reminder_is_dispatched_once` (CB-04), `gone_subscription_is_removed` (o `PushSender` responde 410 e a inscrição é apagada), `missed_occurrences_older_than_15_minutes_are_skipped`.
   - `tests/deletion_hook.rs`: `deleting_reminder_calls_entity_deleted_hook` (camada `Extension<EntityDeletedHook>` que grava as chamadas e espera `(owner_id, "reminder", id)`, só depois do commit), `delete_without_hook_still_succeeds` (CB-06).
   - `tests/authorization.rs`: `other_user_reminder_and_subscription_return_404`, `row_level_security_hides_other_owner_rows`, `mutation_without_csrf_is_refused`.
7. Implemente as portas, os serviços e os repositórios:
   - Cada transação de usuário executa `SELECT set_config('app.current_user_id', $1, true)` e toda query filtra também por `owner_id` e `deleted_at IS NULL` (security-04); registro inexistente ou de outro dono vira `RemindersError::NotFound`.
   - Criar, mudar ou excluir um lembrete atualiza `reminder_schedule` na mesma transação (exclusão remove a linha).
   - `dispatch_due(now)`: lê `reminder_schedule` com `next_fire_at <= now` e `FOR UPDATE SKIP LOCKED`; para cada linha, abre a transação do dono, insere a entrega com `ON CONFLICT (reminder_id, fire_at) DO NOTHING` (disparo único) e, só se inseriu, ocorrência com até 15 minutos de atraso, política ligada e chave VAPID configurada, envia o Web Push a cada inscrição do dono; depois grava o próximo disparo ou remove a linha do pontual. Uma inscrição que responde 404 ou 410 é apagada. Os logs levam só ids (security-13).
   - `run_dispatcher` chama `dispatch_due` a cada 30 segundos com o relógio do `AppState`, sem nunca encerrar por erro de uma iteração.
   - A política ausente na camada `Extension` vale como desligada; sem `ATRIA_WEB_PUSH_VAPID_KEY_FILE`, o Web Push fica desligado e o lembrete continua aparecendo no app (risco "Web Push indisponível").
   - O conteúdo da mensagem é `{"reminder_id": "...", "title": "...", "fire_at": "..."}`, cifrado pelo protocolo do Web Push, com TTL de 15 minutos.
8. Implemente `interface` sob `/api/v1`: `GET|POST /reminders` (filtros `kind=one_off|recurring`, busca `q` no título, paginação por cursor `cursor` e `limit`, cursor opaco com `created_at` e `id` em base64url), `GET|PATCH|DELETE /reminders/{id}`, `GET /reminders/upcoming?from=&to=` (intervalo de até 31 dias), `GET /web-push/public-key` (devolve a chave pública VAPID, ou 404 `web_push_disabled` quando o Web Push está desligado), `POST /push-subscriptions` e `DELETE /push-subscriptions/{id}`. Converta `RemindersError` em `problem+json` (códigos `not_found`, `web_push_disabled`, `validation_failed`).
9. Remoção das ligações ao excluir (CB-06): em `application/ports.rs`, declare o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15 para ser o mesmo tipo na `Extension`, e um comentário dizendo por que a grafia tem de ser idêntica. Os handlers de exclusão extraem `Option<Extension<EntityDeletedHook>>` e, só depois do commit da transação, chamam o gancho (com `.await`) para cada entidade excluída; sem o gancho, a exclusão segue igual. Tipos usados: `reminder`. `DELETE /reminders/{id}` chama o gancho com `(owner_id, "reminder", id)`. Este contexto não chama o `links` direto nem instala o gancho real: a TASK-18 instala `Extension(links::entity_deleted_hook(pool))`.
10. Escreva `interface/openapi.rs` com `RemindersApi` e o teste `documents_all_reminders_routes`.
11. Rode `cargo fmt`, `cargo clippy -p atria-server -- -D warnings` e `cargo test -p atria-server reminders::` até passarem sem aviso, sem `unwrap`, `expect` ou `panic!` fora dos testes.

### Baseline

- `test -e apps/server/src/reminders && echo reminders-existe || echo reminders-ausente`
- `test -e apps/server/src/shared && echo shared-existe || echo shared-ausente`

### Verificação

```bash
# Formatação e lint sem aviso (code-style-02)
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# Testes unitários e de integração do contexto: esperado "test result: ok" e 0 failed
cargo test -p atria-server reminders::
```

### Evidências

- `cargo-test-reminders.txt` (automática): `cargo test -p atria-server reminders::`
  - Prova: lembretes pontuais e recorrentes são cadastrados, os próximos disparos saem para a aba aberta, cada ocorrência dispara uma vez, inclusive no horário de verão, e o Web Push só é enviado quando ligado (RF-40, RF-41, RF-42, CT-25).
  - Trecho: as linhas `test reminders::tests::dispatcher::recurring_reminder_due_in_one_minute_is_pushed_once ... ok`, `test reminders::tests::dispatcher::push_is_not_sent_when_admin_disabled ... ok`, `test reminders::domain::firing::tests::nonexistent_local_time_in_spring_forward_fires_once_shifted_by_gap ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests`.

### Concluída quando

- [x] Lembretes pontuais e recorrentes são cadastrados com data, hora e fuso, editados e excluídos, sem conclusão (RF-40, CT-25).

  > Como comprovar: rodar `cargo test -p atria-server reminders::` e ver `ok` em `creates_one_off_and_recurring_reminders` e `reminder_has_no_completion` (evidência `cargo-test-reminders.txt`).

- [x] O servidor entrega os próximos disparos para a aba aberta notificar, com fim de mês, 29/02 e horário de verão corretos e um único disparo por ocorrência (RF-41, CT-25).

  > Como comprovar: ver `ok` em `upcoming_fires_list_next_occurrences_for_open_tab`, `monthly_on_31_fires_on_last_day_of_short_months`, `yearly_on_feb_29_fires_on_feb_28_in_common_year`, `nonexistent_local_time_in_spring_forward_fires_once_shifted_by_gap`, `ambiguous_local_time_in_fall_back_fires_once_at_first_instant` e `dst_gap_reminder_is_dispatched_once`.

- [x] O Web Push é enviado uma vez por ocorrência só com o recurso ligado pelo admin, a chave VAPID configurada e a inscrição da pessoa, e nada quebra sem ele (RF-42, CT-25).

  > Como comprovar: ver `ok` em `recurring_reminder_due_in_one_minute_is_pushed_once`, `push_is_not_sent_when_admin_disabled`, `push_is_not_sent_without_subscription` e `gone_subscription_is_removed`.

- [x] Lembrete e inscrição de outro usuário respondem 404, a RLS está forçada nas tabelas com conteúdo e mutações sem CSRF são recusadas (RNF-01, RNF-02).

  > Como comprovar: ver `ok` em `other_user_reminder_and_subscription_return_404`, `row_level_security_hides_other_owner_rows` e `mutation_without_csrf_is_refused`.

- [x] Excluir um lembrete chama o gancho de exclusão depois do commit, com `reminder`, para as ligações sumirem dos dois lados; sem o gancho a exclusão funciona igual (CB-06).

  > Como comprovar: ver `ok` em `deleting_reminder_calls_entity_deleted_hook` e `delete_without_hook_still_succeeds` (evidência `cargo-test-reminders.txt`).

- [x] O contexto expõe `router()`, `migrator()`, `RemindersApi`, `WebPushPolicy` e `run_dispatcher`, e passa no `cargo fmt --check` e no `cargo clippy` sem aviso.

  > Como comprovar: ver `ok` em `documents_all_reminders_routes` e a verificação terminar sem erro.

## Descrição

### Resumo executivo

Entrega Lembretes no servidor: lembretes pontuais e recorrentes, a agenda dos próximos avisos para o app aberto e o envio opcional por Web Push, ligado pelo admin.
O benefício é ser avisado na hora certa, mesmo em fuso e horário de verão, sem depender de serviço externo quando o Web Push está desligado.
Perfil julgamento: o disparo único, o horário de verão e o Web Push opcional exigem escolhas de desenho com risco alto.
Depende do núcleo do servidor e libera a busca e, depois da integração do servidor, as telas de Lembretes e o Dashboard.

### Detalhes técnicos

**Abordagem.** Contexto `reminders` em `apps/server/src/reminders`, nas quatro camadas de [project/architecture-02]. O domínio converte a regra de `shared` em instantes UTC no fuso de origem ([project/code-style-06]); a aplicação mantém a fila de disparo e envia o Web Push por uma porta; a interface expõe o cadastro, os próximos disparos e a inscrição. A notificação com a aba aberta é do frontend (TASK-25), que lê `GET /reminders/upcoming`; aqui ficam a agenda, o disparo e o envio Web Push. A TASK-18 registra `router()` e `migrator()`, liga a `WebPushPolicy` às configurações da instância do `auth` e inicia o `run_dispatcher`.

**Alternativas e critérios de escolha.**
- Disparo: escolhida uma fila `reminder_schedule` com o próximo instante de cada lembrete, lida a cada 30 segundos por um laço `tokio` no próprio processo. Descartadas: calcular os vencidos varrendo todos os lembretes a cada ciclo, que exigiria ler conteúdo de todos os usuários contornando a RLS; papel de banco com `BYPASSRLS` ou função `SECURITY DEFINER`, que complicam a autohospedagem e abrem uma porta larga na RLS; fila externa, vetada por [project/architecture-13] e [project/architecture-12]. Critérios: isolamento (a fila só tem ids e instante), um único processo ([project/self-hosting-02]) e disparo único.
- Disparo único (CB-04) garantido no banco por `UNIQUE (reminder_id, fire_at)` nas entregas, além do cálculo certo do instante. Descartado: só a marcação em memória, que repetiria o aviso depois de reiniciar.
- Horário de verão: hora inexistente avança pelo tamanho do salto; hora ambígua usa o primeiro instante. Descartado: pular a ocorrência, que deixaria de avisar.
- Avisos atrasados mais de 15 minutos (servidor parado) são marcados `skipped`, para não despejar avisos velhos de uma vez.
- Web Push opcional ([project/architecture-12], decisão 11): só com a chave VAPID em arquivo, a política do admin ligada e a inscrição da pessoa. A política vem do `auth` por uma porta (`WebPushPolicy`) injetada pela TASK-18, porque um contexto não lê as tabelas do outro ([project/architecture-04]); sem ela, o Web Push vale como desligado. Descartado: copiar a configuração da instância para este contexto, que poderia divergir.
- Lembretes recorrentes guardam só a regra vigente, sem segmentos, porque não têm conclusão (RN-19) e o passado não muda nada; a mudança só recalcula o próximo disparo (RN-08).
- Recursos além do contrato, exigidos pelos RF: `GET|PATCH|DELETE /reminders/{id}`, `GET /reminders/upcoming` (RF-41), `GET /web-push/public-key` e `POST|DELETE /push-subscriptions` (RF-42).
- Remoção das ligações ao excluir (CB-06) pelo gancho `EntityDeletedHook` da TASK-15, opcional via `Option<Extension<EntityDeletedHook>>` e chamado depois do commit, com os tipos `reminder`. Descartados: chamar o contexto `links` direto, que acopla e cria dependência entre tarefas da mesma onda ([project/architecture-04]); `NOTIFY` do PostgreSQL, que perde o evento sem ouvinte. Critério: sem acoplamento e testável com um gancho falso; a TASK-18 instala o gancho real. O alias precisa ter a mesma grafia da TASK-15 para a `Extension` casar.

**Riscos técnicos.** Lembrete em fuso e horário de verão (risco alto da spec), coberto pelos testes de CB-02, CB-03 e CB-04 ([project/testing-08]); dependência do crate `web-push` e do laço iniciado pela TASK-18, ambos fora do caminho desta tarefa, conferidos no passo 1; serviço de push indisponível na rede interna (risco baixo), coberto pela entrega no app como padrão.

**Referências da spec.** RF-40, RF-41, RF-42, RN-08, RN-19, CB-02, CB-03, CB-04, CB-14, CT-25, CB-06, RF-21 (visibilidade), RNF-01, RNF-02, RNF-07, decisões 3, 11, 18, 55 e 56.

**Arquivos em comum na onda.** Nenhum: a tarefa só cria arquivos em `apps/server/src/reminders`.

### Card

- **Título:** Contexto reminders
- **Tipo:** historia
- **Descrição:** Implementa no servidor o contexto de Lembretes: cadastro pontual e recorrente, agenda dos próximos avisos para o app aberto e envio opcional por Web Push, com disparo único mesmo no horário de verão.
- **Critérios de aceite:**
  - [ ] Lembretes pontuais e recorrentes com data, hora e fuso.
  - [ ] Próximos avisos certos em fim de mês, 29/02 e horário de verão.
  - [ ] Cada ocorrência dispara uma única vez.
  - [ ] Web Push enviado só quando ligado pelo admin e permitido pela pessoa.
  - [ ] Dado de outro usuário responde 404.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta reminders criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 1 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | passed | 1 evidência(s) em evidence/TASK-10/ |
| 9 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
