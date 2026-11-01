---
id: TASK-28
spec: SPEC-002
title: "Tarefas: filtros, horário opcional e uma linha por tarefa"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-03, TASK-15]
wave: 4
covers: [RF-08, RF-35, RF-37, RF-38, CT-07, CT-34, CT-36, CT-37, CB-05]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 2f36507b912b9a4c023c2aa63ce5ce5e69c3a55cf27b2abe65de0926a9a51318
adjustments: 3
adjusted_at: 2026-11-01T13:40:49Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 4f35c9eeafa6bd8946b8b2dc38a1480af3833e27769d34c020f16e9ffb863f50
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T13:40:49Z
---

# TASK-28: Tarefas: filtros, horário opcional e uma linha por tarefa

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Tarefas: horário obrigatório no formulário, lista que abre em "Hoje" e esconde a pontual de outro dia, e `buildRows` que cria uma linha por ocorrência e duplica a pontual vinda também de `/tasks/occurrences`), RF-08, RF-35, RF-37, RF-38, CT-07, CT-34, CT-36, CT-37, CB-05, CB-06, RN-04, RN-05, "Contratos e interfaces" (`next_occurrence` em `GET /tasks` e `recurrence.rule.time` opcional só nas tarefas), as decisões 5 (5A), 17 (inferência I) e 19 (inferência K) e "Fora do escopo" (sem estado de atrasada).
- `vostok/work/tasks/SPEC-002/TASK-14.md` e `vostok/work/tasks/SPEC-002/TASK-15.md`: como o servidor calcula `next_occurrence` (recorrente: a próxima data não concluída a partir de hoje; pontual: igual a `due_on`; terminada: `null`) e como o tipo gerado chega a `packages/contracts/src/schema.ts`.
- `vostok/work/tasks/SPEC-002/TASK-03.md`: os ícones de visualização exportados pela `@atria/ui` (`ListIcon`, `DayIcon`) e o `icon` obrigatório do `ViewSwitcher`.
- `packages/contracts/src/schema.ts` (arquivo gerado, grande): só por busca, `TaskResponse` (campo `next_occurrence`), `RecurrenceRule` e `OccurrenceResponse`.
- `vostok/rules/project/frontend.md` (em especial [project/frontend-09], [project/frontend-12], [project/frontend-13], [project/frontend-14] e [project/frontend-18]), `vostok/rules/project/code-style.md`, `vostok/rules/project/testing.md` e `vostok/rules/project/language.md`.
- `prototype/atria-prototype.html`: só por busca, a barra de filtros das listagens (`toolbar`, `filters`) para o alinhamento pela base.
- `apps/web/src/features/tasks/hooks/use-tasks.ts`: `tasksSearchSchema`, `occurrenceWindow`, `toRequestRule`, `TaskRow`, `buildRows`, `sortRows` e `useTaskRows`.
- `apps/web/src/features/tasks/hooks/use-task-completion.ts`: como a conclusão otimista muda o cache das ocorrências.
- `apps/web/src/features/tasks/screens/tasks-screen.tsx` e `apps/web/src/features/tasks/screens/tasks-screen.module.css`: barra de filtros (`.filters` com `align-items: flex-start`, a ajuda do campo Etiqueta), `range_help` e `renderBody`.
- `packages/ui/src/toolbar/toolbar.tsx` e `packages/ui/src/toolbar/toolbar.module.css`: a `Toolbar` já alinha busca, filtros e seletor pela base (`align-items: flex-end`).
- `apps/web/src/features/tasks/screens/task-form-screen.tsx`: `rule_schema`, o `superRefine` que exige o horário, `FormRecurrence ... time_required` e `onSubmit`.
- `apps/web/src/shared/forms/recurrence-fields.tsx`: props `time_required` e `with_time` do `FormRecurrence` (o rótulo "Horário (opcional)" sem `time_required`).
- `apps/web/src/features/tasks/components/task-item.tsx` e `apps/web/src/features/tasks/screens/task-screen.tsx` (`OccurrencesTab`, `subtitle` com `tasks.detail.next_date`).
- `apps/web/src/shared/toast/toast-store.ts`: `pushToast({ tone, message_key, params })`.
- `apps/web/src/features/tasks/i18n/pt-br.json`.
- `apps/web/src/features/tasks/hooks/use-tasks.test.tsx` e `apps/web/src/features/tasks/screens/tasks-screens.test.tsx` (780 linhas): fns `task`, `world`, `handle`, `open`, os blocos `tasks list` (linhas 213-433) e `task form` (linhas 547-780), em especial `requires the rule time for a recurring task, as the recurrence rule of the spec`.
- `apps/web/src/features/tasks/tasks.e2e.ts`: fn `createTask` (o horário preenchido por causa do ajuste 7 da TASK-35 da SPEC-001).
- `apps/web/scripts/evidence-tasks.mjs` (699 linhas): `OUT` (linha 19), fns `makeTask`, `fixtures`, `occurrencesOf` e `installApi` (linhas 95-232), `runScenarios`, `sheet`, `scenarios` (linha 401) e `EVIDENCES` (linha 660).

### Mudar

- `apps/web/src/features/tasks/hooks/use-tasks.ts` (alterar): uma linha por tarefa recorrente, com a próxima ocorrência aberta (`next_occurrence` fora da janela), uma única linha por pontual e a contagem das abertas fora do período.
- `apps/web/src/features/tasks/screens/tasks-screen.tsx` (alterar): filtros alinhados pela base sem ajuda sob Etiqueta, ícones no seletor de visualização e o aviso de tarefas abertas fora do período com o botão que troca o período.
- `apps/web/src/features/tasks/screens/tasks-screen.module.css` (alterar): alinhar os filtros pela base e o estilo do aviso fora do período.
- `apps/web/src/features/tasks/screens/task-form-screen.tsx` (alterar): horário opcional na recorrente e aviso de sucesso ao salvar.
- `apps/web/src/features/tasks/components/task-item.tsx` (alterar): mostrar a próxima ocorrência na linha da recorrente.
- `apps/web/src/features/tasks/screens/task-screen.tsx` (alterar): a próxima ocorrência do detalhe vem de `next_occurrence`, inclusive fora dos próximos 7 dias.
- `apps/web/src/features/tasks/i18n/pt-br.json` (alterar): textos do aviso fora do período, dos avisos de sucesso e da próxima ocorrência; saem a ajuda do campo Etiqueta e o erro de horário obrigatório.
- `apps/web/src/features/tasks/hooks/use-tasks.test.tsx` (alterar): testes de uma linha por tarefa, da pontual sem duplicar, de `next_occurrence` e da contagem fora do período.
- `apps/web/src/features/tasks/screens/tasks-screens.test.tsx` (alterar): testes dos filtros alinhados, do aviso fora do período, da recorrente sem horário e do aviso ao salvar; sai o caso que exigia o horário.
- `apps/web/src/features/tasks/hooks/use-task-completion.test.tsx` (alterar): o caso `completes only today occurrence of a daily task` passa a conferir uma única linha da recorrente (RF-38), que continua `done: true` na ocorrência de hoje, em vez da linha da ocorrência seguinte.
- `apps/web/src/features/tasks/tasks.e2e.ts` (alterar): e2e de CT-34, CT-36 e CT-37 contra o servidor real.
- `apps/web/scripts/evidence-tasks.mjs` (alterar): modo `rows`, que fotografa a lista e o aviso fora do período e grava em vídeo `.webm` (`recordVideo`) o formulário sem horário e a lista, e a pasta de saída lida de `VOSTOK_EVIDENCE`.

### Passos

1. Confira em `packages/contracts/src/schema.ts` (gerado pela TASK-15) que `TaskResponse` tem `next_occurrence?: string | null` e que o `time` da regra das tarefas é opcional. Se faltar algum dos dois, **pare** e informe o Coordenador: a TASK-15 não entregou o contrato.
2. Escreva primeiro os testes de `apps/web/src/features/tasks/hooks/use-tasks.test.tsx`:
   - Tire o caso `merges recurring occurrences by task id` (o comportamento muda pelo RF-38).
   - Acrescente, com os nomes exatos: `rf38 shows one row per recurring task with the next open occurrence` (status `open`, período `week`; `r1` com ocorrências de 05/11 concluída e 06/11 e 07/11 abertas: uma única linha de `r1`, com `occurrence_date` e `date` `2026-11-06` e `done` falso); `rf38 never duplicates a single task that also comes from the occurrences` (pontual `s1` com `due_on` `2026-11-05` e a ocorrência `{ task_id: 's1', occurrence_date: '2026-11-05' }`: uma única linha de `s1`, com `occurrence_date` nulo); `rf38 keeps today occurrence of a recurring task when the status is all` (status `all`, `r1` com 05/11 concluída: uma linha, `done` verdadeiro, data 05/11); `cb05 uses next_occurrence when there is no occurrence in the window` (recorrente semanal `r2` sem ocorrências e com `next_occurrence: '2026-11-20'`: em `range: 'all'`, uma linha com data `2026-11-20`; em `range: 'today'`, nenhuma linha); `cb06 hides an ended recurring task from the open ones` (`next_occurrence: null` e sem ocorrências: nenhuma linha em `open`); `rf37 counts the open tasks outside the period` (em `range: 'today'`, uma pontual para 06/11 e a `r2` do CB-05 dão `hidden_open` 2 em `useTaskRows`; em `range: 'all'`, 0; com status `completed`, 0).
3. Escreva os testes de `apps/web/src/features/tasks/screens/tasks-screens.test.tsx`:
   - Em `world()`, acrescente `next_occurrence` às tarefas: `s1` e `s3` `TODAY`, `s0` `'2026-11-01'`, `s2` `'2026-11-20'`, `r1` `TODAY` e `r2` `'2026-11-09'`; no `POST /tasks` do `handle`, a criada recebe `next_occurrence` igual ao `due_on` (pontual) ou `TODAY` (recorrente).
   - Tire o caso `requires the rule time for a recurring task, as the recurrence rule of the spec` e acrescente, com os nomes exatos: `rf35 saves a recurring task without time` (Recorrente, sem horário, Salvar: o `POST` tem `recurrence` sem a chave `time`, nenhum `role="alert"`, e o campo se chama "Horário (opcional)"); `rf37 shows a success notice after saving` (criar e editar: `getToasts()` contém `tasks.form.created` e depois `tasks.form.saved`, com `tone: 'success'`); `rf37 warns about open tasks outside the period and switches it` (em `/tasks`, a região `role="status"` com "Há 2 tarefas abertas em outros dias." — `s2` e `r2` —; clicar em "Ver todas as datas" leva a `range=all` na URL e mostra "Comprar presente"); `rf37 does not warn when the period is all` (em `/tasks?range=all`, sem o aviso); `rf38 lists one row per task in all` (em `/tasks?range=all`, uma única linha com "Alongamento da manhã", uma com "Revisão semanal" e uma com "Pagar a conta de luz"); `rf08 aligns the filters by the base without help under Etiqueta` (o texto "Digite e confirme com Enter." não existe e `getComputedStyle(screen.getByRole('group', { name: 'Filtros' })).alignItems` é `flex-end`); `rf38 shows the next occurrence in the detail beyond the next days` (detalhe de uma recorrente mensal sem ocorrências nos 7 dias e com `next_occurrence: '2026-11-20'`: o subtítulo tem `Próxima: ${formatDate('2026-11-20', 'pt-BR', 'UTC')}` e a aba Ocorrências diz `Próxima ocorrência em ${formatDate('2026-11-20', 'pt-BR', 'UTC')}.`, com o `formatDate` de `apps/web/src/shared/format/intl` para não fixar o texto da data).
4. Rode `pnpm --filter @atria/web exec vitest run src/features/tasks` e confira que os casos novos falham.
5. Em `apps/web/src/features/tasks/hooks/use-tasks.ts`:
   - Troque `type ContractRule = Schemas['RecurrenceRule']` por `type ContractRule = NonNullable<Task['recurrence']>`, para valer o tipo da regra das tarefas, com `time` opcional, qualquer que seja o nome do esquema gerado.
   - Em `toRule`, `time: rule.time === undefined || rule.time === '' ? null : rule.time`.
   - Troque o comentário de `OCCURRENCE_DAYS` por "Janela das ocorrências buscadas: hoje e os seis dias seguintes; a linha da recorrente mostra a próxima aberta (RF-38)."
   - Crie `export function nextOpenDate(task: Task, own: readonly TaskOccurrence[], window_end: string): string | null`: a data da primeira ocorrência aberta de `own` (ocorrências da tarefa a partir de hoje, em ordem); sem nenhuma aberta, `task.next_occurrence` quando ela existe e é maior que `window_end` (a ocorrência já está fora da janela buscada), senão `null` (uma `next_occurrence` dentro da janela e sem ocorrência aberta é um valor antigo do cache, depois de concluir).
   - Crie `function recurringRow(task: Task, own: readonly TaskOccurrence[], status: TasksSearch['status'], today: string, window_end: string): TaskRow | null`: com `open`, a linha de `nextOpenDate` (`done: false`); com `completed`, a primeira concluída de `own` (`done: true`); com `all`, a ocorrência de hoje, se houver (com o `done` dela), senão a de `nextOpenDate`, senão a primeira concluída; sem nenhuma, `null`. A `key` é `${task.id}:${data}` e `occurrence_date` e `date` são a data escolhida.
   - Reescreva o segundo bloco de `buildRows`: em vez de percorrer `occurrences`, percorra `tasks.filter((item) => item.is_recurring)`; para cada uma, `own` são as ocorrências com `task_id` igual e data `>= today`, ordenadas por data; chame `recurringRow` e inclua a linha quando `filters.range === 'all'` ou `row.date <= to`. Assim a pontual nunca entra pelas ocorrências (RF-38).
   - Crie `export function hiddenOpenCount(tasks, occurrences, filters, today): number`: com `filters.range === 'all'` ou `filters.status === 'completed'`, 0; senão conta as pontuais abertas com `due_on > to` (respeitando `filters.recurring !== 'recurring'`) e as recorrentes cuja `nextOpenDate` é maior que `to` (respeitando `filters.recurring !== 'single'`).
   - Em `useTaskRows`, devolva também `hidden_open: number`, calculado com `useMemo` por `hiddenOpenCount(items, occurrences.data?.items ?? [], filters, today)`.
6. Em `apps/web/src/features/tasks/screens/tasks-screen.tsx`:
   - Tire o `help` do `TextField` da Etiqueta.
   - Passe `icon: <ListIcon />` e `icon: <DayIcon />` às opções do `ViewSwitcher`, importados de `@atria/ui` (se a TASK-18 ou a TASK-03 já os tiver passado, mantenha).
   - Troque o `<p className={styles.help}>{t('tasks.list.range_help')}</p>` por esse parágrafo seguido, quando `!list.is_loading && !list.is_error && list.hidden_open > 0`, de `<div role="status" className={styles.notice}><p>{t('tasks.list.hidden_notice', { count: list.hidden_open })}</p><Button onClick={() => { setSearch({ range: 'all' }); }}>{t('tasks.list.hidden_show_all')}</Button></div>`; o aviso aparece também quando a lista está vazia, antes do estado vazio.
7. Em `apps/web/src/features/tasks/screens/tasks-screen.module.css`: em `.filters`, troque `align-items: flex-start` por `align-items: flex-end`; acrescente `.notice` com `display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s3); padding: var(--s3) var(--s4); border-radius: var(--radius-md); background: var(--info-soft); color: var(--text);` e `.notice p { margin: 0; }` (tom calmo, [project/frontend-02] e [project/frontend-14]).
8. Em `apps/web/src/features/tasks/screens/task-form-screen.tsx`:
   - No `superRefine`, tire o bloco que exige `rule.time` na recorrente; troque o comentário de `time` no `rule_schema` por "Na tarefa o horário é opcional: sem ele, a ocorrência vale o dia inteiro (RN-04)."
   - Troque `<FormRecurrence control={control} name="rule" time_required />` por `<FormRecurrence control={control} name="rule" />`.
   - Em `onSubmit`, depois do `update.mutateAsync` com sucesso, `pushToast({ tone: 'success', message_key: 'tasks.form.saved' })`; depois do `create.mutateAsync`, `pushToast({ tone: 'success', message_key: 'tasks.form.created' })`, antes de navegar; import de `pushToast` de `../../../shared/toast/toast-store`.
9. Em `apps/web/src/features/tasks/components/task-item.tsx`, no `date_text` da recorrente (`row.occurrence_date !== null`): quando `row.date > today`, `t('tasks.item.next', { date: formatDate(row.date, locale, 'UTC') })`; senão, o formato atual.
10. Em `apps/web/src/features/tasks/screens/task-screen.tsx`:
    - Troque `const next = occurrences.find((item) => item.occurrence_date > today)` por `const next = task.next_occurrence ?? null` e, no `subtitle`, mostre `tasks.detail.next_date` quando `today_occurrence === undefined && next !== null && next !== today`.
    - Passe `next_occurrence={task.next_occurrence ?? null}` ao `OccurrencesTab` e, no estado vazio, use `description={next_occurrence ? t('tasks.detail.occurrences_next', { date: formatDate(next_occurrence, locale, 'UTC') }) : t('tasks.detail.occurrences_help')}`.
11. Em `apps/web/src/features/tasks/i18n/pt-br.json`: tire `list.filter_label_help` e `form.time_required`; troque `list.range_help` por `"Cada tarefa que repete aparece uma vez, na próxima data em aberto."`; acrescente `"list.hidden_notice": "{count, plural, one {Há # tarefa aberta em outros dias.} other {Há # tarefas abertas em outros dias.}}"`, `"list.hidden_show_all": "Ver todas as datas"`, `"item.next": "Próxima: {date}"`, `"form.created": "Tarefa criada."`, `"form.saved": "Tarefa salva."` e `"detail.occurrences_next": "Próxima ocorrência em {date}."`.
12. Em `apps/web/src/features/tasks/tasks.e2e.ts`: em `createTask`, tire o preenchimento do horário e o comentário do ajuste 7; acrescente, com os nomes exatos, `ct34 saves a daily task without time` (cria a recorrente diária sem horário e vê o título do detalhe e o aviso "Tarefa criada."), `ct36 warns about a single task for tomorrow outside today` (cria a pontual para amanhã pelo calendário, abre `/tasks`, vê "Há 1 tarefa aberta em outros dias." — ou mais, com tarefas de outros testes — e, em "Ver todas as datas", a tarefa) e `ct37 lists one row per task in all` (cria uma diária, uma semanal e uma pontual com títulos únicos, abre `/tasks?range=all` e confere uma linha de cada).
13. Em `apps/web/scripts/evidence-tasks.mjs`:
    - Troque `const OUT = join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-24');` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-001', 'evidence', 'TASK-24');` e atualize o comentário do topo com o modo novo.
    - Nos fixtures, acrescente `makeTask('r-mensal', 'Pagar o condomínio', { is_recurring: true, recurrence: { ...RULE_BASE, frequency: 'monthly', month_day: 20 } })` e `makeTask('t-amanha', 'Levar o carro à revisão', { due_on: '2026-11-06' })`; em `occurrencesOf`, trate `monthly` (dia do mês igual a `month_day`).
    - No `GET /tasks` do `installApi`, cada tarefa sai com `next_occurrence`: pontual, o `due_on`; recorrente, a primeira ocorrência aberta de `occurrencesOf([task], done, TODAY, addDaysIso(TODAY, 60))` ou `null`. Acrescente `POST /tasks` (cria com o corpo, id `t-nova`, responde 201) e `GET /tasks/t-nova`.
    - Acrescente a `EVIDENCES` o modo `rows`, com cenários nos dois temas, em desktop e em 360 px, e as verificações `check`: "filtros alinhados pela base" (desktop: o `bottom` do `getBoundingClientRect` dos campos do grupo "Filtros", da busca e do seletor de visualização com diferença ≤ 1 px), "sem ajuda sob Etiqueta", "uma linha por tarefa recorrente" e "pontual aparece uma vez" (em `/tasks?range=all`), "próxima ocorrência fora da janela" ("Pagar o condomínio" com "Próxima: 20"), "aviso de tarefas abertas fora do período" (em `/tasks`, a região `role="status"` com "em outros dias" e o clique em "Ver todas as datas" mudando a URL para `range=all`), e "sem rolagem horizontal", mais o `baseChecks`. O formulário sem horário não entra na prancha: grave-o em vídeo `tasks-rows.webm` com `recordVideo` do Playwright (desktop 1280x800, tema claro, cursor visível pelo molde do modo `board-drag` de `evidence-projects.mjs`, salvo com `page.video().saveAs(...)` depois de fechar o contexto), com as verificações "vídeo: recorrente salva sem horário", "vídeo: aviso de sucesso ao salvar" (em `/tasks/new`, Recorrente sem horário, Salvar e o aviso "Tarefa criada." visível), "vídeo: uma linha por tarefa recorrente" e "vídeo: próxima ocorrência fora da janela" (na lista depois de salvar), e imprima `video:` com o caminho. Monte a prancha com `sheet(browser, { title: 'SPEC-002 TASK-28 · Tarefas: filtros, horário opcional e uma linha por tarefa (RF-08, RF-35, RF-37, RF-38)', file: 'tasks-rows.png', shots, scale: { desktop: 0.5, mobile: 0.62 } })` e atualize a mensagem de uso (`Use telas ou rows.`).
13a. Em `apps/web/src/features/tasks/hooks/use-task-completion.test.tsx`, no caso `completes only today occurrence of a daily task`, troque a espera da linha `r1:2026-11-06` (uma linha por ocorrência) pela conferência de que há uma única linha de `r1` e que ela segue `done: true`; o nome do caso não muda.
14. Rode os testes do passo 4 até passarem; depois rode a Verificação inteira e corrija lint, Prettier e tipos até tudo terminar sem erro.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/tasks --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | grep -v -E '> (rf08|rf35|rf37|rf38|cb05|cb06) ' | sed -E 's/ [0-9]+ms$//' | sort` (muda): saem `merges recurring occurrences by task id` e `requires the rule time for a recurring task, as the recurrence rule of the spec`, porque a lista passa a ter uma linha por tarefa (RF-38) e o horário fica opcional (RF-35)
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/tasks`
- `pnpm --filter @atria/web exec prettier --check src/features/tasks scripts/evidence-tasks.mjs`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-tasks.mjs`

### Verificação

```bash
# evidência: tasks-tests.txt
pnpm --filter @atria/web exec vitest run src/features/tasks --reporter=verbose
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/tasks
pnpm --filter @atria/web exec prettier --check src/features/tasks scripts/evidence-tasks.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-tasks.mjs
# evidência: tasks-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/tasks/tasks.e2e.ts
```

### Evidências

- `tasks-tests.txt` (automática, da verificação)
  - Prova: a lista mostra uma linha por tarefa recorrente com a próxima ocorrência aberta, nunca duplica a pontual, usa `next_occurrence` fora da janela, esconde a recorrente terminada, conta e avisa as abertas fora do período, os filtros alinham pela base sem ajuda sob Etiqueta, e o formulário salva a recorrente sem horário com aviso de sucesso (RF-08, RF-35, RF-37, RF-38, CT-07, CT-34, CT-36, CT-37, CB-05).
  - Trecho: os casos `rf38 shows one row per recurring task with the next open occurrence`, `rf38 never duplicates a single task that also comes from the occurrences`, `cb05 uses next_occurrence when there is no occurrence in the window`, `rf37 warns about open tasks outside the period and switches it`, `rf35 saves a recurring task without time`, `rf37 shows a success notice after saving` e `rf08 aligns the filters by the base without help under Etiqueta` com `✓`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `tasks-e2e-list.txt` (automática, da verificação)
  - Prova: os e2e de CT-34, CT-36 e CT-37 estão escritos e compilam (rodam com o servidor real na integração).
  - Trecho: as linhas com `ct34 saves a daily task without time`, `ct36 warns about a single task for tomorrow outside today` e `ct37 lists one row per task in all`.
  - Falha: erro de compilação, `Error:` ou algum dos três casos ausente.
- `tasks-rows.png` (print): `node apps/web/scripts/evidence-tasks.mjs rows`
  - Prova: no Chromium, a lista de Tarefas tem os filtros alinhados pela base, uma linha por tarefa (a recorrente com a próxima ocorrência, mesmo fora dos 7 dias) e o aviso calmo de tarefas abertas em outros dias com o botão que troca o período, nos temas claro e escuro, em desktop e em 360 px (RF-08, RF-37, RF-38, RNF-03).
  - Trecho: uma linha `ok` por verificação (filtros alinhados, sem ajuda sob Etiqueta, uma linha por recorrente, pontual uma vez, próxima ocorrência fora da janela, aviso fora do período, sem rolagem horizontal, axe sem violações), a linha `png:` e `ok  0 falha(s)`; na prancha, a barra de filtros numa base só e o aviso em fundo `--info-soft`.
  - Falha: alguma linha `FALHA`, a ausência da linha `png:`, código de saída diferente de 0, ou na imagem a mesma recorrente em várias linhas, filtros desalinhados, o aviso em vermelho ou rolagem horizontal em 360 px.
- `tasks-rows.webm` (print): `node apps/web/scripts/evidence-tasks.mjs rows`
  - Prova: em vídeo gravado no Chromium (desktop 1280x800, tema claro, cursor visível), o formulário de tarefa sem horário é preenchido, o horário fica vazio, a tarefa recorrente é salva com o aviso de sucesso, e a lista mostra uma linha por tarefa com a próxima ocorrência (RF-35, RF-37, RF-38).
  - Trecho: as linhas `ok` de "vídeo: recorrente salva sem horário", "vídeo: aviso de sucesso ao salvar", "vídeo: uma linha por tarefa recorrente" e "vídeo: próxima ocorrência fora da janela", a linha `video:` com o caminho do `.webm` e `ok  0 falha(s)`; no vídeo, o horário vazio, o clique em Salvar, o aviso "Tarefa criada." e a lista com "Próxima: 20 de nov." numa única linha.
  - Falha: alguma linha `FALHA`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo o formulário exigindo horário, o aviso de sucesso ausente ou a mesma recorrente em várias linhas.

### Concluída quando

- [x] A barra de filtros de Tarefas alinha busca, selects, Etiqueta e seletor de visualização pela base, sem texto de ajuda sob Etiqueta (RF-08, CT-07).

  > Como comprovar: em `tasks-tests.txt`, ver aprovado `rf08 aligns the filters by the base without help under Etiqueta`; no log do print, ver `ok` em "filtros alinhados pela base" e conferir a barra na prancha `tasks-rows.png`.

- [x] Uma tarefa recorrente salva sem horário e vale o dia inteiro (RF-35, CT-34, RN-04).

  > Como comprovar: em `tasks-tests.txt`, ver aprovado `rf35 saves a recurring task without time`; no log do print, ver `ok` em "vídeo: recorrente salva sem horário" e conferir no vídeo `tasks-rows.webm` o horário vazio e o salvar.

- [x] Ao salvar uma tarefa, aparece um aviso de sucesso; a lista avisa quando há tarefas abertas fora do período escolhido e oferece trocar o período (RF-37, CT-36).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `rf37 shows a success notice after saving`, `rf37 warns about open tasks outside the period and switches it` e `rf37 counts the open tasks outside the period`; na prancha `tasks-rows.png`, ver o aviso e o botão "Ver todas as datas".

- [x] A lista mostra uma linha por tarefa recorrente, com a próxima ocorrência em aberto (inclusive fora dos próximos 7 dias), e uma única linha por pontual (RF-38, CT-37, CB-05).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `rf38 shows one row per recurring task with the next open occurrence`, `rf38 never duplicates a single task that also comes from the occurrences`, `cb05 uses next_occurrence when there is no occurrence in the window` e `rf38 lists one row per task in all`; no log do print, ver `ok` em "uma linha por tarefa recorrente" (prancha e vídeo) e "pontual aparece uma vez".

- [x] O detalhe da recorrente mostra a próxima ocorrência vinda do servidor, e a recorrente terminada não aparece entre as abertas (RF-38, CB-05).

  > Como comprovar: em `tasks-tests.txt`, ver aprovados `rf38 shows the next occurrence in the detail beyond the next days` e `cb06 hides an ended recurring task from the open ones`.

- [x] Testes, lint, Prettier e typecheck passam sem warning, e os e2e de CT-34, CT-36 e CT-37 estão listados.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; em `tasks-e2e-list.txt`, ver os três casos `ct34`, `ct36` e `ct37`.

## Descrição

### Resumo executivo

A tela de Tarefas deixa de esconder ou repetir tarefas: cada tarefa aparece uma vez, a que repete mostra a próxima data em aberto, e a lista avisa quando há tarefas abertas em outros dias.
O formulário passa a aceitar tarefa que repete sem horário e confirma o salvamento, e os filtros ficam alinhados.
O benefício é confiar na lista: o que foi criado aparece, sem duplicatas.
Perfil padrão: decisões locais sobre como montar as linhas, apoiadas no novo campo de próxima ocorrência do servidor.
Risco médio na montagem das linhas; depende das tarefas do servidor e do contrato (TASK-14 e TASK-15) e dos ícones compartilhados (TASK-03).

### Detalhes técnicos

**Causa e abordagem.** Como diz o "Estado atual" da spec, `buildRows` (`use-tasks.ts`) percorre as ocorrências de `/tasks/occurrences`, que traz também as datas das pontuais, e cria uma linha por ocorrência: a pontual aparece duas vezes e a recorrente uma vez por dia da janela. A correção percorre as tarefas recorrentes, não as ocorrências, e monta uma linha por tarefa com a próxima ocorrência aberta (decisão 5A): a primeira aberta da janela de 7 dias, que mantém a conclusão otimista pelo cache de ocorrências (`use-task-completion.ts`, RN-05) ou, fora da janela, o `next_occurrence` do servidor (CB-05). A pontual continua vindo só da lista de tarefas.

**Decisões.**
- Com status "Todas", a linha da recorrente é a ocorrência de hoje quando existe, aberta ou feita, para o "Feita hoje" e o reabrir continuarem na lista (casos `pd33` e `pd04` atuais); com "Abertas", a próxima aberta; com "Concluídas", a concluída da janela. Alternativa descartada: usar só o `next_occurrence`, que não muda na conclusão otimista e faria a linha piscar até o servidor responder.
- Uma `next_occurrence` dentro da janela sem ocorrência aberta é tratada como valor antigo do cache (logo depois de concluir) e ignorada.
- O aviso fora do período (inferência K) conta pontuais e recorrentes abertas com data depois da janela e oferece "Ver todas as datas" (`range=all`). Alternativa descartada na spec: mudar o período padrão.
- Horário opcional só na tarefa (inferência I): o formulário tira a exigência; lembretes e Financeiro não mudam. O tipo da regra passa a ser `NonNullable<Task['recurrence']>`, para valer o esquema das tarefas, qualquer que seja o nome gerado pela TASK-15.
- O aviso de sucesso usa o `pushToast` que o app já tem, e o formulário continua indo ao detalhe. Alternativa descartada: voltar à lista, que muda o fluxo além do pedido.
- Sem estado de atrasada nas recorrentes (fora do escopo, resposta 5A).

**Arquivos além dos componentes do plano.** `i18n/pt-br.json` de Tarefas ([project/language-06]), os testes (`use-tasks.test.tsx`, `tasks-screens.test.tsx`, `tasks.e2e.ts`) e o modo `rows` do `scripts/evidence-tasks.mjs`, que passa a gravar em `$VOSTOK_EVIDENCE`.

**Riscos.** Depende do campo `next_occurrence` e do `time` opcional no contrato gerado (TASK-14 e TASK-15); o passo 1 para a tarefa se faltarem. O baseline dos testes de Tarefas leva `(muda)`: saem os dois casos do comportamento antigo.

**Referências.** RF-08, RF-35, RF-37, RF-38, CT-07, CT-34, CT-36, CT-37, CB-05, CB-06, RN-04, RN-05, decisões 5 (5A), 17 (I) e 19 (K).

**Arquivos em comum na onda 4.** Nenhum: TASK-16 (Financeiro), TASK-20 (Diário) e TASK-25 (Acervo e leitor) não alteram os arquivos desta tarefa. `tasks-screen.tsx` não é alterado pela TASK-18 (onda 2), que cuida dos ícones das outras telas.

### Card

- **Título:** Tarefas: filtros, horário opcional e uma linha por tarefa
- **Tipo:** bug
- **Descrição:** Tarefas com uma linha por tarefa (a recorrente com a próxima ocorrência e a pontual sem duplicar), horário opcional na recorrente, aviso ao salvar e aviso de tarefas abertas fora do período, com os filtros alinhados pela base.
- **Critérios de aceite:**
  - [ ] Filtros alinhados pela base, sem ajuda sob Etiqueta.
  - [ ] Recorrente salva sem horário.
  - [ ] Aviso de sucesso ao salvar.
  - [ ] Aviso de tarefas abertas fora do período, com troca do período.
  - [ ] Uma linha por recorrente, com a próxima ocorrência, e a pontual uma única vez.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03, TASK-15

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | use-task-completion.test.tsx incluído em Mudar (passo 13a): o caso da recorrente diária confere uma única linha (RF-38) em vez da linha da ocorrência seguinte |
| 4 | 2026-11-01 | ajuste | in_progress | Edição manual |
| 5 | 2026-11-01 | ajuste | in_progress | Evidência do formulário sem horário e da lista passa a vídeo tasks-rows.webm (print), com a prancha tasks-rows.png só para os estados estáticos; passo do script, Evidência e Como comprovar atualizados |
| 6 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 mudança(s) esperada(s) |
| 8 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 9 | 2026-11-01 | conferência | usuário | print tasks-rows.png conferido pelo usuário (sha256 0cdb2efb) |
| 10 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 11 | 2026-11-01 | conferência | usuário | print tasks-rows.webm conferido pelo usuário (sha256 af706fdf) |
| 12 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 13 | 2026-11-01 | conferência | usuário | print tasks-rows.png conferido pelo usuário (sha256 6f324d16) |
| 14 | 2026-11-01 | conferência | usuário | print tasks-rows.webm conferido pelo usuário (sha256 bb370a3a) |
| 15 | 2026-11-01 | evidências | passed | 4 evidência(s) em evidence/TASK-28/ |
| 16 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | use-task-completion.test.tsx incluído em Mudar (passo 13a): o caso da recorrente diária confere uma única linha (RF-38) em vez da linha da ocorrência seguinte |
| 2 | 2026-11-01 | manual | Edição manual |
| 3 | 2026-11-01 | agente | Evidência do formulário sem horário e da lista passa a vídeo tasks-rows.webm (print), com a prancha tasks-rows.png só para os estados estáticos; passo do script, Evidência e Como comprovar atualizados |
