---
id: TASK-10
spec: SPEC-002
title: "Próximas movimentações no servidor"
profile: padrao
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-15, CT-14]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: 1936d9ed6d0ff69e8b53f9483fb6752b5c4262591c7cf0f1614e1e8a31633f65
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: fcc1c71fcb6ce88e8a73c7e92ea0cd49253a76d02d71cd29dabda13e54e10d4f
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-10: Próximas movimentações no servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Financeiro: "Próximas contas" só traz saídas), RF-15, CT-14, o fluxo principal (passo 3) e a decisão 4 (resposta 4A) do "Registro de decisões".
- `vostok/rules/project/code-style.md`: [project/code-style-05], [project/code-style-07], [project/code-style-08] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-07] e [project/testing-09].
- `vostok/memory/knowledge.md` (KNW-007): uma compilação pesada do servidor por vez.
- `apps/server/src/finance/domain/summary.rs` (const `UPCOMING_DAYS`, fn `upcoming_bills` e o teste `upcoming_bills_cover_overdue_and_next_30_days`, linhas 15 a 20, 255 a 275 e 540 a 576).
- `apps/server/src/finance/application/summaries.rs` (struct `SummaryView` com o campo `upcoming_bills`, linhas 55 a 70, e fn `upcoming`, linhas 240 a 261).
- `apps/server/src/finance/domain/forecast.rs` (enum `FinanceItem` e os métodos `kind`, `is_settled`, `expected_date`, `key`): itens gravados e projeções abertas das recorrentes.
- `apps/server/src/finance/interface/dto.rs` (struct `FinanceSummaryResponse`, campo `upcoming_bills`, linhas 980 a 1030): a resposta já leva `kind` em cada item (`TransactionItemResponse`).
- `apps/server/src/finance/tests/summaries.rs` (fn `expense_on`, fn `summary` e teste `upcoming_bills_cover_next_30_days_regardless_of_period`, linhas 275 a 335).
- `apps/server/src/finance/tests/mod.rs`: `FinanceTest`, `create_transaction`, `create_recurring`, `settle` e `monthly_rule`.

### Mudar

- `apps/server/src/finance/domain/summary.rs` (alterar): a seleção das próximas movimentações inclui entradas e saídas não liquidadas até hoje + 30 dias (RF-15).
- `apps/server/src/finance/application/summaries.rs` (alterar): a busca das próximas movimentações deixa de filtrar só as saídas e usa a seleção nova (RF-15).
- `apps/server/src/finance/interface/dto.rs` (alterar): só o comentário de `upcoming_bills`, que vira a descrição do campo no OpenAPI ("Entradas e saídas ...").
- `apps/server/src/finance/tests/summaries.rs` (alterar): o teste das próximas contas passa a esperar a entrada e ganha o caso da entrada recorrente de daqui a 7 dias (CT-14).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Testes primeiro, em `apps/server/src/finance/tests/summaries.rs`:
   - Renomeie `upcoming_bills_cover_next_30_days_regardless_of_period` para `upcoming_movements_cover_income_and_expense_of_next_30_days` e troque a lista esperada por `[("2026-10-20", 1_000, "overdue"), ("2026-11-10", 9_000, "open"), ("2026-11-15", 2_000, "open"), ("2026-11-20", 5_000, "open"), ("2026-12-01", 3_000, "open")]`, conferindo também `body["upcoming_bills"][1]["kind"] == "income"`; a liquidada de 2026-11-05 e a saída de 2026-12-02 continuam fora. Ajuste o índice da recorrente (`[3]`) nas duas asserções de `recurrence_id` e `id`.
   - Acrescente `ct14_recurring_income_in_7_days_is_upcoming`: com o relógio fixo do auxiliar (`TEST_INSTANT`, 2026-11-01; [project/testing-07]), crie uma entrada recorrente mensal com `t.create_recurring(&t.alice, &account, "income", 650_000, monthly_rule("2026-11-08", 8))`, peça `summary(&t, "").await` (`GET /financial-summaries` sem período) e confira em `upcoming_bills` um item com `kind` `income`, `expected_date` `2026-11-08`, `expected_amount` 650000, `recurrence_id` igual ao da recorrente e `id` nulo.
   - Em `apps/server/src/finance/domain/summary.rs`, renomeie o teste `upcoming_bills_cover_overdue_and_next_30_days` para `upcoming_movements_cover_overdue_and_next_30_days` e inclua a entrada de 2026-11-10 (2000) na lista esperada, entre 2026-10-20 e 2026-11-30.
   Rode `cargo test -p atria-server finance::` e confira que esses testes falham.
3. Em `apps/server/src/finance/domain/summary.rs`: renomeie `upcoming_bills` para `upcoming_movements`, tire a condição `item.kind() == TransactionKind::Expense` do filtro (fica `!item.is_settled() && item.expected_date() <= until`), mantenha a ordem por `(expected_date, key)` e troque o comentário para "Próximas movimentações: entradas e saídas não liquidadas até hoje + 30 dias, inclusive as atrasadas, pela data prevista (RF-15)". Atualize o comentário de `UPCOMING_DAYS` e o `//!` do arquivo ("próximas movimentações"). As transferências continuam fora: não são `FinanceItem`.
4. Em `apps/server/src/finance/application/summaries.rs`: em `upcoming`, tire `kind: Some(TransactionKind::Expense)` do `TransactionFilter` e chame `upcoming_movements`; ajuste o `use`. Mantenha o nome do campo `upcoming_bills` em `SummaryView`, para o contrato não mudar de nome; se o `use` de `TransactionKind` ficar sem uso, remova-o.
5. Em `apps/server/src/finance/interface/dto.rs`, troque só o comentário do campo `upcoming_bills` de `FinanceSummaryResponse` por `/// Entradas e saídas não liquidadas dos próximos 30 dias, inclusive as atrasadas, com as ocorrências abertas das recorrentes (RF-15).`
6. Rode `cargo fmt` e a Verificação inteira.

### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | grep -v 'upcoming_bills_cover_' | sort`
- `cargo test -p atria-server -- reports:: search:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
# evidência: upcoming-tests.txt
cargo test -p atria-server -- finance::tests::summaries::upcoming_ finance::tests::summaries::ct14_ finance::domain::summary::tests::upcoming_
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: search::
```

Resultado esperado: formatação e clippy sem aviso e `test result: ok` nos testes das próximas movimentações, do Financeiro inteiro, dos relatórios e da busca.

### Evidências

- `upcoming-tests.txt` (automática, da verificação)
  - Prova: o resumo do Financeiro traz em "Próximas movimentações" as entradas e as saídas não liquidadas até hoje + 30 dias, inclusive a ocorrência aberta de uma entrada recorrente de daqui a 7 dias, sem as liquidadas e sem o que passa dos 30 dias (RF-15, CT-14).
  - Trecho: as linhas `test finance::tests::summaries::upcoming_movements_cover_income_and_expense_of_next_30_days ... ok`, `test finance::tests::summaries::ct14_recurring_income_in_7_days_is_upcoming ... ok` e `test finance::domain::summary::tests::upcoming_movements_cover_overdue_and_next_30_days ... ok`, e `test result: ok. 3 passed`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (testes com o nome antigo).

### Concluída quando

- [x] O resumo do Financeiro lista nas próximas movimentações as entradas e as saídas não liquidadas dos próximos 30 dias, inclusive as atrasadas, em ordem de data (RF-15, CT-14).

  > Como comprovar: em `upcoming-tests.txt`, ver `upcoming_movements_cover_income_and_expense_of_next_30_days ... ok` e `upcoming_movements_cover_overdue_and_next_30_days ... ok`.

- [x] Uma entrada recorrente para daqui a 7 dias aparece nas próximas movimentações como ocorrência aberta, sem id e com o id da recorrente (RF-15, CT-14).

  > Como comprovar: em `upcoming-tests.txt`, ver `ct14_recurring_income_in_7_days_is_upcoming ... ok`.

- [x] O nome do campo da resposta continua `upcoming_bills`, só a descrição muda, e os testes do Financeiro, dos relatórios e da busca continuam passando, sem aviso de formatação ou do clippy (RF-15).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro.

## Descrição

### Resumo executivo

O painel do Financeiro passa a receber do servidor as entradas previstas junto com as saídas dos próximos 30 dias, inclusive as ocorrências das recorrências.
Assim, uma entrada que se repete deixa de "sumir" depois de salva: ela aparece em "Próximas movimentações".
Perfil padrão, risco baixo: muda só a seleção dos itens, sem banco nem nome novo no contrato.
Desbloqueia o painel do Financeiro (TASK-17).

### Detalhes técnicos

**Abordagem.** A seleção `upcoming_bills` do domínio vira `upcoming_movements`, sem o filtro de tipo, e a busca da aplicação deixa de pedir só `Expense` ao repositório. As projeções das recorrentes (`FinanceItem::Virtual`) já entravam na lista; agora as de entrada também passam.

**Decisões.**
- Manter o nome do campo `upcoming_bills` na resposta, mudando só a descrição. Descartado renomear para `upcoming_movements`: quebraria o contrato e o painel, e cada item já leva `kind`, que é o que a tela precisa para separar entradas de saídas. Por isso a TASK-15 não depende desta tarefa: o esquema do OpenAPI não muda, só o texto da descrição, que a TASK-15 pega por rodar depois da onda 1.
- As atrasadas (não liquidadas antes de hoje) continuam na lista, agora também as de entrada, pelo mesmo critério das saídas.
- O teste de integração da data relativa usa o relógio injetável do auxiliar ([project/testing-07]), não a data atual.

**Riscos técnicos.** A lista fica maior para quem tem muitas entradas; continua limitada a 30 dias. O teste antigo é renomeado de propósito: o Baseline tira o nome antigo da comparação.

**Referências da spec.** RF-15, CT-14; decisão 4 (resposta 4A); "Estado atual" do Financeiro.

**Arquivos em comum na onda 1.** `apps/server/src/finance/interface/dto.rs` com a TASK-09 (que acrescenta `system_key` em `CategoryResponse`): executar em sequência. As demais tarefas de servidor da onda compilam o `atria-server` e rodam uma por vez (KNW-007).

### Card

- **Título:** Próximas movimentações no servidor
- **Tipo:** tarefa
- **Descrição:** O resumo do Financeiro passa a trazer em "Próximas movimentações" as entradas e as saídas previstas para os próximos 30 dias, com as ocorrências abertas das recorrências.
- **Critérios de aceite:**
  - [ ] Entradas e saídas não liquidadas dos próximos 30 dias aparecem, inclusive as atrasadas.
  - [ ] Uma entrada recorrente de daqui a 7 dias aparece como ocorrência aberta.
  - [ ] O nome do campo da resposta não muda.
  - [ ] Testes do Financeiro, relatórios e busca, fmt e clippy sem falha.
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
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-10/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
