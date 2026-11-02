<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- `lib/adjustment-form.ts` concentra a regra do formulário fora dos componentes ([project/code-style-09]): o item do formulário guarda o percentual como texto (`rate_text`) e a caixa `base_different`; `parseRate` converte "11,5" em 1150 centésimos de ponto, `toAdjustments` monta o item do contrato e `adjustment_item_schema` valida nome (1 a 60), valor fixo maior que zero, percentual de 0,01 a 99,99 e base maior que zero (RN-02, RN-05, CB-08, CB-09).
- `AdjustmentsField` é um `useFieldArray` genérico sobre qualquer formulário que tenha `adjustments`, reaproveitado na liquidação pela TASK-08 (com o texto `base_help`). Cada item é um `fieldset` com `legend` "Item N", o que dá a cada campo um nome acessível dentro do grupo (RNF-04).
- `AdjustmentsBreakdown` é uma `dl` sem cartão: o formulário a usa ao vivo, com o resultado de `computeNet` da TASK-03 (RF-13, RNF-02), e os detalhes a usam com os valores do servidor (`computed_amount`), dentro do cartão "Descontos e acréscimos" com "Previsto" e "Liquidado" (RF-12, CT-10). A fn `adjustmentText` do mesmo arquivo escreve o valor com "−" ou "+" e é reaproveitada no cartão do painel (TASK-09).
- O líquido ao vivo é anunciado num `role="status"` à parte, para o leitor de tela não ler a lista inteira a cada tecla.
- Hooks: `amountFields` decide o corpo do pedido; `changedFields` compara os itens pelo conteúdo; o PATCH atualiza o líquido no cache na hora ([project/frontend-18]); as liquidações aceitam `adjustments`; `useSettlementPreview` consulta `POST /transactions/settlement-preview` (decisão 13), usada pela TASK-08.

## Decisões

- O campo do valor continua "Valor previsto" (na recorrente, "Valor") e passa a ser o bruto, com o texto `adjustments.gross_help`. Descartado: renomear para "Valor bruto", que muda o texto para todas as movimentações sem itens e quebra os seletores dos testes, dos e2e e do script de evidências. No detalhe, o fato "Valor previsto" continua o líquido (`expected_amount`, decisão 7), e o bruto aparece no cartão.
- Sem itens, os pedidos de criar e editar continuam com `expected_amount`, como hoje (RN-09); com itens, ou ao tirar os últimos, vão `gross_amount` e `adjustments`. Descartado: mandar sempre os três campos, que mudaria os pedidos de quem não usa descontos e depende de o servidor aceitar `expected_amount` junto dos itens.
- O cartão "Descontos e acréscimos" só aparece com itens; sem itens a tela fica como hoje (CB-06). Descartado: o cartão sempre visível com bruto igual ao líquido, que repete o valor para a maioria das movimentações.
- Desconto com "−" e acréscimo com "+" na cor do texto. Descartado: o `MoneyAmount` com verde no "+", que pintaria de verde um juro numa saída.
- Prévia como `useQuery` com `keepPreviousData`, sem atraso artificial: o cálculo é barato e cada valor digitado tem a própria chave. Descartado: um atraso de digitação no hook, que complica o teste e o lint dos efeitos.

## Riscos

- Os nomes do contrato vêm das TASK-04 e TASK-05; o passo 1 confere `schema.ts` e o estudo e para se algo divergir.
- O tipo gerado deixa de aceitar as fixtures antigas (`gross_amount` e `adjustments` obrigatórios na resposta): a tarefa atualiza `test-utils.tsx`, as fixtures dos testes e as do script de evidências. A fixture do resumo do painel (`adjustments_by_name`, da TASK-06) fica para a TASK-09, e por isso a checagem de tipos desta tarefa a deixa de fora.
- Se `computeNet` da tela calcular diferente do servidor, `ct11 shows the same net as the shared table case ct02…` falha (RNF-02).

## Referências da spec

RF-05, RF-06, RF-07, RF-12, RF-13, RN-01 a RN-05, RN-09, CT-02, CT-10, CT-11, CT-13, CB-03, CB-06, CB-08, CB-09, RNF-02, RNF-04, RNF-05; decisões 7, 12, 13, 15, 16 e 17; riscos "INSS por faixas" e "significado de `expected_amount`".

## Arquivos em comum

A TASK-07 é a única da onda 5. Na onda 6, `pt-br.json` e `apps/web/scripts/evidence-finance.mjs`, que esta tarefa altera, são alterados de novo pela TASK-08 e pela TASK-09, que rodam em sequência depois dela.
