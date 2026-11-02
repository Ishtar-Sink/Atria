<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- `lib/adjustment-form.ts` concentra a regra do formulário fora dos componentes ([project/code-style-09]): o item do formulário guarda o percentual como texto (`rate_text`) e a caixa `base_different`; `parseRate` converte "11,5" em 1150 centésimos de ponto, `toAdjustments` monta o item do contrato e `adjustment_item_schema` valida nome (1 a 60), valor fixo maior que zero, percentual de 0,01 a 99,99 e base maior que zero (RN-02, RN-05, CB-08, CB-09). Exporta também `MAX_ADJUSTMENTS`, `formatRate`, `fromAdjustments`, `adjustments_schema` e `emptyAdjustment`.
- `AdjustmentsField` é um `useFieldArray` genérico sobre qualquer formulário que tenha `adjustments`, reaproveitado na liquidação pela TASK-08 (com o texto `base_help`). Cada item é um `fieldset` com `legend` "Item N", o que dá a cada campo um nome acessível dentro do grupo (RNF-04).
- Acréscimo ao plano: `AdjustmentsField` aceita a prop opcional `children`, renderizada dentro do grupo "Descontos e acréscimos". O formulário a usa para pôr o líquido ao vivo dentro do grupo, como o teste ct11 confere.
- `AdjustmentsBreakdown` é uma `dl` sem cartão: o formulário a usa ao vivo, com o resultado de `computeNet` da TASK-03 (RF-13, RNF-02), e os detalhes a usam com os valores do servidor (`computed_amount`), dentro do cartão "Descontos e acréscimos" com "Previsto" e "Liquidado" (RF-12, CT-10). A fn `adjustmentText` do mesmo arquivo escreve o valor com "−" ou "+" e é reaproveitada no cartão do painel (TASK-09). O arquivo exporta também `breakdownItems`.
- O líquido ao vivo é anunciado num `role="status"` à parte, para o leitor de tela não ler a lista inteira a cada tecla. Ele fica dentro do grupo, pela prop `children` acima.
- Hooks: `amountFields` decide o corpo do pedido; `changedFields` compara os itens pelo conteúdo; o PATCH atualiza o líquido no cache na hora ([project/frontend-18]); as liquidações aceitam `adjustments`; `useSettlementPreview` consulta `POST /transactions/settlement-preview` (decisão 13). O hook ainda não é usado por nenhuma tela: a TASK-08 o liga à liquidação.

## Decisões

- O campo do valor continua "Valor previsto" (na recorrente, "Valor") e passa a ser o bruto, com o texto `adjustments.gross_help`. Descartado: renomear para "Valor bruto", que muda o texto para todas as movimentações sem itens e quebra os seletores dos testes, dos e2e e do script de evidências. No detalhe, o fato "Valor previsto" continua o líquido (`expected_amount`, decisão 7), e o bruto aparece no cartão.
- Sem itens, os pedidos de criar e editar continuam com `expected_amount`, como hoje (RN-09); com itens, ou ao tirar os últimos, vão `gross_amount` e `adjustments`. Descartado: mandar sempre os três campos, que mudaria os pedidos de quem não usa descontos e depende de o servidor aceitar `expected_amount` junto dos itens.
- O cartão "Descontos e acréscimos" só aparece com itens; sem itens a tela fica como hoje (CB-06). Descartado: o cartão sempre visível com bruto igual ao líquido, que repete o valor para a maioria das movimentações.
- Desconto com "−" e acréscimo com "+" na cor do texto. Descartado: o `MoneyAmount` com verde no "+", que pintaria de verde um juro numa saída.
- Prévia como `useQuery` com `keepPreviousData`, sem atraso artificial: o cálculo é barato e cada valor digitado tem a própria chave. Descartado: um atraso de digitação no hook, que complica o teste e o lint dos efeitos.

## Riscos

- Os nomes do contrato vêm das TASK-04 e TASK-05; o passo 1 confere `schema.ts` e o estudo e para se algo divergir.
- O tipo gerado deixa de aceitar as fixtures antigas (`gross_amount` e `adjustments` obrigatórios na resposta): a tarefa atualizou `test-utils.tsx`, as fixtures dos testes e as do script de evidências. A fixture do resumo do painel (`adjustments_by_name`, da TASK-06) continua com erro de tipo e fica para a TASK-09, por isso a checagem de tipos desta tarefa a deixa de fora.
- Se `computeNet` da tela calcular diferente do servidor, `ct11 shows the same net as the shared table case ct02…` falha (RNF-02).
- A prévia da liquidação (`useSettlementPreview`) ainda não está em nenhuma tela; a TASK-08 a usa.

## Arquivos alterados

- `apps/web/src/features/finance/lib/adjustment-form.ts` (novo): regra do formulário sem React, com leitura e escrita do percentual, conversão para o contrato e validação dos itens.
- `apps/web/src/features/finance/lib/adjustment-form.test.ts` (novo): testes da leitura do percentual, da conversão e da validação.
- `apps/web/src/features/finance/components/adjustments-field.tsx` (novo): `AdjustmentsField`, o editor da lista de itens, com a prop `children`.
- `apps/web/src/features/finance/components/adjustments-breakdown.tsx` (novo): `AdjustmentsBreakdown`, o detalhamento do bruto, dos itens e do líquido; exporta `adjustmentText` e `breakdownItems`.
- `apps/web/src/features/finance/components/adjustments.test.tsx` (novo): testes de componente dos dois, com axe.
- `apps/web/src/features/finance/components/finance.module.css` (alterar): classes do editor e do detalhamento, só com tokens; o editor vira uma coluna abaixo de 480 px.
- `apps/web/src/features/finance/screens/transaction-form-screen.tsx` (alterar): editor no formulário, líquido previsto ao vivo, envio do bruto e dos itens, erro de líquido zerado ou negativo.
- `apps/web/src/features/finance/screens/transaction-detail-screen.tsx` (alterar): cartão "Descontos e acréscimos" com previsto e liquidado.
- `apps/web/src/features/finance/screens/recurrence-detail-screen.tsx` (alterar): cartão "Descontos e acréscimos" com o previsto da recorrência.
- `apps/web/src/features/finance/hooks/use-transactions.ts` (alterar): tipos dos itens, `amountFields`, campos editáveis, comparação dos itens no PATCH, líquido otimista com `computeNet`, itens na liquidação e `useSettlementPreview`.
- `apps/web/src/features/finance/hooks/use-recurring-transactions.ts` (alterar): itens opcionais na liquidação da ocorrência.
- `apps/web/src/features/finance/i18n/pt-br.json` (alterar): 34 textos novos em `adjustments.*`.
- `apps/web/src/features/finance/test-utils.tsx` (alterar): campos novos na fixture da movimentação, fixtures `salary()` (t20) e `settledSalary()` (t21, casos ct02 e ct05), helper `breakdownRows`, e o servidor simulado, que calcula o líquido com `computeNet` e grava bruto e itens.
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx` (alterar): testes do formulário e do detalhe com itens.
- `apps/web/src/features/finance/screens/recurrence-detail-screen.test.tsx` (alterar): `rent` aceita `overrides`; teste dos itens da recorrente no detalhe.
- `apps/web/src/features/finance/hooks/use-transactions.test.tsx` (alterar): testes da prévia, dos itens na liquidação, do `amountFields` e do líquido otimista.
- `apps/web/src/features/finance/hooks/use-recurring-transactions.test.tsx` (alterar): campos novos na fixture e os itens na liquidação da ocorrência.
- `apps/web/scripts/evidence-finance.mjs` (alterar): campos novos nas fixtures, mundo com o salário (`adjustedWorld()`) e o modo `descontos-form`, que gera `finance-descontos-form.png`.

## Verificação

- Testes: os 199 testes do Financeiro passam, incluindo os novos.
- Lint e tipos: ESLint e Prettier sem erros; `tsc` sem erros, exceto a fixture `summary` do painel, que fica para a TASK-09.
- Regressão: comparada com o baseline, sem regressão. Três comandos saíram iguais, um com acréscimo e uma mudança esperada.
- Evidência: o modo `descontos-form` do script rodou 12 capturas com 0 falhas, e a prancha `finance-descontos-form.png` foi conferida pelo usuário.
- Pontos do script de evidência: no navegador real, o input do rádio do segmento fica por cima do texto, então o script marca o rádio diretamente. A máscara de valor lê os dígitos como reais, e o script precisou considerar isso.

## Referências da spec

RF-05, RF-06, RF-07, RF-12, RF-13, RN-01 a RN-05, RN-09, CT-02, CT-10, CT-11, CT-13, CB-03, CB-06, CB-08, CB-09, RNF-02, RNF-04, RNF-05; decisões 7, 12, 13, 15, 16 e 17; riscos "INSS por faixas" e "significado de `expected_amount`".

## Arquivos em comum

A TASK-07 é a única da onda 5. Na onda 6, `pt-br.json` e `apps/web/scripts/evidence-finance.mjs`, que esta tarefa altera, são alterados de novo pela TASK-08 e pela TASK-09, que rodam em sequência depois dela.
