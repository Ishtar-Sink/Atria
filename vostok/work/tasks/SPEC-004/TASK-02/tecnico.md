<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

Módulo de domínio puro, `apps/server/src/finance/domain/adjustment.rs`, sem banco nem HTTP ([project/architecture-03] no `//!` de `domain/mod.rs`), com três funções públicas: `validate_adjustments`, `compute_net` (bruto → líquido) e `gross_for_net` (líquido → bruto, na liquidação). Os tipos `AdjustmentDirection`, `AdjustmentMode`, `Adjustment`, `ComputedAdjustment` e `Breakdown` são os que as TASK-04 a TASK-06 vão gravar e expor no contrato, com os nomes do item de ajuste da spec (`name`, `direction`, `mode`, `amount`, `rate_bp`, `base_amount`, `computed_amount`). Testes primeiro ([project/development-methodology-01]), com a tabela de casos comum à TASK-03 (RNF-02).

## Componentes afetados

- `apps/server/src/finance/domain/adjustment.rs` (criar): tipos, validação, cálculo e 17 testes de domínio. O reverso foi dividido em três auxiliares privadas: `equivalent_gross` (bruto equivalente), `scale_bases` (bases digitadas proporcionais) e `absorb_residual` (centavo residual).
- `apps/server/src/finance/domain/mod.rs` (alterar): `pub mod adjustment;`, com `#[cfg_attr(not(test), allow(dead_code))]` e `TODO(SPEC-004 TASK-04)` (ver Pontos de atenção).

## Decisões

- **Como estimar o bruto em inteiros (RN-06, RN-07).** Escolhida a fórmula fechada: como cada item é linear no bruto (o percentual no bruto é `rate_bp × x`, o da base digitada é `rate_bp × base × x ÷ G`, porque a base acompanha o bruto), o líquido é `x × k − F`, e `x = (N + F) × G × 10000 ÷ (G × 10000 + Σ s × rate_bp × G + Σ s × rate_bp × base)`, arredondado meio para cima em `i128`. Critérios: resultado determinístico e idêntico na tela (`BigInt`), sem ponto flutuante (RNF-01) e com no máximo um ajuste de centavos no fim. Alternativas descartadas: (a) busca binária ou iteração do bruto até o líquido bater, que pode oscilar entre dois brutos por causa do arredondamento de cada item e exige um teto de iterações; (b) calcular em `f64` e arredondar, que a regra [project/code-style-05] proíbe e que diverge da tela em valores grandes; (c) escalar a base depois de estimar o bruto sem a base no denominador, que erra o líquido em dezenas de reais quando a base é grande (R$ 67,20 no CT-05).
- **Centavo residual no último percentual da lista (RN-07, CB-05).** Depois de recalcular os itens com o bruto estimado, a diferença para o líquido informado vai para o último item `Percent`: no desconto, `computed_amount -= r`; no acréscimo, `+= r`. O bruto fica o estimado e a identidade RN-04 vale. Alternativa descartada: mudar o bruto em um centavo, que nem sempre fecha (com vários percentuais, o líquido salta mais de um centavo por centavo de bruto) e esconderia o ajuste. Consequência registrada: com resíduo, a ordem da lista muda qual item recebe o centavo (`ct07_residual_follows_list_order`), a exceção da RN-07 à RN-01; o bruto e o líquido não mudam.
- **Base proporcional arredondada (RN-06, decisão 16).** `base nova = round_half_up(base × bruto novo ÷ bruto previsto)`. Base nova zero (bruto muito pequeno) é recusada com `no_gross_for_net`, porque a base digitada precisa ser maior que zero (decisão 17). Alternativa descartada: manter a base fixa até o usuário editar, descartada pela decisão 16.
- **Sem bruto possível (CB-01).** Denominador `<= 0` (os percentuais de desconto somam 100% ou mais), numerador negativo (acréscimos fixos maiores que o líquido), base nova zero ou item negativo depois do centavo: `FinanceError::invalid("adjustments", "no_gross_for_net")`. Líquido zero é aceito (como `settled_amount >= 0` de hoje) e o bruto pode sair zero quando só há percentuais.
- **Erros com o formato atual.** `FinanceError::invalid(campo, código)` com campos `&'static str`: `adjustments` (`too_many`, `net_not_positive`, `no_gross_for_net`, `too_large`), `adjustments.name` (`required`, `too_long`, via `required_name`), `adjustments.amount` (`must_be_positive`), `adjustments.rate_bp` (`out_of_range`), `adjustments.base_amount` (`must_be_positive`), `adjustments.mode` (`fields_mismatch`), `gross_amount` (`must_be_positive`), `expected_gross_amount` (`must_be_positive`) e `settled_amount` (`must_not_be_negative`). Alternativa descartada: campo com o índice do item (`adjustments[3].rate_bp`), que exigiria mudar `FieldIssue` para `String` e todos os usos; a tela sabe qual item está editando.
- **`compute_net` recusa líquido `<= 0` e `gross_for_net` não.** O previsto precisa ser positivo (RN-05, CB-03); o liquidado pode ser zero (CB-01).
- **Estouro.** Somas e produtos em `i128` com `checked_*`; resultado fora de `i64` vira `too_large`, sem `panic!` ([project/code-style-03]).

## Tabela de casos comum (RNF-02)

A mesma da TASK-03 (centavos; `rate_bp` 1100 = 11,00%). Gravada também em `/tmp/claude-1000/-home-victor-projetos-ishtar-sink-atria/e83331c8-146c-4bcc-b5a0-5c49ad795808/scratchpad/cases-004.md` para o detalhamento da TASK-03.

| id | função | entrada | resultado |
|---|---|---|---|
| ct01 | `compute_net` | bruto 800000; INSS desconto 1100 no bruto; Sindical desconto fixo 4000 | `[88000, 4000]`, líquido 708000 |
| ct02 | `compute_net` | bruto 800000; INSS 1100; IRPF desconto 1500 base 712000 (e na ordem inversa) | `[88000, 106800]`, líquido 605200 nas duas ordens |
| ct03 | `compute_net` | bruto 20000; desconto 1000; Taxa acréscimo fixo 500 | `[2000, 500]`, líquido 18500 |
| round | `compute_net` | bruto 33333; desconto 1250 | `[4167]`, líquido 29166 |
| none | `compute_net` | bruto 50000; sem itens | líquido 50000 |
| ct05 | `gross_for_net` | líquido 650000; itens do ct02; bruto previsto 800000 | bruto 859220; `[94514, 114706]`; base do IRPF 764706 |
| fixos | `gross_for_net` | líquido 100000; Sindical fixo 4000; bruto previsto 104000 | bruto 104000; `[4000]` |
| ct07 | `gross_for_net` | líquido 650000; INSS 1100; IRPF 2250 base 712000; bruto previsto 800000 | bruto 942370; `[103661, 188709]` (o IRPF seria 188710); base 838709 |
| ct07 ordem | `gross_for_net` | líquido 10000; A desconto 1250 e B desconto 3333 no bruto; bruto previsto 20000 | bruto 18460; A,B `[2308, 6152]`; B,A `[6153, 2307]` |
| cb01 | `gross_for_net` | líquido 0; INSS 1100; Sindical fixo 4000; bruto previsto 800000 | bruto 4494; `[494, 4000]` |
| sem bruto | `gross_for_net` | líquido 100 com descontos 6000 e 5000 (bruto previsto 10000); líquido 1000 com acréscimo fixo 5000 (bruto previsto 1) | `adjustments`/`no_gross_for_net` |

## Riscos

- Divergência de centavo com a tela (risco médio da spec): mitigada pela tabela idêntica nos dois testes e pela fórmula fechada sem ponto flutuante dos dois lados.
- O cálculo reverso não fechar com vários percentuais e bases digitadas (risco alto da spec): os casos ct05, ct07 e ct07 ordem cobrem base digitada, dois percentuais e o resíduo nos dois sentidos da lista.
- O estudo (TASK-01) mudar a regra ou os nomes: o passo 1 manda parar e ajustar a tarefa.

## Referências da spec

RF-03, RF-04, RF-05, RF-06, RF-07, RF-09; RNF-01, RNF-02; RN-01 a RN-07; CT-01, CT-02, CT-05, CT-07, CT-13; CB-01 a CB-05, CB-08, CB-09; decisões 11, 12, 15, 16 e 17.

## Arquivos em comum com a onda

Nenhum: a TASK-03, da mesma onda, só muda arquivos da tela (`apps/web/src/features/finance/lib/`). As duas dividem a tabela de casos, que precisa ficar igual.

## O que foi feito

- Arquivos: `apps/server/src/finance/domain/adjustment.rs` (criado, com os tipos, a validação, o cálculo do líquido, o reverso e os 17 testes); `apps/server/src/finance/domain/mod.rs` (registro de `pub mod adjustment;` com o atributo temporário).
- Testes: os 17 testes foram escritos antes do código e falharam com `not yet implemented`; agora passam. Os 66 testes de `finance::domain::` passam.
- Resultado: clippy e fmt ok. O código não usa ponto flutuante.

## Pontos de atenção

- O crate é binário e nenhum código usa o módulo ainda. Por isso `pub mod adjustment;` tem `#[cfg_attr(not(test), allow(dead_code))]` com `TODO(SPEC-004 TASK-04)`.
- A TASK-04 precisa tirar esse atributo ao passar a usar o módulo. Ela não lista `apps/server/src/finance/domain/mod.rs` em Mudar, então tirar o atributo exige ajuste da TASK-04 (skill adjust-task) para incluir o arquivo.
- A tabela de casos está repetida na TASK-03 (tela). Qualquer mudança na regra precisa mudar as duas tabelas juntas.
