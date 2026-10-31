---
id: TASK-19
spec: SPEC-001
title: "Telas de auth"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-03, RF-04, RF-06, RF-07, RF-08, RF-09, CT-03, CT-04, CT-06, CT-08, CT-09]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 1b58880620d64574e3982d5229091f7c123abf2e1139c6c3330d8bbed726c5ad
adjustments: 5
adjusted_at: 2026-10-31T09:46:27Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 2bf021d776b73330b5c3b0036644abf343b93ad5a9c79395f9103bc0797193c2
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T09:46:27Z
model: sonnet
---

# TASK-19: Telas de auth

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-03, RF-04, RF-06 a RF-09, CT-03, CT-04, CT-06 a CT-09, FA-01 a FA-03, FA-06, CB-11 e os recursos `/setup` e `/auth/*` em "Contratos e interfaces")
- `vostok/work/tasks/SPEC-001/TASK-06.md` (passo 8: rotas extras `GET /setup`, `POST /auth/totp/activation`, `GET /me` e os códigos de erro do contexto auth)
- `prototype/atria-prototype.html` (telas de assistente, login, cadastro e 2FA validadas no protótipo; a grade do formulário `.screen-form .form`, `.span-2` e `.form-actions`, base da PD-62)
- `docs/decisoes-do-prototipo.md` (linhas PD-19 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-11, PD-14, PD-57 e PD-59 não se aplicam: as telas de auth não têm etiquetas, datas nem página de detalhe)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-006`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-006, item 3 (login, cadastro e redefinir senha num cartão estreito, de cerca de 400 px, centralizado, com os componentes da base e sem a grade de 880 px); DEC-003 e DEC-004 não mudam o contexto auth
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes de formulário da base: `TextField`, `FormActions` e as ligações de `apps/web/src/shared/forms/form-fields.tsx`, PD-62; o `FormGrid` de 880 px não é usado nesta feature, DEC-006)
- `packages/ui/src/card/card.tsx` (o `Card` da TASK-03, na camada `elevation-1`, base do cartão das telas de auth, DEC-006)
- `apps/web/src/app` (só leitura: roteador raiz, layout e como as rotas públicas são montadas)
- `apps/web/src/shared` (cliente da API, tratamento de `problem+json`, interface otimista, `Intl`, i18n comum e helpers de teste com axe)
- `packages/ui` (componentes genéricos: campo, botão, alerta, cabeçalho de página, `Card`, e os da TASK-05: `FormActions` e `TextField` sem as setas nos campos numéricos)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de `GET|POST /setup`, `/auth/*`, `/auth/totp/activation` e `/admin/password-resets`)
- `apps/server/src/auth/interface` (códigos estáveis de erro do contexto auth: `invalid_credentials`, `totp_required`, `invalid_totp_code`, `invite_invalid`, `invite_required`, `reset_token_invalid`, `setup_already_done`, `too_many_attempts`, `validation_failed`)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `apps/web/scripts/evidence-shots.mjs` (molde das evidências visuais, TASK-05)

### Mudar

- `apps/web/src/features/auth/routes.tsx` (criar): rotas públicas `/setup`, `/sign-in`, `/sign-up`, `/two-factor`, `/forgot-password` e `/reset-password/$token`, e a rota de admin `/admin/users/$userId/password-reset`, exportadas por `createAuthRoutes` para a TASK-35 registrar.
- `apps/web/src/features/auth/i18n/pt-br.json` (criar): textos das telas de autenticação em tom calmo.
- `apps/web/src/features/auth/components/auth-card.tsx` (criar): `AuthCard`, o cartão estreito centralizado das telas de auth, sobre o `Card` de `@atria/ui` (DEC-006).
- `apps/web/src/features/auth/components/auth-card.module.css` (criar): largura de cerca de 400 px em tokens e centralização do cartão (DEC-006).
- `apps/web/src/features/auth/components/auth-card.test.tsx` (criar): testes do `AuthCard` (DEC-006).
- `apps/web/src/features/auth/schemas.ts` (criar): esquemas `zod` dos formulários (e-mail, senha, código TOTP de 6 dígitos, token de convite).
- `apps/web/src/features/auth/hooks/use-auth-mutations.ts` (criar): mutações do TanStack Query para assistente, login, cadastro, ativação do TOTP, pedido e redefinição de senha e geração de link pelo admin.
- `apps/web/src/features/auth/hooks/use-auth-mutations.test.tsx` (criar): testes dos hooks com o servidor simulado.
- `apps/web/src/features/auth/screens/setup-screen.tsx` (criar): assistente de primeira execução que cria o admin (RF-03).
- `apps/web/src/features/auth/screens/setup-screen.test.tsx` (criar): testes do assistente (CT-03, FA-01).
- `apps/web/src/features/auth/screens/sign-in-screen.tsx` (criar): login com e-mail e senha e passo do código TOTP (RF-06).
- `apps/web/src/features/auth/screens/sign-in-screen.test.tsx` (criar): testes do login com e sem 2FA (CT-06).
- `apps/web/src/features/auth/screens/sign-up-screen.tsx` (criar): cadastro com convite lido da URL ou sem convite quando não exigido (RF-04).
- `apps/web/src/features/auth/screens/sign-up-screen.test.tsx` (criar): testes do cadastro e do convite inválido (CT-04, FA-02, FA-03).
- `apps/web/src/features/auth/screens/two-factor-screen.tsx` (criar): ativação do 2FA com o segredo, o QR code e a confirmação do código (RF-07).
- `apps/web/src/features/auth/screens/two-factor-screen.test.tsx` (criar): testes da ativação e do bloqueio do admin sem 2FA (CT-06, CT-07).
- `apps/web/src/features/auth/screens/forgot-password-screen.tsx` (criar): pedido do link de redefinição por e-mail com resposta neutra (RF-08).
- `apps/web/src/features/auth/screens/forgot-password-screen.test.tsx` (criar): testes da resposta igual para e-mail existente e inexistente (CT-08, CB-11).
- `apps/web/src/features/auth/screens/reset-password-screen.tsx` (criar): redefinição da senha pelo token do link, vindo do e-mail ou do admin (RF-08, RF-09).
- `apps/web/src/features/auth/screens/reset-password-screen.test.tsx` (criar): testes da redefinição e do token já usado (CT-09).
- `apps/web/src/features/auth/screens/admin-password-reset-screen.tsx` (criar): o admin gera o link de uso único para um usuário e o copia (RF-09).
- `apps/web/src/features/auth/screens/admin-password-reset-screen.test.tsx` (criar): testes da geração e da cópia do link (CT-09).
- `apps/web/src/features/auth/auth.e2e.ts` (criar): fluxos ponta a ponta de assistente, convite, login com 2FA e redefinição de senha, rodados na TASK-35.
- `apps/web/src/features/auth/evidence/harness.tsx` (criar): página de evidência que monta as rotas de `createAuthRoutes` num roteador em memória do TanStack Router com os providers do app (tema, TanStack Query, i18n, preferências), as públicas soltas e a do link do admin dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-auth.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-auth.mjs telas`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (inclusive respostas lentas para o carregando e `problem+json` para `totp_required`, `invite_invalid` e `validation_failed`), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações, inclusive `color-contrast`, por `@axe-core/playwright`, e as verificações de cada estado), imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`, e sai com código diferente de 0 se algo falhar; a prancha vai para `vostok/work/tasks/SPEC-001/evidence/TASK-19/auth-telas.png`.

### Passos

1. Leia os arquivos de "Ler" e anote: o nome da função de tradução e do cliente da API em `apps/web/src/shared`, como o cliente expõe o código estável do `problem+json`, os componentes de formulário de `@atria/ui` e o helper de axe dos testes. Os códigos de erro do contexto auth são os de `apps/server/src/auth/interface` (TASK-06): `invalid_credentials`, `totp_required` (401 no login sem código; 403 em qualquer rota fora de `/auth/*`, `/setup` e `/me` para o admin sem 2FA), `invalid_totp_code`, `invite_invalid`, `invite_required`, `reset_token_invalid`, `setup_already_done`, `too_many_attempts` e `validation_failed`. Use esses nomes em todos os passos seguintes; não crie cliente, tradução nem componente genérico novos. Os formulários usam a base da TASK-05 (PD-62): campos `TextField` de `@atria/ui`, ligados ao `react-hook-form` pelo `register` ou pelas ligações de `apps/web/src/shared/forms/form-fields.tsx`, e as ações dentro do `FormActions`, à direita, embaixo da linha, com o botão primário ("Entrar", "Criar conta", "Ativar", "Enviar link", "Redefinir senha", "Gerar link") por último. O código TOTP é um `TextField` de texto com `inputMode="numeric"`, `autoComplete="one-time-code"` e `maxLength={6}`, nunca `type="number"` (PD-62: campos numéricos sem as setas do navegador). Nenhum `<select>`, `<input type="date">` ou `<input type="number">` nativo na feature. Todas as telas da feature (assistente, login, 2FA, cadastro, pedido de redefinição, redefinição e link do admin) ficam dentro do `AuthCard` (passo 3a), sem o `FormGrid` de 880 px e em uma coluna só (DEC-006).
2. Crie `apps/web/src/features/auth/i18n/pt-br.json` com as chaves em `snake_case`, agrupadas por tela (`setup`, `sign_in`, `sign_up`, `two_factor`, `forgot_password`, `reset_password`, `admin_password_reset`), com título, subtítulo, rótulos, botões e mensagens de erro em tom calmo (ex.: "Este convite não vale mais. Peça um novo a quem te convidou.").
3. Crie `apps/web/src/features/auth/schemas.ts` com os esquemas `zod`: `setupSchema` (nome, e-mail, senha com no mínimo 12 caracteres e confirmação igual), `signInSchema` (e-mail, senha), `totpCodeSchema` (exatamente 6 dígitos), `signUpSchema` (nome, e-mail, senha, confirmação, `invite_token` opcional), `forgotPasswordSchema` (e-mail) e `resetPasswordSchema` (senha e confirmação).
3a. Escreva `apps/web/src/features/auth/components/auth-card.test.tsx` (`describe('AuthCard')`: `it('renders the heading, the subtitle and the form inside the card')`, `it('marks the card with data-auth-card for the screens to find')` e `it('has no axe violations')`) e depois `auth-card.tsx` e `auth-card.module.css` (DEC-006): `AuthCard` recebe `heading`, `subtitle`, `back?` e `children`, renderiza o `Card` de `@atria/ui` com `data-auth-card`, o título com `data-page-heading` e o subtítulo dentro do cartão e o formulário embaixo. No CSS, `width: 100%`, `max-width: calc(var(--space) * 100)` (400 px, com `--space` de 4 px, o mesmo cálculo dos 880 px do `FormGrid`), `margin-inline: auto` e, nas telas públicas, o contêiner com a altura da janela e o cartão centralizado na vertical; abaixo de 480 px, o cartão ocupa a largura menos o respiro lateral do tema ([project/frontend-17]). Só tokens do tema ([project/code-style-10]). Não use o `FormGrid`: o formulário dentro do cartão é uma coluna só, com o `FormActions` embaixo.
4. Escreva `apps/web/src/features/auth/hooks/use-auth-mutations.test.tsx` antes do hook, com o servidor simulado do helper de testes de `apps/web/src/shared`, cobrindo: `useSetupStatus` lê `GET /api/v1/setup` (`{"required": boolean}`); `useSetup` envia `POST /api/v1/setup`; `useSignIn` devolve o estado `totp_required` quando o servidor responde 401 `totp_required`; `useStartTotp` envia `POST /api/v1/auth/totp` e devolve `otpauth_uri`; `useActivateTotp` envia `POST /api/v1/auth/totp/activation` com `code`; `useSignUp` envia o `invite_token`; `useForgotPassword` resolve igual para respostas 202 de e-mail existente e inexistente; `useResetPassword` envia `PUT /api/v1/auth/password-resets/{token}`; `useAdminPasswordReset` envia `POST /api/v1/admin/password-resets` e devolve o link. Rode `pnpm --filter @atria/web test -- src/features/auth` e confirme que falham.
5. Crie `apps/web/src/features/auth/hooks/use-auth-mutations.ts` com os hooks `useSetupStatus` (`useQuery`), `useSetup`, `useSignIn`, `useStartTotp`, `useActivateTotp`, `useSignUp`, `useForgotPassword`, `useResetPassword` e `useAdminPasswordReset`, todos com `useMutation` sobre o cliente de `apps/web/src/shared` e os tipos de `@atria/contracts`. As mutações de autenticação não são otimistas: o resultado depende da resposta do servidor. Rode os testes do passo 4 até passarem.
6. Para cada tela, escreva primeiro o `*.test.tsx` com Testing Library e `userEvent`, e depois a tela, nesta ordem: assistente, login, 2FA, cadastro, pedido de redefinição, redefinição, link do admin. Todo teste de tela verifica: o cabeçalho com `page-heading` e subtítulo; o erro de validação dentro do formulário com `role="alert"`; o botão desabilitado e com texto de carregando durante o envio; o erro do servidor em `role="alert"` sem `window.alert`; a ordem do foco por `userEvent.tab()` passando por todos os campos e botões; o botão primário como último elemento do `FormActions` (`within(screen.getByTestId('form-actions'))`, ou o seletor exposto pelo `FormActions` da TASK-05) (PD-62); o formulário dentro do `AuthCard` (o `form` é descendente do elemento com `data-auth-card`) e nenhum `FormGrid` na tela (DEC-006), no teste `renders the form inside the narrow auth card` de cada tela; e zero violações no axe.
7. `setup-screen.test.tsx` e `setup-screen.tsx`: o formulário usa `react-hook-form` com `setupSchema`; ao concluir, navega para `/two-factor` com o aviso de que o admin precisa ativar o 2FA (RF-07, CT-07); se o servidor responder 409 `setup_already_done`, navega para `/sign-in` com o aviso (FA-01). Teste com o nome `creates the admin and asks for two-factor` e `redirects to sign-in when the instance already has users`.
8. `sign-in-screen.test.tsx` e `sign-in-screen.tsx`: primeiro passo com e-mail e senha; quando o hook devolve `totp_required`, mostra o campo do código no mesmo formulário, com o foco nele, e reenvia com `totp_code`; `invalid_credentials` e `invalid_totp_code` mostram o erro no formulário, e `too_many_attempts` mostra a espera em tom calmo; depois do login, quando a primeira rota protegida responde 403 `totp_required` (admin sem 2FA), navega para `/two-factor`; o link "Esqueci a senha" leva a `/forgot-password`. Testes `signs in without two-factor`, `asks for the totp code and signs in with it`, `shows an error for a wrong totp code` e `sends the admin without two-factor to activation`.
9. `two-factor-screen.test.tsx` e `two-factor-screen.tsx`: ao abrir chama `useStartTotp` e mostra o QR code gerado da `otpauth_uri` e o segredo em texto (para quem não pode escanear), com botão de copiar com `aria-label`, e confirma com o código de 6 dígitos via `useActivateTotp` (`POST /auth/totp/activation`); ao confirmar, navega para `/`. Testes `activates two-factor with a valid code` e `keeps the admin on the screen until two-factor is active`.
10. `sign-up-screen.test.tsx` e `sign-up-screen.tsx`: lê `invite` da URL e o envia como `invite_token`; sem convite na URL, envia sem ele (FA-02); se o servidor responder `invite_invalid` (convite expirado ou já usado), mostra a mensagem de convite inválido em `role="alert"` e mantém os campos preenchidos (FA-03); se responder `invite_required`, mostra o texto pedindo um convite. Testes `signs up with an invite from the url`, `signs up without invite when not required`, `shows invalid invite for a used or expired invite` e `asks for an invite when it is required`.
11. `forgot-password-screen.test.tsx` e `forgot-password-screen.tsx`: depois do envio mostra sempre a mesma mensagem neutra ("Se houver uma conta com este e-mail, enviamos o link. Sem e-mail configurado, peça o link a quem administra o Atria.") (CB-11, FA-06). Teste `shows the same message for existing and unknown emails`.
12. `reset-password-screen.test.tsx` e `reset-password-screen.tsx`: lê o `token` do parâmetro da rota, redefine e navega para `/sign-in` com aviso de sucesso; `reset_token_invalid` (token inválido, vencido ou já usado) mostra o erro no formulário com link para pedir outro. Testes `resets the password once` e `refuses a used token`.
13. `admin-password-reset-screen.test.tsx` e `admin-password-reset-screen.tsx`: rota `/admin/users/$userId/password-reset`, que a lista de usuários da TASK-20 abre pelo caminho; botão "Gerar link" chama `useAdminPasswordReset`, mostra o link num campo só de leitura e o botão de copiar usa `navigator.clipboard.writeText`, com aviso em `aria-live="polite"`. A tela fica no layout do app, mas usa o mesmo `AuthCard` estreito e centralizado das telas públicas, sem o `FormGrid` de 880 px (DEC-006): o título e o subtítulo dentro do cartão, o campo do link na largura do cartão e "Cancelar" (`ghost`, volta à lista de usuários) e "Gerar link" no `FormActions` (PD-62). Testes `generates and copies a single-use reset link` e `renders the form inside the narrow auth card` (o formulário dentro do elemento com `data-auth-card`, nenhum `FormGrid` e "Cancelar" antes de "Gerar link").
14. Crie `apps/web/src/features/auth/routes.tsx` exportando `createAuthRoutes(publicParent: AnyRoute, adminParent: AnyRoute)` que devolve as rotas do TanStack Router: as públicas sob `publicParent` e `/admin/users/$userId/password-reset` sob `adminParent`. O loader de `/sign-in` consulta `GET /api/v1/setup` e redireciona para `/setup` quando `required` é verdadeiro; o de `/setup` redireciona para `/sign-in` quando é falso (CT-03, FA-01). Não altere `apps/web/src/app`.
15. Crie `apps/web/src/features/auth/auth.e2e.ts` com Playwright: `first run creates the admin and requires two-factor`, `invite sign-up works once`, `sign-in requires the totp code after activation` e `admin reset link works once`, cada um em 360 px e desktop, com axe sem violações. Não rode: os e2e rodam na TASK-35.
16. Rode o bloco de "Verificação" e corrija até passar sem warnings.
17. Crie `apps/web/src/features/auth/evidence/harness.tsx` e `apps/web/scripts/evidence-auth.mjs` (veja "Mudar") e rode `node apps/web/scripts/evidence-auth.mjs telas`. Corrija o código da tarefa a cada linha `FALHA` e repita até a última linha ser `ok  0 falha(s)`; abra a prancha `auth-telas.png` para conferir os estados, os temas e as larguras.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente e de hook da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/auth
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/auth/auth.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/auth --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-62)
! grep -rnE '<select|type="(date|number)"' apps/web/src/features/auth --include=*.tsx
# Telas de auth no cartão estreito, sem a grade de 880 px (DEC-006)
! grep -rn 'FormGrid' apps/web/src/features/auth --include=*.tsx
grep -q 'calc(var(--space) \* 100)' apps/web/src/features/auth/components/auth-card.module.css
# Harness e script das evidências visuais
test -f apps/web/src/features/auth/evidence/harness.tsx
test -f apps/web/scripts/evidence-auth.mjs
node --check apps/web/scripts/evidence-auth.mjs
```

### Evidências

- `auth-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/auth --reporter=verbose`
  - Prova: as telas e os hooks de autenticação passam nos testes, com axe sem violações (RF-03, RF-04, RF-06 a RF-09, CT-03, CT-04, CT-06, CT-08, CT-09, RNF-06).
  - Trecho: as linhas `✓` de `creates the admin and asks for two-factor`, `asks for the totp code and signs in with it`, `shows invalid invite for a used or expired invite`, `shows the same message for existing and unknown emails`, `resets the password once`, `AuthCard > renders the heading, the subtitle and the form inside the card` e `renders the form inside the narrow auth card` de cada tela (DEC-006, PD-62), e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `auth-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/auth/auth.e2e.ts`
  - Prova: os fluxos ponta a ponta da feature estão escritos para a TASK-35 rodar (CT-03, CT-04, CT-06, CT-09).
  - Trecho: as linhas com `first run creates the admin and requires two-factor`, `invite sign-up works once`, `sign-in requires the totp code after activation` e `admin reset link works once`.
  - Falha: `No such file or directory` ou saída vazia.
- `auth-telas.txt` (automática): `node apps/web/scripts/evidence-auth.mjs telas`
  - Prova: identidade visual, os dois temas, 360 px e desktop, estados de carregando e erro e foco por teclado, medidos no DOM e fotografados nas telas montadas pelo harness da feature (RNF-06, RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema claro aplicado` e `ok ... tema escuro aplicado`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclusive color-contrast)` em cada captura, `ok ... cartão de ~400 px centralizado`, `ok ... nenhuma largura de 880 px`, `ok ... uma coluna só`, `ok ... campo do código TOTP visível` no login, `ok ... erro em role="alert" dentro do formulário` no cadastro com convite inválido e no formulário com erro de validação, `ok ... botão desabilitado com texto de carregando`, `ok ... contorno de foco visível depois de Tab (≥ 2 px)`, `ok ... ações à direita com "Cancelar" antes do primário` e `ok ... link gerado no campo só de leitura` na tela do admin; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-19/auth-telas.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (texto cortado ou rolagem horizontal em 360 px, formulário na largura de 880 px ou em duas colunas, violação do axe ou contraste insuficiente, foco invisível, erro fora de `role="alert"` ou num alerta do navegador), a ausência da linha `png:`, código de saída diferente de 0 ou a prancha sem algum dos estados.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-19/auth-telas.png`, a prancha com as capturas rotuladas, nos temas claro e escuro, em 360 px e em desktop: assistente, login (com o passo do TOTP), cadastro com convite inválido, ativação do 2FA, redefinição de senha e geração do link pelo admin, mais o formulário com o erro em `role="alert"`, o botão em estado de carregando e o foco visível pelo teclado, todos no cartão estreito (cerca de 400 px) centralizado, sem a grade de 880 px, com as ações à direita embaixo da linha (DEC-006, PD-62).

### Concluída quando

- [x] O assistente cria o admin numa instância vazia, leva à ativação do 2FA e não aparece mais depois (RF-03, RF-07, CT-03).

  > Como comprovar: na saída de `auth-tests.txt`, ver aprovados `creates the admin and asks for two-factor` e `redirects to sign-in when the instance already has users`.

- [x] O cadastro usa o convite da URL, funciona sem convite quando ele não é exigido e mostra "convite inválido" para convite usado ou expirado (RF-04, CT-04).

  > Como comprovar: em `auth-tests.txt`, ver aprovados `signs up with an invite from the url`, `signs up without invite when not required` e `shows invalid invite for a used or expired invite`.

- [x] O login entra sem código para quem não tem 2FA, pede o código para quem tem, recusa código errado e manda o admin sem 2FA para a ativação (RF-06, RF-07, CT-06).

  > Como comprovar: em `auth-tests.txt`, ver aprovados os quatro testes de `sign-in-screen` e os dois de `two-factor-screen`.

- [x] O pedido de redefinição mostra a mesma mensagem para qualquer e-mail, e a redefinição funciona uma única vez pelo link do e-mail ou do admin (RF-08, RF-09, CT-08, CT-09).

  > Como comprovar: em `auth-tests.txt`, ver aprovados `shows the same message for existing and unknown emails`, `resets the password once`, `refuses a used token` e `generates and copies a single-use reset link`.

- [x] Todas as telas têm cabeçalho, erros dentro do formulário com `role="alert"`, estado de carregando, foco por teclado e zero violações no axe (RNF-06).

  > Como comprovar: rodar `pnpm --filter @atria/web test -- src/features/auth` e ver "0 failed"; os testes de cada tela incluem as checagens de foco e axe.

- [x] As telas funcionam em 360 px e em desktop, nos temas claro e escuro, só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: em `auth-telas.txt`, ver `tema claro aplicado`, `tema escuro aplicado`, `sem rolagem horizontal` e `axe sem violações (inclusive color-contrast)` com `ok` e a última linha `ok  0 falha(s)`; abrir a prancha `auth-telas.png` e ver as telas inteiras e legíveis nos dois temas e larguras; a Verificação não encontra cor literal.

- [x] Os formulários usam a base da TASK-05: campos de `@atria/ui`, ações no `FormActions` à direita com o primário por último e código TOTP sem as setas do navegador (PD-62).

  > Como comprovar: a Verificação não encontra `<select`, `type="date"` nem `type="number"` na feature; em `auth-telas.txt`, ver `ações à direita com "Cancelar" antes do primário` com `ok`, e na prancha `auth-telas.png`, ver "Cancelar" antes do botão primário, à direita.

- [x] Todas as telas da feature, inclusive a geração do link pelo admin, ficam num cartão estreito de cerca de 400 px, centralizado, sem a grade de 880 px (DEC-006).

  > Como comprovar: em `auth-tests.txt`, ver aprovados os testes de `AuthCard` e `renders the form inside the narrow auth card` de cada tela; a Verificação não encontra `FormGrid` na feature; em `auth-telas.txt`, ver `cartão de ~400 px centralizado` e `nenhuma largura de 880 px` com `ok`, e na prancha `auth-telas.png`, ver o cartão estreito no centro em desktop.

- [x] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `auth-e2e-specs.txt` lista os quatro fluxos.

## Descrição

### Resumo executivo

Entrega as telas de entrada no Atria: o assistente que cria o administrador, o login com verificação em duas etapas, o cadastro por convite e a recuperação de senha.
Com elas, uma instância nova pode ser configurada e os amigos convidados entram com segurança, sem depender de e-mail.
Perfil padrão, risco baixo: segue os contratos já prontos do servidor e só cria arquivos da própria tela.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/auth`, com telas sem regra de negócio e hooks do TanStack Query sobre o cliente de `apps/web/src/shared` e os tipos de `@atria/contracts`. Formulários com `react-hook-form` e `zod`. A feature só exporta `createAuthRoutes`; a TASK-35 registra as rotas no roteador.

**Componentes.** Telas: assistente (`/setup`), login (`/sign-in`), cadastro (`/sign-up?invite=`), ativação do 2FA (`/two-factor`), pedido de redefinição (`/forgot-password`), redefinição (`/reset-password/$token`) e link gerado pelo admin (`/admin/users/$userId/password-reset`). Um arquivo de hooks com as mutações, um de esquemas e as traduções em `i18n/pt-br.json`.

**Decisões.**
- Passo do TOTP no mesmo formulário do login, depois de o servidor pedir o código. Descartada: pedir o código sempre, porque obriga quem não ativou o 2FA a lidar com um campo inútil.
- Mutações de autenticação não otimistas: o resultado (sessão criada, convite aceito) só existe depois da resposta. A regra de interface otimista vale para as mutações de dados das outras features.
- O estado "convite exigido" vem da resposta `invite_required` do servidor ao cadastro, não de uma consulta prévia: `GET /admin/instance/settings` é só do admin. Descartada: esconder o cadastro quando o convite é exigido, porque a pessoa com convite chega pelo link.
- A tela de geração do link pelo admin fica nesta feature porque RF-09 é desta tarefa; a lista de usuários da TASK-20 só navega para o caminho `/admin/users/$userId/password-reset`, sem importar código daqui. Descartada: tela dentro de `features/admin`, que deixaria RF-09 sem dono nesta onda.
- Mensagem neutra no pedido de redefinição, igual para e-mail existente ou não (CB-11).

- 2FA em dois passos, como no servidor: `POST /auth/totp` gera o segredo pendente e `POST /auth/totp/activation` confirma com o código (TASK-06).
- Redirecionamento inicial pelo `GET /setup` (`{"required": ...}`), rota extra do contexto auth (TASK-06).
- Formulários com a base da TASK-05 (DEC-002, PD-62): `TextField`, `FormActions` com o primário à direita e campos numéricos sem setas. Descartado: campos e ações próprios da feature, que divergiriam do resto do app.
- Cartão estreito (DEC-006, item 3): todas as telas da feature ficam no `AuthCard`, um `Card` de `@atria/ui` com `max-width: calc(var(--space) * 100)` (cerca de 400 px), centralizado, com o formulário em uma coluna só. A tela do link do admin continua no layout do app, mas usa o mesmo cartão. O `AuthCard` fica na feature, não em `packages/ui`, porque só as telas de auth o usam. Descartadas: a grade de 880 px do `FormGrid` (PD-19 e PD-62 valem para as telas de formulário do app, e a DEC-006 tira as telas de auth delas) e um cartão novo na base.

**Evidências visuais.** A prancha `auth-telas.png` é gerada por `apps/web/scripts/evidence-auth.mjs`, como as da TASK-05: a evidência é um comando cuja saída (`auth-telas.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como as rotas só são registradas no roteador pela TASK-35, o `pnpm dev` não mostra as telas; por isso o script sobe o Vite com uma página virtual que carrega `apps/web/src/features/auth/evidence/harness.tsx`, que monta `createAuthRoutes` num roteador em memória com os providers do app, sem tocar em `apps/web/src/app` e fora do build de produção. A API é simulada no navegador (`context.route('/api/**')`) com fixtures do próprio script, e cada captura passa pelo axe, inclusive o contraste.

**Riscos.** Os códigos de erro do contexto auth são o contrato entre servidor e tela: se mudarem, o passo do TOTP e a mensagem de convite inválido quebram. Mitigação: usar os códigos de `apps/server/src/auth/interface` e testar cada um.

**Referências.** RF-03, RF-04, RF-06, RF-07, RF-08, RF-09; CT-03, CT-04, CT-06, CT-07, CT-08, CT-09; FA-01, FA-02, FA-03, FA-06; CB-11; RN-11; RNF-01, RNF-06, RNF-08, RNF-10; decisões 10 e 24 da spec; DEC-002; DEC-006; PD-62 de `docs/decisoes-do-prototipo.md` (a PD-19 não vale para as telas de auth, pela DEC-006).

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta.

### Card

- **Título:** Telas de auth
- **Tipo:** historia
- **Descrição:** Telas de assistente de primeira execução, login com 2FA, cadastro por convite e redefinição de senha, prontas para a integração do frontend.
- **Critérios de aceite:**
  - [ ] O assistente cria o admin e leva à ativação do 2FA.
  - [ ] O cadastro aceita o convite da URL e recusa convite usado ou expirado.
  - [ ] O login pede o código TOTP de quem ativou o 2FA.
  - [ ] A senha é redefinida uma única vez pelo link do e-mail ou do admin.
  - [ ] Telas acessíveis por teclado, sem violações no axe, em 360 px e desktop, nos dois temas.
  - [ ] Formulários com os campos e as ações da base do frontend.
  - [ ] Todas as telas de auth, inclusive o link do admin, num cartão estreito centralizado, sem a grade de 880 px.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 5 | 2026-10-31 | evidências | pending | evidência manual sem arquivo |
| 6 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 7 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 9 | 2026-10-31 | evidências | pending | evidência manual sem arquivo |
| 10 | 2026-10-31 | ajuste | in_progress | Evidência manual auth-telas.png trocada por automática auth-telas.txt gerada por apps/web/scripts/evidence-auth.mjs, com a prancha PNG como Artefato; harness da feature em src/features/auth/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 17 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 11 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 12 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 13 | 2026-10-31 | evidências | passed | 3 evidência(s) em evidence/TASK-19/ |
| 14 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md (PD-19, PD-62), DEC-002 a DEC-004 e os componentes de formulário da TASK-05; Passos com TextField e FormActions da base, código TOTP sem type=number e sem controles nativos (PD-62); tela do link do admin com PageHeader e FormGrid na coluna centralizada e teste renders the header and the form in the centered form column (PD-19, PD-62); Verificação sem select, date e number nativos; Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Linha test -e da pasta da feature removida da Baseline, recusada pela validação depois do ajuste 1 |
| 3 | 2026-10-30 | agente | Telas de auth, inclusive o link do admin, no AuthCard estreito (cerca de 400 px) centralizado sobre o Card da base, sem o FormGrid de 880 px (DEC-006): Ler com DEC-006 e o Card, Mudar com auth-card.tsx, .module.css e .test.tsx, passo 3a, testes renders the form inside the narrow auth card em cada tela, passo 13 sem FormGrid, Verificação sem FormGrid na feature, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 4 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature>, sem o '--' que fazia o vitest ignorar o reporter e o filtro -t |
| 5 | 2026-10-31 | agente | Evidência manual auth-telas.png trocada por automática auth-telas.txt gerada por apps/web/scripts/evidence-auth.mjs, com a prancha PNG como Artefato; harness da feature em src/features/auth/evidence/harness.tsx montando as rotas sem mudar apps/web/src/app; Ler, Mudar, passo 17 novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
