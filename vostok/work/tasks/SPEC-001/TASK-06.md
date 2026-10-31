---
id: TASK-06
spec: SPEC-001
title: "Contexto auth"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RF-58, RF-59, RF-60, CT-03, CT-04, CT-05, CT-06, CT-07, CT-08, CT-09, CT-10, CT-31, CT-32]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 21cec3ce938373cda8eda0f44d04c76c62b12739a4408e09dec258125e083258
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: 30e7626d5833d8a115ea58a7e6967bdf7c49d3565bd10d81e03247b2e3167f8e
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
---

# TASK-06: Contexto auth

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-03 a RF-13, RF-58 a RF-60, RN-11 a RN-13, RN-18, CB-11, FA-01 a FA-03, FA-06, CT-03 a CT-10, CT-31, CT-32, variáveis `ATRIA_SMTP_*` e `ATRIA_WEB_PUSH_VAPID_KEY_FILE`, recursos `/setup`, `/auth/*` e `/admin/*`, decisões 9, 10, 23, 24, 25, 58)
- `apps/server/Cargo.toml`
- `apps/server/src/main.rs`
- `apps/server/src/shared` (erros `problem+json`, UUID v7, relógio injetável, criptografia)
- `apps/server/src/http` (`AppState`, sessão, CSRF, configuração `ATRIA_` e auxiliares de teste)
- `apps/server/src/storage` (espaço usado pelos arquivos)
- `vostok/rules/project/security.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/architecture.md`

### Mudar

- `apps/server/src/auth/mod.rs` (criar): declara as camadas e expõe `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator`, `pub struct AuthApi` (`utoipa::OpenApi`) e `pub fn require_complete_account()`, a camada que barra o admin sem 2FA.
- `apps/server/src/auth/domain/mod.rs` (criar): módulo do domínio, sem axum nem sqlx.
- `apps/server/src/auth/domain/user.rs` (criar): usuário, papel (`admin`, `elevated`, `user`), ativação e regras de quem gere quem (RN-12, RN-13).
- `apps/server/src/auth/domain/invite.rs` (criar): convite de uso único com expiração (RN-11).
- `apps/server/src/auth/domain/password_reset.rs` (criar): token de redefinição de uso único, com prazos por origem.
- `apps/server/src/auth/domain/totp.rs` (criar): segredo, URI `otpauth` e verificação do código com janela de um passo.
- `apps/server/src/auth/domain/preferences.rs` (criar): preferências do usuário com validação de tema, idioma, fuso, moeda, atalho e contextos.
- `apps/server/src/auth/domain/instance_settings.rs` (criar): configurações da instância (convite obrigatório, Web Push, SMTP sem senha).
- `apps/server/src/auth/domain/throttle.rs` (criar): bloqueio progressivo por tentativas.
- `apps/server/src/auth/domain/error.rs` (criar): `AuthError` com `thiserror` e códigos estáveis em inglês.
- `apps/server/src/auth/application/mod.rs` (criar): serviços de aplicação.
- `apps/server/src/auth/application/ports.rs` (criar): traits dos repositórios, do hash de senha e do `MailSender`.
- `apps/server/src/auth/application/setup.rs` (criar): assistente de primeira execução.
- `apps/server/src/auth/application/sign_up.rs` (criar): cadastro com ou sem convite.
- `apps/server/src/auth/application/sign_in.rs` (criar): login com senha, TOTP e bloqueio progressivo.
- `apps/server/src/auth/application/totp_enrollment.rs` (criar): início e confirmação do 2FA.
- `apps/server/src/auth/application/password_resets.rs` (criar): pedido por e-mail, link gerado pelo admin e redefinição.
- `apps/server/src/auth/application/admin.rs` (criar): usuários, convites, papéis, estado e configurações da instância.
- `apps/server/src/auth/application/preferences.rs` (criar): leitura e atualização das preferências.
- `apps/server/src/auth/infrastructure/mod.rs` (criar): implementações das portas.
- `apps/server/src/auth/infrastructure/pg_users.rs` (criar): repositório de usuários.
- `apps/server/src/auth/infrastructure/pg_tokens.rs` (criar): repositório de convites e tokens de redefinição, só com hash.
- `apps/server/src/auth/infrastructure/pg_settings.rs` (criar): repositório das preferências e das configurações da instância.
- `apps/server/src/auth/infrastructure/pg_throttle.rs` (criar): repositório das tentativas.
- `apps/server/src/auth/infrastructure/argon2_hasher.rs` (criar): hash Argon2id das senhas.
- `apps/server/src/auth/infrastructure/smtp_mail_sender.rs` (criar): envio do e-mail de redefinição por SMTP com `lettre`.
- `apps/server/src/auth/interface/mod.rs` (criar): montagem das rotas e da camada `require_complete_account`.
- `apps/server/src/auth/interface/dto.rs` (criar): corpos em `snake_case` com `utoipa::ToSchema`.
- `apps/server/src/auth/interface/handlers.rs` (criar): handlers, validação na borda e conversão de `AuthError` em `problem+json`.
- `apps/server/src/auth/interface/openapi.rs` (criar): `AuthApi` com todas as rotas e esquemas.
- `apps/server/src/auth/migrations/20261101060001_create-auth-users.sql` (criar): tabela `users`.
- `apps/server/src/auth/migrations/20261101060002_create-auth-tokens.sql` (criar): tabelas `invites` e `password_reset_tokens`.
- `apps/server/src/auth/migrations/20261101060003_create-auth-settings.sql` (criar): tabelas `user_preferences` (com RLS) e `instance_settings`.
- `apps/server/src/auth/migrations/20261101060004_create-auth-attempts.sql` (criar): tabela `auth_attempts`.
- `apps/server/src/auth/tests/mod.rs` (criar): auxiliar dos testes de integração (PostgreSQL em container, migrator, app de teste, relógio fixo e `MailSender` em memória).
- `apps/server/src/auth/tests/setup.rs` (criar): testes do assistente (CT-03, CT-07).
- `apps/server/src/auth/tests/sign_up.rs` (criar): testes de cadastro e convites (CT-04, CT-05).
- `apps/server/src/auth/tests/sign_in.rs` (criar): testes de login, 2FA e bloqueio (CT-06).
- `apps/server/src/auth/tests/password_resets.rs` (criar): testes de redefinição (CT-08, CT-09).
- `apps/server/src/auth/tests/roles.rs` (criar): testes de papéis e instância (CT-10, CT-32).
- `apps/server/src/auth/tests/preferences.rs` (criar): testes das preferências (CT-31).

### Passos

1. Confira as pré-condições da TASK-04: `apps/server/src/main.rs` declara o módulo `auth` (o registro do `router()`, do `migrator()` e da camada `require_complete_account()` fica com a TASK-18); `apps/server/src/http` tem o `AppState`, a API de sessão (criar e encerrar a sessão de um usuário e ler o usuário da sessão), o CSRF, a configuração `ATRIA_` e o auxiliar de testes que monta um app com sessão; `apps/server/src/shared` tem o erro `problem+json`, o gerador de UUID v7, o relógio injetável e a criptografia; `apps/server/Cargo.toml` tem `argon2`, `totp-rs`, `lettre`, `chrono-tz`, `sqlx`, `utoipa`, `thiserror` e, em dev-dependencies, `testcontainers` com o módulo postgres. Se algo faltar, PARE e reporte ao Coordenador: esta tarefa não altera `main.rs`, `http`, `shared` nem `Cargo.toml`.
2. Crie `apps/server/src/auth/mod.rs` com `pub mod domain; pub mod application; pub mod infrastructure; pub mod interface;` e `#[cfg(test)] mod tests;`, as funções `router()`, `migrator()` (`sqlx::migrate!("src/auth/migrations")`), `require_complete_account()` e o reexport de `interface::openapi::AuthApi`. Crie os `mod.rs` das camadas para o crate compilar.
3. Escreva primeiro os testes unitários do domínio, num `#[cfg(test)] mod tests` em cada arquivo, e confirme que falham (`cargo test -p atria-server auth::domain`):
   - `invite.rs`: `invite_is_valid_once`, `expired_invite_is_invalid` (RN-11).
   - `password_reset.rs`: `reset_token_is_single_use`, `email_token_expires_in_30_minutes`, `admin_token_expires_in_24_hours`.
   - `totp.rs`: `accepts_code_of_current_step`, `accepts_code_of_adjacent_step`, `refuses_code_two_steps_away`.
   - `user.rs`: `elevated_cannot_change_roles` (RN-12), `elevated_can_deactivate_only_user_role`, `admin_grants_and_revokes_elevated`, `admin_without_totp_is_incomplete` (RF-07).
   - `throttle.rs`: `lock_grows_progressively_after_five_failures`, `success_resets_failures`.
   - `preferences.rs`: `defaults_are_light_pt_br_sao_paulo_brl_mod_k`, `refuses_unknown_timezone`, `refuses_unknown_search_context`.
   Os testes usam relógio fixo, nunca a data atual (testing-07).
4. Implemente o domínio até os testes passarem, com estas decisões: convite expira em 7 dias; token de redefinição por e-mail expira em 30 minutos e o gerado pelo admin, em 24 horas; tokens são 32 bytes aleatórios em base64url, guardados só como SHA-256 (security-05, security-06); TOTP de 30 s, 6 dígitos, SHA-1, janela de um passo; o bloqueio começa depois de 5 falhas seguidas, com 1 minuto, dobrando a cada nova falha até 1 hora, por e-mail normalizado e por IP; preferências padrão `theme = "system"`, `locale = "pt-BR"`, `timezone = "America/Sao_Paulo"`, `currency = "BRL"` (RN-18), `palette_shortcut = "mod+k"` e `search_contexts` com todos os contextos; os contextos aceitos são `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`. O `elevated` só ativa e desativa contas `user`, gera convites e lê o estado da instância; nunca muda papéis nem configurações (RN-12). Nenhuma regra devolve conteúdo de outro contexto (RN-13).
5. Escreva as migrações nos nomes da lista "Mudar":
   - `users`: `id UUID PRIMARY KEY`, `email TEXT NOT NULL`, índice único em `lower(email)`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL CHECK (role IN ('admin','elevated','user'))`, `is_active BOOLEAN NOT NULL DEFAULT true`, `totp_secret_encrypted BYTEA NULL`, `totp_pending_secret_encrypted BYTEA NULL`, `totp_enabled_at TIMESTAMPTZ NULL`, `created_at`, `updated_at`; índice único parcial `((true)) WHERE role = 'admin'` para um único admin.
   - `invites`: `id`, `token_hash BYTEA UNIQUE`, `created_by UUID REFERENCES users`, `expires_at`, `used_at`, `used_by UUID NULL REFERENCES users`, `created_at`. `password_reset_tokens`: `id`, `token_hash BYTEA UNIQUE`, `user_id REFERENCES users`, `origin CHECK IN ('email','admin')`, `expires_at`, `used_at`, `created_at`. Índice em cada FK.
   - `user_preferences`: `user_id UUID PRIMARY KEY REFERENCES users`, `theme CHECK IN ('light','dark','system')`, `locale`, `timezone`, `currency CHAR(3)`, `palette_shortcut`, `search_contexts TEXT[]`, `updated_at`, com `ENABLE` e `FORCE ROW LEVEL SECURITY` e política `user_id = current_setting('app.current_user_id', true)::uuid`. `instance_settings`: uma linha só (`id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id)`), `invite_required BOOLEAN DEFAULT true`, `web_push_enabled BOOLEAN DEFAULT false`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_from` e `updated_at`, com a linha inicial inserida na migração. A senha do SMTP nunca vai para o banco: vem só de `ATRIA_SMTP_PASSWORD_FILE` (security-12).
   - `auth_attempts`: `key TEXT PRIMARY KEY` (`email:<hash>` ou `ip:<endereço>`), `failures INT`, `locked_until TIMESTAMPTZ NULL`, `updated_at`.
   As tabelas de conta e de instância não têm `owner_id` nem `visibility`, porque não são conteúdo do usuário, e não usam RLS: o acesso passa só pelos serviços deste contexto, com o papel conferido.
6. Escreva os testes de integração em `apps/server/src/auth/tests/` antes dos serviços e handlers, com PostgreSQL em container, o `migrator()` do contexto, o auxiliar de testes de `apps/server/src/http`, relógio fixo e um `MailSender` em memória que guarda os e-mails enviados. Confirme que falham:
   - `setup.rs`: `setup_creates_admin_once_and_then_disappears` (CT-03, FA-01: depois `GET /setup` responde `{"required": false}` e `POST /setup` responde 409 `setup_already_done`), `admin_without_totp_is_blocked_until_activation` (CT-07: rotas protegidas por `require_complete_account` respondem 403 `totp_required` até o 2FA ser confirmado).
   - `sign_up.rs`: `sign_up_with_invite_works_once` (CT-04), `expired_invite_is_refused` (FA-03, código `invite_invalid`), `sign_up_without_invite_works_when_not_required` (CT-05, FA-02), `sign_up_without_invite_is_refused_when_required`, `elevated_generates_invite` (RF-11).
   - `sign_in.rs`: `sign_in_with_totp_requires_code` (CT-06: sem código responde 401 `totp_required`, com código entra), `password_is_stored_as_argon2id` (o hash começa com `$argon2id$`), `repeated_failures_lock_sign_in`, `sign_out_ends_session`, `session_cookie_is_http_only_secure_same_site` (RNF-01).
   - `password_resets.rs`: `email_reset_reaches_only_existing_user_with_same_response` (CT-08, CB-11: mesmo status e corpo para os dois e-mails, um e-mail no `MailSender`), `reset_without_smtp_sends_nothing`, `admin_reset_link_works_once` (CT-09), `elevated_cannot_generate_reset_link`.
   - `roles.rs`: `elevated_manages_users_but_not_instance` (CT-10: o admin concede `elevated`; o elevated gera convite, lista usuários sem conteúdo de outros contextos, desativa um `user`, lê `GET /admin/instance` e recebe 403 em `PATCH /admin/instance/settings` e em `PATCH /admin/users/{id}` com `role`), `user_role_gets_403_on_admin_routes`, `instance_settings_apply_to_everyone` (CT-32: o admin liga o Web Push, configura o SMTP e desliga o convite, e um cadastro sem convite passa a funcionar), `deactivated_user_cannot_sign_in`.
   - `preferences.rs`: `preferences_are_saved_and_read_back` (CT-31: tema, idioma, fuso, moeda, atalho e contextos padrão da busca), `preferences_of_other_user_are_not_readable` (RLS com `app.current_user_id` de outro usuário retorna zero linhas), `mutation_without_csrf_is_refused`.
7. Implemente as portas, os serviços e os repositórios até os testes passarem: o `POST /setup` roda numa transação com `pg_advisory_xact_lock` e só cria o admin se `users` estiver vazia; o consumo do convite e do token de redefinição é um `UPDATE ... WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING`, na mesma transação da criação do usuário ou da troca da senha; trocar a senha encerra as outras sessões do usuário pela API de sessão de `http`; o pedido de redefinição sempre responde 202 com o mesmo corpo e só envia o e-mail quando o usuário existe e `ATRIA_SMTP_HOST` e `smtp_host` estão configurados; o segredo TOTP é cifrado com a criptografia de `shared`; o estado da instância traz `version` (`env!("CARGO_PKG_VERSION")`), `database_bytes` (`pg_database_size(current_database())`), `storage_bytes` (pelo módulo `storage`) e `healthy` (ping do banco). Nenhum log leva e-mail, senha ou token (security-13).
8. Implemente `interface`, sob `/api/v1`, com os recursos do contrato e os que os RF exigem: `GET|POST /setup`, `POST /auth/sign-up`, `POST /auth/sign-in`, `POST /auth/sign-out`, `POST /auth/password-resets`, `PUT /auth/password-resets/{token}`, `POST /auth/totp` (gera o segredo pendente e devolve `otpauth_uri`), `POST /auth/totp/activation` (confirma com `code`), `GET /me`, `GET|PATCH /me/preferences`, `GET /admin/users` (paginação por cursor `cursor` e `limit`, filtro `role` e busca `q` por e-mail), `PATCH /admin/users/{id}` (`role`, `is_active`), `POST /admin/invites` (devolve o link com o token só nessa resposta), `POST /admin/password-resets`, `GET /admin/instance`, `GET|PATCH /admin/instance/settings`. A camada `require_complete_account()` responde 403 `totp_required` para o admin sem 2FA em toda rota fora de `/auth/*`, `/setup` e `/me`. Valide tipos e limites na borda (e-mail até 254, senha de 12 a 128 caracteres) e converta `AuthError` em `problem+json` (códigos `invalid_credentials`, `totp_required`, `invalid_totp_code`, `invite_invalid`, `invite_required`, `reset_token_invalid`, `setup_already_done`, `forbidden`, `too_many_attempts`, `validation_failed`).
9. Escreva `interface/openapi.rs` com `AuthApi` e o teste `documents_all_auth_routes`, que confere cada caminho no documento gerado.
10. Rode `cargo fmt`, `cargo clippy -p atria-server -- -D warnings` e `cargo test -p atria-server auth::` até passarem sem aviso, sem `unwrap`, `expect` ou `panic!` fora dos testes.

### Baseline

- `test -e apps/server/src/auth && echo auth-existe || echo auth-ausente`
- `test -e apps/server/src/http && echo http-existe || echo http-ausente`

### Verificação

```bash
# Formatação e lint sem aviso (code-style-02)
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# Testes unitários e de integração do contexto: esperado "test result: ok" e 0 failed
cargo test -p atria-server auth::
```

### Evidências

- `cargo-test-auth.txt` (automática): `cargo test -p atria-server auth::`
  - Prova: assistente, convites, login com 2FA, redefinição de senha, papéis, preferências e configurações da instância passam nos testes (RF-03 a RF-13, RF-58 a RF-60, CT-03 a CT-10, CT-31, CT-32).
  - Trecho: as linhas `test auth::tests::setup::setup_creates_admin_once_and_then_disappears ... ok`, `test auth::tests::sign_in::sign_in_with_totp_requires_code ... ok`, `test auth::tests::roles::elevated_manages_users_but_not_instance ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação ou `running 0 tests`.

### Concluída quando

- [x] Numa instância sem usuários o assistente cria o admin uma única vez, e o admin só usa a instância depois de ativar o 2FA (RF-03, RF-07, CT-03, CT-07).

  > Como comprovar: rodar `cargo test -p atria-server auth::` e ver `ok` em `setup_creates_admin_once_and_then_disappears` e `admin_without_totp_is_blocked_until_activation` (evidência `cargo-test-auth.txt`).

- [x] O cadastro exige um convite de uso único e válido quando o convite é obrigatório, e funciona sem convite quando o admin desliga a exigência (RF-04, RF-05, CT-04, CT-05).

  > Como comprovar: ver `ok` em `sign_up_with_invite_works_once`, `expired_invite_is_refused`, `sign_up_without_invite_works_when_not_required` e `sign_up_without_invite_is_refused_when_required`.

- [x] O login aceita e-mail e senha, exige o TOTP de quem ativou o 2FA, guarda a senha em Argon2id, bloqueia tentativas repetidas e usa cookie `HttpOnly`, `Secure` e `SameSite` (RF-06, RF-07, CT-06, RNF-01).

  > Como comprovar: ver `ok` em `sign_in_with_totp_requires_code`, `password_is_stored_as_argon2id`, `repeated_failures_lock_sign_in` e `session_cookie_is_http_only_secure_same_site`.

- [x] A redefinição por e-mail só envia para quem existe, com a mesma resposta nos dois casos, e o link gerado pelo admin funciona uma única vez (RF-08, RF-09, CT-08, CT-09).

  > Como comprovar: ver `ok` em `email_reset_reaches_only_existing_user_with_same_response`, `admin_reset_link_works_once` e `elevated_cannot_generate_reset_link`.

- [x] O admin concede e retira o `elevated`; o `elevated` gera convites, gere contas `user` e vê o estado da instância, mas não muda papéis nem configurações; o admin não vê conteúdo de outros usuários (RF-10, RF-11, RF-12, RF-13, CT-10).

  > Como comprovar: ver `ok` em `elevated_manages_users_but_not_instance`, `elevated_generates_invite` e `user_role_gets_403_on_admin_routes`.

- [x] As preferências (tema, idioma, fuso, moeda, atalho e contextos padrão da busca) são gravadas e lidas de volta só pelo próprio usuário (RF-58, RF-59, CT-31, RNF-02).

  > Como comprovar: ver `ok` em `preferences_are_saved_and_read_back` e `preferences_of_other_user_are_not_readable`.

- [x] O admin liga o Web Push, configura o SMTP e desliga o convite, e isso passa a valer para todos (RF-60, CT-32).

  > Como comprovar: ver `ok` em `instance_settings_apply_to_everyone`.

- [x] O contexto expõe `router()`, `migrator()`, `AuthApi` e a camada do 2FA obrigatório, e passa no `cargo fmt --check` e no `cargo clippy` sem aviso; mutações sem CSRF são recusadas (RNF-01).

  > Como comprovar: ver `ok` em `documents_all_auth_routes` e `mutation_without_csrf_is_refused`, e a verificação terminar sem erro.

## Descrição

### Resumo executivo

Entrega o controle de acesso do Atria no servidor: o assistente que cria o admin, o cadastro por convite, o login com 2FA, a redefinição de senha, os papéis, as preferências de cada pessoa e as configurações da instância.
O benefício é uma instância segura para dados pessoais, em que só entra quem foi convidado e nem o admin vê o conteúdo dos outros.
Perfil padrão: as decisões de segurança já estão nas regras do projeto e ficam fixadas nos passos.
Depende do núcleo do servidor e libera a integração do servidor e as telas de autenticação, administração e configurações.

### Detalhes técnicos

**Abordagem.** Contexto `auth` em `apps/server/src/auth`, nas quatro camadas de [project/architecture-02]. O domínio guarda as regras de convite, token, TOTP, papéis, bloqueio e preferências; a aplicação orquestra os casos de uso; a infraestrutura implementa repositórios PostgreSQL, Argon2id e envio SMTP; a interface expõe as rotas e o `AuthApi`. A sessão, o cookie e o CSRF são do `http` da TASK-04; este contexto só cria e encerra sessões por essa API. O registro no `main.rs` e a aplicação global da camada `require_complete_account()` ficam com a TASK-18.

**Decisões locais.**
- Preferências do usuário e configurações da instância ficam neste contexto (decisão 58). Descartado: contexto `settings` novo.
- Tokens de convite e de redefinição guardados só como SHA-256 e consumidos por `UPDATE` condicional, o que impede o uso duplo numa corrida ([project/security-05], [project/security-06]). Descartado: marcar o uso depois de ler, sujeito a corrida.
- 2FA em dois passos (`POST /auth/totp` gera o segredo pendente, `POST /auth/totp/activation` confirma com um código), porque ativar sem confirmar deixaria a pessoa trancada. Descartado: ativar direto no `POST /auth/totp`.
- O admin sem 2FA tem sessão, mas a camada `require_complete_account()` só libera `/auth/*`, `/setup` e `/me` (CT-07, [project/security-17]). Descartado: recusar o login do admin sem 2FA, que o impediria de ativar o 2FA.
- Senha do SMTP só por arquivo de ambiente; o restante do SMTP é editável pelo admin (RF-60, [project/security-12]).
- Recursos além do contrato, exigidos pelos RF: `GET /setup` (FA-01), `POST /auth/totp/activation` (RF-07), `GET /me` e `GET|PATCH /me/preferences` (RF-58, RF-59) e `GET /admin/instance/settings` (RF-60).
- Tabelas de conta e de instância sem `owner_id`, `visibility` nem RLS, por não serem conteúdo do usuário; `user_preferences` tem RLS forçada ([project/database-09]).
- `MailSender` como porta, com SMTP real na infraestrutura e implementação em memória nos testes, para o CT-08 rodar sem servidor de e-mail.

**Riscos técnicos.** Vazamento da existência de um e-mail na redefinição (CB-11), coberto pelo teste de resposta igual; corrida no assistente de primeira execução, coberta pelo bloqueio consultivo e pelo índice de admin único. Pré-condições: `argon2`, `totp-rs` e `lettre` no `apps/server/Cargo.toml` e o módulo `auth` declarado no `main.rs`, ambos da TASK-04.

**Referências da spec.** RF-03 a RF-13, RF-58 a RF-60, RN-11, RN-12, RN-13, RN-18, CB-11, FA-01, FA-02, FA-03, FA-06, CT-03 a CT-10, CT-31, CT-32, RNF-01, RNF-02, decisões 9, 10, 23, 24, 25 e 58.

**Arquivos em comum na onda.** Nenhum: a tarefa só cria arquivos em `apps/server/src/auth`.

### Card

- **Título:** Contexto auth
- **Tipo:** historia
- **Descrição:** Implementa no servidor o contexto de autenticação: assistente de primeira execução, cadastro por convite, login com 2FA, redefinição de senha, papéis, preferências do usuário e configurações da instância.
- **Critérios de aceite:**
  - [ ] O assistente cria o admin uma vez e o admin só entra com 2FA ativo.
  - [ ] Cadastro só por convite de uso único quando exigido, e livre quando desligado.
  - [ ] Login com senha em Argon2id e TOTP para quem ativou o 2FA.
  - [ ] Redefinição de senha por e-mail ou por link do admin, de uso único.
  - [ ] Papéis respeitados e preferências e configurações gravadas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: usuário aceitou [1]: pasta auth criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 1 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | passed | 1 evidência(s) em evidence/TASK-06/ |
| 9 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
