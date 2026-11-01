---
id: TASK-08
spec: SPEC-002
title: "Dashboard com cards pareados"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-09, CT-08]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: c3d439752760310b40367f623268111c40d36b93ae4857916222defdd84e8565
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: f789406d28bdd71c0020e1bfc7eb588b60e5339e47faf740d9863401c9f06ea0
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-08: Dashboard com cards pareados

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Painéis (Bugs 10 e 11)"; RF-09; CT-08; RNF-02; decisão 2, resposta 2A: linhas pareadas como exceção à PD-25)
- `docs/decisoes-do-prototipo.md` (PD-25 e PD-58: as zonas do dashboard e do painel; esta tarefa registra a exceção da resposta 2A)
- `prototype/atria-prototype.html` (regras `.dash`, `.dash-zone` e `.card`, e a montagem do dashboard perto da linha 2340: a referência visual dos cartões, salvo o alinhamento)
- `apps/web/src/features/dashboard/blocks.ts`
- `apps/web/src/features/dashboard/screens/dashboard-screen.tsx` (fn `DashboardScreen`, linhas 440 a 515)
- `apps/web/src/features/dashboard/screens/dashboard-screen.test.tsx` (testes `shows the greeting and the two zones with the blocks in order`, `keeps the zones in one column below 960 px with the main zone first` e `grows the last card of each zone so the columns end together`; constante `CSS`)
- `apps/web/src/features/dashboard/components/dashboard.module.css` (regras `.zones`, `.zonesSingle`, `.zone` e `.zone > :last-child`, linhas 1 a 29)
- `apps/web/src/features/dashboard/components/dashboard-block.tsx` (o bloco é um `Card as="section"` com `data-block`)
- `apps/web/scripts/evidence-dashboard.mjs` (constante `OUT`, cenários `dashboard com dados` e `bloco oculto em Configurações`, fn `sheet` e `main`)
- `vostok/rules/project/frontend.md` ([project/frontend-10], [project/frontend-17])
- `vostok/rules/project/code-style.md` ([project/code-style-09], [project/code-style-10])

### Mudar

- `apps/web/src/features/dashboard/blocks.ts` (alterar): função pura `dashboardCells` que dá a cada bloco visível a linha e a coluna, pareando o N-ésimo bloco da zona principal com o N-ésimo da lateral (RF-09).
- `apps/web/src/features/dashboard/blocks.test.ts` (criar): testes da `dashboardCells` com todos os blocos, com blocos ocultos e com uma zona vazia.
- `apps/web/src/features/dashboard/screens/dashboard-screen.tsx` (alterar): renderizar os blocos numa grade única de linhas pareadas, cada um numa célula com `data-zone`, `data-row` e `data-alone`.
- `apps/web/src/features/dashboard/screens/dashboard-screen.test.tsx` (alterar): trocar os dois testes das zonas empilhadas pelos testes das linhas pareadas.
- `apps/web/src/features/dashboard/components/dashboard.module.css` (alterar): grade de linhas pareadas, com os cartões esticados até a altura da linha e uma coluna abaixo de 960 px.
- `apps/web/scripts/evidence-dashboard.mjs` (alterar): grava a prancha em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-08`) e confere topos e bases alinhados em cada linha.

### Passos

1. Leia os arquivos de "Ler". A zona principal tem `today`, `reminders` e `upcoming`; a lateral, `journal`, `balance` e `reading`. Hoje cada zona é uma coluna em `flex` e só o último cartão cresce (PD-25); a resposta 2A troca isso por linhas pareadas: a linha 1 junta `today` e `journal`, a 2 `reminders` e `balance`, a 3 `upcoming` e `reading`, sempre com os blocos que estão visíveis.
2. Crie `apps/web/src/features/dashboard/blocks.test.ts` antes do código, com os testes `pairs the nth main block with the nth side block in the same row` (os seis blocos dão as linhas 1, 2 e 3, cada uma com dois blocos e `alone: false`), `pairs the visible blocks when some are hidden` (sem `journal` e `upcoming`: `today`+`balance` na linha 1 e `reminders`+`reading` na linha 2), `marks the block without a pair as alone` (sem `journal`: `upcoming` fica sozinho na linha 3 com `alone: true`) e `marks every block as alone when one zone is empty` (só os blocos da zona principal). Rode `pnpm --filter @atria/web exec vitest run src/features/dashboard/blocks.test.ts` e confirme que falham.
3. Em `apps/web/src/features/dashboard/blocks.ts`, exporte:
   ```ts
   export interface DashboardCell {
     readonly id: DashboardBlockId;
     readonly zone: DashboardZone;
     readonly row: number;
     readonly alone: boolean;
   }
   ```
   e `export function dashboardCells(visible: readonly DashboardBlockDef[]): DashboardCell[]`: separa `visible` por `zone` mantendo a ordem, numera as linhas a partir de 1 pelo índice dentro da zona e marca `alone` quando a outra zona não tem bloco no mesmo índice. A saída lista primeiro os blocos da zona principal e depois os da lateral (é a ordem de leitura e de Tab, e a ordem em uma coluna). Rode os testes do passo 2 até passarem.
4. Em `apps/web/src/features/dashboard/screens/dashboard-screen.test.tsx`, apague os testes `keeps the zones in one column below 960 px with the main zone first` e `grows the last card of each zone so the columns end together` e escreva no lugar:
   - `pairs the cards in rows with the same height`: cada `[data-row="N"]` tem um bloco da zona principal e um da lateral, nas linhas 1, 2 e 3; o CSS tem `.zones` com `grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr)` e `align-items: stretch`, e `.cell > *` com `flex: 1 1 auto` (o cartão estica até a altura da linha);
   - `keeps one column below 960 px with the main zone first`: a ordem dos `[data-zone]` no DOM é `main, main, main, side, side, side` e o CSS tem `@media (max-width: 960px)` com `.zones { grid-template-columns: minmax(0, 1fr) }` e `.cell` com `grid-column: 1` e `grid-row: auto`;
   - `spans a card without a pair across the row`: com `journal` oculto em `atria.dashboard.hidden_blocks.<id>` (como no teste `keeps a block hidden in settings hidden after reload`), o bloco "Próximos dias" fica numa célula com `data-alone` e o CSS tem `.cell[data-alone]` com `grid-column: 1 / -1`.
   Mantenha `shows the greeting and the two zones with the blocks in order` com o mesmo nome; o seletor `[data-zone="main"] > section > div > h2` continua valendo.
5. Em `apps/web/src/features/dashboard/screens/dashboard-screen.tsx`, troque o cálculo de `main`, `side` e `zone_class` por `const cells = dashboardCells(visible)` (importe de `../blocks`) e o `<div className={zone_class}>` com as duas zonas por:
   ```tsx
   <div className={styles.zones}>
     {cells.map((cell) => (
       <div
         key={cell.id}
         className={styles.cell}
         data-zone={cell.zone}
         data-row={cell.row}
         {...(cell.alone ? { 'data-alone': '' } : {})}
       >
         {renderBlock(cell.id)}
       </div>
     ))}
   </div>
   ```
   Tire o `key` de dentro de `renderBlock` só se o lint apontar duplicidade; não mude os blocos.
6. Em `apps/web/src/features/dashboard/components/dashboard.module.css`, substitua as regras das linhas 1 a 29 por:
   - `.zones`: `display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: var(--s4) var(--s5); align-items: stretch; margin-top: var(--s4);`;
   - `.cell { display: flex; min-width: 0; }` e `.cell > * { flex: 1 1 auto; min-width: 0; }`;
   - `.cell[data-zone='main'] { grid-column: 1; }`, `.cell[data-zone='side'] { grid-column: 2; }`, `.cell[data-alone] { grid-column: 1 / -1; }`;
   - `.cell[data-row='1'] { grid-row: 1; }`, `.cell[data-row='2'] { grid-row: 2; }`, `.cell[data-row='3'] { grid-row: 3; }`;
   - `@media (max-width: 960px) { .zones { grid-template-columns: minmax(0, 1fr); } .cell[data-zone], .cell[data-row] { grid-column: 1; grid-row: auto; } }`.
   Apague `.zonesSingle`, `.zone` e `.zone > :last-child`, que ficam sem uso. Só tokens do tema. Rode `pnpm --filter @atria/web exec vitest run src/features/dashboard` até passar.
7. Em `apps/web/scripts/evidence-dashboard.mjs`:
   - troque `OUT` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-08');` e atualize o comentário do topo e o título da prancha para "TASK-08 (SPEC-002) · Dashboard com cards pareados";
   - no cenário `dashboard com dados`, troque as verificações `duas zonas lado a lado`, `colunas terminando juntas` e `uma coluna com a zona principal primeiro` por: em desktop, `check(`${tag}: cards pareados com topos e bases alinhados`, ...)`, que para cada `N` de 1 a 3 mede o `getBoundingClientRect()` das duas `[data-row="N"] > section` e exige diferença de até 1 px no `top` e no `bottom`, com o detalhe `linha N: topo X/Y, base X/Y`; em 360 px, `check(`${tag}: uma coluna com a zona principal primeiro`, ...)`, em que o primeiro `[data-zone="side"]` começa abaixo do último `[data-zone="main"]`;
   - acrescente o cenário `linha com um card só` (`sizes: both`, `storage` com `atria.dashboard.hidden_blocks.u1` = `["journal"]`, `ready: waitData('Dinheiro')`), que em desktop confere `check(`${tag}: card sem par ocupa a linha inteira`, ...)`: a célula `[data-alone]` tem a largura de `.zones` (diferença de até 1 px) e as linhas 1 e 2 seguem com topos e bases alinhados.
8. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-dashboard.mjs telas`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra a prancha para conferir as linhas pareadas nos dois temas e nas três larguras.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/dashboard --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -vE 'keeps the zones in one column below 960 px with the main zone first|grows the last card of each zone so the columns end together' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/dashboard/screens --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -E 'keeps the zones in one column below 960 px with the main zone first|grows the last card of each zone so the columns end together' | sort` (muda): os dois testes das zonas empilhadas são trocados pelos testes das linhas pareadas (resposta 2A).
- `pnpm --filter @atria/web exec eslint src/features/dashboard --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/dashboard scripts/evidence-dashboard.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-dashboard.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes do dashboard: pareamento puro, tela e CSS (Vitest + Testing Library + axe)
# evidência: dashboard-testes.txt
pnpm --filter @atria/web exec vitest run src/features/dashboard --reporter=verbose
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/features/dashboard --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/dashboard scripts/evidence-dashboard.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-dashboard.mjs
# Nenhuma cor literal no CSS do dashboard
! grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' apps/web/src/features/dashboard/components/dashboard.module.css
```

### Evidências

- `dashboard-testes.txt` (automática, da verificação)
  - Prova: os blocos do dashboard ficam em linhas pareadas, com o card sem par ocupando a linha, uma coluna abaixo de 960 px com a zona principal primeiro, sem perder teclado nem axe (RF-09, CT-08).
  - Trecho: as linhas `✓` de `pairs the nth main block with the nth side block in the same row`, `pairs the visible blocks when some are hidden`, `marks the block without a pair as alone`, `marks every block as alone when one zone is empty`, `pairs the cards in rows with the same height`, `keeps one column below 960 px with the main zone first`, `spans a card without a pair across the row`, `navigates every block and control by keyboard` e `has no axe violations`, e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste ou um desses nomes ausente.
- `dashboard-telas.png` (print): `node apps/web/scripts/evidence-dashboard.mjs telas`
  - Prova: no dashboard montado com a API simulada, os cards lado a lado têm a mesma altura, com topos e bases alinhados, nos dois temas, em desktop, 900 px e 360 px, e o card sem par ocupa a linha inteira (RF-09, CT-08, RNF-02, RNF-03).
  - Trecho: as linhas `ok ... cards pareados com topos e bases alinhados`, `ok ... card sem par ocupa a linha inteira`, `ok ... uma coluna com a zona principal primeiro` e `ok ... axe sem violações`, a linha `png:` e a última linha `ok  0 falha(s)`; na imagem, as bases dos cards de cada linha na mesma altura.
  - Falha: qualquer linha `FALHA` (diferença maior que 1 px num topo ou numa base), a ausência da linha `png:`, código de saída diferente de 0 ou, na imagem, cards da mesma linha com alturas diferentes.

### Concluída quando

- [x] Os cards do dashboard ficam em linhas pareadas, com a mesma altura e topos e bases alinhados (RF-09, CT-08).

  > Como comprovar: em `dashboard-testes.txt`, ver aprovados `pairs the nth main block with the nth side block in the same row` e `pairs the cards in rows with the same height`; em `dashboard-telas.png`, a linha `cards pareados com topos e bases alinhados` com `ok` e, na imagem, as bases alinhadas em cada linha.

- [x] Com blocos ocultos, os visíveis continuam pareados e um card sem par ocupa a linha inteira (RF-09, CT-08).

  > Como comprovar: em `dashboard-testes.txt`, ver aprovados `pairs the visible blocks when some are hidden`, `marks the block without a pair as alone` e `spans a card without a pair across the row`; em `dashboard-telas.png`, a linha `card sem par ocupa a linha inteira` com `ok`.

- [x] Abaixo de 960 px os cards ficam numa coluna, com a zona principal primeiro, e a tela segue acessível por teclado e sem violações no axe nos dois temas (RF-09, RNF-03).

  > Como comprovar: em `dashboard-testes.txt`, ver aprovados `keeps one column below 960 px with the main zone first`, `navigates every block and control by keyboard` e `has no axe violations`; em `dashboard-telas.png`, a última linha `ok  0 falha(s)`.

- [x] Lint, formatação e tipos passam sem warning e o CSS usa só tokens do tema.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro.

## Descrição

### Resumo executivo

Alinha os cards do dashboard em linhas pareadas: os cards lado a lado passam a ter a mesma altura, com topos e bases alinhados.
Corrige a aparência desencontrada que a pessoa viu no uso real, com uma exceção registrada ao desenho do protótipo.
Perfil padrão, risco baixo: muda só a disposição dos blocos, sem mexer nos dados.
Não depende de outra tarefa; o mesmo padrão é aplicado depois ao painel do Financeiro.

### Detalhes técnicos

**Abordagem.** A disposição sai de uma função pura em `blocks.ts` (`dashboardCells`), que pareia o N-ésimo bloco visível da zona principal com o N-ésimo da lateral. A tela vira uma grade única de duas colunas (2/3 e 1/3, como hoje): cada bloco fica numa célula com `data-zone`, `data-row` e, sem par, `data-alone`; o `align-items: stretch` da grade e o `flex: 1 1 auto` do cartão dentro da célula dão a mesma altura aos dois cards da linha. Abaixo de 960 px tudo volta a uma coluna, na ordem do DOM (zona principal primeiro).

**Causa confirmada.** Cada zona era uma coluna em `flex` e só o último cartão crescia (PD-25, igual ao protótipo), então os cards do meio ficavam desalinhados.

**Componentes.** `blocks.ts`, `dashboard-screen.tsx`, `dashboard.module.css`, os testes vizinhos e o script de evidência `evidence-dashboard.mjs`.

**Decisões.**
- Linhas pareadas como exceção à PD-25 (resposta 2A da spec, decisão 2). Descartado: manter o protótipo, que é a causa do relato.
- Uma grade só com posição pela linha e pela coluna, e o DOM na ordem das zonas. Descartado: um `div` por linha, que em uma coluna intercalaria os blocos das duas zonas e mudaria a ordem do Tab.
- Card sem par ocupa a linha inteira. Descartado: deixar a outra coluna vazia, que deixa um buraco na grade.
- O pareamento fica numa função pura testável, sem regra na tela ([project/code-style-09]).

**Evidências visuais.** O script `apps/web/scripts/evidence-dashboard.mjs` (TASK-21 da SPEC-001) sobe o Vite com o harness do dashboard e a API simulada; esta tarefa o faz gravar em `$VOSTOK_EVIDENCE` e medir topo e base de cada linha.

**Riscos.** Mudança visual aprovada como exceção; o usuário confere a prancha na finalização (RNF-02). No baseline, o print roda com o script antigo, que grava em `vostok/work/tasks/SPEC-001/evidence/TASK-21`; essa pasta pode ser apagada depois.

**Referências.** RF-09; CT-08; RNF-02, RNF-03; decisão 2 (resposta 2A); PD-25 e PD-58.

**Arquivos em comum na onda 1.** Nenhum: os arquivos são só do dashboard.

### Card

- **Título:** Dashboard com cards pareados
- **Tipo:** bug
- **Descrição:** Cards do dashboard em linhas pareadas, com a mesma altura e topos e bases alinhados, e o card sem par ocupando a linha.
- **Critérios de aceite:**
  - [ ] Cards lado a lado com a mesma altura e topos e bases alinhados.
  - [ ] Com blocos ocultos, os visíveis continuam pareados.
  - [ ] Abaixo de 960 px, uma coluna com a zona principal primeiro.
  - [ ] Acessível por teclado e sem violações no axe, nos dois temas.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo; 1 mudança(s) esperada(s) |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print dashboard-telas.png conferido pelo usuário (sha256 4de3fc4b) |
| 7 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-08/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
