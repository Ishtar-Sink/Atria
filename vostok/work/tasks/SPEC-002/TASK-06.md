---
id: TASK-06
spec: SPEC-002
title: "Cabeçalho fixo com fundo de ponta a ponta"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-36, CT-35, CB-14]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: a93226a533da96b45ffac49e85957991eec9d7bd2dfd35aee14e161582eef22d
adjustments: 1
adjusted_at: 2026-11-01T10:19:22Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: ed13fbc46344bcbccdc6e52ede6191084945fc2d54d5ad26d21d795fd5daf9e5
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T10:19:22Z
---

# TASK-06: Cabeçalho fixo com fundo de ponta a ponta

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (o `StickyPageHeader` em 52 telas, só com `backdrop-filter`, na largura do conteúdo), RF-36, RNF-06, CT-35, CB-14, o risco "O fundo com desfoque sumir no build, como na ISS-001" e a decisão 18 (inferência J).
- `vostok/memory/issues.md` (ISS-001): o Lightning CSS apaga o `backdrop-filter` escrito antes de `-webkit-backdrop-filter`; escreva só a forma sem prefixo.
- `docs/decisoes-do-prototipo.md`: PD-20 (cabeçalho fixo).
- `vostok/rules/project/frontend.md` ([project/frontend-04], [project/frontend-07], [project/frontend-17]), `code-style.md` ([project/code-style-10], [project/code-style-11]) e `testing.md` ([project/testing-04], [project/testing-09]).
- `prototype/atria-prototype.html` (mais de 400 linhas): linhas 386 (`main` com `--main-px`), 391-406 (`.page-header` fixo, o `::before` com `left: var(--bd-l)`, `width: var(--bd-w)`, o degradê com `color-mix(in srgb, var(--bg) 55%, transparent)`, `backdrop-filter: blur(14px)`, a máscara e `bottom: -24px`, os estados `stuck` e `scrolled` e o `prefers-reduced-motion`), linha 670 (`.screen-form` de 880 px) e linhas 2769-2780 (fn `syncTopbar`, que mede `--bd-l` e `--bd-w` pela `.page`, e o `scroll` que liga `stuck` e `scrolled`).
- `apps/web/src/shared/layout/sticky-page-header.tsx`, `sticky-page-header.module.css` e `sticky-page-header.test.tsx`.
- `packages/ui/src/page-header/page-header.tsx`, `page-header.module.css` e `page-header.test.tsx`.
- `apps/web/src/shared/layout/form-screen.module.css` e `form-screen.tsx`.
- `apps/web/src/app/layout/app-layout.module.css` (`.page` com `data-scroll-area` e o preenchimento de `calc(var(--space) * 6)`, 3 até 720 px; `.pageInner` de 1360 px) e `apps/web/src/app/layout/app-layout.tsx` (o `main` com `data-scroll-area`).
- `apps/web/src/features/command-palette/command-palette.test.tsx` (teste `keeps the unprefixed backdrop blur for the build to prefix`, CSS lido com `?raw`) e `command-palette.e2e.ts` (o `backdropFilter` conferido no build): molde da proteção da ISS-001.
- `apps/web/playwright.config.ts`, `apps/web/src/app/e2e-session.ts` (fn `signIn`, `api`, `setTheme`) e `apps/web/src/app/visual.e2e.ts`: molde do projeto e2e e dos prints.
- `apps/web/src/features/library/book-form-page.tsx`: formulário longo de 880 px com `StickyPageHeader`, usado no e2e.

### Mudar

- `apps/web/src/shared/layout/sticky-page-header.tsx` (alterar): mede `--bd-l` e `--bd-w` pela área de rolagem, para o fundo ir de ponta a ponta (RF-36).
- `apps/web/src/shared/layout/sticky-page-header.module.css` (alterar): fundo tingido com desfoque e máscara do protótipo, só com `backdrop-filter` sem prefixo (RF-36, CB-14, ISS-001).
- `apps/web/src/shared/layout/sticky-page-header.test.tsx` (alterar): testes da medida e do CSS lido com `?raw` (ISS-001).
- `packages/ui/src/page-header/page-header.tsx` (alterar): `data-compact` no estado compacto.
- `packages/ui/src/page-header/page-header.module.css` (alterar): Voltar mais perto do título e preenchimento do estado compacto, como no protótipo.
- `packages/ui/src/page-header/page-header.test.tsx` (alterar): teste do `data-compact`.
- `apps/web/src/shared/layout/form-screen.module.css` (alterar): campos focados nos formulários de 880 px param abaixo do cabeçalho fixo, sem ficar sob o texto dele.
- `apps/web/playwright.config.ts` (alterar): projetos e2e `firefox` e `firefox-session` para os testes marcados `@firefox`, só com `ATRIA_E2E_FIREFOX=1` (RNF-06).
- `apps/web/src/shared/layout/sticky-page-header.e2e.ts` (criar): e2e no Chromium e no Firefox, com os prints (CT-35, CB-14).

### Passos

1. Leia os arquivos de "Ler". Instale o Firefox do Playwright da versão do projeto: `pnpm --filter @atria/web exec playwright install firefox` (hoje só há uma versão antiga em `~/.cache/ms-playwright`). Rode o bloco de "Verificação" e confirme que ele falha.
2. Altere `sticky-page-header.test.tsx` e confirme que os novos falham:
   - `import sticky_css from './sticky-page-header.module.css?raw';`
   - `keeps the unprefixed backdrop blur for the build to prefix` (ISS-001): o bloco `.sticky::before` tem `backdrop-filter: blur(` (regex `/(^|[^-])backdrop-filter: blur\(/`) e o arquivo não contém `-webkit-backdrop-filter`.
   - `tints the background with the page color and fades it at the bottom`: o bloco `.sticky::before` tem `color-mix(in srgb, var(--bg) 55%, transparent)`, `left: var(--bd-l, 0px)`, `width: var(--bd-w, 100%)` e `mask-image`.
   - `measures the backdrop from the scroll area`: com `getBoundingClientRect` simulado (`vi.spyOn`) na área (`left: 264`) e no wrapper `[data-sticky-header]` (`left: 344`) e `clientWidth` da área `1016` (`Object.defineProperty`), depois do render o wrapper tem `style.getPropertyValue('--bd-l') === '-80px'` e `--bd-w` `1016px`; ao mudar o `clientWidth` para `700` e disparar `resize` em `window` (dentro de `act`), `--bd-w` vira `700px`.
   Os quatro casos atuais continuam.
3. Altere `page-header.test.tsx` acrescentando `marks the compact state with data-compact`: com `compact`, o `header` tem `data-compact`; sem, não tem. Confirme que falha.
4. Em `sticky-page-header.tsx`:
   - O wrapper ganha `data-sticky-header=""`.
   - Um novo `useEffect` (separado do de rolagem) mede o fundo: `const area = wrap.current?.closest<HTMLElement>('[data-scroll-area]')`; `measure()` faz `wrap.style.setProperty('--bd-l', \`${String(area.getBoundingClientRect().left - wrap.getBoundingClientRect().left)}px\`)` e `--bd-w` com `\`${String(area.clientWidth)}px\``; chama `measure()` na montagem, em `window` `resize` e, quando existir (`typeof ResizeObserver !== 'undefined'`; o jsdom não tem), num `ResizeObserver` que observa a área e o wrapper; limpa os dois na desmontagem. Comentário: como a `syncTopbar` do protótipo, o fundo vai da sidebar à borda mesmo dentro do formulário de 880 px ou da página de 1360 px (PD-20).
   - O comportamento de `stuck` e `compact` não muda.
5. Reescreva o `.sticky::before` de `sticky-page-header.module.css` como o `.page-header::before` do protótipo, só com tokens e sem a forma `-webkit-` (ISS-001; o Lightning CSS acrescenta o prefixo pelos alvos do build): `content: ''; position: absolute; z-index: -1; top: 0; bottom: calc(var(--space) * -6); left: var(--bd-l, 0px); width: var(--bd-w, 100%); pointer-events: none; opacity: 0; transition: opacity var(--motion-fast) var(--motion-ease-standard); background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 55%, transparent), transparent); backdrop-filter: blur(14px); mask-image: linear-gradient(to bottom, #000 calc(100% - var(--space) * 10), transparent);`. Mantenha `.sticky`, `.sticky:has([data-stuck])::before { opacity: 1; }` e a regra de 720 px. Comentário ao lado do `backdrop-filter`: escrever só a forma sem prefixo (ISS-001). Com "reduzir movimento", o `--motion-fast` vale 0 e o fundo aparece sem transição (CB-14). No `.sticky`, use `top: calc(var(--space) * -6)` (e `calc(var(--space) * -4)` abaixo de 720 px): o `sticky` conta a partir do padding da área de rolagem, e com `top: 0` sobra uma faixa entre o cabeçalho e a topbar.
6. Em `page-header.tsx`, o `header` recebe `{...(compact ? { 'data-compact': '' } : {})}`, como o `data-stuck`. Em `page-header.module.css`: `.compact .back { margin-bottom: var(--s1); }` e, no `.root`, `transition: margin-bottom var(--motion-fast) var(--motion-ease-standard);` (o protótipo aproxima o Voltar do título e anima o compactar). A fonte compacta de 24 px já existe.
7. Em `form-screen.module.css`, acrescente `.screen :is(input, select, textarea, button, a, [tabindex]) { scroll-margin-top: calc(var(--space) * 36); }`, com o comentário: ao focar um campo (Tab ou o primeiro erro), o navegador o rola para baixo do cabeçalho fixo, e não para trás do texto dele (Bugs 9, 16, 25 e 28).
8. Rode `pnpm --filter @atria/web exec vitest run src/shared/layout` e `pnpm --filter @atria/ui exec vitest run src/page-header` até passarem.
9. Em `apps/web/playwright.config.ts`, crie `const FIREFOX_PROJECTS: Project[] = [...]` com os dois projetos abaixo e acrescente `...(process.env['ATRIA_E2E_FIREFOX'] === '1' ? FIREFOX_PROJECTS : [])` ao fim de `projects`, depois dos projetos por largura: `{ name: 'firefox', grep: /@firefox/, testIgnore: WITH_SESSION, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } }` e `{ name: 'firefox-session', grep: /@firefox/, testMatch: WITH_SESSION, dependencies: ['setup'], use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 }, storageState: USER_STATE } }`, com o comentário: o usuário usa o Zen (Firefox); os e2e marcados `@firefox` rodam também no Firefox com `ATRIA_E2E_FIREFOX=1` (RNF-06), e sem a variável o `pnpm e2e` da CI, que instala só o Chromium, mantém os 9 projetos de hoje.
10. Escreva `apps/web/src/shared/layout/sticky-page-header.e2e.ts` com `test.describe('cabeçalho fixo', { tag: '@firefox' }, ...)` e, em cada teste, `test.skip(!['desktop', 'firefox'].includes(info.project.name), ...)`. Um auxiliar `backdropOf(page)` avalia no wrapper `[data-sticky-header]` visível: `getComputedStyle(el, '::before')` (`opacity`, `backdropFilter`, `backgroundImage`, `width`, `left`, `transitionDuration`), o `getBoundingClientRect()` do wrapper e o da área `[data-scroll-area]` com o `clientWidth`.
    - `formulário: fundo tingido com desfoque na largura da área da página` (CT-35): `signIn(page)`, viewport 1280 × 600, `setTheme(page, 'light')` (que também liga `reducedMotion: 'reduce'`), `page.goto('/library/books/new')`, confira que a área rola (`scrollHeight > clientHeight + 200`), role a área até 240 px (`evaluate((n) => n.scrollTo(0, 240))`) e espere `opacity` `1`; confira `backdropFilter` contendo `blur`, `backgroundImage` contendo `linear-gradient`, a largura do `::before` igual ao `clientWidth` da área (±1 px), `wrapper.left + parseFloat(before.left)` igual a `area.left` (±1 px), e a largura do wrapper menor que a da área (o formulário tem 880 px); com `process.env['ATRIA_E2E_SHOT']`, grave `page.screenshot({ path, animations: 'disabled' })` (só a janela, com o cabeçalho preso sobre o formulário).
    - `listagem larga: fundo de ponta a ponta além dos 1360 px` (CT-35): viewport 1680 × 700, crie 30 notas com `api(page, 'POST', '/notes', { title: \`Nota ${i}\`, body: 'Texto.' })`, `page.goto('/notes')`, role e confira as mesmas medidas.
    - `sem transição com reduzir movimento` (CB-14): no formulário, com `reducedMotion: 'reduce'`, `transitionDuration` do `::before` é `0s`.
    - `compacta o título depois de 48 px`: depois de rolar 240 px, o `header` tem `data-compact` e o `h1` tem `font-size` `24px`.
11. Rode o lint e o Prettier dos arquivos de "Mudar" e o bloco de "Verificação" até terminar sem erro. Confira `ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test --list --project=firefox` (só os quatro testes desta tarefa) e que, sem a variável, `--list` não tem projeto `firefox`. Com a pilha e2e no ar (`docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d`), rode os dois comandos de print e abra os PNG.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/shared/layout --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/ui exec vitest run src/page-header --reporter=verbose 2>&1 | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/shared/layout playwright.config.ts --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/shared/layout playwright.config.ts`
- `pnpm --filter @atria/ui exec eslint src/page-header --max-warnings 0`
- `pnpm --filter @atria/ui exec prettier --check src/page-header`
- `pnpm --filter @atria/ui typecheck`
- `pnpm --filter @atria/web typecheck`
- `pnpm --filter @atria/web exec playwright test --list 2>&1 | grep -E '^ +\[' | sed -E 's/^ *\[([^]]+)\].*/\1/' | sort -u`

### Verificação

```bash
# evidência: header-tests.txt
pnpm --filter @atria/web exec vitest run src/shared/layout --reporter=verbose
pnpm --filter @atria/ui exec vitest run src/page-header
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/shared/layout playwright.config.ts --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/shared/layout playwright.config.ts
pnpm --filter @atria/ui exec eslint src/page-header --max-warnings 0
pnpm --filter @atria/ui exec prettier --check src/page-header
ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test --list --project=firefox 2>&1 | grep -q 'shared/layout/sticky-page-header.e2e.ts'
! pnpm --filter @atria/web exec playwright test --list 2>&1 | grep -q '\[firefox'
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `sticky-page-header.test.tsx`, inclusive `keeps the unprefixed backdrop blur for the build to prefix`, e nenhuma `×`.

### Evidências

- `header-tests.txt` (automática, da verificação)
  - Prova: o fundo é medido pela área de rolagem, o CSS tinge com a cor da página, desfoca só com `backdrop-filter` sem prefixo (ISS-001) e some em degradê embaixo (RF-36, CB-14).
  - Trecho: `✓ src/shared/layout/sticky-page-header.test.tsx > StickyPageHeader > keeps the unprefixed backdrop blur for the build to prefix`, `tints the background with the page color and fades it at the bottom` e `measures the backdrop from the scroll area`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `cabecalho-fixo-chromium.png` (print): `ATRIA_E2E_SHOT="$VOSTOK_EVIDENCE/cabecalho-fixo-chromium.png" pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=desktop`
  - Prova: no build real, no Chromium, o cabeçalho preso sobre o formulário tem fundo tingido com desfoque da sidebar à borda, sem o conteúdo se misturar ao texto, e as quatro conferências passam (CT-35, CB-14).
  - Trecho: na imagem, o título "Novo livro" compacto, colado na topbar, sobre um fundo claro desfocado que ocupa toda a área à direita da sidebar, além dos 880 px do formulário; na saída, `4 passed`.
  - Falha: campos legíveis atrás do título, o fundo só na largura do formulário, ou a saída com `failed`, `Timed out` ou `No tests found`.
  - Requer: `apps/web/src/shared/layout/sticky-page-header.e2e.ts`
- `cabecalho-firefox-e2e.txt` (automática): `ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=firefox`
  - Prova: no Firefox, pelo projeto e2e novo, o pseudo-elemento do cabeçalho preso tem `backdrop-filter` com `blur`, o degradê e a largura da área da página (CT-35, RNF-06). O Firefox do Playwright não desenha `backdrop-filter`, por isso a imagem do Firefox vem do Zen.
  - Trecho: `4 passed`.
  - Falha: `Executable doesn't exist` (Firefox sem instalar), `failed`, `Timed out` ou `No tests found`.
  - Requer: `apps/web/src/shared/layout/sticky-page-header.e2e.ts`
- `cabecalho-fixo-firefox.png` (manual): print do Zen, tirado pelo usuário, com a prévia do build e2e (`http://localhost:4173`, entrada por `/__test__/sign-in?role=user`) em `/library/books/new`, rolada até o cabeçalho prender.
  - Prova: no navegador do usuário, o cabeçalho preso cola na topbar e tem o fundo tingido com desfoque de ponta a ponta (CT-35, RNF-06).
  - Trecho: na imagem, o título "Novo livro" compacto logo abaixo da topbar, sem faixa entre os dois, sobre um fundo desfocado da sidebar à borda.
  - Falha: o conteúdo nítido atrás do título, o fundo transparente ou um espaço entre o cabeçalho e a topbar.

### Concluída quando

- [x] O cabeçalho fixo tem fundo tingido com desfoque de ponta a ponta da área da página, nos formulários de 880 px e nas listagens largas, sem o conteúdo aparecer por trás do texto (RF-36, CT-35).

  > Como comprovar: no print `cabecalho-fixo-chromium.png` e no `cabecalho-fixo-firefox.png` do Zen, ver o cabeçalho colado na topbar, o fundo desfocado da sidebar à borda e o título legível; na saída do print do Chromium e em `cabecalho-firefox-e2e.txt`, `4 passed`.

- [x] O desfoque continua no CSS do build, escrito só sem prefixo (ISS-001).

  > Como comprovar: em `header-tests.txt`, ver `✓ ... keeps the unprefixed backdrop blur for the build to prefix`; os e2e conferem `blur` no `backdropFilter` calculado do build no Chromium e no Firefox.

- [x] Com "reduzir movimento", o fundo aparece sem transição (CB-14).

  > Como comprovar: na saída dos prints, o teste `sem transição com reduzir movimento` está entre os `4 passed`.

- [x] Com `ATRIA_E2E_FIREFOX=1`, o projeto e2e `firefox` roda os testes marcados `@firefox`; sem a variável, a lista de projetos da CI não muda (RNF-06).

  > Como comprovar: rodar `ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test --list --project=firefox` e ver os testes de `sticky-page-header.e2e.ts`; sem a variável, `--list` não mostra `firefox`.

- [x] Testes, lint e checagem de tipos passam.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.

## Descrição

### Resumo executivo

Ao rolar formulários e listas, o título fixo do topo deixava o conteúdo aparecer por trás do texto, principalmente no Firefox e nos formulários estreitos. A correção dá ao cabeçalho o fundo tingido e desfocado de ponta a ponta do protótipo e passa a testar essas telas também no Firefox, o navegador do usuário.
Perfil padrão: mudança visual num componente usado em 52 telas, com proteção contra o defeito de build já visto (ISS-001).
Não depende de outra tarefa e não bloqueia nenhuma.

### Detalhes técnicos

**Abordagem.** O `StickyPageHeader` passa a medir, como a `syncTopbar` do protótipo, a posição e a largura da área de rolagem (`[data-scroll-area]`) em relação ao próprio wrapper e grava `--bd-l` e `--bd-w`; o `::before` usa essas variáveis, o degradê com `color-mix(var(--bg) 55%)`, `backdrop-filter: blur(14px)` e a máscara que se dissolve embaixo, como o `.page-header::before` do protótipo (PD-20). Assim o fundo cobre a área inteira mesmo dentro do formulário de 880 px ou da página de 1360 px, e a tinta impede o conteúdo de aparecer legível por trás do título (inferência J). O `PageHeader` ganha `data-compact` e o Voltar mais perto do título no estado compacto. No `form-screen.module.css`, o `scroll-margin-top` faz o campo focado parar abaixo do cabeçalho. O `playwright.config.ts` ganha os projetos `firefox` e `firefox-session`, que rodam só os testes com a marca `@firefox` e só existem com `ATRIA_E2E_FIREFOX=1`; quem roda e2e no Firefox (esta tarefa e as seguintes) passa a variável no comando.

**Decisões.**
- Medida por JavaScript, no lugar de `100vw` com margens negativas. Descartado o CSS puro: a largura da sidebar muda (gaveta até 720 px) e o `100vw` inclui a barra de rolagem, o que gera rolagem horizontal.
- Só `backdrop-filter` sem prefixo, como pede a ISS-001, com o teste que lê o CSS com `?raw` (no molde da paleta de comandos) e o e2e que confere o estilo calculado no build. Descartado escrever as duas formas: o Lightning CSS apaga a sem prefixo.
- Firefox por marca (`grep: /@firefox/`) num projeto próprio, no lugar de rodar todos os e2e no Firefox. Descartado o projeto completo: dobraria o tempo do e2e e falharia em telas fora da SPEC-002; as tarefas seguintes só marcam os testes delas.
- Projetos do Firefox só com `ATRIA_E2E_FIREFOX=1` (decisão do Coordenador). Descartado o Firefox na CI: a CI instala só o Chromium (`playwright install --with-deps chromium` em `.github/workflows/ci.yml`, fora dos componentes da tarefa) e o `pnpm e2e` roda todos os projetos; sem a variável, a CI mantém os 9 projetos de hoje.
- `scroll-margin-top` no contêiner do formulário. Descartado `scroll-padding-top` na área de rolagem: fica em `app-layout.module.css`, fora dos componentes da tarefa.

**Riscos.**
- O Firefox do Playwright desta versão não está instalado na máquina (passo 1).

**Referências.** RF-36, RNF-06, CT-35, CB-14, decisão 18 (inferência J), PD-20, ISS-001.

**Arquivos em comum na onda 1.** Nenhum. A TASK-05 também altera a `@atria/ui`, em outros componentes.

### Card

- **Título:** Cabeçalho fixo com fundo de ponta a ponta
- **Tipo:** bug
- **Descrição:** Cabeçalho fixo com fundo tingido e desfocado de ponta a ponta da área da página, como no protótipo, e projeto e2e no Firefox.
- **Critérios de aceite:**
  - [ ] Fundo tingido com desfoque da sidebar à borda, também nos formulários de 880 px.
  - [ ] O conteúdo não aparece por trás do texto do cabeçalho.
  - [ ] O desfoque sobrevive ao build (ISS-001).
  - [ ] Sem transição com reduzir movimento.
  - [ ] Os e2e do cabeçalho rodam no Chromium e, com `ATRIA_E2E_FIREFOX=1`, no Firefox.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 9 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 7 comando(s) iguais ao baseline; 2 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | ajuste | in_progress | Prova do Firefox: print manual do Zen (cabecalho-fixo-firefox.png), porque o Firefox do Playwright não desenha backdrop-filter; e2e do Firefox vira evidência automática (cabecalho-firefox-e2e.txt); passo 5 com top negativo para o cabeçalho colar na topbar; critério e trecho do Chromium atualizados |
| 7 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-11-01 | regressão | passed | 7 comando(s) iguais ao baseline; 2 com acréscimo |
| 9 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 10 | 2026-11-01 | conferência | usuário | print cabecalho-fixo-chromium.png conferido pelo usuário (sha256 f4e3b93b) |
| 11 | 2026-11-01 | evidências | passed | 4 evidência(s) em evidence/TASK-06/ |
| 12 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 13 | 2026-11-01 | conferência | usuário | print cabecalho-fixo-chromium.png conferido pelo usuário (sha256 11f026a5) |
| 14 | 2026-11-01 | evidências | passed | 4 evidência(s) em evidence/TASK-06/ |
| 15 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Prova do Firefox: print manual do Zen (cabecalho-fixo-firefox.png), porque o Firefox do Playwright não desenha backdrop-filter; e2e do Firefox vira evidência automática (cabecalho-firefox-e2e.txt); passo 5 com top negativo para o cabeçalho colar na topbar; critério e trecho do Chromium atualizados |
