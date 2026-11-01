---
id: TASK-18
spec: SPEC-002
title: "Seletores com ícones nas telas"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-03]
wave: 2
covers: [RF-05, RF-06, RF-07, CT-05, CT-06]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 61a43da89ef465f46545a97ddec6b21b45fabda04480056b45f82a527483ca8b
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 057d0fd4a9431234030cbe4974f0e34af56a64b1f8fedcc9ab71c9b143041526
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-18: Seletores com ícones nas telas

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Componentes compartilhados"; RF-05, RF-06, RF-07; CT-05, CT-06; decisão 11, inferência C; "Contratos e interfaces": ícones de visualização da `@atria/ui`)
- `vostok/work/tasks/SPEC-002/TASK-03.md` (ícones `ListIcon`, `GridIcon`, `ShelfIcon`, `TableIcon`, `DayIcon` e `TimelineIcon` exportados pela `@atria/ui`; `ViewSwitcher` com ícone obrigatório, `title` e `aria-label`; a TASK-03 já passou os ícones em `reminders-screen.tsx` e trocou o agrupamento de `connections-tab.tsx` pelo `SegmentedField`)
- `packages/ui/src/icons` (criado pela TASK-03: nomes exatos das exportações)
- `packages/ui/src/index.ts` (exportações dos ícones)
- `packages/ui/src/view-switcher/view-switcher.tsx` (marcação depois da TASK-03: botões com `aria-label` e `title`)
- `prototype/atria-prototype.html` (linha 842: o seletor do Acervo usa o ícone de estante, com `title="Estante"`; linhas 836 a 843: os seletores "Visualização" das listagens)
- `apps/web/src/features/goals/screens/goals-screen.tsx` (fn `Icon`, `ListIcon` e `GridIcon`, linhas 34 a 66; `ViewSwitcher` perto da linha 334)
- `apps/web/src/features/library/shelf-page.tsx` (fn `Icon`, `GridIcon` e `ListIcon`, linhas 44 a 93; `ViewSwitcher` perto da linha 462)
- `apps/web/src/features/admin/screens/users-screen.tsx` (fns `ListIcon` e `TableIcon`, linhas 41 a 75; `ViewSwitcher` perto da linha 318)
- `apps/web/src/features/notes/screens/notes-screen.tsx` (fn `Icon`, `ListIcon` e `GridIcon`, linhas 30 a 62; `ViewSwitcher` perto da linha 253)
- `apps/web/src/features/projects/icons.tsx` (`ListIcon` e `GridIcon`)
- `apps/web/src/features/projects/projects-list-page.tsx` (import de `./icons` e `ViewSwitcher` perto da linha 242)
- `apps/web/src/features/reminders/screens/reminders-screen.tsx` (`ViewSwitcher` perto da linha 230)
- `apps/web/src/features/connections/connections-tab.tsx` (controle de agrupamento perto da linha 103)
- Testes: `apps/web/src/features/goals/screens/goals-screens.test.tsx` (teste `switches between list and grid`), `apps/web/src/features/library/shelf-page.test.tsx`, `apps/web/src/features/admin/screens/users-screen.test.tsx` (teste `switches between list and table`), `apps/web/src/features/notes/screens/notes-screens.test.tsx`, `apps/web/src/features/projects/projects-list-page.test.tsx`, `apps/web/src/features/reminders/screens/reminders-screens.test.tsx` (teste `switches between list and grouped by day`) e `apps/web/src/features/connections/connections-tab.test.tsx` (teste `groups by category and by date`)
- `apps/web/scripts/evidence-goals.mjs` (constante `OUT`, cenário `lista em lista`, `EVIDENCES`)
- `vostok/rules/project/frontend.md` ([project/frontend-08], [project/frontend-12])

### Mudar

- `apps/web/src/features/goals/screens/goals-screen.tsx` (alterar): trocar as cópias locais `Icon`, `ListIcon` e `GridIcon` pelos ícones da `@atria/ui` (RF-06).
- `apps/web/src/features/library/shelf-page.tsx` (alterar): trocar `GridIcon` e `ListIcon` locais por `ShelfIcon` e `ListIcon` da `@atria/ui` (RF-06).
- `apps/web/src/features/admin/screens/users-screen.tsx` (alterar): trocar `ListIcon` e `TableIcon` locais pelos da `@atria/ui` (RF-06).
- `apps/web/src/features/notes/screens/notes-screen.tsx` (alterar): trocar `Icon`, `ListIcon` e `GridIcon` locais pelos da `@atria/ui` (RF-06).
- `apps/web/src/features/projects/icons.tsx` (alterar): tirar as cópias `ListIcon` e `GridIcon` (RF-06).
- `apps/web/src/features/projects/projects-list-page.tsx` (alterar): importar `ListIcon` e `GridIcon` da `@atria/ui` (RF-06).
- `apps/web/src/features/reminders/screens/reminders-screen.tsx` (alterar): conferir e completar o seletor com `ListIcon` e `DayIcon` da `@atria/ui`, passados pela TASK-03 (RF-05).
- `apps/web/src/features/connections/connections-tab.tsx` (alterar): conferir e completar o agrupamento no `SegmentedField` com texto e o rótulo "Agrupar por", trocado pela TASK-03 (RF-07).
- `apps/web/src/features/goals/screens/goals-screens.test.tsx` (alterar): teste dos ícones compartilhados no seletor.
- `apps/web/src/features/library/shelf-page.test.tsx` (alterar): teste do seletor com estante e lista.
- `apps/web/src/features/admin/screens/users-screen.test.tsx` (alterar): teste dos ícones de lista e tabela.
- `apps/web/src/features/notes/screens/notes-screens.test.tsx` (alterar): teste dos ícones compartilhados no seletor.
- `apps/web/src/features/projects/projects-list-page.test.tsx` (alterar): teste dos ícones compartilhados no seletor.
- `apps/web/src/features/reminders/screens/reminders-screens.test.tsx` (alterar): teste dos ícones de lista e por dia.
- `apps/web/src/features/connections/connections-tab.test.tsx` (alterar): teste do agrupamento no seletor segmentado com texto.
- `apps/web/scripts/evidence-goals.mjs` (alterar): grava a prancha em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-18`) e confere os botões do seletor só com ícone, `title` e nome acessível.

### Passos

1. Leia os arquivos de "Ler". Em `packages/ui/src/icons` e `packages/ui/src/index.ts`, anote os nomes exportados pela TASK-03 (contrato da spec: `ListIcon`, `GridIcon`, `ShelfIcon`, `TableIcon`, `DayIcon`, `TimelineIcon`). Depois da TASK-03, o `ViewSwitcher` exige `icon` e cada botão tem `aria-label` e `title` iguais ao `label`.
2. Para cada uma das sete telas, escreva primeiro, no arquivo de teste dela, um teste com o nome `uses the shared view icons with title and accessible name`: dentro de `screen.getByRole('group', { name: 'Visualização' })`, cada botão tem o nome acessível e o `title` esperados e contém um `svg` com `aria-hidden="true"`, e nenhum botão tem texto visível. Os nomes esperados são os rótulos atuais: Metas e Notas "Lista" e "Grade"; Acervo "Grade" e "Lista" (ícone de estante no primeiro); Usuários "Lista" e "Tabela"; Projetos "Lista" e "Grade"; Lembretes "Lista" e "Por dia" (confira o texto de `reminders.list.view_day` no `i18n/pt-br.json` da feature). Em `connections-tab.test.tsx`, o teste se chama `groups with the segmented text field` e confere `screen.getByRole('radiogroup', { name: 'Agrupar por' })` com os rádios "Categoria", "Data" e "Sem grupos" e nenhum `group` "Visualização" na aba (RF-07, CT-06). Mantenha todos os testes existentes com os mesmos nomes. Rode `pnpm --filter @atria/web exec vitest run src/features/goals/screens src/features/library/shelf-page.test.tsx src/features/admin/screens/users-screen.test.tsx src/features/notes/screens src/features/projects/projects-list-page.test.tsx src/features/reminders/screens src/features/connections/connections-tab.test.tsx` e veja quais falham.
3. `apps/web/src/features/goals/screens/goals-screen.tsx`: apague `function Icon`, `const ListIcon` e `const GridIcon` (linhas 34 a 66; o `Icon` só servia a esses dois) e acrescente `GridIcon` e `ListIcon` ao import de `@atria/ui`. Os `options` do `ViewSwitcher` continuam iguais.
4. `apps/web/src/features/notes/screens/notes-screen.tsx`: o mesmo do passo 3 (linhas 30 a 62).
5. `apps/web/src/features/library/shelf-page.tsx`: apague só `const GridIcon` e `const ListIcon` (o `Icon` local continua servindo a `BookIcon`, `ArticleIcon` e `VideoIcon`), importe `ListIcon` e `ShelfIcon` de `@atria/ui` e troque o `icon` da opção `grid` por `<ShelfIcon />`, como no protótipo. Os rótulos não mudam.
6. `apps/web/src/features/admin/screens/users-screen.tsx`: apague `function ListIcon` e `function TableIcon` e importe `ListIcon` e `TableIcon` de `@atria/ui`.
7. `apps/web/src/features/projects/icons.tsx`: apague `export const ListIcon` e `export const GridIcon`. Em `apps/web/src/features/projects/projects-list-page.tsx`, troque `import { GridIcon, ListIcon } from './icons'` pela importação de `GridIcon` e `ListIcon` de `@atria/ui`. Confira com `grep -rn "ListIcon\|GridIcon" apps/web/src/features/projects` que nada mais importa as cópias.
8. `apps/web/src/features/reminders/screens/reminders-screen.tsx`: confira que as opções do `ViewSwitcher` usam `<ListIcon />` e `<DayIcon />` da `@atria/ui`; se faltar algum, passe-o. `apps/web/src/features/connections/connections-tab.tsx`: confira que o agrupamento é um `SegmentedField` com `label={t('connections.group_by')}` e as opções em texto de `GROUPINGS`; se ainda for `ViewSwitcher`, troque por ele, mantendo o `onChange` com `connections.set_grouping`. Não mude mais nada nos dois arquivos.
9. Rode os testes do passo 2 até passarem e rode `grep -rnE '(const|function) (ListIcon|GridIcon|TableIcon)\b' apps/web/src/features` para confirmar que não sobrou cópia local.
10. Em `apps/web/scripts/evidence-goals.mjs`, troque `OUT` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-18');`, atualize o comentário do topo e o título da prancha para "TASK-18 (SPEC-002)" e, no cenário `lista em lista`, acrescente `check(`${tag}: seletor só com ícones, com title e nome acessível`, ...)`: no `group` "Visualização", os dois botões têm `title` "Lista" e "Grade", nome acessível igual, um `svg` cada, texto visível vazio e o `svg` centralizado no botão (a diferença entre o centro do `svg` e o do botão, na horizontal e na vertical, de até 1 px).
11. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-goals.mjs telas`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra a prancha para conferir os seletores nos dois temas e larguras.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/goals/screens src/features/library/shelf-page.test.tsx src/features/admin/screens/users-screen.test.tsx src/features/notes/screens src/features/projects/projects-list-page.test.tsx src/features/reminders/screens src/features/connections/connections-tab.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/goals/screens src/features/library/shelf-page.tsx src/features/library/shelf-page.test.tsx src/features/admin/screens src/features/notes/screens src/features/projects src/features/reminders/screens src/features/connections --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/goals/screens src/features/library/shelf-page.tsx src/features/library/shelf-page.test.tsx src/features/admin/screens src/features/notes/screens src/features/projects/icons.tsx src/features/projects/projects-list-page.tsx src/features/projects/projects-list-page.test.tsx src/features/reminders/screens src/features/connections scripts/evidence-goals.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-goals.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes das sete telas com o seletor (Vitest + Testing Library + axe)
# evidência: seletores-testes.txt
pnpm --filter @atria/web exec vitest run src/features/goals/screens src/features/library/shelf-page.test.tsx src/features/admin/screens/users-screen.test.tsx src/features/notes/screens src/features/projects/projects-list-page.test.tsx src/features/reminders/screens src/features/connections/connections-tab.test.tsx --reporter=verbose
# Nenhuma cópia local dos ícones de visualização (RF-06)
! grep -rnE '(const|function) (ListIcon|GridIcon|TableIcon)\b' apps/web/src/features
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/features/goals/screens src/features/library/shelf-page.tsx src/features/library/shelf-page.test.tsx src/features/admin/screens src/features/notes/screens src/features/projects src/features/reminders/screens src/features/connections --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/goals/screens src/features/library/shelf-page.tsx src/features/library/shelf-page.test.tsx src/features/admin/screens src/features/notes/screens src/features/projects/icons.tsx src/features/projects/projects-list-page.tsx src/features/projects/projects-list-page.test.tsx src/features/reminders/screens src/features/connections scripts/evidence-goals.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-goals.mjs
```

### Evidências

- `seletores-testes.txt` (automática, da verificação)
  - Prova: Metas, Notas, Acervo, Usuários, Projetos e Lembretes usam os ícones compartilhados, só com ícone, `title` e nome acessível, e Conexões agrupa pelo seletor segmentado com texto (RF-05, RF-06, RF-07, CT-05, CT-06).
  - Trecho: as linhas `✓` de `uses the shared view icons with title and accessible name` em `goals-screens.test.tsx`, `notes-screens.test.tsx`, `shelf-page.test.tsx`, `users-screen.test.tsx`, `projects-list-page.test.tsx` e `reminders-screens.test.tsx`, a linha `✓` de `groups with the segmented text field` em `connections-tab.test.tsx` e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste ou um desses nomes ausente.
- `goals-telas.png` (print): `node apps/web/scripts/evidence-goals.mjs telas`
  - Prova: na lista de Metas montada com a API simulada, o seletor mostra só os ícones compartilhados, centralizados, com `title` e nome acessível, nos dois temas, em desktop e 360 px (RF-05, RF-06, CT-05, RNF-02, RNF-03).
  - Trecho: as linhas `ok ... seletor só com ícones, com title e nome acessível` e `ok ... axe sem violações`, a linha `png:` e a última linha `ok  0 falha(s)`; na imagem, os ícones de lista e grade no centro dos botões.
  - Falha: qualquer linha `FALHA` (texto visível no botão, `title` ausente, ícone fora do centro), a ausência da linha `png:` ou código de saída diferente de 0.

### Concluída quando

- [x] Metas, Notas, Acervo, Usuários e Projetos usam os ícones de visualização da `@atria/ui`, sem cópias locais (RF-06, CT-05).

  > Como comprovar: em `seletores-testes.txt`, ver aprovado `uses the shared view icons with title and accessible name` nas cinco telas; o `grep` da "Verificação" não encontra `ListIcon`, `GridIcon` nem `TableIcon` definidos nas features.

- [x] Os seletores mostram só o ícone, centralizado, com `title` e nome acessível, inclusive em Lembretes (RF-05, CT-05).

  > Como comprovar: em `seletores-testes.txt`, ver aprovado o mesmo teste em `reminders-screens.test.tsx`; em `goals-telas.png`, a linha `seletor só com ícones, com title e nome acessível` com `ok` e, na imagem, os ícones no centro dos botões.

- [x] A aba Conexões agrupa os itens com o seletor segmentado de texto (RF-07, CT-06).

  > Como comprovar: em `seletores-testes.txt`, ver aprovado `groups with the segmented text field`.

- [x] As telas seguem acessíveis nos dois temas e em 360 px, e lint, formatação e tipos passam sem warning.

  > Como comprovar: em `goals-telas.png`, a última linha `ok  0 falha(s)`; o bloco de "Verificação" termina sem erro.

## Descrição

### Resumo executivo

Faz as telas de Metas, Notas, Acervo, Usuários e Projetos usarem os ícones de visualização compartilhados, iguais em todo o app.
Os seletores ficam só com ícone, centralizado e com dica, e a aba Conexões agrupa os itens por um seletor de texto.
Perfil padrão, risco baixo: troca ícones repetidos pelos da biblioteca comum, sem mudar dados.
Depende dos ícones compartilhados (TASK-03) e não bloqueia outra tarefa.

### Detalhes técnicos

**Abordagem.** As telas apagam as cópias locais dos ícones de lista, grade e tabela e importam os da `@atria/ui` (TASK-03). No Acervo, a visualização em grade usa o ícone de estante, como no protótipo. Em Lembretes e Conexões, a TASK-03 já passou os ícones e trocou o agrupamento pelo `SegmentedField` para manter o typecheck verde na onda 1; aqui eles só são conferidos e ganham o teste.

**Causa confirmada.** Cada tela tinha a própria cópia dos ícones, algumas opções não tinham ícone e o ícone ficava acima do centro (Estado atual "Componentes compartilhados").

**Componentes.** `goals-screen.tsx`, `shelf-page.tsx`, `users-screen.tsx`, `notes-screen.tsx`, `projects/icons.tsx`, `projects-list-page.tsx`, `reminders-screen.tsx`, `connections-tab.tsx`, os testes de cada tela e o script de evidência `evidence-goals.mjs`.

**Decisões.**
- Ícones só da `@atria/ui` (decisão 11, inferência C). Descartado: manter os ícones por tela, que é a origem da diferença entre as telas.
- Estante no Acervo, como no protótipo, mantendo o rótulo atual "Grade" para não mexer nos textos do Acervo, que o plano não atribui a esta tarefa. Descartado: trocar o rótulo para "Estante" agora.
- O `Icon` local do Acervo continua, porque desenha os ícones de livro, artigo e vídeo do diálogo "Novo".
- Reminders e Conexões ficam em "Mudar" porque o plano os atribui a esta tarefa; se a TASK-03 já tiver deixado os dois como descrito, a mudança neles é só o teste.

**Evidências visuais.** O script `apps/web/scripts/evidence-goals.mjs` (TASK-23 da SPEC-001) sobe o Vite com o harness de Metas e a API simulada; esta tarefa o faz gravar em `$VOSTOK_EVIDENCE` e medir o seletor.

**Riscos.** Se a TASK-03 exportar os ícones com outros nomes, use os nomes de `packages/ui/src/index.ts`. No baseline, o print roda com o script antigo, que grava em `vostok/work/tasks/SPEC-001/evidence/TASK-23`; essa pasta pode ser apagada depois.

**Referências.** RF-05, RF-06, RF-07; CT-05, CT-06; decisão 11 (inferência C); [project/frontend-08].

**Arquivos em comum na onda 2.** Nenhum com a TASK-04, a TASK-13 e a TASK-27: a TASK-27 muda o quadro de Projetos (`kanban-*.tsx`), não `projects/icons.tsx` nem a listagem; se ela importar `ListIcon` ou `GridIcon` de `projects/icons.tsx`, o Coordenador executa as duas em sequência.

### Card

- **Título:** Seletores com ícones nas telas
- **Tipo:** bug
- **Descrição:** As telas passam a usar os ícones de visualização compartilhados, só com ícone e dica, e a aba Conexões agrupa os itens por um seletor de texto.
- **Critérios de aceite:**
  - [ ] Metas, Notas, Acervo, Usuários e Projetos usam os ícones compartilhados, sem cópias locais.
  - [ ] Seletores só com ícone, centralizado, com dica e nome acessível.
  - [ ] Conexões agrupa pelo seletor segmentado com texto.
  - [ ] Telas acessíveis nos dois temas e em 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print goals-telas.png conferido pelo usuário (sha256 a3c20ee2) |
| 7 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-18/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
