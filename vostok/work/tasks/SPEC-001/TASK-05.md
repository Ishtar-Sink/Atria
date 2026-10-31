---
id: TASK-05
spec: SPEC-001
title: "Base do frontend"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-03]
wave: 4
covers: [RF-14, CT-11]
type: tarefa
labels: [SPEC-001, padrao]
status: done
content_hash: 136adae941ef39bd185a84d6e9b8f0a602519cf9385d29fbd612e32415ebe118
adjustments: 8
adjusted_at: 2026-10-30T23:43:12Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 0fa26b5c90c73a83c55e682c2be9325344f6dbd147d369ca046fe0095ecc3163
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T23:43:12Z
---

# TASK-05: Base do frontend

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-14, CT-11, RNF-05, RNF-06, RNF-08, RNF-09, RNF-10, fluxo FA-04, decisões 16, 32, 39, 48, 49, 53, 54, 56 e 57.
- `prototype/atria-prototype.html`: layout validado na TASK-01 (sidebar, topbar com o gatilho da busca e a dica do atalho, breadcrumbs, informações da tela, cabeçalho de página, gaveta em 720 px, alternar tema) e, pelas decisões do protótipo, o menu do perfil (`openProfileMenu`, `#profile-menu`), o "Mais ações" (`more-menu`), o "Voltar" (`.back-link`), o cabeçalho fixo que compacta, o seletor próprio (`enhanceSelects`, `.cs-trigger`, `.cs-pop`), o grupo segmentado (`.seg-radio`), o calendário (`renderCal`, `enhanceDates`, `#date-pop`), o campo de hora (`data-dt-time`, `.time-field`), as etiquetas em pills (`tagAdd`, `.tag-pills`), a grade do formulário (`.screen-form .form`, `.span-2`, `.form-actions`) os campos numéricos sem setas (`input[type="number"]`), o seletor de cor (`openColorPicker`, `drawWheel`, `syncPicker`, `wireColorPicker`, `#color-dialog`, `.color-trigger`) as variações de botão `.btn-muted` (inclusive `.lane .btn-muted`) e `.btn-success` e o seletor de período (`RANGE_PRESETS`, `finRange`, `rangeOpener`, `rangeForm`, `setRangeField`, `DO['range-open']`, `#range-pop`, `.range-presets`, `.range-trigger`).
- `docs/decisoes-do-prototipo.md`: linhas PD-02, PD-03, PD-11, PD-12, PD-14, PD-18 a PD-24, PD-55, PD-57, PD-61 e PD-62, e a seção "Decisões resolvidas em 30/10 (DEC-002)". As decisões valem sobre o texto antigo desta tarefa.
- Memória, por `vostok memory search decision DEC-002 DEC-003 DEC-004`: DEC-002 (as decisões do protótipo valem já, nas tarefas de servidor e nas telas), DEC-003 e DEC-004 (contexto das tarefas de servidor ajustadas; nenhuma muda a base do frontend).
- `vostok/work/tasks/SPEC-001/TASK-06.md`: contrato de `GET /me`, usado pelo rodapé da sidebar (PD-23).
- `vostok/work/tasks/SPEC-001/TASK-07.md` e `TASK-17.md`: período por `from` e `to` (sem os dois, desde a primeira movimentação, DEC-004), que as telas montam a partir do valor do seletor de período.
- `packages/theme/src/index.ts`, `packages/theme/src/tokens.css`, `packages/theme/src/fonts.css`: tokens, fontes e `breakpoints` da TASK-03, e `paletteFor` (gradiente das iniciais do perfil, PD-23).
- `prototype/atria-prototype.html` (CSS das linhas 201 a 812 e a marca na linha 817): fonte da fidelidade visual pedida pelo usuário (`:root` claro e escuro, `.brand-mark`, `.brand-name`, `.nav-item`, `.topbar`, `.search-trigger`, `.crumbs`, `.page-header`, `.back-link`, `.btn`, `.field`, `.form.card`, `.screen-form`, `.form-actions`, `a`), e `packages/theme/src/tokens.test.ts`, que passa a conferir os tokens contra o protótipo.
- `packages/ui/src/index.ts`: componentes genéricos da TASK-03 (`PageHeader`, `IconButton`, `ToastRegion`, `EmptyState`, `ErrorState`, `LoadingState`, `Button`, `TextField`, `SelectField`, `Checkbox`). O `SelectField` da TASK-03 é um `<select>` nativo e não tem uso no app; `packages/ui` não tem seletor próprio, grupo segmentado, campo de hora, calendário, campo de data, etiquetas em pills, menu de ações, grade de formulário, seletor de cor nem as variações de botão `muted` e `success`: esta tarefa os cria (PD-02, PD-03, PD-11, PD-12, PD-14, PD-23, PD-57, PD-62).
- `packages/ui/src/select-field/`, `packages/ui/src/text-field/`, `packages/ui/src/page-header/` e `packages/ui/src/button/button.tsx`: estado atual dos componentes que esta tarefa altera ou usa (variação `ghost` para o "Cancelar", PD-62).
- `package.json`, `pnpm-workspace.yaml` e `lighthouserc.json`: workspace e Lighthouse CI da TASK-02.
- `apps/server/src/http/csrf.rs` e `apps/server/src/shared/error.rs`, quando existirem (TASK-04): nome do cookie `atria_csrf`, cabeçalho `X-CSRF-Token` e formato `application/problem+json`. Se ainda não existirem, use esses nomes, que são o contrato da TASK-04.
- `vostok/rules/project/frontend.md`, `stack.md` ([project/stack-01], [project/stack-06] a [project/stack-09], [project/stack-12]), `architecture.md` ([project/architecture-07], [project/architecture-10], [project/architecture-11], [project/architecture-12]), `code-style.md`, `testing.md` ([project/testing-04], [project/testing-10]), `language.md` ([project/language-06]), `naming-convention.md` e `api.md` ([project/api-02], [project/api-03]).
- `../translunar/src/translunar/panel/static/index.html`: referência de estrutura da sidebar e do cabeçalho.
- Memória, por `vostok memory search decision DEC-008`: DEC-008 (a preferência `create_layout`, o editor da regra de recorrência e o diálogo de escolha do tipo ficam nesta base; as telas da onda 7 importam daqui).
- `vostok/work/specs/refined/SPEC-001-mvp.md` (contrato "Regra de recorrência") e `vostok/work/tasks/SPEC-001/TASK-22.md`, `TASK-24.md` e `TASK-25.md` (o `recurrence-fields.tsx` de cada uma: campos, ordem, rótulos e ajudas, que o editor único da base reúne).
- `prototype/atria-prototype.html` (PD-09 e PD-10: `openCreateDialog`, `CREATE_CHOICES`, `#create-dialog`, `.create-choices` e `.create-choices.as-list`, `prefs.create_layout`) e `docs/decisoes-do-prototipo.md` (PD-09 e PD-10).
- `apps/web/src/shared/preferences/preferences-context.tsx`, `apps/web/src/shared/session/current-user.ts`, `apps/web/src/shared/forms/form-fields.tsx`, `apps/web/src/app/providers.tsx` e `packages/ui/src/confirm-dialog/confirm-dialog.tsx`: estado atual do que o ajuste 5 altera ou imita (foco devolvido ao gatilho, Esc).

### Mudar

- `apps/web/package.json` (criar): pacote `@atria/web`, com as dependências de todas as features (inclusive `pdfjs-dist`, `@playwright/test` e `@axe-core/playwright`, porque nenhuma feature altera este arquivo) e os scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint` e `e2e`.
- `apps/web/tsconfig.json` (criar): TypeScript `strict` com JSX e os tipos do Vite e do Vitest.
- `apps/web/eslint.config.js` (criar): ESLint com `typescript-eslint`, `react-hooks` e `jsx-a11y`, sem warnings, ignorando a pasta `scripts`.
- `apps/web/vite.config.ts` (criar): Vite com React, proxy de `/api` para o servidor local, build sem script inline e a configuração do Vitest.
- `apps/web/playwright.config.ts` (criar): Playwright com `testMatch` cobrindo `src/**/*.e2e.ts` e os tamanhos 360, 480, 720 e desktop.
- `apps/web/index.html` (criar): página de entrada com `lang="pt-BR"` e `data-theme="light"`.
- `apps/web/src/main.tsx` (criar): inicialização do React, do TanStack Router e do TanStack Query.
- `apps/web/src/app` (criar): pasta do app, ponto de integração (roteador raiz, registro de rotas e navegação, provedores, layout com sidebar e topbar, tema); os arquivos abaixo.
- `apps/web/src/app/router.tsx` (criar): rota raiz com o layout e `createAppRouter`, que recebe as rotas registradas.
- `apps/web/src/app/routes.ts` (criar): registro das rotas das features, vazio até a TASK-35.
- `apps/web/src/app/nav.ts` (criar): registro dos itens da sidebar, vazio até a TASK-35.
- `apps/web/src/app/providers.tsx` (criar): `QueryClientProvider`, i18n, preferências, tema e região de avisos.
- `apps/web/src/app/global.css` (criar): base do documento com os tokens e as fontes de `@atria/theme`.
- `apps/web/src/app/layout/app-layout.tsx` (criar): `AppLayout` com sidebar, topbar e área da página.
- `apps/web/src/app/layout/sidebar.tsx` (criar): `Sidebar` com a marca, `<nav aria-label="Principal">` e o rodapé com alternar tema e sair.
- `apps/web/src/app/layout/topbar.tsx` (criar): `Topbar` com o gatilho da busca e a dica do atalho, os breadcrumbs e as informações da tela.
- `apps/web/src/app/layout/breadcrumbs.tsx` (criar): `Breadcrumbs` a partir das rotas ativas.
- `apps/web/src/app/layout/not-found-page.tsx` (criar): página de rota inexistente, com `PageHeader` e `EmptyState`.
- `apps/web/src/app/layout/app-layout.module.css` (criar): estilos do layout, só com tokens, com quebras em 720 px e 480 px.
- `apps/web/src/app/layout/app-layout.test.tsx` (criar): testes do layout (CT-11) com axe.
- `apps/web/src/app/theme/theme-provider.tsx` (criar): `ThemeProvider` e `useTheme`, com `data-theme`, escolha salva e `prefers-color-scheme`.
- `apps/web/src/app/theme/theme-provider.test.tsx` (criar): testes do tema.
- `apps/web/src/shared` (criar): pasta do código comum das features; os arquivos abaixo.
- `apps/web/src/shared/api/client.ts` (criar): cliente HTTP genérico sobre `fetch`, tipado por parâmetro, com CSRF e erros `problem+json`, sem importar `@atria/contracts`.
- `apps/web/src/shared/api/problem.ts` (criar): `ApiProblem`, o erro `problem+json` com código estável.
- `apps/web/src/shared/api/query-client.ts` (criar): `createQueryClient` com os padrões de repetição.
- `apps/web/src/shared/api/client.test.ts` (criar): testes do cliente.
- `apps/web/src/shared/optimistic/use-optimistic-mutation.ts` (criar): mutação otimista que aplica na hora e desfaz com aviso na recusa (RNF-09).
- `apps/web/src/shared/optimistic/use-optimistic-mutation.test.tsx` (criar): teste simulando a recusa do servidor.
- `apps/web/src/shared/toast/toast-store.ts` (criar): fila de avisos e `useToast`.
- `apps/web/src/shared/i18n/i18n.tsx` (criar): `I18nProvider`, `useT` e `registerMessages`, com interpolação e plural por `Intl.PluralRules`.
- `apps/web/src/shared/i18n/pt-br.json` (criar): textos comuns (layout, ações, estados, erros por código).
- `apps/web/src/shared/i18n/i18n.test.tsx` (criar): testes da tradução.
- `apps/web/src/shared/format/intl.ts` (criar): formatação de moeda, número, porcentagem, data e hora com `Intl`, no locale e fuso do usuário.
- `apps/web/src/shared/format/intl.test.ts` (criar): testes da formatação.
- `apps/web/src/shared/preferences/preferences-context.tsx` (criar): locale, fuso, moeda e atalho da paleta do usuário, com padrões `pt-BR`, `America/Sao_Paulo`, `BRL` e `mod+k`.
- `apps/web/src/shared/navigation/nav-item.ts` (criar): tipo `NavItem` usado pelo `nav.ts` de cada feature.
- `apps/web/src/shared/navigation/route-meta.ts` (criar): tipo de `staticData` das rotas (chave do título e da trilha).
- `apps/web/src/shared/layout/screen-info.tsx` (criar): `ScreenInfoProvider` e `useScreenInfo`, para a página informar o que a topbar mostra.
- `apps/web/src/shared/command-palette/palette-store.ts` (criar): `openCommandPalette`, `closeCommandPalette` e `useCommandPaletteOpen`, usados pela topbar e pela paleta da TASK-32.
- `apps/web/src/shared/url-state/use-list-search.ts` (criar): filtros, busca e visualização das listagens na URL, com `zod`.
- `apps/web/src/shared/url-state/use-list-search.test.tsx` (criar): testes do estado na URL.
- `apps/web/src/shared/test/setup.ts` (criar): preparação do Vitest (jest-dom, axe, `matchMedia` e `HTMLDialogElement` no jsdom).
- `apps/web/src/shared/test/render.tsx` (criar): `renderWithProviders` com roteador em memória, Query, i18n e tema, para os testes das features.
- `packages/ui/src/select-field/select-field.tsx`, `select-field.module.css` e `select-field.test.tsx` (alterar): o `SelectField` deixa de ser o `<select>` nativo e vira o seletor próprio, um botão com a lista do Atria (PD-62).
- `packages/ui/src/segmented-field/segmented-field.tsx`, `segmented-field.module.css` e `segmented-field.test.tsx` (criar): `SegmentedField`, grupo segmentado de rádios para escolhas obrigatórias de até 3 opções e para a visibilidade (PD-62).
- `packages/ui/src/time-field/parse-time.ts`, `time-field.tsx`, `time-field.module.css` e `time-field.test.tsx` (criar): `parseTime` e `TimeField`, hora em 24 h que aceita "930", "9:30" ou "09:30" (PD-62).
- `packages/ui/src/calendar/calendar.tsx`, `calendar.module.css` e `calendar.test.tsx` (criar): `Calendar`, calendário próprio nos modos de um dia e de intervalo (PD-57).
- `packages/ui/src/date-field/date-field.tsx`, `date-field.module.css` e `date-field.test.tsx` (criar): `DateField`, botão com ícone e a data, que abre o `Calendar` num popover com "Hoje" e "Limpar" (PD-57).
- `packages/ui/src/date-time-field/date-time-field.tsx`, `date-time-field.module.css` e `date-time-field.test.tsx` (criar): `DateTimeField`, o `DateField` e o `TimeField` lado a lado, com o valor `YYYY-MM-DDTHH:mm` (PD-62).
- `packages/ui/src/tag-field/tag-field.tsx`, `tag-field.module.css` e `tag-field.test.tsx` (criar): `TagField`, etiquetas em pills (PD-11).
- `packages/ui/src/menu-button/menu-button.tsx`, `menu-button.module.css` e `menu-button.test.tsx` (criar): `MenuButton`, botão que abre um menu de ações, com item de tom `danger`, usado pelo "Mais ações" (PD-14) e pelo menu do perfil (PD-23).
- `packages/ui/src/form-layout/form-layout.tsx`, `form-layout.module.css` e `form-layout.test.tsx` (criar): `FormGrid` (880 px, duas colunas, uma abaixo de 640 px) e `FormActions` (ações à direita, embaixo de uma linha) (PD-19, PD-62).
- `packages/ui/src/text-field/text-field.module.css` (alterar): campos numéricos sem as setas do navegador (PD-62).
- `packages/ui/src/color-field/color.ts`, `color-picker.tsx`, `color-field.tsx`, `color-field.module.css`, `color.test.ts` e `color-field.test.tsx` (criar): conversões HEX, RGB e HSL, `ColorPicker` (roda de matiz e saturação, luminosidade, campos HEX, RGB e HSL sincronizados e prévia) e `ColorField` (botão com a bolinha e o HEX, que abre o seletor num diálogo e grava um HEX livre) (PD-12).
- `packages/ui/src/button/button.tsx`, `button.module.css` e `button.test.tsx` (alterar): variações `muted` (só texto e ícone, com a cor de matiz opcional) e `success` (verde claro, verde cheio quando ativa) (PD-02, PD-03).
- `packages/ui/src/period-field/period.ts`, `period-field.tsx`, `period-field.module.css`, `period.test.ts` e `period-field.test.tsx` (criar): `resolvePeriod` e `PeriodField`, o seletor de período do Financeiro e dos relatórios, com os presets configuráveis e o intervalo personalizado no `Calendar` (PD-55, PD-57, PD-61).
- `packages/ui/src/test/setup.ts` (alterar): `HTMLCanvasElement.prototype.getContext` falso no jsdom, para a roda de cores (PD-12).
- `packages/ui/src/page-header/page-header.tsx`, `page-header.module.css` e `page-header.test.tsx` (alterar): "Voltar" acima do título (PD-21), título focável sem contorno (PD-22), ações na base do bloco do título (PD-14) e os estados preso e compacto (PD-20).
- `packages/ui/src/index.ts` (alterar): exporta os componentes novos.
- `apps/web/src/app/layout/sidebar.tsx`, `app-layout.tsx`, `app-layout.module.css` e `app-layout.test.tsx` (alterar): rodapé com o perfil e o menu da conta (PD-23), conteúdo com até 1360 px (PD-18), foco no título a cada troca de tela (PD-22) e o cabeçalho fixo (PD-20).
- `apps/web/src/app/layout/route-focus.ts` (criar): `useRouteFocus`, que leva o foco ao título da página a cada troca de rota (PD-22).
- `apps/web/src/shared/session/current-user.ts` (criar): `useCurrentUser`, consulta de `GET /me` para o rodapé da sidebar (PD-23).
- `apps/web/src/shared/layout/sticky-page-header.tsx` e `sticky-page-header.test.tsx` (criar): `StickyPageHeader`, o `PageHeader` preso abaixo da topbar, que compacta depois de 48 px de rolagem (PD-20).
- `apps/web/src/shared/navigation/back-target.ts`, `back-link.tsx` e `back-target.test.tsx` (criar): `rememberListLocation`, `useBackTarget` e `BackLink`, o "Voltar" que leva à última listagem ou dashboard com aba e filtros (PD-21).
- `apps/web/src/shared/url-state/use-list-search.ts` e `use-list-search.test.tsx` (alterar): visualização lembrada por módulo e, quando há abas, por aba (PD-24).
- `apps/web/src/shared/forms/form-fields.tsx` e `form-fields.test.tsx` (criar): ligações dos campos de `@atria/ui` ao `react-hook-form` (`FormSelect`, `FormSegmented`, `FormDate`, `FormTime`, `FormDateTime`, `FormTags`, `FormColor`, `FormPeriod`), usadas pelas telas com formulário (PD-62).
- `apps/web/src/shared/i18n/pt-br.json` (alterar): textos do menu da conta, do "Voltar", do "Mais ações", das ações do formulário e dos campos de data, hora e etiquetas.
- `apps/web/src/app/router.tsx` (alterar): registra a rota `/dev/forms` só no modo de desenvolvimento.
- `apps/web/scripts/evidence-shots.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-shots.mjs layout|forms|prototipo`), em Node sem dependências novas (usa o `@playwright/test` de `apps/web`): sobe o Vite numa porta livre e o encerra no fim, abre o app e o protótipo (`file://`) em 1440 px e em 360 px, nos temas claro e escuro, confere o estado no DOM antes de cada captura (popover visível e dentro da janela, sem rolagem horizontal, hora "09:30"), imprime `ok` ou `FALHA` por verificação e o caminho do PNG, e sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-05/`.
- `apps/web/src/app/dev/forms-preview.tsx` (criar): rota `/dev/forms`, registrada só com `import.meta.env.DEV`, que mostra um formulário de exemplo com todos os campos, para as evidências visuais; fica fora do build.
- `packages/theme/src/tokens.css` e `packages/theme/src/tokens.ts` (alterar): a escala de espaçamento do protótipo (`--s1` a `--s10`, múltiplos de `--space`), que falta nos tokens da TASK-03; os demais tokens (cores claras e escuras, sombras, raios, gradiente, fontes e movimento) já são iguais aos do protótipo.
- `packages/theme/src/prototype-fidelity.test.ts` (criar): lê o bloco `<style>` de `prototype/atria-prototype.html` e confere que todo token do `:root` claro, do `[data-theme="dark"]` e da escala compartilhada existe em `tokens.css` com o mesmo valor (normalizado).
- `packages/ui/src/brand-logo/brand-logo.tsx`, `brand-logo.module.css` e `brand-logo.test.tsx` (criar): `BrandLogo`, a marca do protótipo: `.brand-mark` de 34 px com `--brand-gradient`, `--shadow-md` e `--radius-sm`, o SVG de traço `<path d="M3 20L12 4l9 16"/>` e `<path d="M8 20l4-7 4 7"/>` (viewBox 24, 20 px) e o nome "Atria" em Outfit 22 px, peso 800, `letter-spacing: -0.8px` e texto com o gradiente da marca (`background-clip: text`).
- `apps/web/src/app/layout/sidebar.tsx` (alterar): usa `BrandLogo` no lugar do "A" sólido e do nome preto; itens, hover, ativo e rodapé do perfil iguais ao protótipo.
- `apps/web/src/app/layout/app-layout.module.css`, `topbar.tsx`, `breadcrumbs.tsx` e `app-layout.test.tsx` (alterar): sidebar de 236 px, sem sublinhado nos links (`a { text-decoration: none }`, breadcrumb no `--primary`, separador `/` em `--text-faint`), busca com `min-width: 280px`, "Hoje, dd/mm/aaaa" e rolagem do documento como no protótipo (`main` com `padding: 24px`, `max-width: 1360px`), perfil e menu da conta com as medidas do protótipo.
- `apps/web/src/app/global.css` (alterar): `line-height: 1.5`, `a { text-decoration: none }` com `a:hover` em `--primary-hover`, `h1` a `p` sem margem, `button, input, select, textarea { font: inherit; color: inherit }`, como a base do protótipo.
- `apps/web/src/app/dev/forms-preview.tsx` (alterar): o formulário dentro do cartão (`.form.card`), centralizado em 880 px, com as ações do cabeçalho (Editar e Mais ações) como no protótipo.
- `packages/ui/src/form-layout/form-layout.module.css`, `page-header/page-header.module.css`, `text-field/text-field.module.css`, `button/button.module.css`, `card/card.module.css`, `select-field`, `segmented-field`, `date-field`, `time-field`, `date-time-field`, `tag-field`, `color-field`, `period-field` e `menu-button` (alterar, só os `.module.css` e os testes que dependam deles): tipografia (rótulo com `letter-spacing: 1px`, campo em 16 px, título com `letter-spacing: -1.2px`, eyebrow com `1.4px`), espaçamentos, raios, sombras, bordas e cores iguais ao protótipo; cada ponto divergente achado na comparação lado a lado.
- `apps/web/src/shared/preferences/preferences-context.tsx` e `preferences-context.test.tsx` (alterar e criar, DEC-008, PD-10): `usePreferences()` ganha `create_layout: 'grid' | 'list'` (padrão `'grid'`) e `set_create_layout(value)`, guardados no navegador em `atria.settings.create_layout.<userId>` (id de `useCurrentUser`), com `try/catch` em toda leitura e escrita e o padrão como recuo, acompanhando a mudança feita em outra aba pelo evento `storage`; exporta `CreateLayout`.
- `apps/web/src/app/providers.tsx` (alterar): `QueryClientProvider` passa para fora do `PreferencesProvider`, que agora lê o usuário atual; `preferences` aceita só os valores (sem o setter).
- `apps/web/src/shared/forms/recurrence-fields.tsx`, `recurrence-fields.module.css` e `recurrence-fields.test.tsx` (criar, DEC-008): `RecurrenceFields` (campos controlados da regra de recorrência do contrato da spec), `FormRecurrence` (ligação ao `react-hook-form`) e `summarizeRule(rule, locale)`; substitui os três `recurrence-fields.tsx` das TASK-22, TASK-24 e TASK-25.
- `apps/web/src/shared/forms/create-type-dialog.tsx`, `create-type-dialog.module.css` e `create-type-dialog.test.tsx` (criar, DEC-008, PD-09): `CreateTypeDialog`, o diálogo centralizado com um cartão por tipo, em grade ou em lista conforme `create_layout`, usado pelo Financeiro e pelo Acervo.
- `apps/web/src/shared/i18n/pt-br.json` (alterar): textos do editor de recorrência (rótulos, unidades, dias da semana, ajuda do dia do mês, resumos) e `create_type_*`.

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha.
2. Crie `apps/web/package.json` com `"name": "@atria/web"`, `"private": true`, `"type": "module"`, `"license": "AGPL-3.0-only"`, a chave `"prettier": { "singleQuote": true, "printWidth": 100 }` e os scripts `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint . --max-warnings 0 && prettier --check ."` e `"e2e": "playwright test"`. Confira a versão estável mais recente de cada pacote com `npm view <pacote> version` e use `^`. Dependências e justificativa ([project/stack-12]):
   - `dependencies`: `@atria/theme` e `@atria/ui` (`workspace:*`); `react` e `react-dom` 19 ([project/stack-01]); `@tanstack/react-router` e `@tanstack/react-query` ([project/stack-07]); `react-hook-form`, `zod` e `@hookform/resolvers` ([project/stack-08]); `pdfjs-dist` (modo leitura da TASK-29, empacotado no app, decisão 48).
   - `devDependencies`: `vite` e `@vitejs/plugin-react`; `typescript`, `@types/react`, `@types/react-dom`; `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier` ([project/code-style-01]); `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` ([project/testing-04]); `vitest-axe` e `axe-core` ([project/testing-10]); `@playwright/test` e `@axe-core/playwright` (ponta a ponta das features e da TASK-35, [project/testing-05]).
   `@atria/contracts` não entra aqui: o pacote só nasce na TASK-18, e as features que o usam o importam pelo workspace.
3. Crie `apps/web/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `jsx: react-jsx`, `module` e `moduleResolution` `bundler`, `target` `ES2022`, `lib` com `DOM` e `DOM.Iterable`, `types: ["vite/client", "vitest/globals"]`, `noEmit`, `include: ["src", "vite.config.ts", "playwright.config.ts"]`), `apps/web/eslint.config.js` (mesmas regras de `packages/ui/eslint.config.js`) e `apps/web/vite.config.ts`: plugin React; `server.proxy` de `/api` e `/healthz` para `http://localhost:8080`; `build.modulePreload.polyfill: false` e `build.assetsInlineLimit: 0`, para o build não gerar script nem recurso inline (CSP da TASK-04); `test` com `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/shared/test/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']`, `exclude: ['src/**/*.e2e.ts']` e `css: { modules: { localsConvention: 'camelCaseOnly' } }`.
4. Crie `apps/web/playwright.config.ts` com `testDir: './src'`, `testMatch: '**/*.e2e.ts'` (cobre `src/**/*.e2e.ts`), `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `use.baseURL: 'http://localhost:4173'`, `webServer: { command: 'pnpm build && pnpm preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }` e os projetos `desktop` (Chromium 1280×800), `w720` (720×900), `w480` (480×900) e `w360` (360×780) (RNF-08).
5. Crie `apps/web/index.html` com `<!doctype html>`, `<html lang="pt-BR" data-theme="light">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<meta name="color-scheme" content="light dark">`, `<title>Atria</title>`, `<div id="root"></div>` e `<script type="module" src="/src/main.tsx"></script>`. Nenhum script inline e nenhum recurso externo.
6. Escreva primeiro os testes, com estes nomes, e confirme que falham:
   - `src/app/layout/app-layout.test.tsx`, `describe('AppLayout')`: `it('renders the sidebar with the brand and the Principal navigation')`, `it('renders registered nav items in order')`, `it('renders the topbar search trigger with the shortcut hint')` (mostra "Ctrl K" e, com `navigator.platform` de macOS, "⌘ K"), `it('opens the command palette from the topbar trigger')`, `it('renders breadcrumbs from the active routes')`, `it('shows the screen info set by the page')`, `it('toggles the drawer below 720 px with an accessible button')`, `it('has no axe violations')` (CT-11, RF-14), `it('renders the profile button with the name and the initials')`, `it('opens the account menu with Configurações, Alternar tema and Sair')` (Sair com tom `danger`), `it('does not list Configurações in the Principal navigation')` (PD-23) e `it('focuses the page heading on route change')` (PD-22).
   - `src/shared/layout/sticky-page-header.test.tsx`, `describe('StickyPageHeader')`: `it('stays expanded near the top')`, `it('compacts after 48 px of scroll and expands back near the top')`, `it('does not compact on a short page')`, `it('shows the blur whenever the header is stuck')` (PD-20).
   - `src/shared/navigation/back-target.test.tsx`, `describe('useBackTarget')`: `it('returns to the last list with its tab and filters')`, `it('returns to the dashboard when the item was opened there')`, `it('falls back to the list of the type without history')`, `it('uses the explicit target on the edit screen')` (PD-21).
   - `src/shared/forms/form-fields.test.tsx`, `describe('form fields')`: `it('binds select, segmented, date, time, date-time and tags fields to react-hook-form')`, `it('shows the zod error on the field with role alert')` (PD-62).
   - Em `packages/ui` (PD-11, PD-14, PD-57, PD-62):
     - `select-field.test.tsx`, `describe('SelectField')`: mantém `it('has no axe violations')`, `it('associates the label with the control')` (agora o botão com `aria-haspopup="listbox"`) e `it('shows the error with role alert and aria-invalid')`, e acrescenta `it('renders no native select')`, `it('opens the listbox with ArrowDown and picks with Enter')`, `it('moves with Home and End and jumps by typed letters')`, `it('closes on Escape and returns focus to the trigger')`.
     - `segmented-field.test.tsx`, `describe('SegmentedField')`: `it('renders a radiogroup named by the legend')`, `it('moves the choice with the arrow keys')`, `it('has no axe violations')`.
     - `time-field.test.tsx`, `describe('parseTime')`: `it('normalizes 930, 9:30, 09:30 and 9 to 24 h')` ("09:30", "09:30", "09:30", "09:00"), `it('clamps hours to 23 and minutes to 59')`, `it('returns null for empty or non-numeric input')`; `describe('TimeField')`: `it('inserts the colon while typing and normalizes on blur')`, `it('uses inputmode numeric and the 24 h label')`, `it('has no axe violations')`.
     - `calendar.test.tsx`, `describe('Calendar')`: `it('renders the month grid with weekday headers in the locale')`, `it('moves focus with the arrow keys across months')`, `it('picks a single day')`, `it('marks a range with two clicks and highlights the days between')`, `it('swaps the ends when the second click is before the first')`, `it('has no axe violations')`.
     - `date-field.test.tsx`, `describe('DateField')`: `it('shows the placeholder when empty and the formatted date when set')`, `it('opens the calendar popover and picks a day')`, `it('sets today and clears')`, `it('closes on Escape and returns focus to the trigger')`, `it('has no axe violations')`.
     - `date-time-field.test.tsx`, `describe('DateTimeField')`: `it('combines date and time into YYYY-MM-DDTHH:mm')`, `it('emits an empty value while one part is missing')`.
     - `tag-field.test.tsx`, `describe('TagField')`: `it('adds a pill on Enter and on comma')`, `it('ignores repeated tags regardless of case')`, `it('removes the last pill with Backspace on an empty input')`, `it('removes a pill with its × button')`, `it('commits the pending text on blur')`, `it('has no axe violations')`.
     - `menu-button.test.tsx`, `describe('MenuButton')`: `it('opens the menu and focuses the first item')`, `it('moves with the arrow keys and closes on Escape returning focus')`, `it('renders danger items with the danger tone')`, `it('has no axe violations')`.
     - `form-layout.test.tsx`, `describe('FormGrid')`: `it('spans full-width fields across both columns')`; `describe('FormActions')`: `it('renders Cancelar before Salvar at the end of the row')`.
     - `color.test.ts`, `describe('color')`: `it('converts between HEX, RGB and HSL')` (`#7C3AED` ida e volta), `it('accepts 3 and 6 digit HEX with or without #')`, `it('rejects invalid HEX')`.
     - `color-field.test.tsx`, `describe('ColorField')`: `it('shows the swatch and the HEX on the trigger')`, `it('opens the picker in a dialog on the current color')`, `it('changes hue with left and right arrows and saturation with up and down')`, `it('uses a larger step with Shift')` (10 em vez de 1), `it('syncs HEX, RGB and HSL fields and the preview')`, `it('marks an invalid HEX with aria-invalid and keeps the color')`, `it('applies any HEX as #RRGGBB')`, `it('cancels with Escape or Cancelar without changing the value')`, `it('has no axe violations')`.
     - `period.test.ts`, `describe('resolvePeriod')`: `it('resolves this month as the default')`, `it('resolves last month, next 30 days, last 30 days and this year from today')`, `it('returns no dates for all')`, `it('keeps from and to for custom')`.
     - `period-field.test.tsx`, `describe('PeriodField')`: `it('shows the label of the current period on the trigger')` ("Este mês" sem valor; "01/10/2026 – 30/10/2026" no personalizado), `it('lists only the presets passed by the screen')`, `it('marks the current preset with aria-pressed and focuses it on open')`, `it('picks a preset and closes returning focus')`, `it('applies a custom range from the calendar')`, `it('shows an error when applying without the first day')`, `it('emits all without dates')`, `it('centers the popover under the field in form placement')`, `it('closes on Escape and on outside click')`, `it('has no axe violations')`.
     - `button.test.tsx`: `it('applies the muted variant')`, `it('uses the tint color in the muted variant')`, `it('applies the success variant and the pressed state')` (PD-02, PD-03).
     - `page-header.test.tsx`: `it('renders the back link above the title')`, `it('exposes the heading as focusable without a tab stop')`, `it('applies the stuck and compact states')`.
   - `src/app/theme/theme-provider.test.tsx`, `describe('ThemeProvider')`: `it('defaults to light without a saved choice or system preference')`, `it('follows prefers-color-scheme when nothing is saved')`, `it('saves the choice and sets data-theme on html')`, `it('ignores storage errors')` (RNF-10).
   - `src/shared/api/client.test.ts`, `describe('createApiClient')`: `it('sends the CSRF header from the atria_csrf cookie on mutations')`, `it('does not send the CSRF header on GET')`, `it('prefixes paths with /api/v1 and sends same-origin credentials')`, `it('serializes query params and JSON bodies')`, `it('throws ApiProblem with the stable code on problem+json')`, `it('throws ApiProblem network_error when fetch fails')`.
   - `src/shared/optimistic/use-optimistic-mutation.test.tsx`, `describe('useOptimisticMutation')`: `it('applies the change before the server answers')`, `it('rolls back and shows a toast when the server refuses')`, `it('invalidates the queries after settling')` (RNF-09, FA-04).
   - `src/shared/i18n/i18n.test.tsx`: `it('translates a registered key with params')`, `it('uses Intl.PluralRules for counts')`, `it('falls back to the key and never throws')`.
   - `src/shared/format/intl.test.ts`: `it('formats cents as BRL in pt-BR')` (150000 → contém `1.500,00`), `it('formats UTC instants in the user time zone')`, `it('formats percent with one decimal')`.
   - `src/shared/url-state/use-list-search.test.tsx`: `it('reads filters, search and view from the URL')`, `it('writes changes back to the URL')`, `it('drops invalid values with the schema defaults')`, `it('remembers the view per module and per tab')` e `it('prefers the view in the URL over the remembered one')` (PD-24).
7. Implemente `src/shared`:
   - `api/problem.ts`: `export class ApiProblem extends Error` com `status`, `code`, `title`, `detail` e `errors` (`{ field, code }[]`).
   - `api/client.ts`: `export function createApiClient(options?: { base_url?: string; fetch?: typeof fetch })` devolvendo `get<TResponse>(path, { query?, signal? })`, `post<TResponse, TBody>(path, body?, { idempotency_key? })`, `put`, `patch` e `delete`. Prefixo `/api/v1`, `credentials: 'same-origin'`, `Accept: application/json`; em mutações, lê o cookie `atria_csrf` de `document.cookie` e envia `X-CSRF-Token`; `idempotency_key` vira o cabeçalho `Idempotency-Key` ([project/api-06]); resposta `application/problem+json` vira `ApiProblem`; falha de rede vira `ApiProblem` com `code: 'network_error'`; 204 devolve `undefined`. O tipo de cada chamada vem do parâmetro genérico: as features passam os tipos de `@atria/contracts` ([project/api-02]). Exporte também `api = createApiClient()`.
   - `api/query-client.ts`: `createQueryClient()` com `retry` só para `network_error` (até 2 vezes) e nunca para respostas 4xx, e `staleTime` de 30 s.
   - `toast/toast-store.ts`: fila com `push({ tone, message_key, params })`, remoção automática em 6 s e `useToast()` com `useSyncExternalStore`.
   - `optimistic/use-optimistic-mutation.ts`: `useOptimisticMutation({ mutation_fn, query_key, apply, error_message_key })` sobre `useMutation`: em `onMutate`, cancela as consultas de `query_key`, guarda o valor anterior e aplica `apply`; em `onError`, restaura o valor anterior e chama `push` com tom `danger` e a mensagem do código do `ApiProblem` (ou `error_message_key`); em `onSettled`, invalida `query_key` ([project/frontend-18]).
   - `i18n/i18n.tsx` e `i18n/pt-br.json`: `registerMessages(namespace, messages)`, `I18nProvider` e `useT()` com `t('namespace.key', params)`, interpolação `{name}` e plural `{count, plural, one {...} other {...}}` por `Intl.PluralRules`; chave ausente devolve a própria chave. `pt-br.json` (namespace `common`) traz os textos do layout ("Principal", "Buscar ou criar…", "Alternar tema", "Tema claro", "Tema escuro", "Sair", "Abrir menu", "Trilha", "Página não encontrada"), os nomes acessíveis comuns das listagens `common.filters` = "Filtros", `common.search` = "Busca" e `common.view` = "Visualização", os estados ("Carregando…", "Nada por aqui ainda", "Algo deu errado", "Tentar de novo") e as mensagens de erro por código (`errors.network_error`, `errors.csrf_invalid`, `errors.unauthenticated`, `errors.validation_failed`, `errors.not_found`) ([project/language-06], [project/language-08]). Acrescente: menu da conta ("Menu da conta", "Configurações", "Alternar tema", "Sair", PD-23); "Voltar" (PD-21); "Editar", "Mais ações" e "Excluir" (PD-14); "Cancelar" e "Salvar" (PD-62); campos de data e hora ("Escolher data", "Hoje", "Limpar", "Mês anterior", "Próximo mês", "{label}: data", "{label}: hora (24 horas)", "hh:mm", PD-57 e PD-62); etiquetas ("Remover {tag}", "{label} adicionadas", PD-11); período ("Escolher período", "Este mês", "Mês passado", "Próximos 30 dias", "Últimos 30 dias", "Este ano", "Qualquer período", "Personalizado", "Aplicar", "Escolha o primeiro dia.", "escolha o último dia", "Escolha o primeiro dia no calendário.", PD-55, PD-61).
   - `url-state/use-list-search.ts` (PD-24): `useListSearch(schema, { view_key? })`; com `view_key` (o módulo, ou `módulo:aba` no Acervo), a visualização escolhida é gravada em `localStorage` na chave `atria_view:<view_key>` (em `try/catch`) e volta quando a URL não traz `view`; a `view` da URL sempre vence.
   - `navigation/back-target.ts` e `back-link.tsx` (PD-21): `rememberListLocation(module, href)`, chamado pelas listagens e pelo dashboard com a URL completa (aba e filtros), guarda a última origem por módulo em memória e em `sessionStorage` (`atria_back:<module>`, em `try/catch`); `useBackTarget({ module, fallback_to, to? })` devolve `to` quando informado (na edição, o detalhe), senão a última origem do módulo, senão `fallback_to` (a listagem do tipo); `BackLink` é o link "Voltar" com ícone de seta, passado ao `PageHeader` em `back`.
   - `layout/sticky-page-header.tsx` (PD-20): `StickyPageHeader` envolve o `PageHeader` em `position: sticky` logo abaixo da topbar; observa a rolagem da área da página e passa `stuck` (sempre que preso) e `compact` (rolagem acima de 48 px, voltando ao normal abaixo disso, e nunca quando a altura rolável da página não passa de 48 px além da janela). O fundo de desfoque (`backdrop-filter`, sem cor escura e sem linha) ocupa a largura da área da página, da sidebar à borda, e some em degradê embaixo; com `prefers-reduced-motion: reduce`, a troca é sem transição.
   - `session/current-user.ts` (PD-23): `useCurrentUser()` com `useQuery` de `api.get<CurrentUser>('/me')`, onde `CurrentUser` é o tipo local `{ id: string; email: string; display_name?: string | null; avatar_url?: string | null }`, até as features passarem o tipo de `@atria/contracts`.
   - `forms/form-fields.tsx` (PD-62): `FormSelect`, `FormSegmented`, `FormDate`, `FormTime`, `FormDateTime` e `FormTags`, `FormColor` (PD-12) e `FormPeriod` (PD-61), cada um um `Controller` do `react-hook-form` que liga `value`, `onChange`, `onBlur` e a mensagem de erro traduzida ao componente de `@atria/ui`.
   - `format/intl.ts`: `formatMoney(cents, currency, locale)`, `formatNumber`, `formatPercent`, `formatDate(iso, locale, time_zone)` e `formatDateTime`, todos com `Intl` e cache de formatadores ([project/frontend-16], [project/code-style-06]).
   - `preferences/preferences-context.tsx`: `PreferencesProvider` e `usePreferences()` com `locale`, `time_zone`, `currency` e `palette_shortcut`; a TASK-33 passa os valores do servidor pelo mesmo provedor.
   - `navigation/nav-item.ts`: `export type NavItem = { id: string; label_key: string; to: string; icon: ComponentType<{ 'aria-hidden': true }>; order: number }`. `navigation/route-meta.ts`: `export type RouteMeta = { title_key: string; breadcrumb_key: string; layout?: 'app' | 'bare' }` (`bare` é a tela sem sidebar nem topbar, usada pelo modo leitura e pelas telas de entrada) e a declaração do `StaticDataRouteOption` do TanStack Router com esse tipo.
   - `layout/screen-info.tsx`, `command-palette/palette-store.ts` e `url-state/use-list-search.ts` (`useListSearch(schema)` lê e grava `q`, os filtros e `view` na URL por `useSearch`/`useNavigate`, validados por um schema `zod` da feature, [project/frontend-13]).
   - `test/setup.ts` (jest-dom, `vitest-axe`, `matchMedia` falso controlável e `HTMLDialogElement.showModal`/`close`) e `test/render.tsx` (`renderWithProviders(ui, { route?, routes?, nav_items? })` com `createMemoryHistory`, um `QueryClient` sem repetição e o i18n).
8. Implemente `src/app`:
   - `routes.ts`: `export const featureRoutes: AnyRoute[] = []` e `nav.ts`: `export const navItems: NavItem[] = []`, cada um com um comentário dizendo que a TASK-35 registra aqui as rotas e os itens de cada feature.
   - `router.tsx`: `rootRoute` com `AppLayout` (ou só o `<Outlet />` quando a rota ativa tem `staticData.layout === 'bare'`) e `notFoundComponent: NotFoundPage`; `export function createAppRouter(routes = featureRoutes, history?)`; declaração `Register` do TanStack Router.
   - `theme/theme-provider.tsx`: lê `atria_theme` do `localStorage` (em `try/catch`); sem escolha salva, segue `matchMedia('(prefers-color-scheme: dark)')`, e o padrão é `light`; grava `document.documentElement.dataset.theme` ([project/frontend-01]).
   - `layout/sidebar.tsx`: marca no topo (ícone SVG inline `aria-hidden="true"` e o nome "Atria" em `--font-display`), `<nav aria-label={t('common.principal')}>` com os `navItems` ordenados por `order` e o item ativo com `aria-current="page"`; "Configurações" não entra nessa navegação (PD-23). O rodapé (PD-23) tem uma linha `--border` em cima e um `MenuButton` com a foto (`avatar_url`) ou as iniciais sobre o gradiente de `paletteFor(id)`, o nome (`display_name`, ou o e-mail sem nome) e um chevron, com nome acessível "Menu da conta"; o menu abre à direita com "Configurações" (link para `/settings`), "Alternar tema" (ícone e rótulo "Tema escuro" ou "Tema claro") e "Sair" com tom `danger` (`api.post('/auth/sign-out')` e depois `window.location.assign('/sign-in')`). Enquanto `useCurrentUser()` carrega ou falha, o botão mostra só o ícone de pessoa e o menu continua disponível ([project/frontend-05]).
   - `layout/route-focus.ts` (PD-22): `useRouteFocus()`, chamado no `AppLayout`, observa `useRouterState({ select: (s) => s.location.href })` e, a cada troca depois da primeira pintura, foca o elemento `[data-page-heading]` da página (o `h1` do `PageHeader`, com `tabIndex={-1}` e sem contorno visível em `:focus`).
   - `router.tsx`: com `import.meta.env.DEV`, acrescenta a rota `/dev/forms` (`dev/forms-preview.tsx`, por import dinâmico), que não entra no build de produção.
   - `dev/forms-preview.tsx`: `PageHeader` com "Voltar", "Editar" e "Mais ações" (com "Excluir"), e um `FormGrid` com título e descrição na linha inteira, um `SelectField`, um `SegmentedField` ("Saída/Entrada") e a visibilidade em `SegmentedField` ("Pessoal/Compartilhada") na linha inteira, um `TextField type="number"`, um `DateField`, um `DateTimeField`, um `TagField`, um `ColorField`, um `PeriodField` em `placement="form"`, botões `muted` e `success` e o `FormActions`, todos ligados por `form-fields.tsx` a um schema `zod` de exemplo, para as evidências visuais.
   - `layout/topbar.tsx`: botão com aparência de campo, texto "Buscar ou criar…" e a dica do atalho (`⌘ K` no macOS, `Ctrl K` nos demais), que chama `openCommandPalette()` (decisão 16); `Breadcrumbs` (`<nav aria-label="Trilha">` com `<ol>`, a partir de `useMatches()` e `staticData.breadcrumb_key`); as informações da tela de `useScreenInfo()`; abaixo de 720 px, um `IconButton` "Abrir menu" que abre a sidebar como gaveta com foco preso e Esc ([project/frontend-06], [project/frontend-17]).
   - `layout/app-layout.tsx` e `app-layout.module.css`: grade com sidebar fixa e página; o conteúdo da página tem `max-width: calc(var(--space) * 340)` (1360 px), centralizado na área à direita da sidebar (PD-18); a área da página é o contêiner de rolagem observado pelo `StickyPageHeader` (PD-20); em `max-width: 720px` a sidebar vira gaveta; em `max-width: 480px` os espaçamentos diminuem; funcional a partir de 360 px; só tokens, transições com `var(--motion-*)`.
   - `layout/not-found-page.tsx`: `PageHeader` com eyebrow e título "Página não encontrada" e um `EmptyState` explicativo ([project/frontend-07]).
   - `global.css`: importa `@atria/theme/tokens.css` e `@atria/theme/fonts.css`, define `body` com `--bg`, `--text` e `--font-body`, e `:focus-visible` com contorno no token `--primary`.
   - `providers.tsx`: `PreferencesProvider`, `I18nProvider` (com `common` de `shared/i18n/pt-br.json`), `ThemeProvider`, `QueryClientProvider`, `ScreenInfoProvider` e `ToastRegion` de `@atria/ui` ligado ao `useToast`.
9. Crie `src/main.tsx`: importa `./app/global.css`, cria o `QueryClient` e o roteador e renderiza `<StrictMode><AppProviders><RouterProvider router={router} /></AppProviders></StrictMode>` em `#root`.
10. Implemente em `packages/ui` os componentes de formulário e de ação (PD-11, PD-14, PD-57, PD-62), com as regras visuais da TASK-03 (só tokens, `radius.md` em botões, seletores e grupos, DEC-001; nenhum texto literal visível: rótulos, meses e mensagens chegam por props ou por `Intl` com a prop `locale`; foco visível em `--primary`; `Esc` fecha e devolve o foco ao gatilho):
    - `SelectField` (PD-62): props `label`, `help?`, `error?`, `id?`, `options: { value: string; label: string }[]`, `value`, `onChange(value)`, `onBlur?`, `placeholder?`, `disabled?`, `name?`. Renderiza um `<button type="button" aria-haspopup="listbox" aria-expanded>` com o rótulo da opção e um chevron que gira ao abrir, e uma `<ul role="listbox" aria-activedescendant>` posicionada abaixo (ou acima, sem espaço), com `role="option"` e `aria-selected`. Teclado como no protótipo: `ArrowDown`, `ArrowUp`, `Enter` ou espaço abrem; na lista, setas, `Home` e `End` movem, `Enter` ou espaço escolhem, `Esc` fecha, `Tab` fecha sem escolher, letras digitadas em até 700 ms levam à primeira opção que começa com elas; clique fora ou rolagem da página fecham. Com `name`, um `<input type="hidden">` leva o valor ao formulário. Nenhum `<select>` nativo.
    - `SegmentedField` (PD-62): `<fieldset>` com `<legend>` e um grupo `role="radiogroup"` de `<input type="radio">` visualmente escondidos com o rótulo em segmento; o escolhido em `--surface` com texto `--primary` e `--shadow-sm`, sobre `--surface-muted` com borda `--border`. Para escolhas obrigatórias de até 3 opções (Tipo Saída/Entrada, Status do livro, Repetição) e para a visibilidade (Pessoal/Compartilhada); acima de 3 opções, o `SelectField`.
    - `parseTime(text)` e `TimeField` (PD-62): `parseTime` tira o que não é dígito, completa "930" para "0930" e "9" para "0900", limita a hora a 23 e o minuto a 59 e devolve `"HH:mm"`, ou `null` para vazio; `TimeField` é um `<input type="text" inputmode="numeric" maxlength="5" placeholder>` com ícone de relógio, que insere ":" enquanto se digita e normaliza por `parseTime` ao sair, com `font-variant-numeric: tabular-nums`.
    - `Calendar` (PD-57): props `mode: 'single' | 'range'`, `month`, `onMonthChange`, `value` (`from`, `to?`), `onChange`, `today`, `locale` e os rótulos de mês anterior e próximo. Cabeçalho com os dois `IconButton` e o título "outubro de 2026" (`Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })`); grade `role="grid"` de 6 semanas com os dias da semana por `Intl` (`role="columnheader"`), cada dia um botão com `aria-label` completo e "hoje" no dia atual, `aria-pressed` nas pontas e o roving `tabIndex`; setas movem o foco um dia ou uma semana, trocando de mês quando preciso. No modo de intervalo, o primeiro clique marca o início, o segundo o fim (trocando as pontas se vier antes) e os dias entre eles ficam destacados em `--primary-soft`; o resumo "01/10/2026 – 30/10/2026" fica a cargo de quem usa o calendário (o seletor de período da TASK-22).
    - `DateField` (PD-57): botão com ícone de calendário e a data formatada pelo `locale`, ou o placeholder "Escolher data" em `--text-muted` quando vazio, `aria-haspopup="dialog"`; abre um popover com o `Calendar` de um dia e os botões "Hoje" e "Limpar"; escolher fecha e devolve o foco; valor `YYYY-MM-DD` ou `''`. O mesmo `Calendar` atende todos os campos de data do app.
    - `DateTimeField` (PD-62): `DateField` e `TimeField` lado a lado, com os nomes acessíveis "{label}: data" e "{label}: hora (24 horas)"; o valor é `YYYY-MM-DDTHH:mm` quando as duas partes existem e `''` enquanto falta uma.
    - `TagField` (PD-11): campo de texto com as pills embaixo, numa `<ul aria-label>`; `Enter` ou vírgula transformam o texto em pills (sem `#` no começo), repetidas (sem diferenciar maiúsculas) não entram, `Backspace` com o campo vazio remove a última, o "×" de cada pill (nome "Remover {tag}") remove aquela e devolve o foco ao campo, e o texto pendente entra ao sair do campo; valor `string[]`.
    - `MenuButton` (PD-14, PD-23): botão com `aria-haspopup="menu"` e `aria-expanded` que abre um `role="menu"` com itens `role="menuitem"` (botão ou link) e tom `danger` opcional (texto `--danger`); abre com o foco no primeiro item, setas, `Home` e `End` movem, `Esc` e clique fora fecham, `placement` `bottom-end` (o "Mais ações") ou `right-end` (o menu do perfil).
    - `FormGrid` e `FormActions` (PD-19, PD-62): `FormGrid` é a grade do formulário com `max-width: calc(var(--space) * 220)` (880 px, a mesma largura em todo formulário), duas colunas com `column-gap: calc(var(--space) * 4)` e uma coluna em `max-width: 640px`; cada filho pode pedir `data-span="full"` (título, nome, descrição, textos longos, etiquetas, emoções e visibilidade ocupam a linha inteira). `FormActions` fica embaixo de uma linha `--border`, alinhado à direita, com o botão `ghost` "Cancelar" à esquerda e o `primary` "Salvar" à direita.
    - `TextField` (PD-62): em `text-field.module.css`, `input[type="number"]` com `appearance: textfield` e sem `::-webkit-inner-spin-button` e `::-webkit-outer-spin-button`.
    - `color.ts`, `ColorPicker` e `ColorField` (PD-12), como no protótipo: `hexToRgb` (3 ou 6 dígitos, com ou sem `#`, `null` se inválido), `rgbToHex` (`#RRGGBB`), `hslToRgb` e `rgbToHsl` inteiros. `ColorField` tem as props `label`, `value` (HEX), `onChange(hex)`, `error?`, `help?`, `labels` (título, "Luminosidade", "HEX", "RGB", "Vermelho", "Verde", "Azul", "HSL", "Matiz", "Saturação", "Cancelar", "Aplicar" e o nome da roda) e mostra um botão com a bolinha da cor e o HEX em `tabular-nums` (`aria-haspopup="dialog"`). O botão abre um `<dialog>` modal com o `ColorPicker` na cor atual, com a roda num `<canvas>` (`role="slider"`, `tabIndex=0`, `aria-valuetext` "Matiz N graus, saturação N%"), redesenhada a cada mudança de luminosidade, e o marcador na posição da matiz e da saturação. Arrastar ou clicar na roda escolhe; setas laterais mudam a matiz (dando a volta em 360) e as verticais a saturação (0 a 100), com passo 1, ou 10 com Shift. Ao lado ficam a prévia, a luminosidade num `<input type="range">` de 0 a 100, o campo HEX (`aria-invalid` enquanto inválido, sem mudar a cor) e os grupos RGB (0 a 255) e HSL (360, 100, 100) em `fieldset` com `legend`. Todos ficam sincronizados, sem reescrever o campo que está sendo editado. "Cancelar" e Esc fecham sem mudar; "Aplicar" chama `onChange` com o HEX `#RRGGBB` livre, que o servidor grava em minúsculas (TASK-14). O diálogo segue o protótipo; ele é a exceção, como o calendário, ao modal só para confirmação de [project/architecture-10], que trata de criar e editar entidades.
    - `period.ts` e `PeriodField` (PD-55, PD-57, PD-61), como no protótipo: `PeriodPreset` = `'this_month' | 'last_month' | 'next_30_days' | 'last_30_days' | 'this_year' | 'all'`; `PeriodValue` = `{ preset: PeriodPreset | 'custom'; from?: string; to?: string }` (datas `YYYY-MM-DD`; `all` sem datas; `custom` com as duas); `resolvePeriod(value, today)` devolve `{ from, to }` ou `null` em `all`, com as regras de `finRange` (mês corrente, mês anterior, de hoje a hoje + 30, de hoje − 30 a hoje, ano corrente). `PeriodField` tem as props `label?`, `value` (padrão `{ preset: 'this_month' }`), `onChange`, `presets` (lista configurável, cada tela escolhe os seus, na ordem dada; padrão: os seis, na ordem Este mês, Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano, Qualquer período), `allow_custom?` (padrão `true`), `placement: 'toolbar' | 'form'`, `today`, `locale`, `labels` (rótulo de cada preset, "Escolher período", "Personalizado", "Aplicar", "Escolha o primeiro dia.", "escolha o último dia", "Escolha o primeiro dia no calendário.") e `name?` (campos ocultos `period`, `from` e `to` para o formulário). O botão (`aria-haspopup="dialog"`, `aria-expanded`) tem o ícone de calendário e o rótulo do período: o nome do preset ou "01/10/2026 – 30/10/2026" no personalizado. O popover `role="dialog"` tem a coluna de presets (botões com `aria-pressed` no atual, que recebe o foco ao abrir; escolher fecha e devolve o foco) e, com `allow_custom`, "Personalizado" com o `Calendar` de intervalo, o resumo em `aria-live` e "Aplicar" (sem o primeiro dia, o erro com `role="alert"`; com só um dia, de e até nele). Posição: em `toolbar`, alinhado à direita do botão (cabeçalho do Financeiro); em `form`, centralizado sob o campo (filtros de relatório); sempre dentro da janela, com 8 px de margem, e numa coluna abaixo de 560 px. Esc e clique fora fecham.
    - `Button` (PD-02, PD-03): `ButtonVariant` ganha `muted` e `success`. `muted`: sem fundo, borda ou sombra, texto `--text-muted`, que muda só a cor para `--primary` no hover; com a prop `tint` (uma cor CSS, como a da raia), usa `color-mix(in srgb, var(--button-tint) 60%, transparent)` e a cor cheia no hover; com `aria-pressed="true"`, `--success`. `success`: fundo `--success-soft` e texto `--success`, hover com `color-mix` de 22% de `--success`, e com `aria-pressed="true"` fundo `--success` e texto `--surface`.
    - `PageHeader` (PD-14, PD-20, PD-21, PD-22): acrescente `back?: ReactNode` (renderizado acima do eyebrow e do título), `stuck?` e `compact?` (título de `--font-size-xxxl`, 36 px, para `calc(var(--font-size-base) * 1.5)`, 24 px, e sem subtítulo quando compacto) e `headingRef?`; o `h1` tem `tabIndex={-1}`, `data-page-heading` e nenhum contorno em `:focus`; as ações continuam alinhadas à base do bloco do título (`align-items: flex-end`). Nos detalhes, as telas passam em `actions` o "Editar" com ícone de lápis, as ações específicas ao lado dele e o `MenuButton` "Mais ações" com "Excluir" em tom `danger` (PD-14).
    - Exporte tudo em `src/index.ts` e rode `pnpm --filter @atria/ui test`, `typecheck` e `lint` até passar.
11. Implemente `src/shared/forms/form-fields.tsx` e os demais arquivos de `src/shared` e `src/app` acrescentados pelas decisões do protótipo (passos 7 e 8), e a rota de dev `/dev/forms`.
12. Rode `pnpm install` e `pnpm --filter @atria/web test` até passar; depois `pnpm --filter @atria/web typecheck`, `pnpm --filter @atria/web lint` e `pnpm --filter @atria/web build`, corrigindo até zero warnings.
13. Rode o bloco de "Verificação" até terminar sem erro.
14. Crie `apps/web/scripts/evidence-shots.mjs` (veja "Mudar") e rode `node apps/web/scripts/evidence-shots.mjs layout` e `node apps/web/scripts/evidence-shots.mjs forms`. Corrija o app a cada linha `FALHA`, e confira as pranchas `layout-telas.png` e `form-componentes.png` abrindo-as.
15. Fidelidade visual ao protótipo (pedido do usuário): escreva primeiro `packages/theme/src/prototype-fidelity.test.ts` e `packages/ui/src/brand-logo/brand-logo.test.tsx` (o SVG com os dois `path` do protótipo, o nome "Atria" e o gradiente) e confirme que falham. Depois acrescente `--s1` a `--s10`, crie `BrandLogo`, use-o na sidebar e rode `pnpm --filter @atria/theme test` e `pnpm --filter @atria/ui test`.
16. Capture o protótipo (`file://.../prototype/atria-prototype.html#/journal/new`) e o app (`/dev/forms`) lado a lado em 1440 px e em 360 px, nos temas claro e escuro, com `node apps/web/scripts/evidence-shots.mjs prototipo`. Compare marca, sidebar, topbar, cabeçalho de página, cartão do formulário, rótulos, campos, botões, chips, popovers e links; corrija cada diferença apontada com `FALHA` nos `.module.css` e repita até só restar o que o protótipo não tem (itens da navegação, que entram na TASK-35).
17. Peças compartilhadas da DEC-008, sempre testes primeiro (confirme que falham) e depois o código:
    - Preferência (PD-10): `preferences-context.test.tsx` (padrão `grid`; lê o valor salvo de `atria.settings.create_layout.<userId>`; `set_create_layout` grava e atualiza; o evento `storage` de outra aba atualiza o valor e eventos de outras chaves ou usuários são ignorados; usuários diferentes não se misturam; valor inválido, `localStorage` que lança e usuário ainda não carregado recuam para o padrão sem quebrar). Depois altere `preferences-context.tsx` e `providers.tsx`.
    - Editor de recorrência: leia a regra do contrato da spec e os `recurrence-fields.tsx` descritos nas TASK-22, TASK-24 e TASK-25 e una os três: `fieldset` com `legend`; frequência no `SelectField` (4 opções); intervalo em `TextField type="number"` com a unidade da frequência; dias da semana só em `weekly`; dia do mês (1 a 31, `SelectField`) só em `monthly`, com a ajuda "Em meses mais curtos, cai no último dia" (CB-02, CB-03); horário no `TimeField` só com `with_time` (padrão `true`; o Financeiro passa `false`), opcional ou obrigatório por `time_required`; início e fim (opcional) no `DateField`; o fuso do usuário vai na regra pelo `FormRecurrence`. Com `with_time` verdadeiro a regra sem `time` é aceita (a hora é opcional nas Tarefas; quem a exige é o zod da tela, como nos Lembretes). Trocar a frequência limpa os campos que ela não usa. `summarizeRule(rule, locale)` devolve "Todo mês no dia 31", "Toda segunda e quarta, 08:00". Escreva `recurrence-fields.test.tsx` (campos por frequência, `with_time`, limpeza, `summarizeRule`, `FormRecurrence` com o fuso, axe) e confirme que falha; depois `recurrence-fields.tsx` e o CSS.
    - Diálogo de tipo (PD-09): escreva `create-type-dialog.test.tsx` (um cartão por tipo; foco inicial no `focused_type`; grade e lista conforme `create_layout`; setas movem, Enter abre, Esc fecha e devolve o foco ao gatilho; clique no fundo fecha; axe) e confirme que falha; depois `create-type-dialog.tsx` e o CSS, com a aparência do protótipo (DEC-007).
18. Rode `pnpm --filter @atria/ui test`, `typecheck` e `lint`, e `pnpm --filter @atria/web test`, `typecheck`, `lint` e `build`, até zero warnings.

### Baseline

- `test -e apps/web/package.json && echo "apps/web existe" || echo "apps/web ausente"`
- `ls apps/web/src 2>/dev/null || echo "apps/web/src ausente"`

### Verificação

```bash
pnpm install
pnpm --filter @atria/web test
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
pnpm --filter @atria/web build

# Build sem script inline nem recurso externo (CSP da TASK-04, Lighthouse).
if grep -nP '<script(?![^>]*\bsrc=)[^>]*>' apps/web/dist/index.html; then echo "FALHA: script inline no build"; exit 1; fi
if grep -nE "(src|href)=\"https?://" apps/web/dist/index.html; then echo "FALHA: recurso externo"; exit 1; fi
grep -q '<html lang="pt-BR" data-theme="light">' apps/web/index.html

# Playwright configurado para os arquivos *.e2e.ts das features.
pnpm --filter @atria/web exec playwright test --list --pass-with-no-tests
grep -q "testMatch: '\*\*/\*.e2e.ts'" apps/web/playwright.config.ts

# Dependências que as features esperam encontrar.
node -e '
const p = require("./apps/web/package.json");
const all = { ...p.dependencies, ...p.devDependencies };
for (const d of ["@tanstack/react-router", "@tanstack/react-query", "react-hook-form", "zod", "pdfjs-dist", "@playwright/test", "@axe-core/playwright", "@atria/theme", "@atria/ui"]) {
  if (!all[d]) throw new Error("dependência ausente: " + d);
}
if (all["@atria/contracts"]) throw new Error("@atria/contracts só entra na TASK-18");
console.log("dependências do @atria/web ok");
'

# O cliente HTTP é genérico: não importa os contratos.
if grep -rn "@atria/contracts" apps/web/src/shared apps/web/src/app; then echo "FALHA: shared ou app importa @atria/contracts"; exit 1; fi

# Componentes de formulário e de ação em packages/ui (PD-11, PD-14, PD-57, PD-62).
pnpm --filter @atria/ui test
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui lint

# Sem select, data ou hora nativos (PD-57, PD-62).
if grep -rnE "<select|type=[\"'](date|time|datetime-local)[\"']" packages/ui/src apps/web/src --include='*.tsx'; then echo "FALHA: controle nativo de select, data ou hora"; exit 1; fi

# Campos numéricos sem as setas do navegador (PD-62).
grep -q "inner-spin-button" packages/ui/src/text-field/text-field.module.css

# Largura do conteúdo (1360 px, PD-18) e dos formulários (880 px, PD-62).
grep -q "calc(var(--space) \* 340)" apps/web/src/app/layout/app-layout.module.css
grep -q "calc(var(--space) \* 220)" packages/ui/src/form-layout/form-layout.module.css

# Seletor de cor e variações de botão (PD-02, PD-03, PD-12).
grep -q "ColorField" packages/ui/src/index.ts
grep -qE "^\.muted" packages/ui/src/button/button.module.css
grep -qE "^\.success" packages/ui/src/button/button.module.css

# Seletor de período compartilhado pelo Financeiro e pelos relatórios (PD-55, PD-61).
grep -q "PeriodField" packages/ui/src/index.ts

# Fidelidade visual ao protótipo: logo e tokens (pedido do usuário).
grep -q 'M3 20L12 4l9 16' packages/ui/src/brand-logo/brand-logo.tsx
grep -q 'M8 20l4-7 4 7' packages/ui/src/brand-logo/brand-logo.tsx
grep -q "background-clip: text" packages/ui/src/brand-logo/brand-logo.module.css
grep -q "BrandLogo" packages/ui/src/index.ts
grep -q "BrandLogo" apps/web/src/app/layout/sidebar.tsx
pnpm --filter @atria/theme test
pnpm --filter @atria/ui test

# Peças compartilhadas da DEC-008: preferência do botão de criar, editor de recorrência e diálogo de tipo.
grep -q "atria.settings.create_layout" apps/web/src/shared/preferences/preferences-context.tsx
grep -q "export function RecurrenceFields" apps/web/src/shared/forms/recurrence-fields.tsx
grep -q "export function FormRecurrence" apps/web/src/shared/forms/recurrence-fields.tsx
grep -q "export function summarizeRule" apps/web/src/shared/forms/recurrence-fields.tsx
grep -q "export function CreateTypeDialog" apps/web/src/shared/forms/create-type-dialog.tsx
pnpm --filter @atria/web exec vitest run src/shared/preferences src/shared/forms

# Script das evidências visuais (as pranchas são geradas na etapa de evidências).
test -f apps/web/scripts/evidence-shots.mjs
node --check apps/web/scripts/evidence-shots.mjs

# A prévia de formulários só existe no modo de desenvolvimento.
if grep -rl "forms-preview" apps/web/dist; then echo "FALHA: prévia de dev no build"; exit 1; fi
echo "verificação da TASK-05 ok"
```

Resultado esperado: código 0, os testes passam, o build sai em `apps/web/dist` e a última linha é `verificação da TASK-05 ok`.

### Evidências

- `web-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run --reporter=verbose 2>&1 | grep -E "✓|×|Test Files|Tests "`
  - Prova: layout com sidebar e topbar, tema, cliente HTTP com CSRF, interface otimista com desfazer, tradução, formatação e estado na URL (RF-14, CT-11, RNF-09, RNF-10), e as decisões do protótipo na base: menu da conta, foco no título, cabeçalho que compacta, "Voltar" e visualização lembrada (PD-20 a PD-24).
  - Trecho: `✓ ... AppLayout > renders the sidebar with the brand and the Principal navigation`, `✓ ... AppLayout > renders the topbar search trigger with the shortcut hint`, `✓ ... AppLayout > has no axe violations`, `✓ ... useOptimisticMutation > rolls back and shows a toast when the server refuses`, `✓ ... createApiClient > sends the CSRF header from the atria_csrf cookie on mutations`, `✓ ... AppLayout > opens the account menu with Configurações, Alternar tema and Sair`, `✓ ... AppLayout > focuses the page heading on route change`, `✓ ... StickyPageHeader > compacts after 48 px of scroll and expands back near the top`, `✓ ... useBackTarget > returns to the last list with its tab and filters`, `✓ ... remembers the view per module and per tab` e `Tests  N passed`.
  - Falha: `×`, `Tests  N failed` ou `No projects matched the filters` (pacote inexistente).
- `ui-form-tests.txt` (automática): `pnpm --filter @atria/ui exec vitest run --reporter=verbose 2>&1 | grep -E "✓|×|Test Files|Tests "`
  - Prova: seletor de período, seletor de cor, botões `muted` e `success`, seletor próprio, grupo segmentado, campo de hora em 24 h, calendário, campo de data, data e hora, etiquetas em pills, menu de ações, grade do formulário e cabeçalho com "Voltar", operáveis pelo teclado e sem violações no axe (PD-02, PD-03, PD-11, PD-12, PD-14, PD-20 a PD-22, PD-55, PD-57, PD-61, PD-62).
  - Trecho: `✓ ... PeriodField > lists only the presets passed by the screen`, `✓ ... PeriodField > applies a custom range from the calendar`, `✓ ... resolvePeriod > returns no dates for all`, `✓ ... ColorField > changes hue with left and right arrows and saturation with up and down`, `✓ ... ColorField > syncs HEX, RGB and HSL fields and the preview`, `✓ ... ColorField > applies any HEX as #RRGGBB`, `✓ ... Button > applies the success variant and the pressed state`, `✓ ... SelectField > renders no native select`, `✓ ... SelectField > moves with Home and End and jumps by typed letters`, `✓ ... parseTime > normalizes 930, 9:30, 09:30 and 9 to 24 h`, `✓ ... Calendar > marks a range with two clicks and highlights the days between`, `✓ ... DateField > opens the calendar popover and picks a day`, `✓ ... TagField > adds a pill on Enter and on comma`, `✓ ... MenuButton > renders danger items with the danger tone`, `✓ ... FormActions > renders Cancelar before Salvar at the end of the row` e `Tests  N passed`.
  - Falha: `×` ou `Tests  N failed`.
- `shared-dec008-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/shared/preferences src/shared/forms --reporter=verbose 2>&1 | grep -E "✓|×|Test Files|Tests "`
  - Prova: a preferência do botão de criar guardada por usuário com recuo seguro, o editor único da regra de recorrência (campos por frequência, horário opcional, resumo legível) e o diálogo de escolha do tipo em grade ou lista, operável pelo teclado e sem violações no axe (DEC-008, PD-09, PD-10).
  - Trecho: `✓ ... usePreferences > falls back to grid when localStorage throws`, `✓ ... usePreferences > keeps the create layout per user`, `✓ ... usePreferences > follows a change made in another tab through the storage event`, `✓ ... FormRecurrence > submits a rule without time while the time field is shown`, `✓ ... RecurrenceFields > shows the month day only for monthly`, `✓ ... RecurrenceFields > hides the time when with_time is false`, `✓ ... summarizeRule > summarizes a monthly rule on day 31`, `✓ ... CreateTypeDialog > moves between cards with the arrow keys`, `✓ ... CreateTypeDialog > closes with Escape and returns focus to the trigger`, `✓ ... CreateTypeDialog > has no axe violations`.
  - Falha: `×`, `Tests  N failed` ou `No test files found`.
- `web-build.txt` (automática): `ls apps/web/dist/assets | sed -E 's/-[A-Za-z0-9_-]{8}\./-<hash>./' | sort`
  - Prova: o frontend compila para os arquivos estáticos que o servidor embute ([project/self-hosting-02]).
  - Trecho: `index-<hash>.js`, `index-<hash>.css` e as fontes `InterVariable-<hash>.woff2` e `Outfit-Variable-<hash>.ttf` (servidas pelo app, sem CDN).
  - Falha: `No such file or directory` ou ausência das fontes.
- `layout-telas.txt` (automática): `node apps/web/scripts/evidence-shots.mjs layout`
  - Prova: o layout do app, medido no DOM e fotografado em desktop (1440 px) e em 360 px, nos temas claro e escuro: `/qualquer-rota` (página não encontrada dentro do layout), gaveta aberta em 360 px, foco visível no gatilho da busca, menu da conta aberto e cabeçalho compacto depois de rolar `/dev/forms`; sidebar com a marca e o perfil no rodapé, topbar com o gatilho da busca e a dica do atalho, conteúdo até 1360 px e cabeçalho fixo que compacta (CT-11, RNF-08, RNF-10, PD-18, PD-20, PD-23).
  - Trecho: uma linha `ok` por verificação, como `ok ... /qualquer-rota · desktop 1440 · claro: dica do atalho · Ctrl K`, `ok ... foco no gatilho da busca ... contorno de foco visível · solid 2px`, `ok ... menu da conta aberto ... itens Configurações, tema e Sair`, `ok ... /dev/forms rolada (cabeçalho compacto) ... título compacto (24 px)`, `ok ... gaveta aberta · 360 px ... gaveta visível` e `ok ... sem rolagem horizontal` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-05/layout-telas.png (14 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (layout quebrado, rolagem horizontal em 360 px, gaveta fora da janela, contorno de foco ausente, "Configurações" na navegação principal, título do cabeçalho compacto diferente de 24 px), a ausência da linha `png:` ou código de saída diferente de 0 (`Cannot find module` antes da tarefa, porque o script não existe).
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-05/layout-telas.png`, a prancha com as 14 capturas rotuladas; a navegação e o nome do usuário não entram: a sidebar não tem itens até a TASK-35 registrar as features, e o nome só aparece com o `/me`.
- `form-componentes.txt` (automática): `node apps/web/scripts/evidence-shots.mjs forms`
  - Prova: os componentes próprios de `/dev/forms` em desktop e em 360 px, nos dois temas, com o estado conferido no DOM antes de cada captura: formulário de 880 px em duas colunas (uma em 360 px) com "Cancelar" e "Salvar" à direita, nenhum `<select>` nativo, campo numérico sem setas, seletor próprio aberto com 5 opções, calendário aberto, "930" virando "09:30", seletor de cor aberto com o HEX `#7C3AED`, seletor de período aberto com "Este mês" marcado, erro "Campo obrigatório" e "Mais ações" aberto com "Excluir" (PD-02, PD-03, PD-11, PD-12, PD-14, PD-21, PD-57, PD-62).
  - Trecho: `ok ... campo de hora normalizou "930" · valor "09:30"`, `ok ... lista visível`, `ok ... 5 opções`, `ok ... calendário dentro da janela`, `ok ... HEX inicial #7C3AED`, `ok ... preset "Este mês" marcado`, `ok ... popover dentro da janela`, `ok ... erro "Campo obrigatório" visível`, `ok ... item "Excluir" visível`, `ok ... duas colunas`, `ok ... sem rolagem horizontal`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-05/form-componentes.png (32 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (lista ou calendário nativo, popover fora da janela, hora sem normalizar, erro ausente, uma coluna no desktop, rolagem horizontal em 360 px), a ausência da linha `png:` ou código de saída diferente de 0.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-05/form-componentes.png`, a prancha com as 32 capturas rotuladas (8 estados, dois tamanhos, dois temas).
- `app-x-prototipo.txt` (automática): `node apps/web/scripts/evidence-shots.mjs prototipo`
  - Prova: o app (`/dev/forms`) e o protótipo aberto por `file://` (`prototype/atria-prototype.html#/journal/new`) lado a lado em 1440 px e em 360 px, nos dois temas, com as medidas lidas do DOM de cada um e comparadas: cor primária, fundo, fontes, tamanho e peso do título, marca em traço, nome em gradiente, tamanho do nome, sidebar, topbar e links sem sublinhado (pedido do usuário).
  - Trecho: `ok ... cor primária (--primary) igual ao protótipo · app #6D28D9 · protótipo #6D28D9`, `ok ... marca em traço "M3 20L12 4l9 16" no app`, `ok ... nome "Atria" com texto em gradiente no app`, `ok ... largura da sidebar igual ao protótipo`, `ok ... links sem sublinhado igual ao protótipo`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-05/app-x-prototipo.png (8 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` com `app X · protótipo Y` (cor, tamanho ou espaço diferentes, "A" sólido, nome em preto, links sublinhados), a ausência da linha `png:` ou código de saída diferente de 0.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-05/app-x-prototipo.png`, a prancha com as 4 comparações (app à esquerda e protótipo à direita). Em 360 px a topbar do protótipo quebra a busca em duas linhas; a verificação aceita o app com altura menor ou igual.

### Concluída quando

- [x] Toda tela autenticada fica dentro de um layout com sidebar (marca, navegação "Principal" e, no rodapé, o perfil com o menu da conta: Configurações, Alternar tema e Sair) e topbar (gatilho da busca com a dica do atalho, breadcrumbs e informações da tela), com o conteúdo limitado a 1360 px, em desktop e em 360 px (RF-14, CT-11, PD-18, PD-23).

  > Como comprovar: em `web-tests.txt`, ver os doze testes `AppLayout` com `✓`; em `layout-telas.txt`, ver só linhas `ok` e `ok  0 falha(s)`, e em `layout-telas.png`, ver a sidebar, o menu da conta e a topbar em desktop e a gaveta em 360 px.

- [x] O cabeçalho da página fica preso abaixo da topbar, compacta depois de 48 px de rolagem com o desfoque, recebe o foco a cada troca de tela sem contorno visível e mostra o "Voltar" que leva à última listagem ou dashboard de origem; a visualização das listagens é lembrada por módulo e por aba (PD-20, PD-21, PD-22, PD-24).

  > Como comprovar: em `web-tests.txt`, ver os testes `StickyPageHeader`, `useBackTarget`, `focuses the page heading on route change` e `remembers the view per module and per tab` com `✓`; em `layout-telas.txt`, ver `título compacto (24 px)`, e em `layout-telas.png`, ver o cabeçalho compacto.

- [x] Os formulários usam os componentes próprios de `@atria/ui`: seletor próprio no lugar do `<select>`, grupo segmentado para escolhas de até 3 opções e para a visibilidade, calendário próprio em todo campo de data, hora em 24 h que aceita "930", "9:30" e "09:30", etiquetas em pills e campos numéricos sem setas, numa grade de 880 px em duas colunas com "Cancelar" e "Salvar" à direita; nos detalhes, "Editar" e "Mais ações" com "Excluir" em vermelho (PD-11, PD-14, PD-19, PD-57, PD-62).

  > Como comprovar: em `ui-form-tests.txt`, ver os testes dos componentes com `✓`; a "Verificação" não acha `<select>` nem `type="date"`, `"time"` ou `"datetime-local"` em `packages/ui` e `apps/web`; em `form-componentes.txt`, ver só linhas `ok`, inclusive `campo de hora normalizou "930"`, e em `form-componentes.png`, ver os componentes nos dois temas e em 360 px.

- [x] O seletor de cor tem a roda de matiz e saturação, a luminosidade, os campos HEX, RGB e HSL sincronizados e a prévia, é operável pelo teclado (setas laterais na matiz, verticais na saturação, Shift com passo maior) e grava um HEX livre `#RRGGBB`; os botões têm as variações `muted` (só texto e ícone, com a cor da raia quando pedida) e `success` (verde claro, verde cheio quando ativo) (PD-02, PD-03, PD-12).

  > Como comprovar: em `ui-form-tests.txt`, ver os testes `color`, `ColorField` e `Button` com `✓`; em `form-componentes.txt`, ver `HEX inicial #7C3AED`, e em `form-componentes.png`, ver o seletor de cor aberto e os botões nos dois temas.

- [x] O seletor de período tem os presets que cada tela passar (por padrão Este mês, Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano e Qualquer período, com Este mês como padrão) e o intervalo personalizado no calendário próprio, devolve `{ preset, from?, to? }` sem datas em "Qualquer período" e abre centralizado sob o campo nos formulários, para o Financeiro e os relatórios usarem o mesmo componente (PD-55, PD-57, PD-61).

  > Como comprovar: em `ui-form-tests.txt`, ver os testes `resolvePeriod` e `PeriodField` com `✓`; em `form-componentes.txt`, ver `preset "Este mês" marcado`, e em `form-componentes.png`, ver o seletor aberto sob o campo.

- [x] O tema é claro por padrão, segue o sistema quando a pessoa nunca escolheu e guarda a escolha no navegador, com os tokens vigentes do ecossistema (RNF-10).

  > Como comprovar: em `web-tests.txt`, ver os quatro testes `ThemeProvider` com `✓`; em `layout-telas.txt`, ver `tema claro aplicado` e `tema escuro aplicado`, e em `layout-telas.png`, ver os dois temas legíveis.

- [x] As mutações aparecem na hora e são desfeitas, com aviso, quando o servidor recusa (RNF-09).

  > Como comprovar: em `web-tests.txt`, ver `✓ ... useOptimisticMutation > rolls back and shows a toast when the server refuses`.

- [x] O cliente HTTP é genérico, envia o token CSRF nas mutações e transforma erros `problem+json` em erros com código estável, sem depender dos contratos gerados.

  > Como comprovar: em `web-tests.txt`, ver os seis testes `createApiClient` com `✓`; a "Verificação" não acha `@atria/contracts` em `shared` nem em `app`.

- [x] O layout não tem violações no axe, é navegável por teclado com foco visível, e o build não tem script inline nem recurso externo (RNF-05, RNF-06).

  > Como comprovar: ver `✓ ... AppLayout > has no axe violations`; a "Verificação" confere o `index.html` compilado; em `layout-telas.txt`, ver `contorno de foco visível`, e em `layout-telas.png`, ver o contorno de foco.

- [x] O pacote declara as dependências de todas as features e o Playwright encontra os arquivos `*.e2e.ts` das features nos quatro tamanhos de tela (RNF-08).

  > Como comprovar: rodar a "Verificação" e ver `dependências do @atria/web ok` e `verificação da TASK-05 ok`.

- [x] O app é visualmente igual ao protótipo: marca (quadrado em gradiente com o SVG de traço e o nome com texto em gradiente), tokens, tipografia, sidebar, topbar, cabeçalho de página, cartão do formulário, rótulos, campos, botões, chips, popovers e links sem sublinhado, nos dois temas, em 1440 px e em 360 px (pedido do usuário).

  > Como comprovar: em `app-x-prototipo.txt`, ver só linhas `ok` com `app X · protótipo X`, e em `app-x-prototipo.png`, comparar as duas imagens; a "Verificação" confere o SVG da marca; em `web-tests.txt` e `ui-form-tests.txt`, ver `✓ ... BrandLogo > renders the prototype mark and the gradient name` e `✓ ... prototype tokens > mirror the prototype in both themes`.

- [x] A preferência `create_layout` (`'grid'` ou `'list'`, padrão `'grid'`) é lida e gravada por `usePreferences()` no navegador, separada por usuário, segue a mudança feita em outra aba (evento `storage`) e recua para o padrão quando o armazenamento falha (DEC-008, PD-10).

  > Como comprovar: em `shared-dec008-tests.txt`, ver os testes `usePreferences` com `✓`.

- [x] Há um único editor da regra de recorrência em `shared/forms` (`RecurrenceFields`, `FormRecurrence` e `summarizeRule`) com frequência, intervalo, dias da semana, dia do mês, horário (opcional por `with_time`), início e fim, que mostra só os campos da frequência escolhida e resume a regra em texto legível, para o Financeiro, as Tarefas e os Lembretes (DEC-008).

  > Como comprovar: em `shared-dec008-tests.txt`, ver os testes `RecurrenceFields`, `FormRecurrence` e `summarizeRule` com `✓`.

- [x] O `CreateTypeDialog` abre centralizado com um cartão por tipo, em grade ou em lista conforme `create_layout`, com o tipo da aba focado, setas entre os cartões, Enter que abre, Esc que fecha devolvendo o foco ao gatilho e sem violações no axe (DEC-008, PD-09, PD-10).

  > Como comprovar: em `shared-dec008-tests.txt`, ver os testes `CreateTypeDialog` com `✓`.

## Descrição

### Resumo executivo

Cria a base da aplicação web do Atria: a moldura comum de todas as telas (menu lateral, barra superior com a busca, trilha de navegação e troca de tema) e os recursos que todas as telas usam.
Cada módulo passa a ser construído só com a sua parte, já com a aparência, a acessibilidade e o comportamento validados no protótipo; pelas decisões do protótipo, a base também traz os componentes próprios dos formulários (lista de opções, botões de escolha, calendário, hora em 24 h e etiquetas), o formulário padrão de duas colunas, o seletor de cor, o seletor de período, os botões discreto e de sucesso, o menu da conta no rodapé do menu lateral, o "Voltar" e o cabeçalho que fica preso e compacta ao rolar.
Perfil de execução padrao: decisões locais de estrutura, dentro do layout já validado.
Risco médio: uma base mal resolvida se repete em todas as telas; os testes automáticos e as pranchas geradas por script reduzem esse risco.
Desbloqueia todas as telas do MVP (TASK-19 a TASK-34) e a autohospedagem (TASK-36).

### Detalhes técnicos

**Abordagem.** Pacote `@atria/web` com Vite, React, TanStack Router (rotas por código) e TanStack Query. `src/app` é o ponto de integração: roteador raiz, registro vazio de rotas e itens de navegação (preenchido pela TASK-35), provedores, layout e tema. `src/shared` é o código comum das features: cliente HTTP, interface otimista, avisos, i18n, formatação, preferências, estado na URL, tipos de navegação e auxiliares de teste. Cada feature expõe `routes.tsx`, `nav.ts` e `i18n/pt-br.json` e nunca altera `src/app`. Os componentes genéricos de formulário e de ação pedidos pelas decisões do protótipo entram em `packages/ui` ([project/architecture-08]), e as ligações deles ao `react-hook-form` em `src/shared/forms`; as telas com formulário (TASK-21 a TASK-34) só os usam.

**Componentes.** `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app` e `apps/web/src/shared`, mais `tsconfig.json`, `eslint.config.js` e `playwright.config.ts` de `apps/web`, necessários para compilar, analisar e testar o pacote. Em `packages/ui`: `SelectField` (reescrito), `SegmentedField`, `TimeField`, `Calendar`, `DateField`, `DateTimeField`, `TagField`, `MenuButton`, `FormGrid`, `FormActions`, `ColorField` com `ColorPicker`, `PeriodField` com `resolvePeriod`, as variações `muted` e `success` do `Button` e as mudanças de `PageHeader` e `TextField`. Em `apps/web/src/shared`, pela DEC-008: `preferences-context` com `create_layout`, `forms/recurrence-fields.tsx` (`RecurrenceFields`, `FormRecurrence`, `summarizeRule`) e `forms/create-type-dialog.tsx` (`CreateTypeDialog`).

**Decisões.**
- Rotas por código, com `featureRoutes` e `navItems` registrados em `src/app`. Descartado: o plugin de rotas por arquivo do TanStack Router, que gera um arquivo único de árvore de rotas, editado por todas as features em paralelo (conflito no ponto de integração).
- Cliente HTTP próprio sobre `fetch`, tipado pelo parâmetro genérico. Descartado: `openapi-fetch` ligado aos tipos de `@atria/contracts`, que só existem depois da TASK-18; as features passam os tipos gerados como parâmetro.
- i18n próprio e pequeno, com `Intl.PluralRules`. Descartado: `i18next` e `react-i18next`, duas dependências para o que o MVP usa (pt-br, interpolação e plural).
- Interface otimista por um hook sobre `useMutation`, com snapshot e rollback no cache do TanStack Query ([project/frontend-18]). Descartado: `useOptimistic` do React, que não desfaz o cache compartilhado entre telas.
- Tema sem script inline no `index.html`, para respeitar a CSP sem inline da TASK-04 ([project/security-11]). O custo é um instante com o tema claro antes de aplicar a escolha escura salva. Descartado: script inline de pré-pintura com hash na CSP, que acoplaria a CSP do servidor ao conteúdo do `index.html`.
- Paleta aberta por um store em `shared` (`openCommandPalette`), porque a topbar (aqui) e a paleta (TASK-32) vivem em lugares diferentes e a paleta só é registrada pela TASK-35.
- `RouteMeta.layout = 'bare'` para as telas sem sidebar nem topbar (modo leitura, decisão 49, e telas de entrada).
- Todas as dependências das features no `package.json`, porque nenhuma feature altera este arquivo; `@atria/contracts` fica de fora até existir.
- Nomes acessíveis comuns "Filtros", "Busca" e "Visualização" no i18n comum, usados por toda listagem e pelos testes ponta a ponta da TASK-35.
- Seletor próprio no lugar do `<select>` em todo o app, reescrevendo o `SelectField` da TASK-03, que não tinha uso, em vez de criar um segundo componente (PD-62). Descartado: manter o `SelectField` nativo ao lado do novo, o que deixaria o controle nativo disponível para as telas.
- Grupo segmentado para escolhas obrigatórias de até 3 opções e para a visibilidade (PD-62); acima disso, o seletor próprio.
- Um único `Calendar`, com os modos de um dia e de intervalo, para todos os campos de data e para o seletor de período da TASK-22 (PD-57). Descartado: o `<input type="date">` nativo, que muda em cada sistema.
- Data e hora como `DateField` mais `TimeField` em 24 h, com o valor local `YYYY-MM-DDTHH:mm`; a conversão para UTC fica em cada feature, pelo fuso das preferências (PD-62).
- Todos os formulários com 880 px e duas colunas, e as ações à direita (PD-62, que vale sobre os 640 px da PD-19).
- "Configurações", "Alternar tema" e "Sair" no menu do perfil, no rodapé da sidebar, e não na navegação principal (PD-23).
- "Mais ações" e menu do perfil pelo mesmo `MenuButton` (PD-14, PD-23).
- Foco no título a cada troca de rota, sem contorno, para o leitor de tela anunciar a página (PD-22).
- Origem do "Voltar" guardada por módulo em `sessionStorage`, e visualização lembrada por módulo e aba em `localStorage`, sempre com `try/catch` (PD-21, PD-24).
- Seletor de cor próprio, com a cor gravada como HEX livre e não como token do tema, aberto num diálogo como no protótipo (PD-12, DEC-002). Descartado: o `<input type="color">` nativo, que muda em cada sistema e não tem os campos RGB e HSL.
- Um único `PeriodField` na base, com os presets configuráveis por tela, porque o Financeiro (TASK-22) e os relatórios (TASK-34) usam o mesmo seletor e rodam em paralelo na onda 7 (PD-55, PD-61). O valor `{ preset, from?, to? }` vira `from` e `to` na API por `resolvePeriod`; "Qualquer período" vai sem datas (DEC-004). Descartado: cada tela implementar o seu seletor.
- Variações `muted` e `success` no próprio `Button`, com a cor de matiz por `--button-tint` (PD-02, PD-03).
- Rota `/dev/forms` só no modo de desenvolvimento, para as evidências visuais dos componentes sem depender de uma tela de feature.
- DEC-008: a preferência `create_layout`, o editor da regra de recorrência e o diálogo de escolha do tipo ficam na base, porque telas da mesma onda os usam e tarefas da mesma onda não dividem arquivos. Descartado: uma cópia por tela e a preferência dentro da feature de Configurações.
- `create_layout` no `preferences-context`, guardado em `atria.settings.create_layout.<userId>` com `try/catch`; o `QueryClientProvider` sobe acima do `PreferencesProvider`, que lê o usuário de `useCurrentUser`. Sem o usuário carregado, vale o padrão e nada é gravado.
- `RecurrenceFields` controlado (`value`/`onChange` da regra inteira) e `FormRecurrence` com `react-hook-form`; os textos chegam por `labels` (montados do i18n comum pelo `FormRecurrence`), e `summarizeRule` usa as mensagens `common` do i18n da base (`recurrence_summary_*`, `weekday_summary_*`), sem texto literal e sem texto nas features. O horário é opcional por `with_time` e `time_required`.
- `CreateTypeDialog` em `<dialog>` modal nativo, na forma do `ConfirmDialog` (Esc, foco devolvido), com cartões `<a href>`; as telas passam o título e a descrição do módulo.

**Evidências visuais.** As três pranchas (`layout-telas.png`, `form-componentes.png` e `app-x-prototipo.png`) são geradas por `apps/web/scripts/evidence-shots.mjs`, no mesmo espírito do `prototype/smoke-test.mjs` da TASK-01: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG, e a prancha vai para a pasta de evidências da tarefa. O script sobe o Vite numa porta livre (a `/dev/forms` só existe em desenvolvimento), usa o Chromium do `@playwright/test`, abre o protótipo por `file://` e monta cada prancha numa página com as imagens, sem dependência externa. A prancha do layout não inclui a navegação nem o nome do usuário: a sidebar não tem itens até a TASK-35 registrar as features, e o nome só aparece com o `GET /me` (sem servidor, o rodapé mostra só o avatar).

**Riscos técnicos.** O Lighthouse da TASK-35 depende do build enxuto: o `pdfjs-dist` só pode ser carregado na rota do modo leitura (import dinâmico na TASK-29). Sem a TASK-04 pronta no momento do teste local, o proxy de `/api` falha, sem afetar os testes, que usam `fetch` falso. Os campos de `GET /me` usados no rodapé (`display_name` e `avatar_url`) dependem do contrato da TASK-06; sem eles, o rodapé mostra o e-mail e as iniciais. O popover do seletor, do calendário e dos menus precisa reposicionar perto das bordas e dentro de diálogos, como no protótipo.

**Referências da spec e do protótipo.** RF-14, CT-11; RNF-05, RNF-06, RNF-08, RNF-09, RNF-10; FA-04; decisões 16, 32, 39, 48, 49, 53, 54, 56 e 57; PD-02, PD-03, PD-11, PD-12, PD-14, PD-18 a PD-24, PD-55, PD-57, PD-61 e PD-62 de `docs/decisoes-do-prototipo.md`; DEC-001 e DEC-002.

**Arquivos em comum na onda 4.** Nenhum: as tarefas da onda 4 (TASK-06 a TASK-15) só mexem em `apps/server/src/<contexto>`. `apps/web/src/app` volta a ser alterado só pela TASK-35, na onda 8. `packages/ui` não é alterado por outra tarefa da onda 4.

### Card

- **Título:** Base do frontend
- **Tipo:** tarefa
- **Descrição:** Base do frontend React com rotas, layout de sidebar e topbar, tema claro e escuro, cliente HTTP com CSRF, interface otimista, i18n, formatação com `Intl` e as configurações de teste e de ponta a ponta usadas por todas as telas, mais os componentes próprios de formulário (inclusive os seletores de cor e de período), as variações de botão e o layout das decisões do protótipo, e as peças compartilhadas da DEC-008: preferência do botão de criar, editor da regra de recorrência e diálogo de escolha do tipo.
- **Critérios de aceite:**
  - [ ] Layout com sidebar e topbar em desktop e em 360 px, sem violações no axe, com o conteúdo até 1360 px e o menu da conta no rodapé (PD-18, PD-23).
  - [ ] Cabeçalho preso que compacta ao rolar, foco no título a cada tela, "Voltar" para a origem e visualização lembrada por módulo (PD-20 a PD-22, PD-24).
  - [ ] Seletor próprio, grupo segmentado, calendário em todo campo de data, hora em 24 h, etiquetas em pills e campos numéricos sem setas, num formulário de 880 px em duas colunas com as ações à direita (PD-11, PD-14, PD-57, PD-62).
  - [ ] Seletor de período com presets configuráveis e intervalo no calendário, o mesmo para o Financeiro e os relatórios (PD-55, PD-57, PD-61).
  - [ ] Seletor de cor com roda, luminosidade, HEX, RGB e HSL sincronizados, operável pelo teclado e gravando HEX livre, e botões `muted` e `success` (PD-02, PD-03, PD-12).
  - [ ] Tema claro padrão e escuro, com a escolha guardada.
  - [ ] Mutações otimistas desfeitas com aviso quando o servidor recusa.
  - [ ] Cliente HTTP genérico com CSRF e erros com código estável.
  - [ ] Build sem script inline e Playwright pronto para as features.
  - [ ] Visual idêntico ao do protótipo, incluindo a marca, os tokens, os componentes e os links sem sublinhado, nos dois temas (pedido do usuário).
  - [ ] Preferência `create_layout` em `usePreferences()`, editor único da regra de recorrência e diálogo de escolha do tipo em grade ou lista, na base para as telas da onda 7 (DEC-008, PD-09, PD-10).
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, contrato GET /me e o estado de packages/ui; seletor próprio no lugar do select nativo, reescrevendo o SelectField (PD-62); grupo segmentado SegmentedField (PD-62); campo de hora em 24 h com parseTime (PD-62); campos numéricos sem setas (PD-62); FormGrid de 880 px em duas colunas e FormActions à direita (PD-19, PD-62); Calendar e DateField próprios em todo campo de data e DateTimeField (PD-57, PD-62); TagField em pills (PD-11); MenuButton e PageHeader com Mais ações e ações na base do título (PD-14); conteúdo até 1360 px (PD-18); cabeçalho preso que compacta (PD-20); Voltar para a origem (PD-21); foco no título por rota (PD-22); perfil e menu da conta no rodapé, sem Configurações na navegação (PD-23); visualização lembrada por módulo e aba (PD-24); rota /dev/forms só em dev para evidências; Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 4 | 2026-10-30 | ajuste | in_progress | Seletor de cor ColorField e ColorPicker em packages/ui com roda de matiz e saturação, luminosidade, HEX, RGB e HSL sincronizados, prévia, teclado com Shift e HEX livre (PD-12); variação muted do Button com cor de matiz opcional (PD-02); variação success do Button com estado ativo (PD-03); canvas falso no setup de teste, FormColor e prévia em /dev/forms; Ler, testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 5 | 2026-10-30 | ajuste | in_progress | PeriodField e resolvePeriod em packages/ui: botão com o rótulo do período, popover com presets configuráveis por tela (padrão Este mês, Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano, Qualquer período) e intervalo personalizado no Calendar, valor { preset, from?, to? } sem datas em Qualquer período, centralizado sob o campo em formulário (PD-55, PD-57, PD-61); FormPeriod, textos do i18n e prévia em /dev/forms; Ler, testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 6 | 2026-10-30 | ajuste | in_progress | Fidelidade visual ao protótipo, incluindo o logo (pedido do usuário): tokens --s1 a --s10 e teste de tokens contra o protótipo em packages/theme; BrandLogo em packages/ui; sidebar, topbar, global.css, form-layout, page-header, text-field e demais CSS dos componentes alinhados; Ler, Passos, Verificação, evidência app-x-prototipo.png, critério de conclusão e card |
| 7 | 2026-10-30 | ajuste | in_progress | Edição manual |
| 8 | 2026-10-30 | ajuste | in_progress | Ler com DEC-008, contrato da regra de recorrência, TASK-22, TASK-24 e TASK-25 e PD-09 e PD-10 do protótipo; preferência create_layout em usePreferences e providers.tsx (PD-10); RecurrenceFields, FormRecurrence e summarizeRule em shared/forms; CreateTypeDialog em shared/forms (PD-09); passos 17 e 18; Verificação; evidência shared-dec008-tests.txt; três critérios de Concluída quando; Detalhes técnicos e card (DEC-008) |
| 9 | 2026-10-30 | ajuste | in_progress | Edição manual |
| 10 | 2026-10-30 | ajuste | in_progress | Evidências manuais (layout-telas.png, form-componentes.png, app-x-prototipo.png) trocadas por automáticas (layout-telas.txt, form-componentes.txt, app-x-prototipo.txt) geradas por apps/web/scripts/evidence-shots.mjs, com as pranchas PNG como Artefato; navegação e nome do usuário removidos da prancha do layout; script incluído em Mudar e eslint ignorando scripts; passos 14 e 16, Verificação, Como comprovar dos critérios, Resumo executivo e Detalhes técnicos atualizados |
| 11 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 12 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 13 | 2026-10-30 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): apps/web/src criada pela própria tarefa (defeito da issue 6); aceito(s): 2 |
| 14 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 15 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 1 aceito(s) pelo usuário; 1 ignorado(s) por medir a entrega |
| 16 | 2026-10-30 | evidências | passed | 7 evidência(s) em evidence/TASK-05/ |
| 17 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, contrato GET /me e o estado de packages/ui; seletor próprio no lugar do select nativo, reescrevendo o SelectField (PD-62); grupo segmentado SegmentedField (PD-62); campo de hora em 24 h com parseTime (PD-62); campos numéricos sem setas (PD-62); FormGrid de 880 px em duas colunas e FormActions à direita (PD-19, PD-62); Calendar e DateField próprios em todo campo de data e DateTimeField (PD-57, PD-62); TagField em pills (PD-11); MenuButton e PageHeader com Mais ações e ações na base do título (PD-14); conteúdo até 1360 px (PD-18); cabeçalho preso que compacta (PD-20); Voltar para a origem (PD-21); foco no título por rota (PD-22); perfil e menu da conta no rodapé, sem Configurações na navegação (PD-23); visualização lembrada por módulo e aba (PD-24); rota /dev/forms só em dev para evidências; Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 2 | 2026-10-30 | agente | Seletor de cor ColorField e ColorPicker em packages/ui com roda de matiz e saturação, luminosidade, HEX, RGB e HSL sincronizados, prévia, teclado com Shift e HEX livre (PD-12); variação muted do Button com cor de matiz opcional (PD-02); variação success do Button com estado ativo (PD-03); canvas falso no setup de teste, FormColor e prévia em /dev/forms; Ler, testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 3 | 2026-10-30 | agente | PeriodField e resolvePeriod em packages/ui: botão com o rótulo do período, popover com presets configuráveis por tela (padrão Este mês, Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano, Qualquer período) e intervalo personalizado no Calendar, valor { preset, from?, to? } sem datas em Qualquer período, centralizado sob o campo em formulário (PD-55, PD-57, PD-61); FormPeriod, textos do i18n e prévia em /dev/forms; Ler, testes, Verificação, Evidências, Concluída quando, Detalhes técnicos e card atualizados |
| 4 | 2026-10-30 | agente | Fidelidade visual ao protótipo, incluindo o logo (pedido do usuário): tokens --s1 a --s10 e teste de tokens contra o protótipo em packages/theme; BrandLogo em packages/ui; sidebar, topbar, global.css, form-layout, page-header, text-field e demais CSS dos componentes alinhados; Ler, Passos, Verificação, evidência app-x-prototipo.png, critério de conclusão e card |
| 5 | 2026-10-30 | manual | Edição manual |
| 6 | 2026-10-30 | agente | Ler com DEC-008, contrato da regra de recorrência, TASK-22, TASK-24 e TASK-25 e PD-09 e PD-10 do protótipo; preferência create_layout em usePreferences e providers.tsx (PD-10); RecurrenceFields, FormRecurrence e summarizeRule em shared/forms; CreateTypeDialog em shared/forms (PD-09); passos 17 e 18; Verificação; evidência shared-dec008-tests.txt; três critérios de Concluída quando; Detalhes técnicos e card (DEC-008) |
| 7 | 2026-10-30 | manual | Edição manual |
| 8 | 2026-10-30 | agente | Evidências manuais (layout-telas.png, form-componentes.png, app-x-prototipo.png) trocadas por automáticas (layout-telas.txt, form-componentes.txt, app-x-prototipo.txt) geradas por apps/web/scripts/evidence-shots.mjs, com as pranchas PNG como Artefato; navegação e nome do usuário removidos da prancha do layout; script incluído em Mudar e eslint ignorando scripts; passos 14 e 16, Verificação, Como comprovar dos critérios, Resumo executivo e Detalhes técnicos atualizados |
