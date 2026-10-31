---
id: TASK-03
spec: SPEC-001
title: "Tema e biblioteca UI"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-02]
wave: 3
covers: []
type: tarefa
labels: [SPEC-001, padrao]
status: done
content_hash: ea5b994bd8c41ed194d0ee5ff5180ac2ac8704ebe868ddceca2811b441b6598e
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: 1785b5763b1711772ace8f9c1a9bb771afb1b3f5658c17eaa5bda8f4c9b98af3
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
---

# TASK-03: Tema e biblioteca UI

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RNF-06 e RNF-10, componentes `packages/theme` e `packages/ui`, premissa dos tokens e fora do escopo (extração dos pacotes para a organização).
- `prototype/atria-prototype.html`: protótipo validado na TASK-01; os componentes reproduzem os botões, campos, cartões, selos, abas, estados vazio, carregando e erro, barra de ferramentas e cabeçalho de página dele.
- `../org/docs/identidade-ecossistema.md`: tokens da revisão 2026-10 (cores dos dois temas, `elevation`, `shadows`, `motion`, `gradients`, `radii`, `space`), contraste medido, regra do `textFaint`, `paletteFor` e tipografia.
- `../translunar/src/translunar/panel/static/tokens.css`: os mesmos tokens escritos como variáveis CSS em `kebab-case`.
- `../translunar/src/translunar/panel/static/fonts/`: `InterVariable.woff2`, `Outfit-Variable.ttf`, `OFL-Inter.txt` e `OFL-Outfit.txt`.
- `../nebula/packages/theme/package.json` e `../nebula/packages/theme/src/index.ts`: referência de pacote de tema no ecossistema.
- `package.json` e `pnpm-workspace.yaml`: workspace criado na TASK-02.
- `vostok/rules/project/architecture.md` ([project/architecture-08], [project/architecture-09]), `frontend.md`, `code-style.md` ([project/code-style-01], [project/code-style-09], [project/code-style-10]), `testing.md` ([project/testing-04], [project/testing-10]), `stack.md` ([project/stack-09], [project/stack-12]), `naming-convention.md` e `language.md` ([project/language-06]).

### Mudar

- `packages/theme/package.json` (criar): pacote `@atria/theme`, com `exports` de `.`, `./tokens.css` e `./fonts.css` e os scripts `lint`, `typecheck` e `test`.
- `packages/theme/tsconfig.json` (criar): TypeScript `strict`.
- `packages/theme/eslint.config.js` (criar): ESLint com `typescript-eslint`, sem warnings.
- `packages/theme/src/tokens.ts` (criar): fonte única dos tokens (`light`, `dark`, `radii`, `space`, `motion`, `gradients`, `fonts`, `breakpoints`).
- `packages/theme/src/tokens.css` (criar): os tokens como variáveis CSS em `kebab-case` nos dois temas, com o comentário de origem.
- `packages/theme/src/fonts.css` (criar): `@font-face` de Inter e Outfit servidas pelo app, com `font-display: swap`.
- `packages/theme/src/palette.ts` (criar): `artPalettes` e `paletteFor`, a cor determinística por item ([project/frontend-11]).
- `packages/theme/src/contrast.ts` (criar): cálculo da razão de contraste do WCAG 2.
- `packages/theme/src/index.ts` (criar): exportações públicas do pacote.
- `packages/theme/src/tokens.test.ts` (criar): o CSS espelha o TypeScript e os dois temas têm as mesmas chaves.
- `packages/theme/src/contrast.test.ts` (criar): pares de texto e fundo em AA nos dois temas.
- `packages/theme/src/palette.test.ts` (criar): a cor por id é determinística.
- `packages/theme/fonts/InterVariable.woff2` (criar): fonte Inter variável.
- `packages/theme/fonts/Outfit-Variable.ttf` (criar): fonte Outfit variável.
- `packages/theme/fonts/OFL-Inter.txt` (criar): licença OFL da Inter.
- `packages/theme/fonts/OFL-Outfit.txt` (criar): licença OFL da Outfit.
- `packages/ui/package.json` (criar): pacote `@atria/ui`, com React como `peerDependency` e os scripts `lint`, `typecheck` e `test`.
- `packages/ui/tsconfig.json` (criar): TypeScript `strict` com JSX.
- `packages/ui/eslint.config.js` (criar): ESLint com `typescript-eslint`, `react-hooks` e `jsx-a11y`, sem warnings.
- `packages/ui/vitest.config.ts` (criar): Vitest com `jsdom` e o arquivo de preparação.
- `packages/ui/src/test/setup.ts` (criar): `@testing-library/jest-dom`, `vitest-axe` e o complemento de `HTMLDialogElement` para o jsdom.
- `packages/ui/src/index.ts` (criar): exportações públicas dos componentes.
- `packages/ui/src/button/button.tsx` (criar): `Button`, com as variantes `primary`, `secondary` e `ghost`.
- `packages/ui/src/icon-button/icon-button.tsx` (criar): `IconButton`, com `aria-label` obrigatório.
- `packages/ui/src/text-field/text-field.tsx` (criar): `TextField`, com rótulo, ajuda e erro com `role="alert"`.
- `packages/ui/src/select-field/select-field.tsx` (criar): `SelectField`, com rótulo e erro.
- `packages/ui/src/checkbox/checkbox.tsx` (criar): `Checkbox` com rótulo.
- `packages/ui/src/card/card.tsx` (criar): `Card` na camada `elevation-1`.
- `packages/ui/src/badge/badge.tsx` (criar): `Badge` com os tons de estado sobre o fundo `*-soft`.
- `packages/ui/src/tabs/tabs.tsx` (criar): `Tabs` com o padrão de abas do WAI-ARIA e navegação por setas.
- `packages/ui/src/confirm-dialog/confirm-dialog.tsx` (criar): `ConfirmDialog`, único modal, para confirmação ([project/architecture-10]).
- `packages/ui/src/toast/toast.tsx` (criar): `ToastRegion` e `Toast`, com `aria-live`.
- `packages/ui/src/empty-state/empty-state.tsx` (criar): `EmptyState`, com título e texto explicativo.
- `packages/ui/src/loading-state/loading-state.tsx` (criar): `LoadingState` e `Skeleton`, com `aria-busy`.
- `packages/ui/src/error-state/error-state.tsx` (criar): `ErrorState`, com ação de tentar de novo.
- `packages/ui/src/page-header/page-header.tsx` (criar): `PageHeader`, com eyebrow, `page-heading` e subtítulo ([project/frontend-07]).
- `packages/ui/src/toolbar/toolbar.tsx` (criar): `Toolbar`, com busca, filtros e o seletor de visualização.
- `packages/ui/src/view-switcher/view-switcher.tsx` (criar): `ViewSwitcher`, botões com `aria-pressed`.
- `packages/ui/src/progress-bar/progress-bar.tsx` (criar): `ProgressBar` com `role="progressbar"`.
- `packages/ui/src/item-swatch/item-swatch.tsx` (criar): `ItemSwatch`, gradiente determinístico pelo id.
- `packages/ui/src/<componente>/<componente>.module.css` (criar): um arquivo de estilo por componente acima, só com tokens.
- `packages/ui/src/<componente>/<componente>.test.tsx` (criar): um teste por componente acima, com Testing Library e axe.

### Passos

1. Leia os arquivos de "Ler". Confira as versões estáveis mais recentes com `npm view <pacote> version` para cada dependência abaixo e use-as com `^`. Dependências novas e a justificativa de cada uma ([project/stack-12]), a registrar também em "Detalhes técnicos" se mudar alguma:
   - `react` e `react-dom` 19 (peer e dev em `@atria/ui`): stack do frontend ([project/stack-01]).
   - `typescript`, `eslint`, `typescript-eslint`, `prettier` (dev nos dois pacotes): [project/code-style-01].
   - `eslint-plugin-react-hooks` e `eslint-plugin-jsx-a11y` (dev em `@atria/ui`): regras de hooks e de acessibilidade estáticas (RNF-06).
   - `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` (dev): [project/testing-04].
   - `vitest-axe` e `axe-core` (dev em `@atria/ui`): [project/testing-10].
   - `@types/react` e `@types/react-dom` (dev em `@atria/ui`).
2. Crie a estrutura de `packages/theme`: `package.json` com `"name": "@atria/theme"`, `"private": true`, `"type": "module"`, `"license": "AGPL-3.0-only"`, `"exports": { ".": "./src/index.ts", "./tokens.css": "./src/tokens.css", "./fonts.css": "./src/fonts.css" }`, `"files": ["src", "fonts"]`, os scripts `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint . --max-warnings 0 && prettier --check ."` e a chave `"prettier": { "singleQuote": true, "printWidth": 100 }`; `tsconfig.json` com `strict`, `noUncheckedIndexedAccess`, `module` e `moduleResolution` `bundler`, `target` `ES2022`, `noEmit`; `eslint.config.js` com `typescript-eslint` `strictTypeChecked`. Copie as quatro fontes e licenças de `../translunar/src/translunar/panel/static/fonts/` para `packages/theme/fonts/`.
3. Escreva os testes do tema antes do código:
   - `src/tokens.test.ts`: `describe('tokens')` com `it('light and dark have the same keys')`, `it('tokens.css mirrors tokens.ts in both themes')` (lê `tokens.css` com `node:fs`, extrai cada `--nome: valor` dos blocos `:root, [data-theme="light"]` e `[data-theme="dark"]` e compara com `light` e `dark` convertendo `camelCase` para `kebab-case`, ex.: `surfaceMuted` ↔ `--surface-muted`) e `it('motion durations never exceed 320 ms')`.
   - `src/contrast.test.ts`: `describe('contrast')` com um `it` por par da tabela "Contraste medido" de `identidade-ecossistema.md`, nomeado `'<tema>: <texto> on <fundo> >= 4.5'` (ex.: `'light: primary on primarySoft >= 4.5'`), e `it('textFaint is below 4.5 and only decorative')`, que documenta que `textFaint` fica abaixo de 4,5:1 e acima de 3:1.
   - `src/palette.test.ts`: `describe('paletteFor')` com `it('returns the same pair for the same seed')` e `it('returns a pair from artPalettes')`.
   Rode `pnpm install` na raiz e `pnpm --filter @atria/theme test` e confirme que falham por falta dos módulos.
4. Escreva `src/tokens.ts` com os valores da revisão 2026-10 (mesmos nomes do bloco `packages/theme/src/tokens.ts` do documento de identidade, com `elevation1` a `elevation3` e `shadowSm`, `shadowMd` e `shadowLg` dentro de `light` e `dark`), `radii`, `space`, `motion` (`fast`, `base`, `slow` e `ease`), `gradients` (`brand`, `deep`, `calm`), `fonts` (`display` e `body`, com as pilhas do documento) e `breakpoints = { md: 720, sm: 480, min: 360 }` ([project/frontend-17]), todos `as const` e com um comentário no topo apontando `Ishtar-Sink/.github` `docs/identidade-ecossistema.md` como origem.
5. Escreva `src/tokens.css` com o mesmo comentário de origem no topo, o bloco `:root, [data-theme="light"]` e o bloco `[data-theme="dark"]` com cada token em `kebab-case` (igual ao `tokens.css` do Translunar), e um bloco `:root` com as escalas: `--radius-sm` a `--radius-pill`, `--space: 4px`, `--brand-gradient`, `--font-display`, `--font-body`, `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 320ms`, `--motion-ease-standard`, `--motion-ease-enter`, `--motion-ease-exit` e `--motion-ease-linear`. Acrescente `@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-base: 0ms; --motion-slow: 0ms; } }` ([project/frontend-04]).
6. Escreva `src/fonts.css` com `@font-face` de `Inter` (`url('../fonts/InterVariable.woff2') format('woff2')`) e `Outfit` (`url('../fonts/Outfit-Variable.ttf') format('truetype')`), `font-weight: 100 900`, `font-style: normal` e `font-display: swap` ([project/frontend-03]). As URLs são relativas para o Vite empacotar as fontes no build do app, sem CDN ([project/stack-09]).
7. Escreva `src/palette.ts` com `artPalettes` e `paletteFor` exatamente como no documento de identidade, `src/contrast.ts` com `relativeLuminance(hex)` e `contrastRatio(foreground, background)` pela fórmula do WCAG 2, e `src/index.ts` exportando `light`, `dark`, `radii`, `space`, `motion`, `gradients`, `fonts`, `breakpoints`, `artPalettes`, `paletteFor` e `contrastRatio`, e os tipos `ThemeName = 'light' | 'dark'` e `ThemeTokens`. Rode `pnpm --filter @atria/theme test` até passar.
8. Crie a estrutura de `packages/ui`: `package.json` com `"name": "@atria/ui"`, `"private": true`, `"type": "module"`, `"license": "AGPL-3.0-only"`, `"exports": { ".": "./src/index.ts" }`, `"sideEffects": ["**/*.css"]`, `"dependencies": { "@atria/theme": "workspace:*" }`, `"peerDependencies"` com `react` e `react-dom`, os mesmos scripts e a mesma chave `prettier` do tema; `tsconfig.json` com as opções do tema mais `"jsx": "react-jsx"` e `"types": ["vitest/globals"]`; `eslint.config.js` com `typescript-eslint` `strictTypeChecked`, `react-hooks` e `jsx-a11y` `recommended`; `vitest.config.ts` com `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']` e `css: { modules: { localsConvention: 'camelCaseOnly' } }`; `src/test/setup.ts` importando `@testing-library/jest-dom/vitest`, estendendo `expect` com os matchers de `vitest-axe` e definindo `HTMLDialogElement.prototype.showModal` e `close` quando o jsdom não os tiver.
9. Para cada componente da lista "Mudar", escreva primeiro `<componente>.test.tsx`, com `describe('<NomeDoComponente>')` e, em todos, `it('has no axe violations')` (`expect(await axe(container)).toHaveNoViolations()`), mais os casos de comportamento:
   - `Button`: `it('renders the variant class')`, `it('is disabled with aria-disabled when loading')`.
   - `IconButton`: `it('exposes the aria-label')`, ícone com `aria-hidden="true"`.
   - `TextField` e `SelectField`: `it('associates the label with the control')`, `it('shows the error with role alert and aria-invalid')`.
   - `Checkbox`: `it('toggles with the keyboard')`.
   - `Tabs`: `it('moves focus with arrow keys')`, `it('activates the tab on Enter')`.
   - `ConfirmDialog`: `it('traps focus and closes on Escape')`, `it('returns focus to the trigger')`, `role="alertdialog"`.
   - `ToastRegion` e `Toast`: `it('announces with aria-live polite')`, `it('uses the soft background of the tone')`.
   - `EmptyState`, `LoadingState` e `ErrorState`: `it('renders title and explanation')`, `it('marks the region as busy')` e `it('calls onRetry')`.
   - `PageHeader`: `it('renders eyebrow, heading and subtitle')`, com `h1`.
   - `Toolbar` e `ViewSwitcher`: `it('marks the active view with aria-pressed')`, `it('calls onSearchChange')`.
   - `ProgressBar`: `it('exposes aria-valuenow, min and max')`, `it('clamps the value to 100')`.
   - `ItemSwatch`: `it('uses paletteFor for the same id')`.
   - `Card` e `Badge`: `it('renders children')` e `it('maps each tone to the soft background')`.
10. Implemente cada componente como função React sem regra de negócio ([project/code-style-09], [project/architecture-08]), exportada em `PascalCase` de um arquivo em `kebab-case` ([project/naming-convention-09]), com estilos só no `<componente>.module.css` e só com tokens `var(--...)` e `calc(var(--space) * n)` ([project/code-style-10]): nenhuma cor, raio, espaço ou duração literal; as únicas medidas literais aceitas são `0`, `1px` e `2px` em bordas e contorno de foco. Nenhum texto literal visível nos componentes: todo rótulo, título e mensagem chega por props ([project/language-06]). Regras visuais: `:focus-visible` com contorno de `2px` na cor `--primary`; transições só com `var(--motion-*)`; fundo de estado sempre `--<tom>-soft` com texto na cor cheia do tom ([project/frontend-02]); `--text-faint` só em ícone inerte ou divisor; `Badge` tem os tons `neutral`, `primary`, `accent`, `success`, `warning`, `danger` e `info`, e `warning`, não `danger`, é o tom indicado para uma pendência comum ([project/frontend-14]); títulos com `--font-display` e corpo com `--font-body`, conforme a tipografia do documento. Exporte todos de `src/index.ts`.
11. Rode `pnpm --filter @atria/ui test` até passar, depois `pnpm --filter @atria/theme lint`, `pnpm --filter @atria/ui lint`, `pnpm --filter @atria/theme typecheck` e `pnpm --filter @atria/ui typecheck`, corrigindo até zero warnings.
12. Rode o bloco de "Verificação" até terminar sem erro.

### Baseline

- `test -e packages/theme && echo "packages/theme existe" || echo "packages/theme ausente"`
- `test -e packages/ui && echo "packages/ui existe" || echo "packages/ui ausente"`

### Verificação

```bash
pnpm install
pnpm --filter @atria/theme test
pnpm --filter @atria/theme typecheck
pnpm --filter @atria/theme lint
pnpm --filter @atria/ui test
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui lint

# Fontes servidas pelo próprio app, com a licença ao lado.
for f in InterVariable.woff2 Outfit-Variable.ttf OFL-Inter.txt OFL-Outfit.txt; do
  test -s "packages/theme/fonts/$f" || { echo "FALHA: fonte ausente: $f"; exit 1; }
done
grep -q "font-display: swap" packages/theme/src/fonts.css
if grep -nE "https?://" packages/theme/src/fonts.css; then echo "FALHA: fonte externa"; exit 1; fi

# Comentário de origem dos tokens.
head -3 packages/theme/src/tokens.css | grep -q "identidade-ecossistema.md"

# Estilos dos componentes só com tokens: sem cor, duração ou medida literal (fora 0, 1px e 2px).
if grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|[0-9.]+m?s\b|\b([3-9]|[1-9][0-9]+)px|[0-9.]+rem" packages/ui/src --include='*.module.css'; then
  echo "FALHA: valor literal em estilo de componente"; exit 1
fi
echo "verificação da TASK-03 ok"
```

Resultado esperado: código 0, os testes dos dois pacotes passam e a última linha é `verificação da TASK-03 ok`.

### Evidências

- `theme-tests.txt` (automática): `pnpm --filter @atria/theme exec vitest run --reporter=verbose 2>&1 | grep -E "✓|×|Test Files|Tests "`
  - Prova: os tokens CSS espelham a fonte TypeScript, os pares de texto e fundo passam em AA nos dois temas e a cor por item é determinística (RNF-06, RNF-10).
  - Trecho: as linhas `✓ ... tokens.css mirrors tokens.ts in both themes`, `✓ ... light: primary on primarySoft >= 4.5`, `✓ ... dark: primary on primarySoft >= 4.5` e `Tests  N passed`.
  - Falha: `×` em algum teste, `Tests  N failed` ou `No projects matched the filters` (pacote inexistente).
- `ui-tests.txt` (automática): `pnpm --filter @atria/ui exec vitest run --reporter=verbose 2>&1 | grep -E "✓|×|Test Files|Tests "`
  - Prova: cada componente genérico funciona por teclado, tem os estados vazio, carregando e erro e não tem violações no axe (RNF-06).
  - Trecho: uma linha `✓ ... has no axe violations` por componente, `✓ ConfirmDialog > traps focus and closes on Escape` e `Test Files  N passed`.
  - Falha: `×`, `failed` ou `No projects matched the filters`.
- `ui-exports.txt` (automática): `grep -oE "export \{ [A-Za-z, ]+ \}|export \* from '[^']+'" packages/ui/src/index.ts`
  - Prova: a biblioteca expõe os componentes genéricos usados pelas features ([project/architecture-08]).
  - Trecho: uma linha por componente, de `Button` a `ItemSwatch`.
  - Falha: saída vazia ou erro de arquivo inexistente.

### Concluída quando

- [x] Os tokens do ecossistema (revisão 2026-10) existem em TypeScript e como variáveis CSS em `kebab-case` nos dois temas, com o comentário de origem, e o CSS espelha o TypeScript ([project/architecture-09], RNF-10).

  > Como comprovar: em `theme-tests.txt`, ver `✓ ... tokens.css mirrors tokens.ts in both themes`; abrir `packages/theme/src/tokens.css` e ver no topo a referência a `identidade-ecossistema.md`.

- [x] Todos os pares de texto e fundo da tabela de contraste do ecossistema passam em AA, e `textFaint` fica marcado como decorativo (RNF-06).

  > Como comprovar: em `theme-tests.txt`, ver um `✓` por par (`>= 4.5`) e `✓ ... textFaint is below 4.5 and only decorative`.

- [x] As fontes Inter e Outfit são servidas pelo app, com `font-display: swap` e as licenças OFL ao lado ([project/stack-09], [project/frontend-03]).

  > Como comprovar: ver os quatro arquivos em `packages/theme/fonts/` e, em `fonts.css`, `font-display: swap` e nenhuma URL externa (a "Verificação" confere).

- [x] A biblioteca tem os componentes genéricos com os estados vazio, carregando e erro, navegáveis por teclado e sem violações no axe (RNF-06, [project/testing-10]).

  > Como comprovar: em `ui-tests.txt`, ver `✓ ... has no axe violations` para cada componente e `Test Files  N passed` sem falhas.

- [x] Os estilos dos componentes usam só tokens e respeitam `prefers-reduced-motion` ([project/code-style-10], [project/frontend-04]).

  > Como comprovar: a "Verificação" não acha cor, duração nem medida literal nos `.module.css`; abrir `tokens.css` e ver as durações zeradas em `prefers-reduced-motion: reduce`.

- [x] Lint e typecheck dos dois pacotes passam sem nenhum warning ([project/code-style-01]).

  > Como comprovar: rodar a "Verificação" e ver `verificação da TASK-03 ok` no fim.

## Descrição

### Resumo executivo

Cria a base visual do Atria: as cores, fontes e medidas oficiais do ecossistema e a biblioteca de peças de tela reutilizáveis.
Toda tela do produto passa a ter a mesma aparência, nos temas claro e escuro, com contraste e uso por teclado garantidos por testes automáticos.
Perfil de execução padrao: decisões locais de componente, dentro da identidade já definida.
Risco baixo; o principal cuidado é não divergir dos valores oficiais da identidade.
Desbloqueia a base do frontend (TASK-05) e, por ela, todas as telas.

### Detalhes técnicos

**Abordagem.** Dois pacotes do workspace pnpm. `@atria/theme` tem a fonte única dos tokens em TypeScript (`tokens.ts`), o espelho em CSS (`tokens.css`, com `data-theme`), as fontes com licença e utilitários (`paletteFor`, `contrastRatio`). `@atria/ui` tem os componentes React genéricos, sem regra de negócio e sem texto literal, prontos para a extração futura para a organização ([project/architecture-08]). Os dois pacotes são consumidos pelo código-fonte (`exports` apontando para `src`), compilados pelo Vite do app.

**Componentes.** `packages/theme` e `packages/ui`.

**Decisões.**
- `tokens.css` escrito à mão e conferido contra `tokens.ts` por teste. Descartado: gerar o CSS por script de build, que acrescentaria um passo de geração a todo consumidor para um arquivo que muda raramente; o teste garante que os dois não divergem.
- CSS Modules por componente (`<componente>.module.css`). Descartado: CSS-in-JS (dependência e custo em tempo de execução, pior no Lighthouse) e Tailwind (redeclararia a escala de cores e espaços fora de `packages/theme`, contra [project/architecture-09]).
- `ConfirmDialog` sobre o `<dialog>` nativo, com foco preso e Esc do navegador. Descartado: biblioteca de diálogo, desnecessária para o único modal permitido ([project/architecture-10]).
- `breakpoints` como constantes em `tokens.ts`, porque variáveis CSS não funcionam em media queries; os valores vêm de [project/frontend-17].
- Contraste testado com a fórmula do WCAG 2 sobre os pares do documento de identidade. Descartado: confiar só no axe, que não avalia os pares do tema escuro sem renderização real.
- Exceção às medidas literais só para `0`, `1px` e `2px` (borda e contorno de foco), porque o ecossistema não tem token de espessura; a verificação aceita só essas.
- Dependências novas e justificativas no passo 1 ([project/stack-12]).

**Riscos técnicos.** O documento de identidade cita o Atria como "legado" da paleta anterior: aqui já se adotam os valores da revisão 2026-10, os mesmos do Translunar. O jsdom não implementa `showModal`, por isso o complemento em `src/test/setup.ts`. A primeira instalação gera o `pnpm-lock.yaml` na raiz, um artefato do pnpm.

**Referências da spec.** RNF-06, RNF-10; componentes `packages/theme` e `packages/ui`; premissa dos tokens e do Translunar como referência; fora do escopo: extração dos pacotes. A tarefa não cobre RF nem CT (coluna "Cobre" vazia).

**Arquivos em comum na onda 3.** Nenhum: a TASK-04, da mesma onda, só mexe em `apps/server`.

### Card

- **Título:** Tema e biblioteca UI
- **Tipo:** tarefa
- **Descrição:** Pacote de tema com os tokens oficiais do ecossistema e as fontes servidas pelo app, e biblioteca de componentes genéricos acessíveis, com os estados vazio, carregando e erro.
- **Critérios de aceite:**
  - [ ] Tokens do ecossistema em TypeScript e CSS, nos temas claro e escuro, com contraste AA testado.
  - [ ] Fontes Inter e Outfit servidas pelo app, com licença.
  - [ ] Componentes genéricos sem regra de negócio, navegáveis por teclado e sem violações no axe.
  - [ ] Estilos só com tokens, respeitando movimento reduzido.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-02

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: Usuário aceitou [1] e [2]: as pastas criadas são a entrega da tarefa; aceito(s): 1, 2 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 2 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | passed | 3 evidência(s) em evidence/TASK-03/ |
| 9 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
