---
id: TASK-01
spec: SPEC-002
title: "Proteção das rotas sem sessão"
profile: julgamento
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-01, RF-02, CT-01, CT-02, CB-01]
type: bug
labels: [SPEC-002, julgamento]
status: done
content_hash: de6744a1cda0bdc01adb8e6e8a1093ca8a02846297c3ef79b93600f344fdbf4e
adjustments: 1
adjusted_at: 2026-11-01T10:12:18Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: e6fb230293ea04a0d77383c19a0c72ca7a595fddef3a1c7dbedd93208fcc0ebb
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-opus-5-5
updated_at: 2026-11-01T10:12:18Z
---

# TASK-01: Proteção das rotas sem sessão

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Sessão, Bug 1), RF-01, RF-02, CT-01, CT-02, CB-01, o risco "laço de redirecionamento entre login e assistente" e a decisão 9 (inferência A).
- `vostok/rules/project/frontend.md` ([project/frontend-10]), `code-style.md` ([project/code-style-01], [project/code-style-07], [project/code-style-09]), `testing.md` ([project/testing-04], [project/testing-05], [project/testing-09]) e `security.md`.
- `apps/web/src/app/router.tsx`: `RootComponent` (escolha entre `Outlet` e `AppLayout` por `staticData.layout === 'bare'`), `RouterContext` e `createAppRouter`.
- `apps/web/src/shared/session/current-user.ts`: `useCurrentUser` (chave `['me']`).
- `apps/web/src/shared/api/query-client.ts` e `apps/web/src/shared/api/problem.ts` (`ApiProblem` com `status` e `code`).
- `apps/web/src/features/auth/routes.tsx`: `setupRequired` e os `loader` de `/setup` e `/sign-in`.
- `apps/web/src/features/auth/hooks/use-auth-mutations.ts` (fn `useStoreMe`, `useSignIn`): o login grava `['me']` com `setQueryData` e a tela navega para `/`.
- `apps/web/src/features/admin/routes.tsx` (fn `requireAdminArea`): padrão de `redirect` lançado pelo roteador.
- `apps/web/src/main.tsx`, `apps/web/src/app/app-shell.tsx` e `apps/web/src/app/providers.tsx`: o app completo cria o roteador com `shell: APP_SHELL`; o `QueryClient` nasce no `AppProviders` (arquivo da TASK-07, não muda aqui).
- `apps/web/src/shared/test/render.tsx` e `apps/web/src/features/auth/test-server.ts` (fn `mockApi`, `problem`, `renderAuthRoute`): auxiliares dos testes.
- `apps/web/src/app/layout/app-layout.test.tsx` (fn `renderWithShell`): teste que já monta o roteador com `shell`.
- `apps/web/src/app/e2e-session.ts` (fn `signIn`) e `apps/web/src/app/e2e-sign-in-plugin.ts` (a entrada `/__test__/sign-in` responde 302 para `/`), `apps/web/src/app/navigation.e2e.ts` e `apps/web/playwright.config.ts`: molde dos e2e.
- `apps/server/src/http/session.rs` (fn de `CurrentUser`): sem sessão, o servidor responde 401 com o código `unauthenticated`; o login errado responde 401 `invalid_credentials`.

### Mudar

- `apps/web/src/app/router.tsx` (alterar): `SessionGate` no `RootComponent` para as rotas não `bare`, ligado pela opção `guard_session` de `createAppRouter` (RF-01, RF-02, CB-01).
- `apps/web/src/shared/session/current-user.ts` (alterar): `SESSION_QUERY_KEY`, `useSessionState`, `fetchSetupRequired`, `hasSession` e o endereço de volta (`rememberReturnTo`, `takeReturnTo`) (RF-01, RF-02).
- `apps/web/src/shared/api/query-client.ts` (alterar): um 401 `unauthenticated` de qualquer consulta ou mutação invalida a sessão, e o `SessionGate` leva ao login (RF-02).
- `apps/web/src/features/auth/routes.tsx` (alterar): reaproveita `fetchSetupRequired` de `current-user.ts` e tira do login quem já tem sessão (RF-01).
- `apps/web/src/app/session-guard.test.tsx` (criar): testes da proteção das rotas (CT-01, CT-02, CB-01).
- `apps/web/src/shared/api/query-client.test.ts` (criar): testes do tratamento do 401 (RF-02).
- `apps/web/src/features/auth/routes.test.tsx` (criar): teste do login com sessão já aberta.
- `apps/web/src/app/route-guard.e2e.ts` (criar): e2e sem sessão e com a sessão expirada no uso, com o print da evidência (CT-01, CT-02).

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha (os arquivos de teste novos ainda não existem).
2. Escreva `apps/web/src/shared/api/query-client.test.ts` (describe `createQueryClient session handling`), com `createQueryClient()` e um `vi.spyOn(client, 'invalidateQueries')`, e confirme que falha:
   - `invalidates the session when a query answers 401 unauthenticated`: `client.fetchQuery({ queryKey: ['notes'], queryFn: () => Promise.reject(new ApiProblem({ status: 401, code: 'unauthenticated', title: 'x' })) })` (com `.catch(() => undefined)`) chama `invalidateQueries({ queryKey: ['me'], exact: true })`.
   - `invalidates the session when a mutation answers 401 unauthenticated`: o mesmo com `client.getMutationCache().build(client, { mutationFn: ... }).execute(undefined)`.
   - `ignores the 401 of the session query itself`: a mesma rejeição com `queryKey: ['me']` não chama `invalidateQueries`.
   - `ignores a 401 with another code`: `code: 'invalid_credentials'` não chama `invalidateQueries`.
3. Escreva `apps/web/src/app/session-guard.test.tsx` e confirme que falha. Monte o app como o `main.tsx`: `createAppRouter([...createAuthRoutes(rootRoute, rootRoute), probe], { history: createMemoryHistory({ initialEntries: [rota] }), guard_session: true })` dentro de `<AppProviders query_client={createQueryClient()}>` e `<RouterProvider>`, com a API simulada por `mockApi` e `problem` de `../features/auth/test-server`. `probe` é uma rota `'$'` com `staticData` de `common.brand` cujo componente faz `useQuery({ queryKey: ['probe'], queryFn: () => api.get('/accounts') })` e mostra o texto `tela autenticada`. Limpe `sessionStorage` e use `vi.unstubAllGlobals()` no `afterEach`. Casos:
   - `sends to the setup wizard without a session on a new instance` (CT-01, CB-01): `GET /me` → `problem(401, 'unauthenticated')`, `GET /setup` → `{ status: 200, body: { required: true } }`, rota `/finance`; espera `router.state.location.pathname === '/setup'` (`waitFor`), `tela autenticada` nunca aparece e nenhuma chamada a `/accounts` em `calls`.
   - `sends to sign-in without a session on a configured instance` (CT-01): `/setup` com `required: false`; termina em `/sign-in`, sem `tela autenticada` e sem `/accounts`.
   - `renders the authenticated screen with a session`: `GET /me` 200 com `{ id: 'u1', email: 'a@b.c' }` e `GET /accounts` 200 com `{ items: [] }`; `tela autenticada` aparece.
   - `returns to the previous address after signing in` (CT-02): rota `/notes?q=a` sem sessão termina em `/sign-in`; depois `query_client.setQueryData(['me'], { id: 'u1', email: 'a@b.c' })` e `router.navigate({ to: '/' })` (o que a tela de login faz); espera `router.state.location.href === '/notes?q=a'`.
   - `sends to sign-in when a call answers 401 during use` (RF-02): `/me` começa em 200 e passa a 401 depois da primeira chamada (handler com contador), `/accounts` responde `problem(401, 'unauthenticated')`, `/setup` com `required: false`; termina em `/sign-in`.
   - `keeps the bare routes out of the guard`: rota `/sign-in` sem sessão mostra o título da tela de login e continua em `/sign-in`.
   - `does not guard routers created without guard_session`: `renderWithProviders(<p>livre</p>)` sem `/me` simulado mostra `livre` (as features e os harness de evidência continuam sem sessão).
4. Escreva `apps/web/src/features/auth/routes.test.tsx` com `takes a signed-in person out of the sign-in screen`: `mockApi({ 'GET /setup': { status: 200, body: { required: false } }, 'GET /me': { status: 200, body: { id: 'u1', email: 'a@b.c' } } })`, `renderAuthRoute('/sign-in')` e `waitFor` de `router.state.location.pathname === '/'`. Confirme que falha.
5. Em `apps/web/src/shared/session/current-user.ts`:
   - `export const SESSION_QUERY_KEY = ['me'] as const;` e use-o em `useCurrentUser`.
   - `export async function fetchSetupRequired(): Promise<boolean>`: o corpo de `setupRequired` de `routes.tsx` (`api.get<Schemas['SetupStatus']>('/setup')`, `false` em qualquer erro, com o comentário que já existe).
   - `export async function hasSession(): Promise<boolean>`: `api.get('/me')` resolve `true`, qualquer erro `false`.
   - `export function isSessionLost(error: unknown): boolean`: `error instanceof ApiProblem && error.status === 401 && error.code === 'unauthenticated'`.
   - `const RETURN_KEY = 'atria_return_to'`; `export function rememberReturnTo(href: string)` grava em `sessionStorage` só quando `href` não começa por `/?` e é diferente de `/`, dentro de `try/catch` (sem armazenamento, não guarda); `export function takeReturnTo(): string | undefined` lê, remove e devolve, também em `try/catch`.
   - `export type SessionState = 'checking' | 'authenticated' | 'needs_setup' | 'needs_sign_in'` e `export function useSessionState(): SessionState`: `const me = useCurrentUser()`; `const lost = me.error instanceof ApiProblem && me.error.status === 401`; `const setup = useQuery({ queryKey: ['session', 'setup_required'], queryFn: fetchSetupRequired, enabled: lost })`. Retorne `'checking'` com `me.isPending`; `'authenticated'` quando não é `lost` (outro erro, como 500 ou rede, abre o app: cada tela mostra o próprio erro); `'checking'` com `setup.isPending`; senão `setup.data ? 'needs_setup' : 'needs_sign_in'`. Não use a chave `['setup']`: ela guarda o objeto `SetupStatus` de `useSetupStatus`.
6. Em `apps/web/src/shared/api/query-client.ts`, `createQueryClient` passa a criar `const client = new QueryClient({ queryCache: new QueryCache({ onError: (error, query) => { ... } }), mutationCache: new MutationCache({ onError: (error) => { ... } }), defaultOptions: ... })` e devolve `client`. Os dois `onError` chamam `void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY, exact: true })` quando `isSessionLost(error)`; o da consulta ignora a própria sessão (`query.queryKey.length === 1 && query.queryKey[0] === 'me'`), senão o 401 do `/me` se repetiria sem fim. Comentário do porquê: a consulta da sessão refeita responde 401 e o `SessionGate` leva ao login (RF-02).
7. Em `apps/web/src/features/auth/routes.tsx`: apague `setupRequired` e importe `fetchSetupRequired` e `hasSession` de `../../shared/session/current-user`. O `loader` de `/setup` usa `fetchSetupRequired`. O `loader` de `/sign-in`: `if (await fetchSetupRequired()) throw redirect({ to: '/setup' });` e depois `if (await hasSession()) throw redirect({ to: '/' });`, com o mesmo `eslint-disable-next-line` do arquivo.
8. Em `apps/web/src/app/router.tsx`:
   - `RouterContext` ganha `guard_session: boolean`; `createAppRouter` aceita `guard_session?: boolean` e grava `guard_session: options.guard_session ?? options.shell !== undefined` no contexto. Comentário: o app completo (`main.tsx`, com `shell`) protege as rotas; os testes das features e os harness de evidência montam o roteador sem `shell` e continuam sem sessão.
   - Novo componente `SessionGate` (no mesmo arquivo): `const state = useSessionState()`, `const href = useRouterState({ select: (s) => s.location.href })`, `const navigate = useNavigate()`. Num `useEffect` com `[state, href]`: em `'needs_setup'` ou `'needs_sign_in'`, `rememberReturnTo(href)` e `void navigate({ to: state === 'needs_setup' ? '/setup' : '/sign-in', replace: true })`; em `'authenticated'`, `const back = takeReturnTo()` e, se existir e for diferente de `href`, `void navigate({ to: back, replace: true })`. Renderiza `<AppLayout />` só em `'authenticated'` e `null` nos demais estados: nenhuma tela autenticada monta, e as APIs dela não são chamadas (CB-01).
   - `RootComponent`: `const { guard_session } = useRouteContext({ from: rootRoute.id })` (ou `useRouter().options.context`); `bare ? <Outlet /> : guard_session ? <SessionGate /> : <AppLayout />`. As rotas `bare` (`/setup`, `/sign-in`, `/sign-up`, `/two-factor`, `/forgot-password`, `/reset-password/$token`) ficam fora da proteção, o que evita o laço entre login e assistente.
   - `main.tsx` não muda: ele já passa `shell`.
9. Rode `pnpm --filter @atria/web exec vitest run src/app src/shared/api src/shared/session src/features/auth` até passar, inclusive o `app-layout.test.tsx` (que monta com `shell` e responde 200 a todo `fetch`).
10. Escreva `apps/web/src/app/route-guard.e2e.ts` (só no projeto `desktop`: `test.skip(info.project.name !== 'desktop', ...)`, como em `visual.e2e.ts`):
    - `rota autenticada sem sessão leva ao login` (CT-01): abre uma página num contexto novo (`browser.newContext()`) só para `signIn(page)` e garantir a instância configurada, e fecha; noutro contexto novo, sem cookies, `page.goto('/finance')`; espera `toHaveURL(/\/sign-in$/)`, o título da tela de login visível e nenhum título `Financeiro`; `expectNoAxeViolations(page)`; se `process.env['ATRIA_E2E_SHOT']` existir, `page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })`.
    - `sessão expirada no uso leva ao login e volta ao endereço` (CT-02): `signIn(page)`, `page.goto('/notes')`, espera o título `Notas` visível e `page.waitForLoadState('networkidle')` (as leituras da tela já terminaram; sem isso elas saem sem cookie, recebem 401 e levam ao login antes do clique), `page.context().clearCookies()`, clique no link `a[href="/goals"]` da navegação `Principal`; espera `toHaveURL(/\/sign-in$/)`; depois `page.goto('/__test__/sign-in?role=user')` e espera `toHaveURL(/\/goals$/)`.
    O caso da instância nova (assistente) fica no teste de componente do passo 3: o e2e roda sobre uma instância já configurada.
11. Rode `pnpm --filter @atria/web exec eslint` e `prettier --check` nos arquivos de "Mudar", corrija e rode o bloco de "Verificação" até terminar sem erro. Com a pilha e2e no ar (`docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d`), rode o comando do print de "Evidências" e abra `rota-sem-sessao.png`.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/app src/shared/api src/shared/session src/features/auth --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/app/router.tsx src/shared/session/current-user.ts src/shared/api/query-client.ts src/features/auth/routes.tsx --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/app/router.tsx src/shared/session/current-user.ts src/shared/api/query-client.ts src/features/auth/routes.tsx`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# evidência: guard-tests.txt
pnpm --filter @atria/web exec vitest run src/app/session-guard src/shared/api/query-client src/features/auth/routes --reporter=verbose
pnpm --filter @atria/web exec vitest run src/app src/shared/api src/shared/session src/features/auth
pnpm --filter @atria/web exec eslint src/app/router.tsx src/app/session-guard.test.tsx src/app/route-guard.e2e.ts src/shared/session/current-user.ts src/shared/api/query-client.ts src/shared/api/query-client.test.ts src/features/auth/routes.tsx src/features/auth/routes.test.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/router.tsx src/app/session-guard.test.tsx src/app/route-guard.e2e.ts src/shared/session/current-user.ts src/shared/api/query-client.ts src/shared/api/query-client.test.ts src/features/auth/routes.tsx src/features/auth/routes.test.tsx
pnpm --filter @atria/web typecheck
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` dos testes de `session-guard.test.tsx`, `query-client.test.ts` e `routes.test.tsx` e nenhuma `×`.

### Evidências

- `guard-tests.txt` (automática, da verificação)
  - Prova: sem sessão, a rota autenticada leva ao assistente numa instância nova e ao login numa configurada, sem montar a tela nem chamar as APIs dela; um 401 no uso leva ao login e o endereço volta depois de entrar (RF-01, RF-02, CT-01, CT-02, CB-01).
  - Trecho: `✓ src/app/session-guard.test.tsx > ... > sends to the setup wizard without a session on a new instance`, `sends to sign-in without a session on a configured instance`, `returns to the previous address after signing in`, `sends to sign-in when a call answers 401 during use`, `keeps the bare routes out of the guard` e `✓ src/shared/api/query-client.test.ts > ... > invalidates the session when a query answers 401 unauthenticated`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `rota-sem-sessao.png` (print): `ATRIA_E2E_SHOT="$VOSTOK_EVIDENCE/rota-sem-sessao.png" pnpm --filter @atria/web exec playwright test src/app/route-guard.e2e.ts --project=desktop`
  - Prova: no app real, abrir `/finance` sem sessão mostra a tela de login, e a sessão apagada no uso leva ao login e volta a `/goals` depois de entrar (CT-01, CT-02).
  - Trecho: na imagem, a tela de login no cartão estreito, sem sidebar nem conteúdo do Financeiro; na saída, `2 passed`.
  - Falha: a imagem mostra a sidebar ou o Financeiro, ou a saída tem `failed`, `Timed out` ou `No tests found`.
  - Requer: `apps/web/src/app/route-guard.e2e.ts`

### Concluída quando

- [x] Sem sessão, uma rota autenticada leva ao assistente numa instância nova e ao login numa instância configurada, sem mostrar a tela autenticada nem chamar as APIs dela (RF-01, CT-01, CB-01).

  > Como comprovar: em `guard-tests.txt`, ver `✓` em `sends to the setup wizard without a session on a new instance` e `sends to sign-in without a session on a configured instance`; no print `rota-sem-sessao.png`, ver só a tela de login.

- [x] Um 401 durante o uso leva ao login e, depois de entrar, a pessoa volta ao endereço em que estava (RF-02, CT-02).

  > Como comprovar: em `guard-tests.txt`, ver `✓` em `sends to sign-in when a call answers 401 during use`, `returns to the previous address after signing in` e nos casos de `query-client.test.ts`; na saída do print, `2 passed`.

- [x] As telas de login e do assistente continuam abertas sem sessão, sem laço de redirecionamento, e quem já tem sessão sai do login (RF-01).

  > Como comprovar: em `guard-tests.txt`, ver `✓` em `keeps the bare routes out of the guard` e em `takes a signed-in person out of the sign-in screen`.

- [x] Os testes, o lint, o Prettier e a checagem de tipos do `@atria/web` passam sem aviso.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Hoje, quem abre o Atria sem estar conectado vê o painel vazio e só chega ao login pelo botão Sair. Esta correção faz o app levar direto ao login, ou ao assistente da primeira vez numa instância nova, e trata a sessão que expira no meio do uso, devolvendo a pessoa ao ponto em que estava depois de entrar.
Perfil de julgamento: mexe na entrada de todas as telas, com risco de laço entre login e assistente, coberto por testes dos três estados.
Não depende de outra tarefa e não bloqueia nenhuma.

### Detalhes técnicos

**Abordagem.** A proteção fica num componente `SessionGate`, montado pelo `RootComponent` de `router.tsx` no lugar do `AppLayout` para as rotas não `bare`. Ele lê o estado da sessão (`useSessionState` em `current-user.ts`, sobre a consulta `['me']` que o app já usa) e, sem sessão, consulta `/setup` para escolher entre o assistente e o login. Enquanto confere, não renderiza nada: a tela autenticada não monta e as APIs dela não são chamadas (CB-01). Um 401 com o código `unauthenticated` em qualquer consulta ou mutação invalida `['me']` pelo `QueryCache`/`MutationCache` de `createQueryClient`; o `/me` refeito responde 401 e o `SessionGate` leva ao login (RF-02). O endereço de volta fica no `sessionStorage` (`atria_return_to`) e é usado uma vez quando a sessão volta: a tela de login navega para `/` e o `SessionGate` leva ao endereço guardado.

**Decisões.**
- Componente no `RootComponent`, no lugar de `beforeLoad` na raiz. Descartado o `beforeLoad`: o roteador nasce no `main.tsx`, fora do `AppProviders`, e não tem o `QueryClient` no contexto (pô-lo lá muda `providers.tsx`, da TASK-07), o que obrigaria um `GET /me` a cada navegação, como o `requireAdminArea` faz.
- Proteção ligada por `guard_session`, com padrão "há `shell`". Descartado ligar sempre: os mais de 100 arquivos de teste das features e os harness de evidência montam o roteador sem sessão simulada e ficariam presos. O `main.tsx`, que passa `shell`, liga a proteção sem mudar.
- Endereço de volta no `sessionStorage`, no lugar do parâmetro `?redirect=` no login. Descartado o parâmetro: a tela de login (`sign-in-screen.tsx`) navega para `/` e não está nos componentes da tarefa; o `SessionGate` aplica o endereço guardado ao chegar em `/` com sessão, inclusive depois do passo do 2FA.
- Só o código `unauthenticated` dispara o login. Descartado reagir a todo 401: o login com senha errada responde 401 `invalid_credentials`. Outros erros do `/me` (500, rede) abrem o app, e cada tela mostra o próprio erro.
- `setupRequired` sai de `routes.tsx` para `current-user.ts` (`fetchSetupRequired`), usado pelas rotas de auth e pelo `SessionGate` ("Reaproveitar a checagem de instância configurada", componentes afetados). O login também passa a tirar quem já tem sessão.

**Riscos.** Laço entre login e assistente: as rotas `bare` ficam fora da proteção e o teste cobre os três estados (sem instância, sem sessão e com sessão). O e2e roda numa instância já configurada; o caso do assistente fica no teste de componente.

**Referências.** RF-01, RF-02, CT-01, CT-02, CB-01, decisão 9 (inferência A), risco "A proteção de rotas criar laço de redirecionamento".

**Arquivos em comum na onda 1.** Nenhum dos arquivos de "Mudar" aparece em outra tarefa da onda. O `typecheck` da "Verificação" compila o `@atria/web` inteiro; a TASK-03, da mesma onda, mantém o app compilando ao tornar o ícone do `ViewSwitcher` obrigatório.

### Card

- **Título:** Proteção das rotas sem sessão
- **Tipo:** bug
- **Descrição:** Rotas autenticadas sem sessão levam ao assistente da primeira vez ou ao login, e uma sessão que expira no uso leva ao login e volta ao endereço depois de entrar.
- **Critérios de aceite:**
  - [ ] Sem sessão, nenhuma tela autenticada aparece e o app leva ao assistente ou ao login.
  - [ ] Um 401 no uso leva ao login e, depois de entrar, volta ao endereço anterior.
  - [ ] Login e assistente abrem sem sessão, sem laço de redirecionamento.
  - [ ] Testes, lint e checagem de tipos do frontend passam.
- **Rótulos:** SPEC-002, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 4 comando(s); códigos de saída: 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 3 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 6 | 2026-11-01 | ajuste | in_progress | Passo 10: o e2e da sessão expirada espera a tela de Notas carregar (título e networkidle) antes de apagar os cookies |
| 7 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-11-01 | regressão | passed | 3 comando(s) iguais ao baseline; 1 com acréscimo |
| 9 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 10 | 2026-11-01 | conferência | usuário | print rota-sem-sessao.png conferido pelo usuário (sha256 20e41fef) |
| 11 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-01/ |
| 12 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Passo 10: o e2e da sessão expirada espera a tela de Notas carregar (título e networkidle) antes de apagar os cookies |
