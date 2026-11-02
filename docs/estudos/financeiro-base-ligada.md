# Estudo: base ligada e parcela a deduzir nos descontos do Financeiro

Este estudo é a primeira tarefa da SPEC-005 (RF-01). Ele confirma ou troca o contrato proposto pela spec antes de qualquer código: como calcular um percentual cuja base está ligada a outros itens da lista, como descontar a parcela a deduzir e como manter o cálculo reverso da liquidação exato e igual na tela e no servidor. As TASK-02 a TASK-08 leem este arquivo no primeiro passo e param se a recomendação divergir do que elas descrevem.

## Pergunta

Dá para manter o cálculo reverso exato, em inteiros e igual na tela e no servidor, quando a base de um percentual é ligada a outros itens da lista e o item tem uma parcela a deduzir? Como recusar ciclos, qual item recebe o centavo residual e o que muda no contrato e no banco?

## Estado atual

O holerite de outubro de 2026, com bruto de R$ 14.500,00, não fecha hoje no Atria. O INSS a 6,81% dá R$ 987,45 em vez de R$ 988,07, porque a alíquota do holerite é arredondada. A base do IRPF precisa ser digitada e ficou R$ 13.511,86 em vez de R$ 13.511,93. E o IRPF a 27,50% dá R$ 3.715,76 em vez de R$ 2.807,05, porque o item não tem como descontar a parcela a deduzir da faixa (R$ 908,73).

O cálculo da SPEC-004 está em `apps/server/src/finance/domain/adjustment.rs` e se repete em `BigInt` em `apps/web/src/features/finance/lib/adjustments.ts`. `item_amount` (`itemAmount` na tela) calcula o percentual sobre o bruto ou sobre a `base_amount` digitada. Na liquidação, `equivalent_gross` (`reverseGross`) estima o bruto por fórmula fechada, `scale_bases` (`scaleBases`) escala a base digitada na proporção do bruto, e `absorb_residual` (`absorbResidual`) põe o centavo residual no último percentual da lista (`rposition` no servidor, `lastPercentIndex` na tela). Nenhuma dessas funções conhece vínculos entre itens.

## Modelo do cálculo

O item percentual passa a ter exatamente uma de três bases, que se excluem (RN-01, decisão 6): o bruto (nenhum campo), a base digitada (`base_amount`) ou a base ligada (`base_items`). A base ligada é o bruto mais a soma assinada dos valores calculados dos itens ligados, `bruto + Σ s × computed_amount`, com `s = −1` no desconto e `+1` no acréscimo (RN-02). O valor de um percentual com parcela é `round_half_up(base × rate_bp ÷ 10000) − deduction_amount` (RN-05).

Como um item pode depender de outro em qualquer posição (decisão 2), os itens são calculados na ordem das dependências, dada por uma ordenação topológica sobre no máximo 20 itens (CB-06). O líquido continua sendo o bruto mais a soma assinada de todos os itens, então ele não depende da ordem da lista (RN-08).

O CT-01, passo a passo:

1. Bruto R$ 14.500,00; INSS fixo R$ 988,07.
2. Base do IRPF, ligada ao INSS: 14.500,00 − 988,07 = R$ 13.511,93 (1351193 centavos).
3. IRPF: 27,50% de 13.511,93 = R$ 3.715,78; menos a parcela de R$ 908,73 = R$ 2.807,05 (280705 centavos).
4. Sindical R$ 35,00 e consignados R$ 3.746,70.
5. Líquido: 14.500,00 − 988,07 − 2.807,05 − 35,00 − 3.746,70 = R$ 6.923,18 (692318 centavos), igual ao holerite.

## Ciclos e validação

A validação estática da lista roda antes de qualquer conta, sempre na mesma ordem na tela e no servidor, para que as duas pontas devolvam o mesmo primeiro erro (RNF-02):

1. `base_items` num item fixo ou junto de `base_amount`: `adjustments.base_items`/`fields_mismatch`.
2. Lista `base_items` vazia: equivale a sem vínculo, sem erro.
3. Posição fora da lista: `adjustments.base_items`/`out_of_range`.
4. Posição igual à do próprio item: `adjustments.base_items`/`self_reference` (CB-01).
5. Posição repetida no mesmo item: `adjustments.base_items`/`fields_mismatch`.
6. Ciclo de dois ou mais itens: `adjustments.base_items`/`cycle` (CB-02), detectado pela ordenação topológica (algoritmo de Kahn: se sobra item sem ordem, há ciclo).
7. Cadeia com mais de 3 níveis de vínculo encadeado: `adjustments.base_items`/`too_deep` (ver "Cálculo reverso").
8. `deduction_amount` num item fixo: `adjustments.deduction_amount`/`fields_mismatch` (CB-05); menor ou igual a zero: `adjustments.deduction_amount`/`must_be_positive`.

Depois vêm as recusas que dependem do bruto, durante o cálculo: base ligada menor ou igual a zero dá `adjustments.base_items`/`not_positive` (CB-03), e parcela maior que o valor percentual dá `adjustments.deduction_amount`/`exceeds_amount` (CB-04, CT-06). Parcela igual ao valor percentual deixa o item em zero e é aceita, porque a RN-06 só recusa o valor negativo.

Casos da tabela: o `ct05` recusa A ligado a B e B ligado a A com `cycle`, e A ligado a si mesmo com `self_reference`; o `ct06` recusa o IRPF de 27,50% sobre R$ 1.000,00 com parcela de R$ 908,73 (275,00 − 908,73 < 0) com `exceeds_amount`.

## Cálculo reverso

O cálculo reverso continua exato. Antes do arredondamento, o valor de cada item segue afim no bruto `G`:

- fixo: constante;
- percentual no bruto: `rate_bp × G ÷ 10000 − parcela`;
- base digitada: `rate_bp × base × (G ÷ bruto previsto) ÷ 10000 − parcela`, porque a base acompanha o bruto (decisão 16 da SPEC-004);
- base ligada: `rate_bp × (G + Σ s × valor ligado) ÷ 10000 − parcela`, que é afim porque os valores ligados são afins.

Composto na ordem das dependências, o líquido sem arredondamento é `a × G + b`, com `a` e `b` racionais. O bruto equivalente ao líquido `N` é `round_half_up((N − b) ÷ a)`, com numerador e denominador inteiros. A parcela entra em `b` como um fixo e não muda na liquidação (RN-07, decisão 8). A base ligada é recalculada a partir dos itens liquidados, nunca escalada (decisão 7); só a base digitada continua escalada na proporção do bruto.

Sem `base_items`, `a` e `b` são exatamente os termos de `equivalent_gross`: `num = (N + F) × G × 10000` e `den = G × 10000 + Σ s × rate_bp × base`. O arredondamento depende só da razão `num ÷ den`, então todos os resultados da SPEC-004 continuam iguais (RNF-03, CT-07); a conferência reproduziu o ct05 (bruto 859220) e o ct07 (bruto 942370) da SPEC-004.

**Viabilidade em `i128`.** Cada nível de percentual ligado em cadeia multiplica o denominador comum por `10000`. Sem redução por MDC, uma cadeia de `k` níveis leva o numerador a cerca de `N × G × 10000^(k+1)`. Com 3 níveis, `10000^4 = 10^16`, e `N × G` precisa ficar abaixo de cerca de `1,7 × 10^22` para caber no `i128` (limite de `1,7 × 10^38`): bruto e líquido de até R$ 1 bilhão cabem com folga; a redução por MDC da TASK-02 amplia a margem (até 6 níveis com valores de até R$ 10 bilhões). No limite teórico da lista (20 itens, cadeia de 19 vínculos, valores em `i64`), a conta estoura, enquanto o `BigInt` da tela não estoura. Pelo critério da decisão "Profundidade da cadeia", a recomendação é um limite de **3 níveis de vínculo encadeado**, validado ao salvar com `adjustments.base_items`/`too_deep`, na tela e no servidor. Assim as duas pontas recusam as mesmas listas, e nenhuma movimentação é gravada sem poder ser liquidada. Um holerite real usa 1 ou 2 níveis.

Erros do reverso: `den ≤ 0`, numerador negativo, base ligada nova menor ou igual a zero ou parcela que deixaria um item negativo dão `adjustments`/`no_gross_for_net` (CB-08). Estouro em valores absurdos dá `adjustments`/`too_large`, sem `panic!`.

Casos da tabela: o `ct02` volta do líquido 692318 ao bruto 1450000 (exato 1450000,10), com o IRPF 280705 e resíduo zero. O `cb08` recusa o líquido de R$ 1.000,00 com IRPF de 27,50% e parcela de R$ 908,73: o bruto estimado 12589 daria IRPF de 3462 − 90873, negativo. O `cadeia` reverte o líquido 500007 com três percentuais encadeados para o bruto 746446.

## Centavo residual

O resíduo `r = N − líquido recalculado` vai para o último item percentual da lista do qual nenhum outro item depende, isto é, que não aparece em nenhum `base_items` (RN-09). Assim a correção não muda nenhuma base ligada. Sem vínculos, todo percentual é livre, e a regra é a de hoje (RNF-03).

O CB-09 não acontece com resíduo diferente de zero. Sem percentual, o reverso é exato (`G = N + F`) e o resíduo é zero. Com pelo menos um percentual, seguir os itens que dependem dele termina num percentual livre, porque o grafo não tem ciclo e só percentuais dependem de outros itens. O caso que sobra é o item livre ficar negativo depois de absorver o resíduo, que continua `adjustments`/`no_gross_for_net`. Numa cadeia, o resíduo pode passar de um centavo, e é sempre absorvido inteiro.

Casos da tabela: no `residuo`, o IRPF vem antes do INSS na lista e é ligado a ele. A regra de hoje mudaria o INSS (último percentual), e a base do IRPF ficaria incoerente; a regra nova muda o IRPF, que fica 253971, e o INSS, base dele, continua 91637. No `cadeia`, o item C, o único livre, absorve o centavo e fica 64679.

## Contrato

O item ganha dois campos opcionais, só no percentual:

- `base_items`: posições, a partir de 0, dos itens da mesma lista que formam a base ligada (decisão 10).
- `deduction_amount`: parcela a deduzir, em centavos, maior que zero.

Os códigos de erro são os da seção "Ciclos e validação": `adjustments.base_items` (`fields_mismatch`, `out_of_range`, `self_reference`, `cycle`, `too_deep`, `not_positive`) e `adjustments.deduction_amount` (`fields_mismatch`, `must_be_positive`, `exceeds_amount`). O `AdjustmentDto` tem `deny_unknown_fields` e recebe os dois campos como `Option`.

As rotas não mudam: criação, edição e liquidação de movimentações e recorrentes passam a aceitar os campos novos, e `POST /api/v1/transactions/settlement-preview` continua com `expected_gross_amount` (DEC-014 da SPEC-004), que só serve para escalar as bases digitadas. A RN-10 (não remover item usado como base) é regra do editor, sem código novo no servidor: o servidor recebe a lista inteira e recusa a posição inválida com `out_of_range`.

## Migração do JSONB

Nenhuma migração. O `AdjustmentRow` gravado em `JSONB` não tem `deny_unknown_fields`, e o `serde` lê campo `Option` ausente como `None`, então as linhas gravadas pela SPEC-004 continuam válidas. Os `CHECK`s da `20261104010001_add-finance-adjustments.sql` só olham o tipo e o tamanho da lista, não as chaves de cada item ([project/development-methodology-02]).

A recomendação é `#[serde(skip_serializing_if = "Option::is_none")]` nos dois campos novos do `AdjustmentRow`, para que um item sem base ligada e sem parcela seja gravado com as mesmas chaves de hoje (RNF-03). A alternativa descartada, gravar `null`, mudaria o `JSONB` de itens que não usam o recurso. O `computed_amount` gravado já vem com a parcela descontada, então o cartão "Descontos do período" soma o valor certo sem mudar a fórmula (RF-10).

## Tabela de casos comum

A TASK-02 (`adjustment.rs`) e a TASK-03 (`adjustments.test.ts`) usam estes ids nos nomes dos testes, com um prefixo próprio (RNF-02). Valores em centavos, posições a partir de 0, desconto em todos os itens; conferidos com frações exatas e arredondamento meio para cima.

| id | entrada | resultado |
|---|---|---|
| ct01 | bruto 1450000; [0] INSS fixo 98807; [1] IRPF 2750 bp, `base_items` [0], parcela 90873; [2] Sindical fixo 3500; [3] Consignados fixo 374670 | base do IRPF 1351193; IRPF 280705; líquido 692318 |
| ct02 | itens do ct01; líquido 692318; bruto previsto 1450000 | bruto 1450000 (exato 1450000,10); IRPF 280705; resíduo 0 |
| ct03 | bruto 1450000; [0] INSS 681 bp no bruto; [1] IRPF 2750 bp, `base_items` [0], parcela 90873 | INSS 98745; base 1351255; IRPF 280722; líquido 1070533 |
| ct04 | bruto 1450000; [0] INSS fixo 98807; [1] Pensão fixo 100000; [2] IRPF 2750 bp, `base_items` [0, 1], parcela 90873 | base 1251193; IRPF 253205; líquido 997988 |
| ct05 | [0] A 1000 bp, `base_items` [1]; [1] B 1000 bp, `base_items` [0]; e, à parte, [0] A 1000 bp, `base_items` [0] | `adjustments.base_items`/`cycle`; `adjustments.base_items`/`self_reference` |
| ct06 | bruto 100000; [0] IRPF 2750 bp no bruto, parcela 90873 | `adjustments.deduction_amount`/`exceeds_amount` (27500 − 90873 < 0) |
| cb08 | líquido 100000; [0] IRPF 2750 bp no bruto, parcela 90873; bruto previsto 1450000 | `adjustments`/`no_gross_for_net` (bruto 12589 daria IRPF 3462 − 90873 < 0) |
| residuo | [0] IRPF 2750 bp, `base_items` [1], parcela 90873; [1] INSS 681 bp no bruto; líquido 1000009; bruto previsto 1450000 | bruto 1345617; INSS 91637; base 1253980; IRPF 253972, que absorve 1 centavo e fica 253971 (o INSS, base do IRPF, não muda) |
| cadeia | [0] A 1100 bp no bruto; [1] B 1500 bp, `base_items` [0]; [2] C 1000 bp, `base_items` [1]; no bruto 800000; e reverso com líquido 500007 e bruto previsto 800000 | bruto 800000: A 88000, B 106800, C 69320, líquido 535880; reverso: bruto 746446, A 82109, B 99651, C 64680, que absorve 1 centavo e fica 64679 |

## Recomendação

1. **Base ligada por posição:** `base_items` com posições a partir de 0, exclusiva com `base_amount`; lista vazia vale como sem vínculo.
2. **Parcela no percentual:** `deduction_amount` em centavos, maior que zero, descontada do valor arredondado; recusada se deixar o item negativo.
3. **Ordem das dependências:** ordenação topológica (Kahn) sobre no máximo 20 itens, com recusa de autorreferência, ciclo e cadeia com mais de 3 níveis (`too_deep`).
4. **Reverso:** forma afim composta em `i128` com `checked_*` no servidor e `BigInt` na tela, com a base ligada recalculada pelos itens liquidados e a parcela fixa.
5. **Resíduo:** no último percentual da lista do qual nenhum item depende.
6. **Armazenamento:** os dois campos opcionais no `JSONB`, com `skip_serializing_if`, sem migração.

## O que muda no contrato da spec

| Ponto do contrato | Proposta da spec | Recomendação do estudo |
|---|---|---|
| `base_items` | Posições dos itens da mesma lista; não vem junto com `base_amount` | confirma; lista vazia vale como sem vínculo |
| `deduction_amount` | Parcela em centavos, maior que zero | confirma |
| Códigos de `adjustments.base_items` | `self_reference`, `cycle`, `out_of_range`, `not_positive`, `fields_mismatch` | confirma, com `fields_mismatch` também para posição repetida, e acrescenta `too_deep` |
| Códigos de `adjustments.deduction_amount` | `must_be_positive`, `exceeds_amount`, `fields_mismatch` | confirma |
| Limite de profundidade da cadeia | Não previsto | muda: no máximo 3 níveis de vínculo encadeado, recusado com `adjustments.base_items`/`too_deep` |
| Rotas e prévia | Rotas sem mudança; prévia aceita os campos novos | confirma; a prévia continua com `expected_gross_amount` |
| Armazenamento | Campos opcionais no `JSONB`, sem migração, a confirmar | confirma, com `skip_serializing_if` |

Como na DEC-014, a spec não é ajustada: as tarefas seguem esta versão do contrato, e a diferença fica registrada aqui para a finalização.

## O que muda nas tarefas

| Tarefa | Mudança | Status |
|---|---|---|
| TASK-02 | Limite de 3 níveis com `too_deep`, lista vazia sem vínculo e repetição com `fields_mismatch` | já na tarefa |
| TASK-03 | O mesmo limite e as mesmas regras de vínculo na tela | já na tarefa |
| TASK-04 | `skip_serializing_if` nos campos novos do `AdjustmentRow`, sem migração | já na tarefa |
| TASK-05 | Texto do erro `too_deep` no editor | já na tarefa |

## Decisões em aberto

Nenhuma.

## Fontes

- [Estudo dos descontos e acréscimos do Financeiro (SPEC-004)](financeiro-descontos.md)
- [Documento técnico da SPEC-004](../specs/SPEC-004/tecnico.html)
- [Cálculo dos ajustes no servidor](../../apps/server/src/finance/domain/adjustment.rs)
- [Cálculo dos ajustes na tela](../../apps/web/src/features/finance/lib/adjustments.ts)
- [Migração dos descontos e acréscimos](../../apps/server/src/finance/migrations/20261104010001_add-finance-adjustments.sql)
