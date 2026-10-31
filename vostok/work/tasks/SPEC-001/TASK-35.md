---
id: TASK-35
spec: SPEC-001
title: "Integração do frontend"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-19, TASK-20, TASK-21, TASK-22, TASK-23, TASK-24, TASK-25, TASK-26, TASK-27, TASK-28, TASK-29, TASK-30, TASK-31, TASK-32, TASK-33, TASK-34]
wave: 8
covers: [RF-20, RF-21, CT-14, CT-15]
type: tarefa
labels: [SPEC-001, julgamento]
status: approved
content_hash: aee59895e8045e53dc5abf6dc2095fda24c7be1b1d3a020b1afcfdb0d615ffa8
adjustments: 2
adjusted_at: 2026-10-30T22:04:33Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: aee59895e8045e53dc5abf6dc2095fda24c7be1b1d3a020b1afcfdb0d615ffa8
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T22:04:33Z
---

# TASK-35: Integração do frontend

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-19, RF-20, RF-21, CT-13, CT-14, CT-15, RN-17, RNF-05, RNF-06, RNF-08, RNF-10 e decisões 26, 53, 54, 56 e 57.
- `vostok/rules/project/frontend.md`, `vostok/rules/project/architecture.md`, `vostok/rules/project/code-style.md`, `vostok/rules/project/testing.md`, `vostok/rules/project/language.md` e `vostok/rules/project/naming-convention.md`.
- `prototype/atria-prototype.html`: layout, listagens e aba Conexões validados (TASK-01), com a visibilidade no cartão "Registro" da visão geral (`reg`) e no formulário de cada tipo, sem controle acima das abas (DEC-006); pelas decisões do protótipo, o template `#entity-detail` (abas "Visão geral", as extras de `EXTRA_TABS` e "Conexões"), `projectOverviewHTML` (cartão "Ligações"), o menu do perfil (`#profile-menu`) com Configurações, `REPORTS`, `REP_ENTITY` e o menu "Relatórios" dos módulos.
- `docs/decisoes-do-prototipo.md`: a tabela PD-xx (em especial PD-14, PD-19, PD-23, PD-36, PD-41, PD-46, PD-57, PD-59, PD-61 e PD-62) e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa.
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-006`: DEC-002 (decisões do protótipo no MVP: capas de livro e artigo, cartão de projeto completo, nove relatórios com filtros por entidade), DEC-003 (a tarefa ligada ao cartão é uma ligação do contexto links e aparece em Conexões), DEC-004 (relatórios sem período) e DEC-006 (item 2: sai o botão de alternar a visibilidade acima das abas; a visibilidade muda pelo formulário da entidade e aparece no cartão "Registro").
- `vostok/work/tasks/SPEC-001/TASK-05.md`: o menu do perfil com Configurações, Alternar tema e Sair (PD-23), o `PageHeader` com "Voltar" e ações (PD-14, PD-21), o `PeriodField` de `packages/ui/src/period-field/`, seletor de período do Financeiro, do Diário e dos Relatórios, e os controles de formulário da base (PD-57, PD-62).
- `vostok/work/tasks/SPEC-001/TASK-23.md`, `TASK-24.md`, `TASK-25.md`, `TASK-26.md`, `TASK-27.md`, `TASK-28.md` e `TASK-30.md`: as telas de detalhe que montam as próprias abas e recebem `extra_tabs` (meta, tarefa, lembrete, nota, entrada do diário, livro, artigo e projeto), as rotas de detalhe novas `/tasks/$taskId` e `/reminders/$reminderId`, o formulário do cartão (`/projects/$projectId/cards/new` e `/projects/$projectId/cards/$cardId`), a propriedade `links_slot` da Visão geral do projeto e as capas por upload (`PUT|DELETE /books/{id}/cover` e `/articles/{id}/cover`, exibidas por `/api/v1/files/{id}`).
- `vostok/work/tasks/SPEC-001/TASK-31.md`: `ConnectionsTab({ entity_type, entity_id })` e `ConnectionsSummary({ entity_type, entity_id, limit })`.
- `vostok/work/tasks/SPEC-001/TASK-34.md` e `vostok/work/tasks/SPEC-001/TASK-17.md`: as rotas `/reports`, `/reports/$report` e `/reports/exports`, os nove ids do catálogo e os filtros por entidade; os módulos e as entidades emitem os relatórios por `/reports/<id>?<filtro>_id=<id>&run=1&from_module=<módulo>` (TASK-22, TASK-23, TASK-28 e TASK-30).
- `apps/web/src/app`: roteador raiz, layout com sidebar e topbar, registro de rotas e navegação, tema e carregamento das traduções (TASK-05).
- `apps/web/src/shared`: cliente da API sobre `@atria/contracts`, interface otimista e i18n comum (TASK-05).
- `packages/contracts/src/index.ts`: `paths` e o schema do tipo de entidade das ligações (TASK-18).
- `packages/ui`: componentes de listagem (filtros, busca, modos de visualização, estados vazio, carregando e erro), abas e grupo de opções (TASK-03).
- `apps/web/src/features/auth/routes.tsx`, `apps/web/src/features/admin/routes.tsx`, `apps/web/src/features/dashboard/routes.tsx`, `apps/web/src/features/finance/routes.tsx`, `apps/web/src/features/goals/routes.tsx`, `apps/web/src/features/tasks/routes.tsx`, `apps/web/src/features/reminders/routes.tsx`, `apps/web/src/features/notes/routes.tsx`, `apps/web/src/features/journal/routes.tsx`, `apps/web/src/features/library/routes.tsx`, `apps/web/src/features/reader/routes.tsx`, `apps/web/src/features/projects/routes.tsx`, `apps/web/src/features/connections/routes.tsx`, `apps/web/src/features/command-palette/routes.tsx`, `apps/web/src/features/settings/routes.tsx` e `apps/web/src/features/reports/routes.tsx`, com os `nav.ts` das features que têm item na sidebar.
- `apps/web/src/features/connections`: o componente exportado da aba Conexões e as props que ele recebe (TASK-31).
- Os `*.e2e.ts` de `apps/web/src/features` e o utilitário de sessão de teste que a TASK-19 usa, para reaproveitar.
- `apps/web/playwright.config.ts`, `apps/web/package.json` e `lighthouserc.json`: padrão dos arquivos ponta a ponta, servidor de teste, `@axe-core/playwright` e telas do Lighthouse (TASK-02 e TASK-05).

### Mudar

- `apps/web/src/app` (alterar): o roteador raiz e a sidebar passam a usar o registro das 16 features; o layout autenticado monta uma vez o `ReminderNotifier` (TASK-25) e o `CommandPaletteProvider` (TASK-32), com o `PaletteTrigger` na topbar; o carregador de traduções inclui as do app.
- `apps/web/src/app/feature-registry.ts` (criar): chama `create<Feature>Routes(parent)` das 15 features sob o layout autenticado e `createReaderRoutes(root_route)` fora dele, junta os `<feature>NavItem` dos `nav.ts` na sidebar e envolve cada rota de entidade com o layout de entidade.
- `apps/web/src/app/feature-registry.test.ts` (criar): todas as features registradas, sem rota duplicada, itens da sidebar na ordem, toda rota de entidade mapeada e as rotas de destino de `ENTITY_CATEGORIES` (TASK-31) e de "abrir para completar" (TASK-32) registradas.
- `apps/web/src/app/entity-types.ts` (criar): mapa de cada rota de detalhe para o tipo de entidade das ligações e para as rotas `GET` e `PATCH` da API, tipado por `@atria/contracts`.
- `apps/web/src/app/entity-layout.tsx` (criar): `EntityLayout`, sem cabeçalho próprio e sem controle de visibilidade (a visibilidade muda pelo formulário da feature e aparece no cartão "Registro" dela, DEC-006) (o cabeçalho com "Editar" e "Mais ações" é da tela da feature, PD-14); nas telas que montam as próprias abas (meta, tarefa, lembrete, nota, entrada do diário, livro, artigo e projeto), passa `ConnectionsTab` (e `HighlightsTab` em livro e artigo) por `extra_tabs` e, no projeto, `ConnectionsSummary` por `links_slot`; nas demais, as abas "Visão geral" e "Conexões" controladas pela URL (PD-41, PD-59).
- `apps/web/src/app/entity-layout.test.tsx` (criar): abas, aba pela URL, ausência do controle de visibilidade (DEC-006), estados de carregando e erro e axe.
- `apps/web/src/app/listing-standard.test.ts` (criar): toda rota de listagem aceita na URL `q`, `view` e os filtros.
- `apps/web/src/app/i18n/entity-layout.pt-br.json` (criar): textos das abas.
- `apps/web/src/app/e2e-session.ts` (criar): sessão de teste pela API (admin com TOTP e dois usuários) e dados de exemplo, se a TASK-19 não exportar um utilitário reaproveitável.
- `apps/web/src/app/listings.e2e.ts` (criar): CT-14 em cada módulo.
- `apps/web/src/app/visibility.e2e.ts` (criar): CT-15 com dois usuários, com a visibilidade mudada pelo formulário e conferida no cartão "Registro", e a visibilidade em toda tela de entidade (DEC-006).
- `apps/web/src/app/navigation.e2e.ts` (criar): todos os itens da sidebar abrem, toda tela de entidade tem a aba Conexões, os links da aba Conexões e o "abrir para completar" da paleta levam a telas registradas, o lembrete e a paleta estão montados, por mouse e teclado.
- `apps/web/src/app/accessibility.e2e.ts` (criar): axe nas telas principais, nos dois temas.
- `apps/web/src/app/lighthouse-login.cjs` (criar): script de login do Lighthouse CI (Puppeteer), que prepara um usuário de auditoria pela API e entra antes de auditar as telas autenticadas.
- `lighthouserc.json` (alterar): confirma as telas em `http://localhost:4173` (vite preview), acrescenta `puppeteerScript` com o script de login e `settings.disableStorageReset: true`, para a sessão valer em todas as telas.
- `.github/workflows/ci.yml` (alterar): o job `lighthouse` sobe o PostgreSQL e o servidor antes do `pnpm lhci`, com as variáveis do usuário de auditoria.
- `apps/web/src/app/visual.e2e.ts` (criar): capturas das telas principais em 360, 480, 720 e 1280 px, nos temas claro e escuro.
- `apps/web/src/app/prototype-routes.e2e.ts` (criar): as rotas novas das decisões do protótipo de ponta a ponta: formulário do cartão, relatórios emitidos pelo módulo e pela entidade, capas e Configurações pelo menu do perfil (DEC-002, PD-23, PD-36, PD-46, PD-61).

### Passos

1. Leia os arquivos de "Ler". Confirme as interfaces das features: `create<Feature>Routes(parent)` em `routes.tsx` de todas (o reader exporta `createReaderRoutes(root_route)`, para ficar fora do layout autenticado, sem sidebar nem topbar), `<feature>NavItem` em `nav.ts`, `ReminderNotifier` exportado por `apps/web/src/features/reminders/index.ts` (TASK-25), `CommandPaletteProvider` e `PaletteTrigger` (TASK-32), `ConnectionsTab({ entity_type, entity_id })`, `ConnectionsSummary({ entity_type, entity_id, limit })` e `ENTITY_CATEGORIES` (TASK-31), `HighlightsTab({ item_type, item_id })` (TASK-29), a propriedade `extra_tabs` das telas de meta, tarefa, lembrete, nota, entrada do diário, livro, artigo e projeto (TASK-23 a TASK-28 e TASK-30), a propriedade `links_slot` da tela do projeto (TASK-30) e as rotas de "abrir para completar" de `palette-actions.ts` (TASK-32). A feature de Configurações não tem `nav.ts`: ela abre pelo menu do perfil da TASK-05 (PD-23). Se alguma faltar ou tiver outra assinatura, pare e registre o bloqueio da tarefa da feature. Anote também o schema do tipo de entidade das ligações em `@atria/contracts`, o `testMatch` do `apps/web/playwright.config.ts` e se `@axe-core/playwright` está em `apps/web/package.json`. Se o `testMatch` não incluir `src/app/*.e2e.ts` ou o `@axe-core/playwright` não estiver declarado, pare e registre o bloqueio: os dois arquivos são de outras tarefas.
2. Escreva primeiro `apps/web/src/app/feature-registry.test.ts`, que deve falhar: `registers all sixteen features`, `has no duplicated route path`, `lists sidebar items in the order of the prototype`, `maps every entity detail route to an entity type` (toda rota cujo caminho termina em `$id`, menos a de leitura `/read`, tem entrada em `entity-types.ts`) `covers every link entity type` (todo valor do tipo de entidade das ligações tem uma rota de detalhe), `registers reader outside the authenticated layout`, `registers every ENTITY_CATEGORIES route` (cada rota de `ENTITY_CATEGORIES` casa com uma rota registrada), `lighthouse urls are registered routes` (cada URL de `lighthouserc.json` casa com uma rota registrada), `registers every open-to-complete route` (cada rota de "abrir para completar" da paleta casa com uma rota registrada), `keeps settings out of the sidebar` (nenhum item da sidebar aponta para `/settings`, e a rota `/settings` está registrada, PD-23), `registers the card form routes` (`/projects/$projectId/cards/new` e `/projects/$projectId/cards/$cardId` registradas e o cartão de `ENTITY_CATEGORIES` casando com a segunda, PD-46), `registers the new detail routes` (`/tasks/$taskId` e `/reminders/$reminderId`, PD-59), `registers every report of the catalog` (`/reports`, `/reports/exports` e `/reports/<id>` para os nove ids `fin-flow`, `fin-cat`, `fin-diff`, `read-pages`, `lib-status`, `journal-emo`, `goals-progress`, `tasks-done` e `proj-cards`, PD-61) e `report links of modules and entities resolve to registered routes` (os caminhos `/reports/<id>?...&from_module=<módulo>` dos menus "Relatórios" e "Mais ações", lidos dos módulos de relatórios das features, como `GOALS_REPORTS` e `goalReportHref`, casam com `/reports/$report` e só usam os filtros do relatório no catálogo).
3. Crie `apps/web/src/app/entity-types.ts` com `ENTITY_ROUTES`, uma entrada por rota de detalhe das features (contas, movimentações, categorias, metas, tarefas `/tasks/$taskId`, lembretes `/reminders/$reminderId`, notas, entradas do diário, livros, artigos, vídeos, projetos e cartões `/projects/$projectId/cards/$cardId`), cada uma com `entity_type` (tipo das ligações), `detail_path` e `update_path` (chaves de `paths` de `@atria/contracts`) e `layout`: `extra_tabs` nas telas que montam as próprias abas (metas, tarefas, lembretes, notas, entradas do diário, livros, artigos e projetos), `generic` nas demais (contas, movimentações, categorias e vídeos) e `none` no formulário do cartão, que não é envolvido (PD-46), de modo que um caminho ou tipo inexistente quebre o typecheck.
4. Crie `apps/web/src/app/feature-registry.ts`: chama `create<Feature>Routes(authenticated_route)` das 15 features sob a rota do layout autenticado da TASK-05 e `createReaderRoutes(root_route)` direto na raiz; junta os `<feature>NavItem` na ordem do protótipo; e, para cada rota de `ENTITY_ROUTES` com `layout` diferente de `none`, troca o componente pelo `EntityLayout` com o componente original como conteúdo (`route.update({ component, validateSearch })`), acrescentando `tab: "overview" | "connections"` ao `validateSearch` original só nas de `layout: 'generic'`; nas de `layout: 'extra_tabs'`, a aba fica no `tab` que a própria feature já declara, e o id da aba extra é `connections` (e `highlights` em livro e artigo). Configurações não entra na sidebar (PD-23): a ordem dos itens é a do protótipo sem Configurações. Altere o roteador raiz e a sidebar de `apps/web/src/app` para usar só o registro, removendo qualquer lista de rotas ou itens escrita à mão, e monte uma vez no layout autenticado o `ReminderNotifier` e o `CommandPaletteProvider`, com o `PaletteTrigger` na topbar, no lugar do gatilho de busca provisório da TASK-05.
5. Escreva `apps/web/src/app/entity-layout.test.tsx`, que deve falhar: `renders the Visão geral tab by default`, `opens connections tab from tab=connections in the URL`, `passes connections and highlights as extra_tabs to book and article pages`, `passes connections as extra_tabs to the screens with their own tabs` (meta, tarefa, lembrete, nota, entrada do diário e projeto), `passes connections before Configurações in the project and the summary in links_slot` (no projeto, as abas ficam Visão geral, Quadro, Conexões e Configurações, e o cartão "Ligações" recebe `ConnectionsSummary`, PD-41, PD-42), `does not render a page header of its own` (o único `page-heading` é o da tela da feature, PD-14), `does not wrap the card form` (PD-46), `switches tab with arrow keys`, `shows loading and error states`, `has no axe violations` e `dec006 renders no visibility control above the tabs` (nenhum `radiogroup` "Visibilidade" nem botão de alternar a visibilidade fora do conteúdo da tela da feature, nas rotas `generic` e `extra_tabs`).
6. Crie `apps/web/src/app/entity-layout.tsx` (sem cabeçalho próprio: o `PageHeader` é o da tela da feature, PD-14; sem controle de visibilidade: a visibilidade é um campo do formulário de cada feature (`FormSegmented` "Pessoal" e "Compartilhada") e aparece no cartão "Registro" da visão geral, como no protótipo, DEC-006; nas rotas `layout: 'generic'`, abas com `role="tablist"`, a aba ativa vinda de `tab` na URL, "Visão geral" com o componente original e "Conexões" com `ConnectionsTab({ entity_type, entity_id })`; nas rotas `layout: 'extra_tabs'`, sem abas próprias do layout: o componente original recebe `extra_tabs` com `{ id: 'connections', label, render: ConnectionsTab({ entity_type, entity_id }) }` e, em livro e artigo, também `HighlightsTab({ item_type, item_id })`, e no projeto recebe `links_slot` com `ConnectionsSummary({ entity_type: 'project', entity_id, limit: 5 })`; as abas ficam na tela da feature, que põe as extras antes de Configurações no projeto). Só componentes de `packages/ui`, tokens do tema e textos de `apps/web/src/app/i18n/entity-layout.pt-br.json`, registrado no carregador de traduções da TASK-05.
7. Escreva e faça passar `apps/web/src/app/listing-standard.test.ts`: para cada rota de listagem do registro (as que estão na sidebar e as listagens internas, como contas, artigos e vídeos), o `validateSearch` aceita `q`, `view` e ao menos um filtro, e devolve os valores na URL. Se uma feature não seguir o padrão, não altere a feature: pare e registre o bloqueio com a rota e o parâmetro faltante.
8. Rode `pnpm --filter @atria/web test -- src/app` até passar.
9. Crie `apps/web/src/app/e2e-session.ts` só se a TASK-19 não exportar um utilitário de sessão: cria o admin por `/api/v1/setup`, ativa o TOTP com o código calculado por HMAC-SHA1 de `node:crypto` (RFC 6238, sem dependência nova), gera convites e cria `alice` e `bob`, e cria por API uma entidade de cada tipo para `alice`.
10. Escreva os ponta a ponta com nomes que começam pelo ID: `apps/web/src/app/listings.e2e.ts` (`CT-14 <módulo>: filtro, busca e visualizações ficam na URL`, um por listagem, conferindo os controles com os nomes acessíveis "Filtros", "Busca" e "Visualização", a mudança dos itens e os parâmetros na URL depois de recarregar), `apps/web/src/app/visibility.e2e.ts` (`CT-15 marcação compartilhada fica gravada e outro usuário recebe 404`: alice abre "Editar" de uma meta, escolhe "Compartilhada" no grupo "Visibilidade" do formulário, salva, vê "Compartilhada" no cartão "Registro" da visão geral e continua vendo depois de recarregar; bob abre a mesma URL e vê a tela de não encontrado; e `DEC-006 toda tela de entidade mostra a visibilidade no Registro e a muda pelo formulário`: para cada tipo de `ENTITY_ROUTES` com `layout` diferente de `none`, o detalhe da entidade de alice não tem controle de visibilidade acima das abas, o cartão "Registro" mostra "Visibilidade: Pessoal" e o formulário de edição tem o grupo "Visibilidade"; tela de feature sem a linha no "Registro" ou sem o campo no formulário é bloqueio da tarefa daquela feature), `apps/web/src/app/navigation.e2e.ts` (`sidebar abre todas as telas`, `toda tela de entidade tem a aba Conexões`, `livro e artigo têm as abas Conexões e Destaques`, `links da aba Conexões abrem as telas de ENTITY_CATEGORIES` (alice liga uma nota a uma entidade de cada tipo e cada link abre a tela de destino, sem a tela de não encontrado), `abrir para completar da paleta abre a tela de edição` (nota, tarefa, meta, projeto e entrada do diário), `paleta abre pelo PaletteTrigger e por Ctrl + K`, `modo leitura abre sem sidebar nem topbar` e `navegação por teclado com foco visível`) e `apps/web/src/app/accessibility.e2e.ts` (`axe <tela> <tema>: sem violações`, com `@axe-core/playwright`, nas telas de `lighthouserc.json`, em claro e escuro).
11. Escreva `apps/web/src/app/prototype-routes.e2e.ts` (DEC-002), com a sessão de `e2e-session.ts` ou da TASK-19: `PD-46 adicionar cartão abre o formulário do cartão na raia` (no Quadro, "+ Adicionar cartão" de uma raia abre `/projects/<id>/cards/new?lane=<raia>`, salvar volta ao Quadro com o cartão na raia, e abrir o cartão leva a `/projects/<id>/cards/<cardId>`), `PD-61 relatório emitido pelo módulo volta ao módulo` (o menu "Relatórios" de Metas abre `/reports/goals-progress?from_module=goals`, e "Voltar" leva a `/goals`), `PD-61 relatório emitido pela entidade abre filtrado e gerado` (o "Mais ações" de uma meta abre `/reports/goals-progress?goal_id=<id>&run=1&from_module=goals` com o resultado já gerado e só a meta filtrada; o mesmo para a conta em `fin-flow`, o livro em `read-pages` e o projeto em `proj-cards`), `PD-36 capa enviada aparece na estante e na visão geral` (envia uma capa PNG a um livro e a um artigo pelo formulário, e a imagem carrega de `/api/v1/files/<id>` na estante e na visão geral; remover volta ao gradiente do id) e `PD-23 Configurações abre pelo menu do perfil` (a sidebar não tem "Configurações"; o menu do perfil abre `/settings`), em 360 px e desktop, com axe. Acrescente em `accessibility.e2e.ts` `axe seletores da base abertos: sem violações` (o `PeriodField` aberto no Financeiro, no Diário e na página de um relatório, o `DateField` aberto num formulário de tarefa e o seletor de emoções do Diário, PD-57, PD-62).
12. Escreva `apps/web/src/app/visual.e2e.ts`: para Dashboard, lista de movimentações, detalhe de meta na aba Conexões, Diário, estante do Acervo e Kanban de projeto, em 360, 480, 720 e 1280 px de largura e nos temas claro e escuro, grava `apps/web/visual-screenshots/<tela>-<largura>-<tema>.png` (48 arquivos) com página inteira e animações desligadas, e confere que não há rolagem horizontal (`scrollWidth <= innerWidth`).
13. Com o servidor no ar (`docker compose -p atria-e2e --env-file .env.example up -d --build --wait`), rode `pnpm --filter @atria/web e2e` (todos os `*.e2e.ts`, das features e do app) até passar. Falha num `*.e2e.ts` de feature que venha da feature e não do registro é bloqueio da tarefa daquela feature: registre e pare.
14. Prepare o Lighthouse CI: confira que cada URL de `lighthouserc.json` (`/`, `/finance`, `/goals`, `/tasks`, `/reminders`, `/notes`, `/journal`, `/library`, `/projects`, `/reports`, `/settings`, em `http://localhost:4173`, servidas por `pnpm --filter @atria/web preview --port 4173 --strictPort`) é uma rota registrada pelo `feature-registry.ts` (teste `lighthouse urls are registered routes` em `feature-registry.test.ts`, que lê o JSON) e corrija em `lighthouserc.json` a URL que não for. Crie `apps/web/src/app/lighthouse-login.cjs` (`module.exports = async (browser, context) => {...}`): na primeira chamada, pela API em `http://localhost:4173/api/v1` (o preview repassa `/api` ao servidor em `8080`), se `GET /setup` indicar instância vazia, cria o admin, ativa o TOTP com o código de HMAC-SHA1 de `node:crypto`, gera um convite e cadastra o usuário de auditoria com `ATRIA_LHCI_EMAIL` e `ATRIA_LHCI_PASSWORD`; em seguida abre `/sign-in` numa página, preenche e envia o formulário e espera a sidebar; nas chamadas seguintes, só confere que a sessão continua. Em `lighthouserc.json`, acrescente em `ci.collect` `"puppeteerScript": "./apps/web/src/app/lighthouse-login.cjs"` e `"settings": { "disableStorageReset": true }`, mantendo as asserções de 90. No job `lighthouse` de `.github/workflows/ci.yml`, acrescente o serviço `postgres`, o build e a subida do servidor em segundo plano (`cargo run --release -p atria-server` com `ATRIA_DATABASE_URL` e a chave de criptografia de teste, esperando `curl -fsS http://localhost:8080/healthz`) e as variáveis `ATRIA_LHCI_EMAIL` e `ATRIA_LHCI_PASSWORD` antes de `pnpm lhci`.
15. Com o servidor no ar (`docker compose -p atria-e2e --env-file .env.example up -d --build --wait`, que publica a porta 8080, TASK-36), rode `pnpm lhci` e confira 90 ou mais em desempenho, acessibilidade e boas práticas em todas as telas, auditadas já logadas (a tela de login não pode aparecer no relatório). Se uma nota ficar abaixo por causa do registro (por exemplo, rotas carregadas sem divisão de código), corrija em `apps/web/src/app` com `lazy` das rotas; se for por uma feature, registre o bloqueio.
16. Rode `pnpm --filter @atria/web lint` e `pnpm --filter @atria/web typecheck` e corrija os avisos, sem `any` e sem `@ts-ignore`.

### Baseline

- `ls apps/web/src/features`
- `pnpm --filter @atria/web test -- src/app 2>&1 | grep -E "Test Files|Tests " || true`

### Verificação

```bash
pnpm --filter @atria/web lint
pnpm --filter @atria/web typecheck
# registro, layout de entidade (sem controle de visibilidade, DEC-006) e padrão de listagem
pnpm --filter @atria/web test -- src/app
# sem o controle de visibilidade acima das abas (DEC-006)
test ! -e apps/web/src/app/visibility-toggle.tsx
! grep -rn 'VisibilityToggle' apps/web/src --include=*.tsx --include=*.ts
# a suíte de componentes inteira continua passando
pnpm --filter @atria/web test
# servidor e banco para os ponta a ponta e o Lighthouse (o preview repassa /api para a porta 8080)
docker compose -p atria-e2e --env-file .env.example up -d --build --wait
# ponta a ponta de todas as features e do app, com axe e capturas
pnpm --filter @atria/web e2e
test "$(ls apps/web/visual-screenshots/*.png | wc -l)" -eq 48
# Lighthouse logado: 90 ou mais em desempenho, acessibilidade e boas práticas
ATRIA_LHCI_EMAIL=lhci@atria.test ATRIA_LHCI_PASSWORD=lhci-audit-password pnpm lhci
```

### Evidências

- `app-unit-tests.txt` (automática): `pnpm --filter @atria/web test -- src/app 2>&1`
  - Prova: as 16 features estão registradas, toda rota de entidade tem o layout com Conexões e sem o controle de visibilidade acima das abas, e toda listagem guarda busca, visualização e filtros na URL (RF-20, RF-21, DEC-006).
  - Trecho: os arquivos `feature-registry.test.ts`, `entity-layout.test.tsx` (com `dec006 renders no visibility control above the tabs`) e `listing-standard.test.ts` como aprovados e a linha `Tests` sem `failed`.
  - Falha: `FAIL`, `failed` ou `No test files found`.
- `e2e.txt` (automática): `pnpm --filter @atria/web e2e -- --reporter=list 2>&1`
  - Prova: os ponta a ponta de todas as features e do app passam, incluindo listagens, visibilidade e axe (RF-20, RF-21, CT-14, CT-15, RNF-06).
  - Trecho: as linhas `CT-14 ...`, `CT-15 marcação compartilhada fica gravada e outro usuário recebe 404`, `DEC-006 toda tela de entidade mostra a visibilidade no Registro e a muda pelo formulário`, `axe ... sem violações`, `PD-46 adicionar cartão abre o formulário do cartão na raia`, `PD-61 relatório emitido pelo módulo volta ao módulo`, `PD-61 relatório emitido pela entidade abre filtrado e gerado`, `PD-36 capa enviada aparece na estante e na visão geral`, `PD-23 Configurações abre pelo menu do perfil` e o resumo `passed` sem `failed`.
  - Falha: `failed`, `flaky` ou nenhuma linha `CT-14`.
- `lighthouse.txt` (automática): `ATRIA_LHCI_EMAIL=lhci@atria.test ATRIA_LHCI_PASSWORD=lhci-audit-password pnpm lhci 2>&1`
  - Prova: as telas principais têm 90 ou mais em desempenho, acessibilidade e boas práticas (RNF-05).
  - Trecho: o fim `Done running autorun.` sem nenhuma linha de asserção falhando.
  - Falha: `Assertion failed`, `expected >= 0.9` ou `assertion(s) failed`.
- `visual-screenshots.txt` (automática): `ls -1 apps/web/visual-screenshots`
  - Prova: as capturas das telas principais existem nas quatro larguras e nos dois temas (RNF-08, RNF-10).
  - Trecho: 48 nomes no formato `<tela>-<largura>-<tema>.png`, de `dashboard-360-light.png` a `projects-kanban-1280-dark.png`.
  - Falha: pasta inexistente ou menos de 48 arquivos.
  - Artefato: `apps/web/visual-screenshots/*.png`.
- `revisao-visual.png` (manual): montagem das capturas de `apps/web/visual-screenshots` de 360 px e 1280 px no tema claro e escuro, conferidas por uma pessoa contra o protótipo: sidebar e topbar, aba Conexões no detalhe da meta, a visibilidade no cartão "Registro" e nenhum controle de visibilidade acima das abas, filtros, busca e visualizações nas listagens, sem texto cortado nem rolagem horizontal.
  - Prova: a interface integrada segue a identidade e o layout validados no protótipo, nos dois temas e nas larguras pedidas (RF-20, RF-21, RNF-08, RNF-10).
  - Trecho: as abas "Visão geral" e "Conexões", a linha "Visibilidade" no cartão "Registro" e os controles de listagem visíveis em 360 px.
  - Falha: elementos sobrepostos, texto cortado, contraste baixo no tema escuro ou controle ausente.

### Concluída quando

- [ ] As 16 features estão registradas no roteador e na sidebar pelo registro único, sem rota duplicada, e toda URL do `lighthouserc.json` é uma rota registrada (RF-20).

  > Como comprovar: em `app-unit-tests.txt`, ver `feature-registry.test.ts` aprovado; no app, abrir cada item da sidebar e ver a tela correspondente (`sidebar abre todas as telas` em `e2e.txt`).

- [ ] Toda listagem tem filtros, busca e modos de visualização, e o estado fica na URL depois de recarregar (RF-20, CT-14).

  > Como comprovar: em `e2e.txt`, ver uma linha `CT-14` aprovada para cada módulo; em `app-unit-tests.txt`, ver `listing-standard.test.ts` aprovado.

- [ ] Toda tela de entidade mostra a marcação "Pessoal" ou "Compartilhada" no cartão "Registro", mudada pelo formulário da entidade, sem controle de visibilidade acima das abas, e tem a aba "Conexões"; livro e artigo também têm "Destaques" (RF-21, DEC-006).

  > Como comprovar: em `app-unit-tests.txt`, ver `entity-layout.test.tsx` aprovado, com `dec006 renders no visibility control above the tabs`; em `e2e.txt`, ver `DEC-006 toda tela de entidade mostra a visibilidade no Registro e a muda pelo formulário` aprovado; a Verificação não acha `VisibilityToggle`; em `e2e.txt`, ver `toda tela de entidade tem a aba Conexões` e `livro e artigo têm as abas Conexões e Destaques` aprovados.

- [ ] Os links da aba Conexões e o "abrir para completar" da paleta levam a telas registradas, a paleta e o aviso de lembretes estão montados no layout e o modo leitura abre fora dele (RF-20, RF-21).

  > Como comprovar: em `e2e.txt`, ver `links da aba Conexões abrem as telas de ENTITY_CATEGORIES`, `abrir para completar da paleta abre a tela de edição`, `paleta abre pelo PaletteTrigger e por Ctrl + K` e `modo leitura abre sem sidebar nem topbar` aprovados; em `app-unit-tests.txt`, ver `registers every ENTITY_CATEGORIES route` e `registers every open-to-complete route`.

- [ ] As rotas novas das decisões do protótipo estão registradas e funcionam de ponta a ponta: formulário do cartão, relatórios do catálogo emitidos pelo módulo e pela entidade, detalhes de tarefa e lembrete e capas; Configurações abre pelo menu do perfil, fora da sidebar (DEC-002, PD-23, PD-36, PD-46, PD-59, PD-61).

  > Como comprovar: em `app-unit-tests.txt`, ver aprovados `keeps settings out of the sidebar`, `registers the card form routes`, `registers the new detail routes`, `registers every report of the catalog` e `report links of modules and entities resolve to registered routes`; em `e2e.txt`, ver as cinco linhas `PD-...` de `prototype-routes.e2e.ts` aprovadas.

- [ ] As telas com abas próprias recebem Conexões por `extra_tabs`, o projeto na ordem Visão geral, Quadro, Conexões e Configurações com o resumo das ligações, e nas demais as abas são "Visão geral" e "Conexões", sem cabeçalho duplicado (PD-14, PD-41, PD-42, PD-59).

  > Como comprovar: em `app-unit-tests.txt`, ver aprovados `passes connections as extra_tabs to the screens with their own tabs`, `passes connections before Configurações in the project and the summary in links_slot`, `does not render a page header of its own` e `renders the Visão geral tab by default`.

- [ ] Uma entidade marcada como compartilhada continua marcada depois de recarregar e outro usuário recebe 404 ao abri-la (RF-21, CT-15).

  > Como comprovar: em `e2e.txt`, ver `CT-15 marcação compartilhada fica gravada e outro usuário recebe 404` aprovado.

- [ ] Os ponta a ponta de todas as features passam e o axe não acha violações nas telas principais, nos dois temas (RNF-06).

  > Como comprovar: abrir `e2e.txt` e ver o resumo com `passed` e nenhum `failed`, e as linhas `axe ... sem violações`.

- [ ] O Lighthouse dá 90 ou mais em desempenho, acessibilidade e boas práticas nas telas principais (RNF-05).

  > Como comprovar: abrir `lighthouse.txt` e ver `Done running autorun.` sem asserção falhando; abrir um relatório em `.lighthouseci` e ver a tela auditada já logada, com a sidebar, e não a tela de login.

- [ ] As telas principais funcionam em 360, 480, 720 e 1280 px, sem rolagem horizontal, nos temas claro e escuro (RNF-08, RNF-10).

  > Como comprovar: abrir `visual-screenshots.txt` e ver os 48 arquivos, e conferir a montagem `revisao-visual.png` contra o protótipo.

- [ ] Lint e typecheck do `@atria/web` passam sem nenhum aviso (RF-20).

  > Como comprovar: rodar a Verificação e ver `lint` e `typecheck` terminarem sem erro nem aviso.

## Descrição

### Resumo executivo

Junta todas as telas do Atria num único aplicativo navegável: cada módulo aparece na barra lateral, toda tela de item ganha a aba de conexões e mostra se é pessoal ou compartilhado no próprio registro, e todas as listagens se comportam do mesmo jeito.
Fecha o MVP com a prova de qualidade: testes ponta a ponta de todos os fluxos, acessibilidade sem violações, notas mínimas de desempenho e capturas em celular e desktop nos dois temas.
Perfil julgamento, risco alto: integra dezesseis telas feitas em paralelo e qualquer desvio aparece aqui.
É a última tarefa do frontend e libera a entrega do MVP.

### Detalhes técnicos

- **Abordagem:** um registro único (`apps/web/src/app/feature-registry.ts`) importa `routes.tsx` e `nav.ts` das 16 features e é a única fonte do roteador e da sidebar. As rotas de detalhe listadas em `apps/web/src/app/entity-types.ts` são envolvidas pelo `EntityLayout`, que acrescenta as abas "Visão geral" e "Conexões" (ou entrega Conexões por `extra_tabs`) sem mudar as features; a visibilidade fica no formulário e no cartão "Registro" de cada feature (DEC-006). Os testes ponta a ponta do app, o axe, as capturas e o Lighthouse fecham a verificação do MVP.
- **Componentes:** só `apps/web/src/app` (criado pela TASK-05). Nenhuma feature é alterada; desvio de uma feature vira bloqueio da tarefa dela.
- **Decisão: montar a aba Conexões envolvendo o componente da rota (`route.update`).** Alternativas: (a) rota-pai sem caminho como layout, que depende de as features aceitarem o pai por parâmetro; (b) rota filha `/connections`, que exige `<Outlet />` em todas as telas de detalhe; (c) cada feature montar a própria aba, que muda doze features fora desta tarefa. Critério de escolha: nenhuma feature alterada, aba na URL ([project/frontend-13]) e typecheck garantindo o mapeamento. Se o formato da TASK-05 já recebe o pai por parâmetro, (a) é equivalente e pode ser usada, desde que os mesmos testes passem.
- **Decisão: interfaces das features como contrato do registro.** Cada feature expõe `create<Feature>Routes(parent)` e `<feature>NavItem`; o reader recebe a raiz (`createReaderRoutes(root_route)`) para ficar sem sidebar nem topbar (RF-65). `ReminderNotifier`, `CommandPaletteProvider` e `PaletteTrigger` são montados uma vez no layout autenticado; descartado montá-los por tela, que duplicaria notificações e atalhos. Em livro e artigo, Conexões e Destaques entram por `extra_tabs` na tela da feature, que já tem abas próprias; descartado empilhar a barra de abas do layout sobre as da tela. As rotas de `ENTITY_CATEGORIES` e de "abrir para completar" são conferidas no teste unitário e no ponta a ponta, porque foram escritas em tarefas paralelas.
- **Decisão: abas e cabeçalho conforme o protótipo (DEC-002, PD-14, PD-41, PD-59).** As telas de detalhe ajustadas às decisões do protótipo têm o próprio `PageHeader` (com "Editar" e "Mais ações") e as próprias abas (Marcos, Ocorrências, Histórico de leitura, Quadro, Configurações), então o `EntityLayout` não desenha cabeçalho e, nelas, só entrega Conexões por `extra_tabs` (e, no projeto, `ConnectionsSummary` por `links_slot`, PD-42). O layout genérico, com "Visão geral" (antes "Detalhes") e "Conexões", fica para as telas sem abas próprias. O formulário do cartão (PD-46) não é envolvido. Descartados: empilhar a barra de abas do layout sobre a da tela e manter o cabeçalho do layout, que duplicaria o título.
- **Decisão: rotas das decisões do protótipo conferidas no registro e de ponta a ponta.** Formulário do cartão, detalhes de tarefa e lembrete, os nove relatórios com os links de módulo e de entidade (`/reports/<id>?<filtro>_id=<id>&run=1&from_module=<módulo>`) e as capas são de tarefas paralelas; o teste do registro e o `prototype-routes.e2e.ts` pegam a rota faltante ou o filtro que o relatório não aceita. Descartado confiar só nos e2e de cada feature, que não atravessam as features.
- **Decisão: mapa de entidades tipado por `@atria/contracts`.** `ENTITY_ROUTES` usa as chaves de `paths` e o tipo de entidade das ligações, e o teste `covers every link entity type` garante que nenhuma entidade fica sem Conexões. Descartado inferir o tipo pelo caminho da URL, que quebraria sem aviso.
- **Decisão: visibilidade pelo formulário e no cartão "Registro" (DEC-006, item 2).** Sai o `VisibilityToggle` acima das abas: cada feature já tem a visibilidade no formulário (`FormSegmented` "Pessoal" e "Compartilhada") e a mostra no cartão "Registro" da visão geral, como no protótipo. Esta tarefa não grava visibilidade: só confere, no teste do layout, que nenhum controle aparece acima das abas e, de ponta a ponta, que toda entidade tem a linha no "Registro" e o campo no formulário (RF-21, CT-15); a falta em uma feature é bloqueio da tarefa dela. Descartados: manter o botão acima das abas, que a DEC-006 tira, e um hook de visibilidade no app, que duplicaria a gravação das features.
- **Decisão: padrão de listagem verificado, não reescrito.** `listing-standard.test.ts` e `listings.e2e.ts` conferem `q`, `view` e filtros na URL e os nomes acessíveis "Filtros" e "Visualização" em toda listagem ([project/frontend-12], [project/frontend-13]). Descartado reescrever as listagens aqui, fora dos componentes da tarefa.
- **Decisão: Lighthouse logado por `puppeteerScript`.** O LHCI roda o script de login antes das URLs e `disableStorageReset` mantém o cookie de sessão entre elas; as URLs do `lighthouserc.json` (TASK-02) são conferidas contra o registro. Descartados: auditar só telas públicas (não mede as telas principais, RNF-05) e injetar cookie fixo no `extraHeaders` (sessão expira e exige segredo no repositório). O job da CI passa a subir banco e servidor, porque o preview só serve o frontend.
- **Decisão: sessão de teste sem dependência nova.** O TOTP do admin é calculado com `node:crypto`; reaproveita o utilitário da TASK-19 se ele existir.
- **Riscos:** formato de registro diferente entre features, componente da aba Conexões com props diferentes, listagens fora do padrão e notas do Lighthouse puxadas por uma feature; todos aparecem nos testes e viram bloqueio. As capturas em `apps/web/visual-screenshots` não devem ser versionadas; se o `.gitignore` da TASK-02 não cobrir a pasta, a pendência é registrada no fim da tarefa.
- **Referências:** RF-19, RF-20, RF-21, CT-13, CT-14, CT-15, RN-17, RNF-05, RNF-06, RNF-08, RNF-10, decisões 26, 54, 56 e 57; DEC-002, DEC-003, DEC-004 e DEC-006; PD-14, PD-23, PD-36, PD-41, PD-42, PD-46, PD-57, PD-59, PD-61 e PD-62; [project/architecture-07], [project/architecture-10], [project/frontend-02], [project/frontend-10], [project/frontend-17], [project/testing-05], [project/testing-10] e [project/testing-11].
- **Arquivos em comum na onda 8:** nenhum; é a única tarefa da onda. `apps/web/src/app` é da TASK-05, de outra onda.

### Card

- **Título:** Integração do frontend
- **Tipo:** tarefa
- **Descrição:** Registra as rotas e a navegação das 16 features, monta a aba Conexões em toda tela de entidade, confere a visibilidade no formulário e no cartão Registro de cada uma e fecha o MVP com ponta a ponta, axe, Lighthouse e capturas nos dois temas.
- **Critérios de aceite:**
  - [ ] Todos os módulos abrem pela sidebar.
  - [ ] Toda listagem tem filtros, busca e visualizações com o estado na URL.
  - [ ] Toda entidade tem a aba Conexões e mostra a marcação pessoal ou compartilhada no cartão Registro, mudada pelo formulário, sem botão acima das abas.
  - [ ] Formulário do cartão, relatórios pelo módulo e pela entidade, capas e Configurações pelo menu do perfil funcionam de ponta a ponta.
  - [ ] Ponta a ponta e axe passam, e o Lighthouse dá 90 ou mais.
  - [ ] As telas funcionam de 360 px ao desktop, nos temas claro e escuro.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-19, TASK-20, TASK-21, TASK-22, TASK-23, TASK-24, TASK-25, TASK-26, TASK-27, TASK-28, TASK-29, TASK-30, TASK-31, TASK-32, TASK-33, TASK-34

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, TASK-05 (menu do perfil, PeriodPicker e controles da base), TASK-23 a TASK-28 e TASK-30 (extra_tabs, links_slot, detalhes novos, formulário do cartão e capas), TASK-31 (ConnectionsSummary), TASK-34 e TASK-17 (rotas e links dos relatórios); EntityLayout sem cabeçalho próprio (PD-14), aba Visão geral no lugar de Detalhes (PD-59), Conexões por extra_tabs nas telas com abas próprias e, no projeto, antes de Configurações com ConnectionsSummary em links_slot (PD-41, PD-42), formulário do cartão sem layout (PD-46), com layout em ENTITY_ROUTES; Configurações fora da sidebar (PD-23); testes do registro para settings, formulário do cartão, detalhes de tarefa e lembrete, nove relatórios e links de módulo e entidade com from_module e run=1 (PD-61); prototype-routes.e2e.ts com cartão, relatórios por módulo e por entidade, capas e menu do perfil, e axe dos seletores da base abertos (PD-36, PD-57, PD-62); Evidências, Concluída quando, Detalhes técnicos e card atualizados; linha test -e de feature-registry.ts removida da Baseline, recusada pela validação |
| 2 | 2026-10-30 | agente | VisibilityToggle, use-entity-visibility.ts e o teste dele tirados de Mudar e dos passos 5 e 6: o EntityLayout não tem controle de visibilidade acima das abas, teste dec006 renders no visibility control above the tabs, CT-15 pelo formulário com a visibilidade no cartão Registro e e2e DEC-006 toda tela de entidade mostra a visibilidade no Registro e a muda pelo formulário, Verificação sem VisibilityToggle (DEC-006); PeriodPicker trocado por PeriodField em Ler e no axe dos seletores abertos; Evidências, Concluída quando, Resumo executivo, Detalhes técnicos e card atualizados |
