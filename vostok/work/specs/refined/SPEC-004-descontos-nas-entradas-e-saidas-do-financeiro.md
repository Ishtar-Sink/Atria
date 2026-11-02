---
id: SPEC-004
title: "Descontos nas entradas e saídas do Financeiro"
status: planned
author: "Victor Batalha"
created_at: 2026-11-02T01:55:07Z
updated_at: 2026-11-02T02:56:46Z
tags: []
type: feature
source: "draft/SPEC-004-descontos-nas-entradas-e-saidas-do-financeiro.md"
refined_at: 2026-11-02T02:01:35Z
adjustments: 1
adjusted_at: 2026-11-02T02:16:39Z
content_hash: c28d7e8ddf49c3f35f1acbc3578cb1a3b5113eaf9db8f5fc42ed843caa598d9c
approved_at: 2026-11-02T02:24:44Z
approved_hash: c28d7e8ddf49c3f35f1acbc3578cb1a3b5113eaf9db8f5fc42ed843caa598d9c
---

# Descontos nas entradas e saídas do Financeiro - Especificação Refinada

Entradas e saídas do Financeiro ganham descontos e acréscimos nominais (IRPF, INSS, Sindical, juros), em valor fixo ou percentual, calculados sobre o bruto ou sobre uma base de cálculo digitada. O saldo, as projeções e o painel passam a usar o líquido, e na liquidação o usuário informa o líquido que caiu na conta e o sistema recalcula o bruto e os percentuais.

## Objetivo

Hoje a movimentação tem um só valor, e quem conhece o salário bruto não consegue registrar os descontos da folha nem chegar ao líquido que entra no caixa. O resultado esperado é registrar o bruto com os descontos e acréscimos nominais, ver o líquido nas projeções e no saldo e, ao liquidar com outro valor, ter os percentuais reajustados e o valor correto no caixa.

## Escopo

### Dentro do escopo

- Estudo de implementação como primeira tarefa (`docs/estudos/financeiro-descontos.md`), com a pesquisa do cálculo contábil da folha de 2026 (INSS por faixas, IRRF sobre o bruto menos o INSS) e a recomendação de modelo de dados, arredondamento e cálculo reverso.
- Descontos e acréscimos nominais em movimentações avulsas e recorrentes, de entrada e de saída.
- Cada item em valor fixo ou percentual; o percentual incide sobre o bruto ou, com "base diferente do bruto" marcada, sobre a base digitada.
- Líquido previsto calculado a partir do bruto, usado no saldo, nas projeções, nas listagens e no painel.
- Liquidação pelo líquido recebido ou pago, com o bruto e os percentuais recalculados e os itens editáveis antes de confirmar.
- Detalhe da movimentação com o bruto, cada item e o líquido.
- Cartão do painel com o total dos descontos e dos acréscimos do período por nome.
- Contrato da API (`packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`) e migração do banco.

### Fora do escopo

- Tabelas oficiais de INSS e IRRF calculadas pelo sistema (faixas, dedução por dependente, redutor da Lei 15.270/2025): o usuário informa a alíquota (resposta 1A).
- Atualização anual de alíquotas ou modelos de desconto reutilizáveis entre movimentações.
- Descontos em transferências e em pagamento de fatura.
- Relatórios novos além do cartão do painel; os nove relatórios existentes continuam sobre o líquido sem mudança de layout.
- Holerite, declaração de imposto ou qualquer documento fiscal.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | O sistema deve permitir adicionar a uma movimentação avulsa, de entrada ou de saída, uma lista ordenada de itens de ajuste. |
| RF-02 | O sistema deve permitir adicionar a uma movimentação recorrente a mesma lista de itens, que vale para a ocorrência aberta e as seguintes. |
| RF-03 | Cada item deve ter um nome livre (por exemplo IRPF, INSS, Sindical, Juros) de 1 a 60 caracteres. |
| RF-04 | Cada item deve ter o sentido: desconto, que reduz o valor, ou acréscimo, que aumenta o valor. |
| RF-05 | Cada item deve ser em valor fixo, em centavos, ou em percentual, com até duas casas decimais. |
| RF-06 | Cada item percentual deve ter a opção "base diferente do bruto"; marcada, o formulário mostra um campo para digitar a base de cálculo, em centavos. |
| RF-07 | O sistema deve calcular o líquido previsto a partir do bruto informado e dos itens, cada um calculado de forma independente. |
| RF-08 | O saldo, as listagens, as projeções de recorrentes e o painel devem usar o líquido no lugar do bruto. |
| RF-09 | Na liquidação, o usuário deve informar o líquido recebido ou pago, e o sistema deve calcular o bruto equivalente, recalculando os percentuais e mantendo os valores fixos. |
| RF-10 | Antes de confirmar a liquidação, o usuário deve poder editar os itens (nome, sentido, tipo, valor e base) daquela movimentação. |
| RF-11 | A cópia liquidada de uma recorrente deve guardar os itens com os valores da liquidação, sem mudar a regra da recorrente. |
| RF-12 | O detalhe da movimentação deve mostrar o bruto, cada item com o valor calculado e o líquido, no previsto e no liquidado. |
| RF-13 | O formulário da movimentação deve mostrar o líquido previsto atualizado enquanto o usuário edita o bruto e os itens. |
| RF-14 | O painel deve ganhar um cartão com o total dos descontos e o dos acréscimos do período, agrupados por nome. |
| RF-15 | Desfazer a liquidação deve devolver os itens e o bruto ao previsto antes da liquidação. |
| RF-16 | O sistema deve produzir o estudo `docs/estudos/financeiro-descontos.md` antes da implementação, com a pesquisa contábil e a recomendação de modelo, arredondamento e cálculo reverso. |

## Requisitos não funcionais

| ID | Requisito | Como verificar |
|---|---|---|
| RNF-01 | Os valores ficam em centavos inteiros e os percentuais em centésimos de ponto percentual inteiros, sem ponto flutuante no servidor. | Teste unitário de domínio com uma tabela de casos (bruto, itens, líquido esperado) e revisão do tipo dos campos na migração. |
| RNF-02 | O líquido calculado na tela é igual ao do servidor para os mesmos dados. | A mesma tabela de casos roda no teste de domínio do servidor e no teste da biblioteca da tela. |
| RNF-03 | Movimentações existentes continuam com os mesmos valores depois da migração. | Teste de migração: antes e depois, o saldo das contas e o resumo do painel são iguais. |
| RNF-04 | O editor de itens e o cartão do painel seguem a acessibilidade AA e a navegação por teclado do Financeiro. | Teste de componente com rótulos acessíveis e axe nos e2e do Financeiro. |
| RNF-05 | O formulário e o detalhe funcionam a partir de 360 px de largura sem rolagem horizontal. | Evidência em 360 px e em desktop gerada por `apps/web/scripts/evidence-finance.mjs`. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Cada item é calculado de forma independente; a ordem da lista é só de apresentação e não muda o resultado. Cada desconto subtrai o seu valor do bruto e cada acréscimo soma. |
| RN-02 | Percentual sem "base diferente do bruto" incide sobre o bruto; com a opção marcada, incide sobre a base digitada, que precisa ser maior que zero. |
| RN-03 | Cada valor percentual é arredondado para o centavo, meio para cima, no momento em que é calculado. |
| RN-04 | Identidade sempre exata: líquido = bruto − soma dos descontos + soma dos acréscimos. |
| RN-05 | O líquido previsto precisa ser maior que zero, como o valor previsto de hoje. Cada percentual fica entre 0,01% e 99,99%. |
| RN-06 | Na liquidação, os valores fixos não mudam e os percentuais são recalculados sobre o bruto equivalente ao líquido informado. A base digitada acompanha o bruto na mesma proporção (base nova = base prevista × bruto novo ÷ bruto previsto, arredondada para o centavo) e pode ser editada antes de confirmar. |
| RN-07 | Quando o arredondamento impede chegar exatamente ao líquido informado, o centavo de diferença vai para o último item percentual, e o bruto segue a RN-04. |
| RN-08 | A diferença da liquidação (economia, ganho ou perda) é calculada entre o líquido liquidado e o líquido previsto, pela regra que já existe em `apps/server/src/finance/domain/settlement.rs`. |
| RN-09 | Movimentação sem itens tem bruto igual ao líquido, e tudo funciona como hoje. |
| RN-10 | Mudar os itens da recorrente vale para a ocorrência aberta e as seguintes; cópias liquidadas não mudam, como na regra atual das recorrentes. |
| RN-11 | No cartão do painel, nomes que diferem só por maiúsculas ou acentos são somados juntos. Liquidadas entram com os valores da liquidação; previstas e projeções, com os valores previstos. |

## Fluxos

### Fluxo principal

1. O usuário abre "Nova movimentação" no Financeiro, escolhe Entrada e informa o bruto (por exemplo, salário de R$ 8.000,00) e a recorrência mensal.
2. Em "Descontos e acréscimos", adiciona INSS (desconto, percentual 11,00% sobre o bruto), IRPF (desconto, percentual 15,00%, com "base diferente do bruto" marcada e base de R$ 7.120,00) e Sindical (desconto, fixo R$ 40,00).
3. O formulário mostra o líquido previsto a cada mudança (RF-13) e o usuário salva.
4. O painel, as próximas contas e a projeção do mês seguinte mostram o líquido (RF-08), e o cartão "Descontos do período" mostra INSS, IRPF e Sindical (RF-14).
5. No dia do pagamento, o usuário abre a ocorrência, toca em Liquidar e informa o líquido que caiu na conta.
6. O sistema mostra o bruto equivalente, a base do IRPF ajustada na proporção do bruto e cada item recalculado (RF-09); o usuário confere e confirma.
7. O saldo da conta soma o líquido informado, a cópia liquidada guarda os itens da liquidação (RF-11) e a recorrente passa para o mês seguinte com os itens previstos.

### Fluxos alternativos

- FA-01 (passo 6): o usuário edita um item antes de confirmar (por exemplo, o IRPF veio com outra alíquota); o sistema recalcula o bruto com os itens editados e o líquido continua o informado (RF-10).
- FA-02 (passo 1): saída com abatimento ou encargo, por exemplo conta de R$ 200,00 com desconto à vista de 10% e acréscimo fixo de R$ 5,00 de taxa; o líquido previsto é R$ 185,00 e é o que sai do saldo.
- FA-03 (passo 5): movimentação avulsa, sem recorrência; a liquidação segue os passos 5 e 6 e não há próxima ocorrência.
- FA-04 (depois do passo 7): o usuário desfaz a liquidação; o saldo é revertido e os itens voltam ao previsto (RF-15).

## Casos de borda

| ID | Situação | Comportamento esperado | Requisitos |
|---|---|---|---|
| CB-01 | Líquido informado na liquidação é zero. | Aceito, como hoje (`settled_amount >= 0`); o bruto equivalente é a soma dos fixos ajustada pelos percentuais, e se não houver bruto possível, o sistema recusa com mensagem. | RF-09 |
| CB-02 | Só há itens fixos. | O bruto equivalente é o líquido mais os descontos fixos menos os acréscimos fixos. | RF-09 |
| CB-03 | Os itens deixam o líquido previsto zero ou negativo. | O salvamento é recusado com erro no campo dos itens. | RF-07 |
| CB-04 | Percentual de 0% ou de 100% ou mais. | Recusado na validação (RN-05). | RF-05 |
| CB-05 | Arredondamento não fecha o líquido informado. | O último percentual absorve o centavo (RN-07) e a identidade RN-04 vale. | RF-09 |
| CB-06 | Movimentação liquidada antes desta spec. | Mostra bruto igual ao líquido, sem itens; desfazer a liquidação funciona como hoje. | RF-12, RF-15 |
| CB-07 | Nomes "INSS" e "inss" em movimentações diferentes. | Somados numa linha só no cartão do painel (RN-11). | RF-14 |
| CB-08 | Movimentação com 20 itens ou mais. | O limite é de 20 itens por movimentação; o 21º é recusado. | RF-01 |
| CB-09 | "Base diferente do bruto" marcada sem valor ou com zero. | O salvamento é recusado com erro no campo da base. | RF-06 |

## Contratos e interfaces

Proposta inicial; o estudo (RF-16) pode refinar nomes e o armazenamento, e a mudança volta para a spec por ajuste.

```text
Item de ajuste (adjustment)
{
  "name": "INSS",                  // 1 a 60 caracteres
  "direction": "deduction" | "addition",
  "mode": "fixed" | "percent",
  "amount": 4000,                  // mode=fixed: centavos > 0
  "rate_bp": 1100,                 // mode=percent: centésimos de ponto percentual, 1..9999
  "base_amount": 712000,           // só em percent, opcional: base digitada em centavos > 0;
                                   // ausente = base no bruto
  "computed_amount": 88000         // só na resposta: valor calculado em centavos
}

POST /api/v1/transactions, PATCH /api/v1/transactions/{id}
POST /api/v1/recurring-transactions, PATCH /api/v1/recurring-transactions/{id}
  + "gross_amount": 800000          // bruto previsto, centavos
  + "adjustments": [ ... ]          // 0 a 20 itens, na ordem
  "expected_amount" passa a ser só leitura na resposta: o líquido previsto
  (sem "adjustments", o pedido aceita "expected_amount" como hoje, e bruto = líquido)

POST /api/v1/transactions/{id}/settlement
POST /api/v1/recurring-transactions/{id}/settlement
  { "settled_amount": 612345, "settled_at": "2026-11-05",
    "adjustments": [ ... ] }        // opcional: itens editados (RF-10)
  resposta: + "settled_gross_amount", + "settled_adjustments"

POST /api/v1/transactions/settlement-preview   (nova; só cálculo, sem gravar)
  { "settled_amount": 612345, "adjustments": [ ... ] }
  -> 200 { "gross_amount": 800000, "adjustments": [ ...com computed_amount ] }

GET /api/v1/finance/summary
  + "adjustments_by_name": [
      { "name": "INSS", "direction": "deduction", "expected": 88000, "settled": 88000 } ]
```

Migração nova em `apps/server/src/finance/migrations/`, sem mudar valores existentes (RNF-03). Contrato regenerado com `pnpm --filter @atria/contracts generate` e conferido com `pnpm --filter @atria/contracts check`.

## Componentes afetados

| Caminho | Ação | Motivo |
|---|---|---|
| `docs/estudos/financeiro-descontos.md` | criar | Estudo da primeira tarefa (RF-16). |
| `apps/server/src/finance/domain/adjustment.rs` | criar | Cálculo do líquido, do bruto equivalente e do arredondamento (RN-01 a RN-07). |
| `apps/server/src/finance/domain/mod.rs` | alterar | Registrar o módulo novo. |
| `apps/server/src/finance/domain/transaction.rs` | alterar | Bruto e itens na movimentação, liquidação e desfazer. |
| `apps/server/src/finance/domain/recurring_transaction.rs` | alterar | Itens na recorrente e na liquidação da ocorrência. |
| `apps/server/src/finance/domain/settlement.rs` | alterar | Diferença sobre o líquido (RN-08). |
| `apps/server/src/finance/domain/forecast.rs` | alterar | Ocorrências virtuais com o líquido e os itens. |
| `apps/server/src/finance/domain/summary.rs` | alterar | Total por nome para o cartão do painel (RF-14). |
| `apps/server/src/finance/application/transactions.rs` | alterar | Criar, editar, liquidar e prévia com itens. |
| `apps/server/src/finance/application/recurring_transactions.rs` | alterar | Criar, editar e liquidar a ocorrência com itens. |
| `apps/server/src/finance/application/summaries.rs` | alterar | Montar o total por nome. |
| `apps/server/src/finance/infrastructure/pg_transactions.rs` | alterar | Gravar e ler bruto e itens. |
| `apps/server/src/finance/infrastructure/pg_recurring_transactions.rs` | alterar | Gravar e ler os itens da recorrente. |
| `apps/server/src/finance/migrations/20261104010001_add-finance-adjustments.sql` | criar | Bruto e itens de ajuste, sem mudar valores existentes. |
| `apps/server/src/finance/interface/dto.rs` | alterar | Campos novos dos pedidos e respostas. |
| `apps/server/src/finance/interface/handlers.rs` | alterar | Rota da prévia da liquidação. |
| `apps/server/src/finance/interface/openapi.rs` | alterar | Documentar os campos e a rota nova. |
| `apps/server/src/finance/tests/transactions.rs` | alterar | Testes de integração das avulsas. |
| `apps/server/src/finance/tests/recurring_transactions.rs` | alterar | Testes de integração das recorrentes. |
| `apps/server/src/finance/tests/summaries.rs` | alterar | Teste do total por nome. |
| `packages/contracts/openapi.json` | alterar | Contrato gerado. |
| `packages/contracts/src/schema.ts` | alterar | Tipos gerados. |
| `apps/web/src/features/finance/lib/adjustments.ts` | criar | Cálculo do líquido na tela, igual ao do servidor (RNF-02). |
| `apps/web/src/features/finance/components/adjustments-field.tsx` | criar | Editor da lista de itens no formulário e na liquidação. |
| `apps/web/src/features/finance/components/adjustments-breakdown.tsx` | criar | Bruto, itens e líquido no detalhe. |
| `apps/web/src/features/finance/components/settlement-card.tsx` | alterar | Liquidação pelo líquido com prévia e edição dos itens. |
| `apps/web/src/features/finance/screens/transaction-form-screen.tsx` | alterar | Bruto, itens e líquido previsto no formulário. |
| `apps/web/src/features/finance/screens/transaction-detail-screen.tsx` | alterar | Mostrar o detalhamento. |
| `apps/web/src/features/finance/screens/recurrence-detail-screen.tsx` | alterar | Mostrar os itens da recorrente. |
| `apps/web/src/features/finance/screens/finance-panel-screen.tsx` | alterar | Cartão "Descontos do período". |
| `apps/web/src/features/finance/hooks/use-transactions.ts` | alterar | Campos novos e a prévia. |
| `apps/web/src/features/finance/hooks/use-recurring-transactions.ts` | alterar | Campos novos. |
| `apps/web/src/features/finance/i18n/pt-br.json` | alterar | Textos novos. |
| `apps/web/scripts/evidence-finance.mjs` | alterar | Evidências do formulário, da liquidação e do cartão. |

## Premissas e dependências

- O Financeiro da SPEC-001 e da SPEC-003 está implantado, com a liquidação pelo efetivo e a diferença (`apps/server/src/finance/domain/settlement.rs`).
- A recorrência segue a ocorrência única com cópia liquidada e projeção virtual (DEC-003), e desfazer a liquidação reabre a ocorrência (DEC-004, DEC-005).
- O usuário informa as alíquotas efetivas; o sistema não conhece as tabelas oficiais (resposta 1A).
- O estudo (RF-16) termina antes de qualquer mudança de código, e uma mudança de contrato que ele recomendar volta para a spec por ajuste.
- Valores da pesquisa de 2026 (INSS de 7,5% a 14% por faixas até R$ 8.475,55; IRRF sobre o bruto menos o INSS, com o redutor até R$ 5 mil) vêm de fontes de terceiros e servem só de exemplo no estudo.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| O cálculo reverso não fecha o centavo com vários percentuais e bases digitadas. | alto | RN-07 e tabela de casos com bases digitadas no teste de domínio. |
| A base digitada proporcional não bate com a base real do holerite. | baixo | A base aparece na prévia da liquidação e pode ser editada antes de confirmar (RN-06). |
| A tela e o servidor calculam diferente. | médio | Mesma tabela de casos nos dois testes (RNF-02) e prévia da liquidação pelo servidor. |
| A migração altera o valor de movimentações existentes. | alto | Bruto igual ao líquido e lista vazia por padrão, com teste de saldo antes e depois (RNF-03), e backup antes do deploy. |
| O usuário espera o INSS por faixas e vê diferença do holerite. | médio | Texto de ajuda no editor dizendo que o percentual é a alíquota efetiva, e a liquidação pelo líquido corrige o valor real. |
| Mudar o significado de `expected_amount` quebra a tela. | médio | `expected_amount` continua sendo o valor que afeta o saldo (o líquido), e o bruto entra em campo novo. |

## Casos de teste

| ID | Cenário | Passos | Resultado esperado | Requisitos |
|---|---|---|---|---|
| CT-01 | Avulsa de entrada com descontos. | Criar entrada de R$ 8.000,00 com INSS 11% sobre o bruto e Sindical fixo R$ 40,00. | Líquido previsto R$ 7.080,00; INSS R$ 880,00. | RF-01, RF-03, RF-05, RF-07 |
| CT-02 | Base digitada. | Bruto R$ 8.000,00, INSS 11% sobre o bruto e IRPF 15% com base digitada de R$ 7.120,00; depois mudar a ordem dos itens. | IRPF R$ 1.068,00; líquido R$ 6.052,00, igual nas duas ordens. | RF-06, RF-07 |
| CT-03 | Saída com desconto e acréscimo. | Saída de R$ 200,00 com desconto 10% e acréscimo fixo R$ 5,00. | Líquido R$ 185,00 sai do saldo na liquidação. | RF-04, RF-08 |
| CT-04 | Recorrente com itens. | Criar recorrente mensal com itens e consultar a projeção de três meses. | Cada ocorrência virtual tem o líquido e os itens. | RF-02, RF-08 |
| CT-05 | Liquidação pelo líquido. | Liquidar a ocorrência de CT-02 informando R$ 6.500,00. | Bruto recalculado, base do IRPF na mesma proporção do bruto, INSS e IRPF recalculados, saldo + R$ 6.500,00, identidade RN-04 exata. | RF-09, RF-11 |
| CT-06 | Edição dos itens na liquidação. | Na liquidação, mudar o IRPF para 22,5% e confirmar. | Bruto recalculado com o novo item; a regra da recorrente continua com 15%. | RF-10, RF-11 |
| CT-07 | Centavo do arredondamento. | Bruto com percentuais que não fecham o líquido informado. | O último percentual absorve o centavo e a RN-04 vale. | RF-09 |
| CT-08 | Diferença sobre o líquido. | Entrada com líquido previsto R$ 7.080,00 liquidada por R$ 7.000,00. | Diferença −R$ 80,00, tipo perda. | RF-09 |
| CT-09 | Desfazer a liquidação. | Liquidar e depois desfazer. | Saldo revertido, itens e bruto voltam ao previsto. | RF-15 |
| CT-10 | Detalhe da movimentação. | Abrir o detalhe de CT-05. | Mostra bruto, cada item com valor e líquido, previsto e liquidado. | RF-12 |
| CT-11 | Prévia no formulário. | Editar o bruto e um percentual no formulário. | O líquido previsto muda a cada edição e é igual ao do servidor. | RF-13 |
| CT-12 | Cartão do painel. | Período com duas entradas com "INSS" e "inss" e uma saída com "Juros". | Uma linha de INSS somada nos descontos e uma de Juros nos acréscimos. | RF-14 |
| CT-13 | Validações. | Percentual 0%, 100%, base digitada zero, 21 itens, líquido zero ou negativo. | Cada caso recusado com erro no campo. | RF-05, RF-07 |
| CT-14 | Migração. | Rodar a migração num banco com movimentações e conferir saldo e resumo. | Valores iguais antes e depois; bruto igual ao líquido. | RF-08 |
| CT-15 | Estudo. | Conferir `docs/estudos/financeiro-descontos.md`. | Tem a pesquisa contábil, o modelo de dados, o arredondamento, o cálculo reverso e a recomendação. | RF-16 |

## Critérios de aceite

- [ ] CA-01: O estudo `docs/estudos/financeiro-descontos.md` existe e foi revisado antes da implementação (RF-16).
- [ ] CA-02: Movimentações avulsas e recorrentes aceitam itens nominais de desconto ou acréscimo, fixos ou percentuais, com a base escolhida (RF-01, RF-02, RF-03, RF-04, RF-05, RF-06).
- [ ] CA-03: O líquido previsto segue as RN-01 a RN-05 nos casos de CT-01 a CT-03 e CT-13 (RF-07).
- [ ] CA-04: Saldo, listagens, projeções e painel usam o líquido (RF-08).
- [ ] CA-05: A liquidação pelo líquido recalcula o bruto e os percentuais, mantém os fixos e fecha a identidade RN-04 (RF-09, RF-11).
- [ ] CA-06: Os itens são editáveis na liquidação sem mudar a regra da recorrente (RF-10).
- [ ] CA-07: O detalhe mostra bruto, itens e líquido, e o formulário mostra o líquido previsto ao vivo, igual ao do servidor (RF-12, RF-13).
- [ ] CA-08: O cartão do painel soma descontos e acréscimos por nome (RF-14).
- [ ] CA-09: Desfazer a liquidação devolve itens e bruto ao previsto (RF-15).
- [ ] CA-10: A migração não muda valores existentes (RF-08).

## Referências

| Tipo | Referência | Uso |
|---|---|---|
| arquivo | `apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql` | Campos e restrições da movimentação (previsto, efetivo, diferença). |
| arquivo | `apps/server/src/finance/migrations/20261101070003_create-finance-recurring-transactions.sql` | Modelo da recorrente e da ocorrência aberta. |
| arquivo | `apps/server/src/finance/domain/settlement.rs` | Regra da diferença e do efeito no saldo. |
| arquivo | `apps/server/src/finance/domain/forecast.rs` | Ocorrências virtuais e valor usado nas projeções. |
| arquivo | `apps/server/src/finance/domain/summary.rs` | Onde o painel soma previsto e realizado. |
| arquivo | `apps/server/src/finance/interface/dto.rs` | Pedidos de criação, edição e liquidação. |
| arquivo | `apps/server/src/finance/interface/openapi.rs` | Rotas do Financeiro. |
| arquivo | `packages/contracts/package.json` | Comandos de geração e conferência do contrato. |
| arquivo | `docs/estudos/financeiro-painel.md` | Formato dos estudos do Financeiro. |
| memória | DEC-003 | Ocorrência única, cópia liquidada e projeção virtual. |
| memória | DEC-004 | Excluir a cópia liquidada reabre a ocorrência. |
| memória | DEC-005 | Edição e desfazer a liquidação. |
| documentação | Agência Brasil, tabelas do IR 2026 | Faixas do IRRF e redutor da Lei 15.270/2025. |
| documentação | Escola Superior ESN e Razonet, folha de 2026 | INSS por faixas e IRRF sobre o bruto menos o INSS. |

## O que mudou

| # | Assunto | Estado no Original | Estado Refinado |
|---|---|---|---|
| 1 | Cálculo | "como na parte contábil, sob a base bruta" | Percentual ou fixo informado pelo usuário, sobre o bruto ou sobre uma base digitada, sem tabelas oficiais e sem efeito da ordem. |
| 2 | Liquidação | "os percentuais já se ajustam" | O usuário informa o líquido; o sistema calcula o bruto equivalente e recalcula os percentuais. |
| 3 | Saídas | "descontos nas entradas e saídas" | Itens com sentido: desconto ou acréscimo, nos dois tipos. |
| 4 | Projeções | "as projeções levam isso em consideração" | Saldo, projeções e painel usam o líquido, mais o cartão de descontos por nome. |
| 5 | Estudo | "estudo como primeira tarefa" | RF-16 com o documento do estudo e o que ele cobre. |
| 6 | Pesquisa | "pesquise, por favor" | Pesquisa da folha de 2026 registrada em premissas e referências, para o estudo aprofundar. |

## Registro de decisões

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Itens percentuais ou fixos, com base no bruto ou no acumulado, em ordem. | Só sobre o bruto; tabelas oficiais de INSS e IRRF. | resposta 1A |
| 2 | Na liquidação o usuário informa o líquido e o sistema calcula o bruto. | Informar o bruto; informar os dois. | resposta 2B |
| 3 | Cada item diz se é desconto ou acréscimo. | Saída só com abatimento; saída só com encargo. | resposta 3C |
| 4 | Painel e saldo pelo líquido, detalhe com bruto e itens, cartão por nome. | Só no detalhe; bruto e líquido nos gráficos. | resposta 4A |
| 5 | Tipo `feature`, com o estudo como primeira tarefa. | Spec `study` separada. | inferência A |
| 6 | Vale para avulsas e recorrentes; as cópias guardam os itens da liquidação. Parcelamento fica de fora porque a API não o expõe. | Incluir parceladas. | inferência B |
| 7 | O usuário digita o bruto; `expected_amount` passa a ser o líquido, que afeta o saldo. | `expected_amount` ser o bruto. | inferência C |
| 8 | Diferença da liquidação sobre o líquido. | Sobre o bruto. | inferência D |
| 9 | Desfazer a liquidação devolve os itens ao previsto. | Manter os itens da liquidação. | inferência E |
| 10 | Movimentações existentes ficam sem itens, bruto igual ao líquido. | Converter valores. | inferência F |
| 11 | Centavos inteiros, arredondamento meio para cima por item, centavo residual no último percentual. | Arredondar só no total. | inferência G |
| 12 | Líquido previsto maior que zero; percentual de 0,01% a 99,99%; até 20 itens. | Sem limites. | inferência H |
| 13 | Prévia da liquidação calculada pelo servidor, e o formulário calcula localmente com a mesma tabela de casos. | Só cálculo local. | inferência I |
| 14 | Nomes iguais sem diferenciar maiúsculas e acentos somam juntos no painel. | Agrupar pelo texto exato. | inferência J |
| 15 | A base do percentual é o bruto ou uma base digitada (checkbox "base diferente do bruto"); a ordem não muda o cálculo. Substitui a base no acumulado da decisão 1. | Base no acumulado depois dos itens anteriores, que exige reordenar. | ajuste 1 |
| 16 | Na liquidação, a base digitada acompanha o bruto na mesma proporção e pode ser editada antes de confirmar. | Base fixa até ser editada. | ajuste 1 |
| 17 | A base digitada precisa ser maior que zero. | Aceitar base zero. | ajuste 1, inferência A |

## Pendências

| # | Pendência | Opções em aberto |
|---|---|---|
| - | Nenhuma | - |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-02 | agente | RF-06 troca a base no acumulado pela opção base diferente do bruto com a base digitada; RF-07 e RN-01 tiram o efeito da ordem; RN-02 e RN-06 com a base digitada proporcional ao bruto na liquidação; contrato com base_amount; CT-02, CT-05, CT-13, nova CB-09, riscos e decisões 15 a 17 |
