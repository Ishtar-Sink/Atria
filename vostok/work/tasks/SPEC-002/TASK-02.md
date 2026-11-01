---
id: TASK-02
spec: SPEC-002
title: "Voltar para a listagem de origem"
profile: padrao
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-03, CT-03, CB-02]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: f19ba00a1f4ae33eb3865cd960e69fe7d0ebe5c3e198730c24875fa95eed2ef5
adjustments: 1
adjusted_at: 2026-11-01T10:12:18Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 28c81808ab52485078e473555de838332f73d3df8e21291a38f2da7cd64b05a1
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T10:12:18Z
---

# TASK-02: Voltar para a listagem de origem

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Voltar, Bug 2), RF-03, CT-03, CB-02 e a decisão 10 (inferência B).
- `vostok/rules/project/frontend.md` ([project/frontend-10], [project/frontend-13]), `code-style.md` ([project/code-style-07], [project/code-style-09]) e `testing.md` ([project/testing-04], [project/testing-09]).
- `apps/web/src/shared/navigation/back-target.ts`, `back-link.tsx` e `back-target.test.tsx`.
- `apps/web/src/features/notes/screens/notes-screen.tsx` (fn `NotesScreen`, o `useEffect` com `rememberListLocation('notes', href)`): uma das 10 listagens; as outras são `finance/screens/accounts-screen.tsx`, `transactions-screen.tsx`, `transfers-screen.tsx`, `journal/journal-list-page.tsx`, `library/shelf-page.tsx`, `reminders/screens/reminders-screen.tsx`, `goals/screens/goals-screen.tsx`, `projects/projects-list-page.tsx` e `tasks/screens/tasks-screen.tsx`. Nenhuma muda nesta tarefa.
- `apps/web/src/features/tasks/screens/task-form-screen.tsx` (fn com `useBackTarget`), `reminders/screens/reminder-form-screen.tsx` e `journal/journal-entry-form-page.tsx`: os outros usuários de `useBackTarget`.
- `apps/web/src/shared/test/render.tsx` (fn `renderWithProviders`): roteador em memória para os testes.
- `apps/web/src/app/e2e-session.ts` (fn `signIn`, `api`, `createSampleEntities`) e `apps/web/src/app/prototype-routes.e2e.ts` (teste `PD-61 relatório emitido pelo módulo volta ao módulo`): molde do e2e do Voltar.
- `packages/contracts/openapi.json` (schemas `CreateAccountRequest` e `CreateTransferRequest`): dados da transferência do e2e.

### Mudar

- `apps/web/src/shared/navigation/back-target.ts` (alterar): guarda as últimas origens de cada módulo e ignora a origem igual à página atual, que a listagem grava enquanto a rota muda (RF-03, CB-02).
- `apps/web/src/shared/navigation/back-link.tsx` (alterar): o Voltar nunca empurra a página atual (RF-03).
- `apps/web/src/shared/navigation/back-target.test.tsx` (alterar): testes dentro de um roteador, com os casos novos.
- `apps/web/src/shared/navigation/back-link.test.tsx` (criar): testes do clique no Voltar.
- `apps/web/src/shared/navigation/back-link.e2e.ts` (criar): e2e das 10 listagens, com o vídeo da evidência (CT-03).

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha.
2. Reescreva `back-target.test.tsx` para rodar dentro de um roteador: um auxiliar `targetAt(current: string, options: BackTargetOptions)` que faz `renderWithProviders(<Probe {...options} />, { route: current })`, em que `Probe` mostra `useBackTarget(options)` num `<output>`, e devolve o texto com `await screen.findByRole('status')` (ou `findByText`). Mantenha `beforeEach` com `forgetListLocations()` e `sessionStorage.clear()`. Mantenha os cinco casos atuais (com a página atual `/finance/accounts/1` ou `/library/books/1`) e acrescente:
   - `ignores the page being opened, saved by the list while the route changes` (RF-03): `rememberListLocation('notes', '/notes?q=a')`, depois `rememberListLocation('notes', '/notes/1')`; em `/notes/1`, o destino é `/notes?q=a`.
   - `drops that stale entry so the next detail still returns to the list`: depois do caso acima, em `/notes/2`, o destino é `/notes?q=a`.
   - `falls back to the module list when the first page is a detail` (CB-02): sem origem guardada, em `/notes/1`, o destino é o `fallback_to` `/notes`.
   - `reads an origin saved as plain text by the previous version`: `sessionStorage.setItem('atria_back:goals', '/goals?view=grid')`, depois `forgetListLocations({ keep_session: true })`; em `/goals/1`, o destino é `/goals?view=grid`.
   Confirme que os novos falham.
3. Crie `back-link.test.tsx` com `renderWithProviders(<BackLink module="notes" fallback_to="/notes" />, { route: '/notes/1' })`:
   - `links to the list of origin`: com `rememberListLocation('notes', '/notes?q=a')`, o link `Voltar` tem `href="/notes?q=a"` e o clique leva `router.state.location.href` a `/notes?q=a`.
   - `never pushes the current page` (RF-03): só com `rememberListLocation('notes', '/notes/1')`, o link tem `href="/notes"` e o clique leva a `/notes`.
   Confirme que falham.
4. Em `back-target.ts`:
   - `const MAX_ORIGINS = 5`; `memory` passa a `Map<string, string[]>`, da mais recente para a mais antiga.
   - `export function pathnameOf(href: string): string` com `new URL(href, 'http://atria.invalid').pathname`.
   - `read(module)`: da memória ou do `sessionStorage`; o valor guardado é `JSON.stringify(string[])`; um valor que não é um array JSON (o texto puro da versão anterior) vira `[valor]`; erro de armazenamento devolve `[]`. `write(module, list)`: grava na memória e no `sessionStorage` dentro de `try/catch`, como hoje.
   - `rememberListLocation(module, href)` (assinatura igual): `write(module, [href, ...read(module).filter((item) => pathnameOf(item) !== pathnameOf(href))].slice(0, MAX_ORIGINS))`.
   - `pickBackTarget(module, current_path)`: separa as entradas com `pathnameOf(item) === current_path`; se houver alguma, regrava a lista sem elas (a listagem nunca vive no endereço de um detalhe: é a escrita que ela fez enquanto a rota mudava) e devolve a primeira das restantes, ou `undefined`.
   - `useBackTarget` lê `const current = useRouterState({ select: (state) => state.location.pathname })` e devolve `useMemo(() => to ?? pickBackTarget(module, current) ?? fallback_to, [to, module, fallback_to, current])`. Comentário do porquê no topo do arquivo: o TanStack Router muda a localização antes de a listagem desmontar, e o efeito dela grava o endereço da página que está abrindo (Bug 2).
   - `forgetListLocations` continua igual, limpando as listas.
5. Em `back-link.tsx`, leia `const current = useRouterState({ select: (state) => state.location.pathname })` e, no `onClick`, use `const next = pathnameOf(target) === current ? options.fallback_to : target`; se `pathnameOf(next) === current`, só `event.preventDefault()` e não navegue; senão `router.history.push(next)`. O `href` do link continua `target`.
6. Rode `pnpm --filter @atria/web exec vitest run src/shared/navigation` até passar e depois os testes dos formulários que usam `useBackTarget` (comandos da "Verificação").
7. Escreva `back-link.e2e.ts` (só no projeto `desktop`, com `test.skip(info.project.name !== 'desktop', ...)`), teste `Voltar leva à listagem de origem nas 10 listagens` (CT-03): `signIn(page)`, `const samples = await createSampleEntities(page)`, uma segunda conta (`api(page, 'POST', '/accounts', { name: \`Reserva ${sufixo}\` })`) e uma transferência (`api(page, 'POST', '/transfers', { from_account_id: conta_principal, to_account_id: reserva, amount: 5_000, transferred_on: hoje })`). Para cada par listagem e detalhe — `/finance/accounts` e a conta, `/finance/expenses` e a movimentação, `/finance/transfers` e a transferência, `/goals`, `/tasks`, `/reminders`, `/notes`, `/journal`, `/library` (o livro) e `/projects` (o projeto) —: `page.goto(listagem)`, clique em `page.locator(\`main a[href^="${url_do_detalhe}"]\`).first()`, espere `toHaveURL` do detalhe, clique em `getByRole('link', { name: 'Voltar' })` e espere `expect.poll(() => new URL(page.url()).pathname).toBe(listagem)`. Por último, em `/notes?q=Nota`, abra a nota, volte e espere `toHaveURL(/\/notes\?q=Nota/)`; com `process.env['ATRIA_E2E_SHOT']`, grave `page.screenshot({ path, fullPage: true, animations: 'disabled' })` dessa listagem com o filtro. Para a evidência em vídeo, o teste usa a fixture `browser` em vez de `page`: com `process.env['ATRIA_E2E_VIDEO']` definido, cria o contexto com `recordVideo: { dir: <pasta temporária de testInfo.outputPath('video')>, size: { width: 1280, height: 800 } }`; ao fim, fecha o contexto e salva o vídeo com `page.video()?.saveAs(video)`. Sem a variável, `browser.newContext()` comum. Retire o `page.screenshot` do fim.
8. Rode o lint e o Prettier dos arquivos de "Mudar" e o bloco de "Verificação" até terminar sem erro. Com a pilha e2e no ar (`docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d`), rode o comando do vídeo e assista `voltar-listagem.webm`.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/shared/navigation src/features/journal/journal-entry-form-page src/features/reminders/screens src/features/tasks/screens src/features/notes/screens --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/shared/navigation --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/shared/navigation`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# evidência: back-tests.txt
pnpm --filter @atria/web exec vitest run src/shared/navigation --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/journal/journal-entry-form-page src/features/reminders/screens src/features/tasks/screens src/features/notes/screens
pnpm --filter @atria/web exec eslint src/shared/navigation --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/shared/navigation
pnpm --filter @atria/web typecheck
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `back-target.test.tsx` e `back-link.test.tsx` e nenhuma `×`.

### Evidências

- `back-tests.txt` (automática, da verificação)
  - Prova: a origem gravada pela listagem enquanto a rota muda é ignorada, o Voltar nunca leva à página atual e, sem origem, usa a listagem do módulo (RF-03, CB-02).
  - Trecho: `✓ src/shared/navigation/back-target.test.tsx > ... > ignores the page being opened, saved by the list while the route changes`, `drops that stale entry so the next detail still returns to the list`, `falls back to the module list when the first page is a detail` e `✓ src/shared/navigation/back-link.test.tsx > ... > never pushes the current page`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `voltar-listagem.webm` (print): `ATRIA_E2E_VIDEO="$VOSTOK_EVIDENCE/voltar-listagem.webm" pnpm --filter @atria/web exec playwright test src/shared/navigation/back-link.e2e.ts --project=desktop`
  - Prova: no app real, o vídeo mostra o Voltar de cada detalhe levando de volta às 10 listagens e, por último, a listagem de Notas com a busca "Nota" mantida (CT-03). Um print só mostraria a tela final, sem a navegação.
  - Trecho: no vídeo, a sequência listagem → detalhe → Voltar → mesma listagem nas 10 telas, terminando em Notas com "Nota" na busca; na saída, `1 passed`.
  - Falha: no vídeo, um Voltar que fica no detalhe ou cai em outra listagem, ou a saída com `failed`, `Timed out` ou `No tests found`.
  - Requer: `apps/web/src/shared/navigation/back-link.e2e.ts`

### Concluída quando

- [x] O Voltar de um detalhe leva à listagem de onde a pessoa veio, com os filtros, nas 10 listagens (RF-03, CT-03).

  > Como comprovar: na saída do print, ver `1 passed`; no `voltar-listagem.webm`, ver o Voltar voltando às 10 listagens e a de Notas com a busca mantida.

- [x] O Voltar nunca navega para a página atual, mesmo com a origem gravada errada pela listagem (RF-03).

  > Como comprovar: em `back-tests.txt`, ver `✓` em `ignores the page being opened, saved by the list while the route changes`, `drops that stale entry so the next detail still returns to the list` e `never pushes the current page`.

- [x] Sem listagem guardada, o Voltar usa a listagem padrão do módulo (CB-02).

  > Como comprovar: em `back-tests.txt`, ver `✓` em `falls back to the module list when the first page is a detail`.

- [x] Os formulários que usam o mesmo destino, o lint e a checagem de tipos continuam passando.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Hoje o botão Voltar de um detalhe às vezes não sai do lugar, porque a listagem guarda o endereço errado ao abrir o item. A correção faz o Voltar levar sempre à listagem de origem, com os filtros que a pessoa tinha escolhido, nas 10 listagens do app.
Perfil padrão: mudança pequena em dois arquivos compartilhados, sem mexer nas telas.
Não depende de outra tarefa e não bloqueia nenhuma.

### Detalhes técnicos

**Abordagem.** A causa é de tempo: o TanStack Router muda `location.href` antes de a listagem desmontar, e o `useEffect` de `rememberListLocation` grava o endereço do detalhe que está abrindo. Em vez de mudar as 10 listagens (arquivos de outras tarefas), `back-target.ts` passa a guardar as últimas origens de cada módulo (até 5, uma por caminho) e `useBackTarget` escolhe a mais recente com caminho diferente da página atual, apagando a que coincide com ela. `BackLink` confere de novo antes de navegar. A assinatura de `rememberListLocation` e de `useBackTarget` não muda.

**Decisões.**
- Lista de origens com descarte da página atual, no lugar de gravar só o endereço "certo". Descartado mudar as listagens para gravar o endereço da própria rota (`useMatch`): são 10 arquivos de outras tarefas (TASK-17, TASK-18, TASK-20, TASK-28) e o defeito voltaria em toda listagem nova.
- Descartado trocar o Voltar pelo histórico do navegador (decisão 10): quem abre um detalhe por link direto ficaria sem destino.
- Leitura compatível do valor antigo em texto puro, para quem já tem uma origem guardada na sessão do navegador ao atualizar.
- `useBackTarget` passa a ler a página atual com `useRouterState`; por isso `back-target.test.tsx` deixa o `renderHook` solto e roda dentro do roteador de `renderWithProviders`.

**Riscos.** Um detalhe que leva a outro do mesmo módulo: a entrada errada é apagada na primeira leitura, e o segundo detalhe volta à listagem (teste `drops that stale entry ...`).

**Referências.** RF-03, CT-03, CB-02, decisão 10 (inferência B).

**Arquivos em comum na onda 1.** Nenhum. O `typecheck` da "Verificação" compila o `@atria/web` inteiro; a TASK-03, da mesma onda, mantém o app compilando ao tornar o ícone do `ViewSwitcher` obrigatório.

### Card

- **Título:** Voltar para a listagem de origem
- **Tipo:** bug
- **Descrição:** O Voltar dos detalhes leva sempre à listagem de origem, com os filtros, e nunca navega para a própria página.
- **Critérios de aceite:**
  - [ ] O Voltar leva à listagem de origem nas 10 listagens.
  - [ ] O Voltar nunca navega para a página atual.
  - [ ] Sem origem guardada, o Voltar usa a listagem do módulo.
  - [ ] Testes, lint e checagem de tipos passam.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 4 comando(s); códigos de saída: 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 3 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | ajuste | in_progress | Evidência do CT-03 passa de print para vídeo (voltar-listagem.webm, gravado pelo e2e com ATRIA_E2E_VIDEO); passo 7 e critério de conclusão atualizados |
| 7 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-11-01 | regressão | passed | 3 comando(s) iguais ao baseline; 1 com acréscimo |
| 9 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 10 | 2026-11-01 | conferência | usuário | print voltar-listagem.webm conferido pelo usuário (sha256 d666ec20) |
| 11 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-02/ |
| 12 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Evidência do CT-03 passa de print para vídeo (voltar-listagem.webm, gravado pelo e2e com ATRIA_E2E_VIDEO); passo 7 e critério de conclusão atualizados |
