<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

Uma função pura nova em `domain/summary.rs`, `adjustments_by_name(entries)`, soma o `computed_amount` dos itens das entradas do período (as mesmas de "Fechamento": gravadas pela data efetiva e virtuais das recorrentes), agrupando por nome normalizado e sentido. A liquidada entra com os itens da liquidação e as demais com os previstos, lidos por `FinanceItem::settled_adjustments()` e `FinanceItem::adjustments()` (TASK-04). O resultado vai para `PeriodSummaryView.adjustments_by_name` e sai no resumo como `FinancialSummaryResponse.adjustments_by_name: Vec<AdjustmentTotalDto { name, direction, expected, settled }>`. Nenhuma query muda: as entradas já são lidas para o fechamento.

## Decisões

- **`expected` pela regra da RN-11** (liquidadas pelos valores da liquidação, previstas e projeções pelos previstos), como o `forecast` de "Fechamento", e `settled` só das liquidadas, como o `realized`. Descartado `expected` como a soma dos previstos de todas, inclusive das liquidadas, como em "Previsto x realizado": contraria a RN-11.
- **Normalização por tabela própria** (minúsculas, espaços e as letras acentuadas do português e do espanhol). Descartados o crate `unicode-normalization` (dependência nova sem necessidade, [project/stack-12]) e o agrupamento no banco com `finance_unaccent` (o resumo soma em memória e não tem query própria para isso).
- **Chave `(nome, sentido)`:** um desconto e um acréscimo com o mesmo nome ficam em linhas separadas, porque o cartão os mostra em grupos diferentes (RF-14).
- **Nome exibido = o primeiro encontrado**, aparado, na ordem das entradas (data efetiva e chave): estável entre chamadas. Descartado o mais frequente: muda de um período para outro sem a pessoa ter mudado nada.
- **Ordem fixa:** descontos antes dos acréscimos e, em cada grupo, o maior total primeiro, para o cartão não reordenar na tela.
- **Independente da TASK-05:** só os métodos de `FinanceItem` da TASK-04 são usados. A TASK-05 completou a virtual na mesma onda, e as projeções das recorrentes já entram no total sem mudar esta função; os testes desta tarefa usam só movimentações avulsas.

## Riscos

- **Rota do resumo:** a spec cita `GET /api/v1/finance/summary`, mas a rota real é `GET /api/v1/financial-summaries`; o campo entra nela, sem rota nova.
- **Acentos fora da tabela** (por exemplo letras de outros alfabetos) não são unificados; os nomes de descontos da folha brasileira estão cobertos.
- **Typecheck do `apps/web`:** o campo novo e obrigatório quebra o objeto de teste tipado de `apps/web/src/features/finance/screens/finance-panel-screen.test.tsx` até a TASK-09; por isso fica fora desta tarefa.

## Referências da spec

RF-14, RN-11, CT-12, CB-07, decisão 14; o `GET` do resumo em "Contratos e interfaces".

## Arquivos em comum com a onda

A TASK-06 e a TASK-05 estão na onda 4 e dividem `apps/server/src/finance/interface/dto.rs`, `apps/server/src/finance/interface/openapi.rs` (inclusive o teste `documents_all_finance_routes`), `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`: o Coordenador as executa em sequência, em qualquer ordem. A segunda mantém as mudanças da primeira nesses arquivos e regenera o contrato a partir do código, que já inclui as duas.

## O que foi feito

- **Servidor (`apps/server/src/`):**
  - `finance/domain/summary.rs`: `AdjustmentTotal`, `name_key` e `unaccent` (tabela própria das letras acentuadas, sem dependência nova) e `adjustments_by_name`, que agrupa por nome normalizado e sentido, com descontos primeiro e `expected` decrescente. Liquidadas entram pelos itens da liquidação; previstas e virtuais, pelos previstos.
  - `finance/application/summaries.rs`: `PeriodSummaryView.adjustments_by_name`.
  - `finance/interface/dto.rs`: `AdjustmentTotalDto` e o campo `adjustments_by_name` de `FinancialSummaryResponse`.
  - `finance/interface/openapi.rs`: `AdjustmentTotalDto` registrado; o teste `documents_all_finance_routes` confere o campo.
  - `finance/tests/summaries.rs`: 2 testes de integração `adj_`.
- **Contrato:** `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts` regenerados do código. `.sqlx/` sem mudança, porque nenhuma query foi criada ou alterada.
- **Testes:** 3 de domínio em `summary.rs` e 2 de integração em `tests/summaries.rs`. Passam 194 testes de `finance::`. Evidências em `vostok/work/tasks/SPEC-004/TASK-06/evidencias/`: `adjustments-summary-tests.txt` e `adjustments-summary-contract.txt` (2 ok).
- **Regressão:** sem diferença em relação ao baseline; a única diferença é o acréscimo dos testes da TASK-05.

## Pontos de atenção

1. `FinanceItem::adjustments()` e `settled_adjustments()` (`finance/domain/forecast.rs`) agora são usados pelo resumo, mas o `#[cfg_attr(not(test), allow(dead_code))]` com `TODO(SPEC-004 TASK-06)` continua em `forecast.rs`, que está fora da lista de Mudar. Tirar o atributo exige um ajuste da tarefa ou decisão do usuário. Não muda o comportamento.
2. Testes e código foram escritos na mesma rodada. O passo 2 pedia que os testes falhassem antes do código, e isso não foi registrado. Os testes passam, mas não há evidência de que falhariam sem a implementação.
3. O campo novo obrigatório do resumo quebra o objeto de teste tipado de `apps/web/src/features/finance/screens/finance-panel-screen.test.tsx` até a TASK-09. Por isso o typecheck do `apps/web` fica fora desta tarefa, e nenhum arquivo de `apps/web` foi alterado.
