<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

Biblioteca pura da feature, `apps/web/src/features/finance/lib/adjustments.ts`, no formato de `finance-period.ts`: sem React, sem chamada de API, só funções e tipos. Ela repete a regra de `apps/server/src/finance/domain/adjustment.rs` (TASK-02) para o formulário mostrar o líquido previsto a cada edição (RF-13, CT-11) sem ida ao servidor; a prévia da liquidação continua pelo servidor (decisão 13, TASK-04 e TASK-08). O teste `adjustments.test.ts` roda a mesma tabela de casos do teste de domínio do servidor, com os mesmos números e códigos de erro (RNF-02). Testes primeiro ([project/development-methodology-01]).

## Componentes afetados

- `apps/web/src/features/finance/lib/adjustments.ts` (criar): tipos, constantes, `validateAdjustments`, `computeNet` e `grossForNet`.
- `apps/web/src/features/finance/lib/adjustments.test.ts` (criar): os 17 casos da tabela comum. O plano lista só a biblioteca; o teste é o par dela na mesma pasta, como `finance-period.test.ts`.

## Decisões

- **Tipos locais com as chaves do contrato, não os gerados.** A TASK-03 depende só do estudo e roda antes da TASK-04, que gera `AdjustmentDto` em `packages/contracts/src/schema.ts`. Os tipos ficam em `adjustments.ts` com as chaves em `snake_case` do contrato ([project/naming-convention-06]) e os opcionais como `?: number | null`, a forma que o gerador produz, para que a TASK-07 passe os itens da API direto às funções. Alternativa descartada: esperar o contrato gerado, que tiraria a tarefa da onda 2 e atrasaria o editor; a regra [project/api-02] fala dos tipos da API, e estes são da biblioteca de cálculo, que a TASK-07 confere contra os gerados no `typecheck`.
- **`BigInt` nas contas, `number` na entrada e na saída.** O numerador do reverso (`líquido × bruto previsto × 10000`) já passa de `Number.MAX_SAFE_INTEGER` num salário de R$ 12.000,00 (`1,2e6 × 1,2e6 × 1e4 = 1,44e16`), e `number` perderia o centavo. Alternativa descartada: `number` com `Math.round`, que diverge do servidor justo nos valores da folha; e uma biblioteca decimal, que exigiria dependência nova ([project/stack-12]) para o que `BigInt` (ES2020, dentro do `target` ES2022) resolve. Resultados fora do inteiro seguro viram `adjustments`/`too_large`; o limite da tela (cerca de R$ 90 trilhões) é menor que o `i64` do servidor e não tem efeito prático.
- **Resultado discriminado, sem exceção.** `computeNet` e `grossForNet` devolvem `{ ok: true, breakdown }` ou `{ ok: false, issue: { field, code } }`, com os mesmos campos e códigos do `FinanceError::invalid` do servidor (`adjustments`, `adjustments.name`, `adjustments.amount`, `adjustments.rate_bp`, `adjustments.base_amount`, `adjustments.mode`, `gross_amount`, `expected_gross_amount`, `settled_amount`). O formulário mostra o erro no campo ([project/frontend-09]) sem `try/catch`. Alternativa descartada: lançar `Error`, que obrigaria cada chamada do editor a capturar e traduzir a mensagem.
- **`Breakdown.adjustments` em vez de `items`.** No servidor o domínio usa `items`, mas a resposta da prévia no contrato é `{ gross_amount, adjustments: [...com computed_amount] }`; a tela segue o contrato, para a TASK-08 trocar o cálculo local pela prévia sem mudar a tela.
- **Nome contado por ponto de código.** `Array.from(name.trim()).length`, igual ao `chars().count()` do `required_name` no servidor; `String.length` contaria unidades UTF-16 e aceitaria menos caracteres que o servidor em nomes com emoji. O plano previa o spread `[...name.trim()]`, trocado por `Array.from` porque o ESLint recusa o spread de string (ver Pontos de atenção).

## Tabela de casos comum (RNF-02)

Copiada da TASK-02 (`vostok/work/tasks/SPEC-004/TASK-02/tecnico.md`), em centavos; `rate_bp` 1100 = 11,00%.

| id | função | entrada | resultado |
|---|---|---|---|
| ct01 | `computeNet` | bruto 800000; INSS desconto 1100 no bruto; Sindical desconto fixo 4000 | `[88000, 4000]`, líquido 708000 |
| ct02 | `computeNet` | bruto 800000; INSS 1100; IRPF desconto 1500 base 712000 (e na ordem inversa) | `[88000, 106800]`, líquido 605200 nas duas ordens |
| ct03 | `computeNet` | bruto 20000; desconto 1000; Taxa acréscimo fixo 500 | `[2000, 500]`, líquido 18500 |
| round | `computeNet` | bruto 33333; desconto 1250 | `[4167]`, líquido 29166 |
| none | `computeNet` | bruto 50000; sem itens | líquido 50000 |
| ct05 | `grossForNet` | líquido 650000; itens do ct02; bruto previsto 800000 | bruto 859220; `[94514, 114706]`; base do IRPF 764706 |
| fixos | `grossForNet` | líquido 100000; Sindical fixo 4000; bruto previsto 104000 | bruto 104000; `[4000]` |
| ct07 | `grossForNet` | líquido 650000; INSS 1100; IRPF 2250 base 712000; bruto previsto 800000 | bruto 942370; `[103661, 188709]` (o IRPF seria 188710); base 838709 |
| ct07 ordem | `grossForNet` | líquido 10000; A desconto 1250 e B desconto 3333 no bruto; bruto previsto 20000 | bruto 18460; A,B `[2308, 6152]`; B,A `[6153, 2307]` |
| cb01 | `grossForNet` | líquido 0; INSS 1100; Sindical fixo 4000; bruto previsto 800000 | bruto 4494; `[494, 4000]` |
| sem bruto | `grossForNet` | líquido 100 com descontos 6000 e 5000 (bruto previsto 10000); líquido 1000 com acréscimo fixo 5000 (bruto previsto 1) | `adjustments`/`no_gross_for_net` |

## Riscos

- A tela e o servidor calcularem diferente (risco médio da spec): mesma tabela e mesmos códigos nos dois testes; qualquer mudança da regra precisa mudar as duas tabelas juntas.
- O contrato gerado na TASK-04 sair com outra forma de opcional (por exemplo, sem `null`): a TASK-07 ajusta na chamada; os tipos daqui aceitam `undefined` e `null`.
- O estudo (TASK-01) mudar a regra ou os nomes: o passo 1 manda parar e ajustar a tarefa.

## Referências da spec

RF-13, CT-11, RNF-02; RN-01 a RN-07; CB-01 a CB-05, CB-08, CB-09; decisões 11, 13, 15, 16 e 17.

## Arquivos em comum com a onda

Nenhum: a TASK-02, da mesma onda, só muda `apps/server/src/finance/domain/`. As duas dividem a tabela de casos, que precisa ficar igual.

## O que foi feito

- Arquivos: `apps/web/src/features/finance/lib/adjustments.ts` (criado, com os tipos, a validação, o líquido e o bruto equivalente em BigInt); `apps/web/src/features/finance/lib/adjustments.test.ts` (criado, com os 17 casos da tabela comum).
- Testes: `adjustments.test.ts` passa com 17 de 17 casos; a pasta `lib` passa com 25 de 25 testes.
- Resultado: ESLint, Prettier e tsc ok.

## Pontos de atenção

- O nome é contado com `Array.from(name.trim())` em vez do spread `[...name.trim()]` previsto, porque o ESLint do projeto recusa o spread de string. A contagem por ponto de código é a mesma; o comportamento não muda.
- Os tipos são locais, com as chaves do contrato, e não os gerados de `packages/contracts`. A TASK-07 precisa conferir no typecheck que batem com o contrato gerado pela TASK-04.
- O cálculo usa só BigInt; o `number` entra apenas na entrada e na saída, e resultados fora do inteiro seguro viram `too_large`.
