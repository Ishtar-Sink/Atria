---
id: TASK-32
spec: SPEC-001
title: "Paleta de comandos"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-15, RF-16, RF-17, CT-12]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: 69b186b280c35798f1a831e8d2e0b0f218089740c9ca3ef5b721f4fde6b97409
adjustments: 3
adjusted_at: 2026-10-31T11:42:47Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: c9858a3050499131358b1247da4d8b60ee5cf750c1933372ff48d79e472d56fd
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-10-31T11:42:47Z
model: sonnet
---

# TASK-32: Paleta de comandos

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-15 a RF-17, RF-59, CT-12, CB-13, contrato da paleta (atalho, prefixos e teclas), `/search?q=&contexts=`, fluxo principal (passos 7 e 8), FA-05, RNF-04, RNF-06, RNF-08 a RNF-10 e decisões 15, 16 e 34 a 40.
- `vostok/rules/project/architecture.md`: [project/architecture-10] (exceção da criação rápida pela paleta) e [project/architecture-11].
- `vostok/rules/project/frontend.md`: [project/frontend-04] (motion e `prefers-reduced-motion`), [project/frontend-06], [project/frontend-08], [project/frontend-10] e [project/frontend-18].
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução.
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `prototype/atria-prototype.html`: paleta de comandos validada no protótipo (decisão 40).
- `docs/decisoes-do-prototipo.md`: a tabela PD-xx e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa. PD-11, PD-14, PD-19, PD-57, PD-59 e PD-62 não mudam a paleta: ela não tem formulário em página, campo de data, etiquetas editáveis nem tela de detalhe; a criação rápida é só o título no próprio campo da paleta, como no protótipo (`startQuickNote`).
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam a paleta.
- `vostok/work/tasks/SPEC-001/TASK-24.md` e `vostok/work/tasks/SPEC-001/TASK-25.md`: as telas de detalhe `/tasks/$taskId` e `/reminders/$reminderId`, acrescentadas pelas decisões do protótipo, e as rotas de edição `/tasks/$taskId/edit`.
- `apps/web/src/app`: só leitura, para ver a topbar onde a TASK-35 monta o gatilho e o provedor da paleta.
- `apps/web/src/shared`: cliente da API, mutação otimista, i18n comum e acesso às preferências do usuário.
- `packages/ui`: diálogo, campo de busca, lista navegável e atalho de teclado (`kbd`).
- `packages/theme`: tokens do tema, de sobreposição, de desfoque e de `--motion-*`.
- `packages/contracts`: tipos gerados de `/search`, de `/me/preferences` (atalho e contextos padrão) e da criação de notas, tarefas, metas, projetos e entradas do diário.
- `apps/web/scripts/evidence-shots.mjs`: molde das evidências visuais (TASK-05): Vite numa porta livre, Chromium do `@playwright/test`, temas claro e escuro, 1440 e 360 px, `check()` com `ok`/`FALHA`, prancha `sheet()` e código de saída 1 em falha.

### Mudar

- `apps/web/src/features/command-palette/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/command-palette/command-palette.tsx` (criar): diálogo da paleta, `CommandPalette`, com `role="dialog"`, foco preso, busca, resultados, recentes e criação rápida (RF-15 a RF-17).
- `apps/web/src/features/command-palette/command-palette.css` (criar): fundo borrado com `backdrop-filter` e fallback, só com tokens.
- `apps/web/src/features/command-palette/command-palette-provider.tsx` (criar): provedor do estado aberto e do atalho global, `CommandPaletteProvider`, para a TASK-35 montar no layout.
- `apps/web/src/features/command-palette/palette-trigger.tsx` (criar): campo de busca da topbar que abre a paleta e mostra a dica do atalho, `PaletteTrigger`, para a TASK-35 montar (decisão 39).
- `apps/web/src/features/command-palette/context-chips.tsx` (criar): escolha dos contextos da busca (RF-16).
- `apps/web/src/features/command-palette/quick-create.tsx` (criar): criação rápida com os campos mínimos e "abrir para completar" (RF-17).
- `apps/web/src/features/command-palette/parse-query.ts` (criar): leitura dos prefixos `>` e `#` (decisão 38).
- `apps/web/src/features/command-palette/shortcut.ts` (criar): leitura e comparação do atalho configurável, com padrão Ctrl + K e Cmd + K (decisão 39).
- `apps/web/src/features/command-palette/palette-actions.ts` (criar): ações de criar e de ir para os módulos.
- `apps/web/src/features/command-palette/use-command-palette.ts` (criar): abrir, fechar e foco de volta ao gatilho.
- `apps/web/src/features/command-palette/use-palette-shortcut.ts` (criar): escuta do atalho em qualquer tela, também com foco num campo (CB-13).
- `apps/web/src/features/command-palette/use-palette-search.ts` (criar): busca em `/search` com os contextos escolhidos ou os padrão (RF-16, RF-59).
- `apps/web/src/features/command-palette/use-recent-items.ts` (criar): itens abertos recentemente, mostrados com a paleta vazia (decisão 37).
- `apps/web/src/features/command-palette/use-quick-create.ts` (criar): criação otimista da entidade mínima.
- `apps/web/src/features/command-palette/command-palette.test.tsx` (criar): testes do diálogo.
- `apps/web/src/features/command-palette/use-palette-shortcut.test.tsx` (criar): testes do atalho.
- `apps/web/src/features/command-palette/parse-query.test.ts` (criar): testes dos prefixos.
- `apps/web/src/features/command-palette/quick-create.test.tsx` (criar): testes da criação rápida.
- `apps/web/src/features/command-palette/command-palette.e2e.ts` (criar): fluxo ponta a ponta do CT-12, rodado só na TASK-35.
- `apps/web/src/features/command-palette/evidence/harness.tsx` (criar): página de evidência que monta `CommandPaletteProvider` e `PaletteTrigger` (a feature não tem rotas) sobre uma tela de exemplo num roteador em memória do TanStack Router, com os providers do app (tema, TanStack Query, i18n, preferências) e dentro do layout do app; não é importada pelo app nem por `apps/web/src/app` (nada muda em `apps/web/src/app`) e por isso fica fora do build de produção; só tokens do tema; passa no typecheck e no lint.
- `apps/web/scripts/evidence-command-palette.mjs` (criar): script das evidências visuais (`node apps/web/scripts/evidence-command-palette.mjs temas|estados`), em Node sem dependências novas, no molde de `apps/web/scripts/evidence-shots.mjs` (código próprio, sem importar o da TASK-05): sobe o Vite numa porta livre por `createServer` da API do Vite com um plugin que serve uma página HTML virtual carregando o `harness.tsx` (encerra no fim, KNW-006), simula a API com `context.route('/api/**')` e fixtures em memória no próprio script (`/search` com resultados de vários contextos, `/me/preferences`, recentes, uma resposta lenta para o carregando, lista vazia e `problem+json` para o erro), captura nos temas claro e escuro, em 1440 px e em 360 px, confere o estado no DOM antes de cada captura (tema aplicado, sem rolagem horizontal, sem erro de JS, axe sem violações incluindo `color-contrast`, e as verificações de cada estado), imprime `ok` ou `FALHA` por verificação, o caminho do PNG e a última linha `ok  0 falha(s)`, e sai com código diferente de 0 se algo falhar; as pranchas vão para `vostok/work/tasks/SPEC-001/evidence/TASK-32/`.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared` (cliente da API e mutação otimista) e em `vostok/work/tasks/SPEC-001/TASK-06.md` as preferências de `GET /me/preferences` (`palette_shortcut`, padrão `mod+k`, e `search_contexts`), `packages/ui` e `packages/contracts` (`/search` com `q` e `contexts`, preferências `palette_shortcut` e contextos padrão da busca, e a criação das entidades).
2. Criar `i18n/pt-br.json` com chaves em `snake_case` sob `command_palette`: `dialog_label`, `input_label`, `input_placeholder`, `trigger_label`, `shortcut_hint`, `contexts_label`, `context.<contexto>` para cada contexto de busca, `all_contexts`, `recent_title`, `actions_title`, `results_title`, `tags_title`, `no_results`, `loading`, `error`, `create_note`, `create_task`, `create_goal`, `create_project`, `create_journal_entry`, `quick_create_title_label`, `quick_create_save`, `open_to_complete`, `created_notice` e `undo_notice`.
3. Escrever os testes antes do código, com o cliente da API simulado e a plataforma (`navigator.platform`) simulada:
   - `parse-query.test.ts`: `treats a leading greater than as actions only`, `treats a leading hash as tags only`, `treats free text as a search in everything`.
   - `use-palette-shortcut.test.tsx`: `opens with ctrl k on windows and linux`, `opens with cmd k on macos`, `opens even with the focus in a text field` (CB-13), `uses the shortcut saved in the user preferences`, `prevents the browser default for the shortcut`.
   - `command-palette.test.tsx`: `opens from the topbar trigger`, `shows the shortcut hint on the trigger`, `is a dialog with a label and traps the focus`, `navigates results with arrow keys and opens with enter`, `closes with escape and returns the focus to the trigger`, `shows recent items and create actions when empty`, `searches every context by default`, `searches only the chosen contexts`, `starts with the default contexts from the preferences`, `shows the loading, empty and error states`, `applies the blurred backdrop class`, `has no axe violations`.
   - `quick-create.test.tsx`: `creates a note with only the title`, `keeps the note saved with minimal fields when closed` (FA-05), `opens the entity screen with open to complete`, `rolls back and shows the undo notice when the server rejects` (RNF-09).
4. Rodar `pnpm --filter @atria/web test -- src/features/command-palette` e confirmar que falham por falta da implementação.
5. Implementar `parse-query.ts` (`parseQuery(text)` devolve `{ mode: 'actions' | 'tags' | 'all', term }`) e `shortcut.ts` (`DEFAULT_SHORTCUT = 'mod+k'`, `matchesShortcut(event, shortcut)`, com `mod` = Meta no macOS e Ctrl nos demais, e `formatShortcut(shortcut)` para a dica).
6. Implementar os hooks: `use-command-palette.ts` (estado aberto, guarda o elemento que abriu e devolve o foco ao fechar), `use-palette-shortcut.ts` (escuta `keydown` em `window` na fase de captura, para valer com o foco em campos, e chama `preventDefault`), `use-palette-search.ts` (TanStack Query em `/search` com espera curta entre teclas, contextos escolhidos ou os padrão das preferências, e o modo de `parseQuery`), `use-recent-items.ts` (até 8 itens no `localStorage` do navegador, só id, tipo e título, com leitura e escrita em `try/catch`) e `use-quick-create.ts` (mutação otimista de `apps/web/src/shared`).
7. Implementar `palette-actions.ts` com as ações de criar (nota, tarefa, meta, projeto e entrada do diário, as entidades cujo campo mínimo é um texto) e de ir para cada módulo, e as rotas de "abrir para completar": `/notes/{id}/edit`, `/tasks/{id}/edit`, `/goals/{id}/edit`, `/projects/{id}/edit` e `/journal/{id}/edit`.
8. Implementar `command-palette.css`: sobreposição com `backdrop-filter: blur(...)` usando o token de desfoque e o de sobreposição; em `@supports not (backdrop-filter: blur(1px))`, fundo opaco com o token de sobreposição forte; animação de entrada só com `--motion-*` e desligada em `@media (prefers-reduced-motion: reduce)` (decisão 35). Nenhum valor literal de cor, raio, espaço ou duração.
9. Implementar `command-palette.tsx` com o diálogo de `packages/ui` (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), foco preso no diálogo, campo como `role="combobox"` com `aria-controls` e `aria-activedescendant` apontando para a lista `role="listbox"`, setas para navegar, Enter para abrir e Esc para fechar; com o campo vazio, recentes e ações de criar; resultados agrupados por contexto; estados carregando, vazio e erro. Implementar `context-chips.tsx` (botões alternáveis com `aria-pressed`) e `quick-create.tsx` (só o título, salvar e "abrir para completar").
10. Implementar `palette-trigger.tsx` (`PaletteTrigger`, botão com aparência de campo, `aria-label` e a dica do atalho em `kbd`) e `command-palette-provider.tsx` (`CommandPaletteProvider`, que registra o atalho e renderiza `CommandPalette`). Exportar os dois para a TASK-35 montar no layout e na topbar; a feature não tem `routes.tsx` nem `nav.ts` e não altera `apps/web/src/app`.
11. Criar `command-palette.e2e.ts` (Playwright) com o CT-12: Ctrl/Cmd + K com o foco num campo, fundo borrado, busca com e sem contextos, nota rápida e "abrir para completar" até a tela da nota, em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
12. Rodar a Verificação até passar sem nenhum warning de lint.
13. Criar `evidence/harness.tsx` e `apps/web/scripts/evidence-command-palette.mjs` (veja "Mudar") e rodar `node apps/web/scripts/evidence-command-palette.mjs temas` e `node apps/web/scripts/evidence-command-palette.mjs estados`. Corrigir o código da tarefa a cada linha `FALHA` e abrir as pranchas `command-palette-themes-widths.png` e `command-palette-states-focus.png` para conferir.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/command-palette
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
grep -q "backdrop-filter" apps/web/src/features/command-palette/command-palette.css
grep -q "@supports not (backdrop-filter" apps/web/src/features/command-palette/command-palette.css
grep -q "prefers-reduced-motion" apps/web/src/features/command-palette/command-palette.css
grep -q "export function PaletteTrigger" apps/web/src/features/command-palette/palette-trigger.tsx
test -f apps/web/src/features/command-palette/command-palette.e2e.ts
test -f apps/web/src/features/command-palette/evidence/harness.tsx
test -f apps/web/scripts/evidence-command-palette.mjs
node --check apps/web/scripts/evidence-command-palette.mjs
```

### Evidências

- `command-palette-tests.txt` (automática): `pnpm --filter @atria/web exec vitest run src/features/command-palette --reporter=verbose`
  - Prova: os testes da paleta passam, cobrindo atalho com foco em campo, gatilho da topbar, diálogo com foco preso, teclas, prefixos, contextos, recentes, criação rápida, estados, axe e interface otimista (RF-15, RF-16, RF-17, CT-12, CB-13, RNF-06, RNF-09).
  - Trecho: os arquivos `parse-query.test.ts`, `use-palette-shortcut.test.tsx`, `command-palette.test.tsx` e `quick-create.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `command-palette-backdrop.txt` (automática): `grep -nE "backdrop-filter|@supports not|prefers-reduced-motion" apps/web/src/features/command-palette/command-palette.css`
  - Prova: o fundo borrado tem fallback para navegadores sem `backdrop-filter` e fica sem animação com movimento reduzido (RF-15, decisão 35).
  - Trecho: as linhas com `backdrop-filter`, `@supports not (backdrop-filter` e `prefers-reduced-motion`.
  - Falha: saída vazia ou `No such file or directory`.
- `command-palette-files.txt` (automática): `find apps/web/src/features/command-palette -type f | sort`
  - Prova: a feature tem o diálogo, o provedor, o gatilho da topbar, traduções, hooks, testes e o e2e do CT-12.
  - Trecho: `command-palette.tsx`, `command-palette-provider.tsx`, `palette-trigger.tsx`, `i18n/pt-br.json` e `command-palette.e2e.ts` na lista.
  - Falha: `No such file or directory` ou algum desses arquivos ausente.
- `command-palette-themes-widths.txt` (automática): `node apps/web/scripts/evidence-command-palette.mjs temas`
  - Prova: fundo borrado, identidade visual nos dois temas e layout funcional a partir de 360 px, medidos no DOM e fotografados: a paleta aberta sobre uma tela, com resultados agrupados, em 1440 px e em 360 px, nos temas claro e escuro (RF-15, RNF-08, RNF-10).
  - Trecho: uma linha `ok` por verificação, como `ok ... tema aplicado`, `ok ... diálogo aberto (role="dialog", aria-modal)`, `ok ... fundo com backdrop-filter blur` (ou o fallback opaco), `ok ... resultados agrupados por contexto`, `ok ... diálogo inteiro dentro da janela` em 360 px, `ok ... dica do atalho no gatilho`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)` em cada captura; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-32/command-palette-themes-widths.png (4 capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (fundo sem desfoque nem escurecimento, diálogo cortado em 360 px, contraste baixo no tema escuro apontado pelo axe), a ausência da linha `png:` ou código de saída diferente de 0 (`Cannot find module` antes da tarefa, porque o script não existe).
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-32/command-palette-themes-widths.png`, a prancha com as capturas rotuladas: a paleta aberta com resultados agrupados e o fundo borrado, nos temas claro e escuro, em 1440 px e em 360 px.
- `command-palette-states-focus.txt` (automática): `node apps/web/scripts/evidence-command-palette.mjs estados`
  - Prova: todos os estados da paleta e a navegação por teclado (decisões 36 e 37, RNF-06).
  - Trecho: `ok ... paleta vazia com recentes e ações de criar`, `ok ... indicador de carregamento visível` (resposta lenta), `ok ... texto de sem resultados visível`, `ok ... mensagem de erro visível` (`problem+json`), `ok ... item ativo depois das setas (aria-activedescendant)`, `ok ... destaque visível no item ativo`, `ok ... sem rolagem horizontal`, `ok ... sem erro de JS` e `ok ... axe sem violações (inclui color-contrast)`; a linha `png: vostok/work/tasks/SPEC-001/evidence/TASK-32/command-palette-states-focus.png (N capturas)` e a última linha `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (paleta vazia sem conteúdo, estado sem texto, item ativo sem destaque visível), a ausência da linha `png:` ou código de saída diferente de 0.
  - Artefato: `vostok/work/tasks/SPEC-001/evidence/TASK-32/command-palette-states-focus.png`, a prancha com a paleta vazia (recentes e ações), carregando, sem resultados, com erro e com o resultado ativo destacado navegando só pelas setas, nos dois temas.

### Concluída quando

- [x] A paleta abre com Ctrl + K no Windows e no Linux, Cmd + K no macOS, também com o foco num campo, e pelo clique no campo da topbar, borrando o fundo (RF-15, CT-12, CB-13).

  > Como comprovar: na saída `command-palette-tests.txt`, ver aprovados os casos da `use-palette-shortcut.test.tsx` e `opens from the topbar trigger`; em `command-palette-backdrop.txt`, ver o `backdrop-filter` com o fallback.

- [x] A paleta é um diálogo com foco preso, setas navegam, Enter abre e Esc fecha devolvendo o foco (RF-15, CT-12).

  > Como comprovar: ver aprovados `is a dialog with a label and traps the focus`, `navigates results with arrow keys and opens with enter` e `closes with escape and returns the focus to the trigger`.

- [x] A busca vale para todas as entidades ou só para os contextos escolhidos, começando pelos contextos padrão da pessoa, com os prefixos `>` e `#` (RF-16, CT-12).

  > Como comprovar: ver aprovados `searches every context by default`, `searches only the chosen contexts`, `starts with the default contexts from the preferences` e os casos da `parse-query.test.ts`.

- [x] A paleta cria uma entidade só com os campos mínimos e "abrir para completar" leva à tela própria; sem abrir, a entidade fica salva (RF-17, CT-12).

  > Como comprovar: ver aprovados os casos da `quick-create.test.tsx`, entre eles `opens the entity screen with open to complete`.

- [x] Com o campo vazio, a paleta mostra os recentes e as ações de criar, e o atalho configurado nas preferências é respeitado (RF-15).

  > Como comprovar: ver aprovados `shows recent items and create actions when empty` e `uses the shortcut saved in the user preferences`.

- [x] A criação rápida aparece na hora e é desfeita com aviso se o servidor recusar (RNF-09).

  > Como comprovar: ver aprovado `rolls back and shows the undo notice when the server rejects` em `quick-create.test.tsx`.

- [x] A paleta não tem violações no axe, funciona só pelo teclado, nos dois temas e a partir de 360 px, sem animação com movimento reduzido (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovado `has no axe violations`, a linha `prefers-reduced-motion` em `command-palette-backdrop.txt`; em `command-palette-themes-widths.txt` e `command-palette-states-focus.txt`, ver só linhas `ok` (tema, fundo borrado, sem rolagem horizontal, axe sem violações, estados e item ativo destacado) e `ok  0 falha(s)`, e conferir nas pranchas `command-palette-themes-widths.png` e `command-palette-states-focus.png` os dois temas, as duas larguras, os estados e o destaque do item ativo.

- [x] Testes, typecheck e lint passam sem warning, o gatilho fica exportado para a topbar e o e2e do CT-12 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `palette-trigger.tsx` e `command-palette.e2e.ts` aparecem em `command-palette-files.txt`.

## Descrição

### Resumo executivo

Entrega a paleta de comandos: um atalho de teclado ou um clique na busca do topo abre um painel para achar qualquer coisa no Atria e criar uma nota, tarefa, meta, projeto ou entrada do diário em segundos.
É o atalho central do produto, acessível por teclado e com o atalho configurável pela pessoa.
Perfil padrão, risco baixo: as decisões de interação já foram validadas no protótipo.
Libera a integração do frontend, que coloca a paleta e o gatilho na topbar.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/command-palette` com um provedor (`CommandPaletteProvider`) que escuta o atalho em `window` na fase de captura, o diálogo (`CommandPalette`) e o gatilho da topbar (`PaletteTrigger`), exportados para a TASK-35 montar. A busca usa `/search?q=&contexts=` (TASK-16), a mesma da topbar (decisão 16).
- **Componentes:** diálogo, estilos do fundo borrado, provedor, gatilho, seleção de contextos, criação rápida, leitura de prefixos, atalho configurável, ações e hooks de estado, atalho, busca, recentes e criação; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisões:** escuta do atalho na fase de captura com `preventDefault`, para abrir também com foco em campo (decisão 34, CB-13), descartada a escuta só fora dos campos; `role="dialog"` com foco preso e padrão combobox e listbox com `aria-activedescendant` (decisão 36), descartada a lista sem navegação por teclado; `backdrop-filter` com fallback opaco por `@supports` e sem animação com movimento reduzido (decisão 35), descartado o fundo só escurecido; prefixos `>` e `#` (decisão 38); recentes e ações com a paleta vazia (decisão 37); atalho padrão `mod+k`, configurável pela preferência do usuário (decisão 39, RF-58, gravada na TASK-33). A criação rápida é a exceção da [project/architecture-10] (decisão 15) e cobre só as entidades cujo mínimo é um texto (nota, tarefa, meta, projeto, entrada do diário); descartadas movimentação e lembrete, que exigem valor, conta ou data. Os recentes ficam no `localStorage` só com id, tipo e título, por serem conveniência do navegador, sem conteúdo pessoal.
- **Riscos:** conflito do atalho com o do navegador (mitigado com `preventDefault` e o atalho configurável); rotas de "abrir para completar" diferentes das definidas pelas features donas (mitigado pelo e2e da TASK-35); o tempo de 300 ms do RNF-04 depende do servidor (TASK-16), e a paleta só acrescenta a espera curta entre teclas.
- **Referências da spec:** RF-15, RF-16, RF-17, RF-59, CT-12, CB-13, FA-05, RNF-04, RNF-06, RNF-08 a RNF-10, decisões 15, 16 e 34 a 40.
- **Decisões do protótipo (DEC-002):** nenhuma PD muda a paleta. As rotas de "abrir para completar" continuam as de edição das features donas (`/notes/{id}/edit`, `/tasks/{id}/edit`, `/goals/{id}/edit`, `/projects/{id}/edit`, `/journal/{id}/edit`), todas presentes depois dos ajustes das TASK-23, TASK-24, TASK-26, TASK-27 e TASK-30, e conferidas pelo `registers every open-to-complete route` da TASK-35.
- **Evidências visuais:** as pranchas `command-palette-themes-widths.png` e `command-palette-states-focus.png` são geradas por `apps/web/scripts/evidence-command-palette.mjs`, no molde do `evidence-shots.mjs` da TASK-05: cada evidência é um comando cuja saída (`.txt`) lista as verificações com `ok` ou `FALHA` e o caminho do PNG. Como a TASK-35 é quem monta o provedor e o gatilho no layout e registra as rotas, o script monta a feature por `src/features/command-palette/evidence/harness.tsx` (provedor e gatilho sobre uma tela de exemplo, num roteador em memória com os providers e o layout do app), servido por uma página virtual do Vite, com a API simulada por fixtures; nada muda em `apps/web/src/app`.
- **Arquivos em comum na onda 7:** nenhum.

### Card

- **Título:** Paleta de comandos
- **Tipo:** historia
- **Descrição:** Paleta de comandos aberta por Ctrl/Cmd + K ou pela busca da topbar, com fundo borrado, busca por contextos, prefixos, recentes e criação rápida com "abrir para completar".
- **Critérios de aceite:**
  - [ ] Abre por Ctrl/Cmd + K, também com foco num campo, e pelo campo da topbar, com o fundo borrado.
  - [ ] Diálogo com foco preso, setas, Enter e Esc, e atalho configurável.
  - [ ] Busca em tudo ou nos contextos escolhidos, com prefixos `>` e `#` e recentes.
  - [ ] Criação rápida com os campos mínimos e "abrir para completar", otimista e sem violações no axe.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: sonnet |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | ajuste | in_progress | Evidências manuais command-palette-themes-widths.png e command-palette-states-focus.png trocadas por automáticas command-palette-themes-widths.txt e command-palette-states-focus.txt geradas por apps/web/scripts/evidence-command-palette.mjs, com a prancha PNG como Artefato; harness da feature em src/features/command-palette/evidence/harness.tsx montando o provedor e o gatilho sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 4 | 2026-10-31 | ajuste | in_progress | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
| 5 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-10-31 | regressão | passed | 1 comando(s) iguais ao baseline |
| 7 | 2026-10-31 | evidências | passed | 5 evidência(s) em evidence/TASK-32/ |
| 8 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004 e as rotas de detalhe das TASK-24 e TASK-25; Detalhes técnicos registram que nenhuma PD muda a paleta e que as rotas de abrir para completar existem nas features donas; linha test -e da pasta da feature removida da Baseline, que a validação recusa |
| 2 | 2026-10-31 | agente | Evidências manuais command-palette-themes-widths.png e command-palette-states-focus.png trocadas por automáticas command-palette-themes-widths.txt e command-palette-states-focus.txt geradas por apps/web/scripts/evidence-command-palette.mjs, com a prancha PNG como Artefato; harness da feature em src/features/command-palette/evidence/harness.tsx montando o provedor e o gatilho sem mudar apps/web/src/app; Ler, Mudar, passo novo, Verificação, Como comprovar dos critérios e Detalhes técnicos atualizados |
| 3 | 2026-10-31 | agente | Comando das evidências automáticas de testes trocado para pnpm --filter @atria/web exec vitest run src/features/<feature> --reporter=verbose, sem o '--' que fazia o vitest ignorar a pasta, o reporter e o filtro -t |
