# Estudo: descontos nas entradas e saídas do Financeiro

Este estudo é a primeira tarefa da SPEC-004 (RF-16). Ele fecha o modelo de dados, o arredondamento e o cálculo reverso dos descontos e acréscimos antes de qualquer código. As tarefas seguintes leem este arquivo no primeiro passo e param se a recomendação divergir do que elas descrevem.

## Pergunta

Como guardar e calcular descontos e acréscimos nominais, fixos ou percentuais, sobre o bruto ou sobre uma base digitada, de forma que o líquido seja exato em centavos e que a liquidação pelo líquido recalcule o bruto?

## Prática contábil da folha de 2026

A folha de 2026 serve aqui só para mostrar como a pessoa chega às alíquotas que digita. O Atria não calcula INSS nem IRRF por faixas (resposta 1A da spec).

**INSS do empregado, progressivo por faixa (Portaria Interministerial MPS/MF nº 13/2026).** Cada alíquota incide só sobre a parte do salário dentro da faixa. Acima do teto, a contribuição fica em R$ 988,09.

| Faixa do salário de contribuição | Alíquota |
|---|---|
| Até R$ 1.621,00 | 7,5% |
| De R$ 1.621,01 a R$ 2.902,84 | 9% |
| De R$ 2.902,85 a R$ 4.354,27 | 12% |
| De R$ 4.354,28 a R$ 8.475,55 (teto) | 14% |

**IRRF mensal: a tabela progressiva não mudou em 2026.** A base do IRRF é o bruto menos o INSS e menos R$ 189,59 por dependente. Quando o desconto simplificado mensal de R$ 607,20 for maior que essas deduções, ele as substitui.

| Base de cálculo mensal | Alíquota | Parcela a deduzir |
|---|---|---|
| Até R$ 2.428,80 | isento | — |
| De R$ 2.428,81 a R$ 2.826,65 | 7,5% | R$ 182,16 |
| De R$ 2.826,66 a R$ 3.751,05 | 15% | R$ 394,16 |
| De R$ 3.751,06 a R$ 4.664,68 | 22,5% | R$ 675,49 |
| Acima de R$ 4.664,68 | 27,5% | R$ 908,73 |

**O redutor da Lei 15.270/2025, em vigor desde janeiro de 2026, entra depois da tabela.** Na prática, quem ganha até R$ 5.000,00 por mês fica isento, e quem ganha até R$ 7.350,00 paga menos. A faixa do redutor é medida pelo rendimento tributável bruto do mês, não pela base de cálculo, como nos exemplos da Receita Federal.
- Até R$ 5.000,00, a redução vai até R$ 312,89 e zera o imposto.
- Entre R$ 5.000,01 e R$ 7.350,00, a redução é de R$ 978,62 − 0,133145 × o rendimento tributável. Ela cai até chegar a zero no limite de transição.
- Acima de R$ 7.350,00, não há redução.
- A redução nunca passa do imposto apurado.

| Bruto mensal | INSS | Base do IRRF | IRRF pela tabela | Redutor | IRRF devido | Alíquota efetiva da base |
|---|---|---|---|---|---|---|
| R$ 4.500,00 | R$ 431,51 | R$ 3.892,80 (simplificado) | R$ 200,39 | R$ 200,39 | R$ 0,00 | 0% (isento) |
| R$ 6.000,00 | R$ 641,51 | R$ 5.358,49 | R$ 564,85 | R$ 179,75 | R$ 385,10 | 7,19% (paga menos) |
| R$ 8.000,00 | R$ 921,51 | R$ 7.078,49 | R$ 1.037,85 | R$ 0,00 | R$ 1.037,85 | 14,66% (sem redutor) |

A alíquota efetiva cai muito abaixo da alíquota nominal da faixa (27,5%) por causa da parcela a deduzir e, até R$ 7.350,00, do redutor. É esse número efetivo que a pessoa digita no Atria.

**A contribuição sindical é facultativa desde 2017.** Quando autorizada, ela vem num valor fixo ou num percentual definido pela convenção coletiva, o que no Atria é um item fixo ou percentual.

**Exemplo: salário bruto de R$ 8.000,00, sem dependentes.**

| Passo | Cálculo | Valor | Alíquota efetiva |
|---|---|---|---|
| INSS por faixas | 121,58 + 115,37 + 174,17 + 510,40 | R$ 921,51 | 11,52% do bruto |
| Base do IRRF | 8.000,00 − 921,51 (maior que o simplificado de R$ 607,20) | R$ 7.078,49 | — |
| IRRF pela tabela | 7.078,49 × 27,5% − 908,73 | R$ 1.037,85 | 14,66% da base |
| Redutor | bruto de R$ 8.000,00, acima do limite de R$ 7.350,00 | R$ 0,00 | — |
| Líquido | 8.000,00 − 921,51 − 1.037,85 | R$ 6.040,64 | — |

No Atria, a pessoa digita:
- o INSS como desconto percentual de 11,52% sobre o bruto;
- o IRPF como desconto percentual de 14,66% com "Base diferente do bruto" marcada e a base de R$ 7.078,49.

Com duas casas no percentual, o resultado se afasta do holerite em centavos: R$ 921,60 de INSS e R$ 1.037,71 de IRPF. Para quem quer o centavo exato do holerite, o item fixo é o caminho; o percentual serve à projeção e ao ajuste automático na liquidação.

**Exemplo, não regra do sistema: o Atria não conhece as tabelas oficiais e usa as alíquotas que o usuário informa (resposta 1A).**

## Modelo de dados

| Opção | Como fica | A favor | Contra |
|---|---|---|---|
| Tabela de itens | `transaction_adjustments` e `recurring_transaction_adjustments`, uma linha por item, com `position` | Integridade por `CHECK` em cada coluna ([project/database-05]) | Exige `owner_id`, RLS com `FORCE`, FK e índices novos ([project/database-01], [project/database-07], [project/database-09]). Precisa de duas listas por movimentação, prevista e liquidada, e de uma consulta extra por página nas listagens, no resumo e nas recorrentes. |
| Coluna `JSONB` | `adjustments` e `settled_adjustments` em `transactions`; `adjustments` em `recurring_transactions` | Leitura numa linha só, mesmo padrão da `rule JSONB` da recorrente, com no máximo 20 itens | A validação de cada item fica no domínio. O banco confere só a forma, com `CHECK (jsonb_typeof(...) = 'array' AND jsonb_array_length(...) <= 20)`, escrito com `CASE` porque o PostgreSQL não garante a ordem do `AND`. |

**Recomendação: coluna `JSONB` na própria linha.** A lista é sempre lida e gravada inteira junto com a movimentação, tem até 20 itens e o banco nunca filtra por ela. O total por nome do resumo (RF-14) é somado no domínio, como os outros totais do painel. A tabela filha seria descartada porque traria RLS, índices e uma consulta extra para um dado que nunca é consultado sozinho.

Colunas novas, todas em `BIGINT` para os valores ([project/database-02]):
- em `transactions`: `gross_amount`, `adjustments JSONB NOT NULL DEFAULT '[]'`, `settled_gross_amount` e `settled_adjustments JSONB`;
- em `recurring_transactions`: `gross_amount` e `adjustments JSONB NOT NULL DEFAULT '[]'`.

Cada item gravado guarda o `computed_amount`. Assim a leitura não recalcula, e o resumo soma o que foi mostrado.

(a) `expected_amount` continua sendo o líquido previsto, o valor que afeta o saldo e as projeções (decisão 7), e `settled_amount` continua sendo o líquido liquidado. O bruto é uma informação a mais, não um novo valor de saldo.

(b) A restrição `transactions_settlement_coherent` não muda e continua com `difference_amount = settled_amount - expected_amount` (RN-08). A coerência nova vai numa restrição ao lado dela: `settled_amount`, `settled_gross_amount` e `settled_adjustments` ficam todos nulos ou todos preenchidos. Ficar ao lado evita reescrever uma restrição já testada.

(c) Sob `FORCE ROW LEVEL SECURITY`, um `UPDATE` sem `app.current_user_id` afeta zero linhas, sem erro: é a armadilha registrada em `20261103010001_remove-credit-cards.sql`. Este estudo recomenda o mesmo `NO FORCE` temporário da `20261103010002_categories-color-hex.sql`, que deixa o dono da tabela preencher as linhas de todas as pessoas:
- `gross_amount = expected_amount` e `adjustments = []` nas linhas antigas;
- `settled_gross_amount = settled_amount` e `settled_adjustments = []` nas que já foram liquidadas.

Depois do preenchimento, a migração volta a `FORCE` e aplica o `NOT NULL`.

Nenhum valor existente muda, porque a migração só preenche colunas novas (decisão 10, RNF-03). A alternativa só com DDL, lendo um `gross_amount` nulo como `expected_amount`, foi descartada: ela espalharia um caso especial por todas as leituras e impediria o `NOT NULL`.

## Arredondamento

**Unidades.** O dinheiro fica em centavos `i64`, e o percentual em `rate_bp`, um inteiro de 1 a 9999 em centésimos de ponto percentual: 1100 é 11,00% ([project/code-style-05], RNF-01).

**Valor de um percentual.** É o arredondamento meio para cima de `base × rate_bp ÷ 10000`, calculado em inteiros como `(2 × base × rate_bp + 10000) ÷ 20000`, sem ponto flutuante (RN-03). A base é o `base_amount`, quando a pessoa a digita, ou o bruto.

**Ordem e identidade.** Cada item é independente, e a ordem da lista serve só para apresentação (RN-01). O líquido obedece à identidade exata líquido = bruto − Σ descontos + Σ acréscimos (RN-04): o líquido sai da soma dos valores já arredondados, então nunca sobra centavo.

**Exemplo `round`.** Um bruto de 33.333 centavos com desconto de 12,50% dá 4.166,625, que vira 4.167. O líquido fica em 29.166 centavos.

**Na tela.** O cálculo repete a mesma conta com `BigInt`, porque o numerador do cálculo reverso passa de `Number.MAX_SAFE_INTEGER`. Os mesmos casos de teste rodam no servidor e na tela (RNF-02).

## Cálculo reverso

Na liquidação pelo líquido `N`, os itens fixos não mudam, e os percentuais são recalculados sobre o bruto novo. As variáveis são:
- `G`: o bruto previsto;
- `F`: os fixos de desconto menos os fixos de acréscimo;
- `s`: −1 no desconto e +1 no acréscimo.

O bruto equivalente vem de uma fórmula linear fechada, calculada em `i128`:

```text
num = (N + F) × G × 10000
den = G × 10000 + Σ s × rate_bp × G         (percentuais sobre o bruto)
                + Σ s × rate_bp × base_amount (percentuais com base digitada)
bruto = meio para cima de num ÷ den
```

**Base proporcional.** A base digitada acompanha o bruto na mesma proporção: base nova = meio para cima de `base_amount × bruto ÷ G` (RN-06, decisão 16).

**Recálculo e resíduo.** Com o bruto e as bases novas, os itens são recalculados. Se o arredondamento deixar um resíduo `r = N − líquido calculado`, o último item percentual da lista o absorve: o desconto diminui `r`, e o acréscimo aumenta `r` (RN-07). O bruto fica o estimado, e a identidade continua valendo.

**Sem bruto possível.** O cálculo devolve o erro `adjustments`/`no_gross_for_net` (CB-01) quando:
- `den ≤ 0`;
- o numerador é negativo;
- a base nova dá zero;
- algum item fica negativo depois do resíduo.

| Caso | Pedido | Bruto | Itens recalculados |
|---|---|---|---|
| ct05 | Líquido R$ 6.500,00 com INSS 11% no bruto e IRPF 15% na base de R$ 7.120,00 (bruto previsto R$ 8.000,00) | R$ 8.592,20 | INSS R$ 945,14; base do IRPF R$ 7.647,06; IRPF R$ 1.147,06 |
| Só fixos (CB-02) | Líquido R$ 1.000,00 com Sindical fixo de R$ 40,00 | R$ 1.040,00 | Sindical R$ 40,00 |
| ct07 | O ct05 com IRPF de 22,50% | R$ 9.423,70 | INSS R$ 1.036,61; base R$ 8.387,09; IRPF R$ 1.887,10, que absorve o centavo e fica R$ 1.887,09 |
| Líquido zero (CB-01) | Líquido R$ 0,00 com INSS 11% e Sindical R$ 40,00 | R$ 44,94 | INSS R$ 4,94; Sindical R$ 40,00 |

Com resíduo, a ordem da lista muda qual item recebe o centavo, mas o bruto e o líquido não mudam. Esta é a única exceção da RN-07 à RN-01, e um teste de domínio a cobre com a mesma lista em duas ordens.

## Impacto no forecast e no resumo

**Projeções.** As ocorrências virtuais (`VirtualOccurrence` em `forecast.rs`) passam a levar o bruto e os itens da regra, e `expected_amount` continua sendo o líquido. Por isso nenhuma destas fórmulas muda (RF-08):
- o saldo previsto;
- as próximas contas;
- o "Mês a mês";
- os nove relatórios.

**Resumo.** O resumo ganha o total por nome, agrupado sem diferenciar maiúsculas e acentos com a mesma normalização `finance_unaccent` da busca (RN-11). As liquidadas somam pelos itens da liquidação; as previstas e as projeções, pelos itens previstos.

**Desfazer a liquidação.** Descarta `settled_gross_amount` e `settled_adjustments` e volta ao previsto (RF-15, DEC-005). O bruto e os itens previstos nunca são sobrescritos, então não há cópia de segurança a restaurar.

**Recorrentes.** A cópia liquidada da recorrente grava os itens da liquidação, e a regra não muda (RF-11, RN-10, DEC-003).

## Recomendação

1. **Modelo:** colunas `JSONB` na própria linha, com `computed_amount` gravado em cada item.
2. **Colunas:** `gross_amount`, `adjustments`, `settled_gross_amount` e `settled_adjustments` em `transactions`, e `gross_amount` e `adjustments` em `recurring_transactions`, criadas numa única migração. As linhas existentes são preenchidas sob `NO FORCE` temporário.
3. **Arredondamento:** meio para cima em inteiros, item a item, com a identidade exata do líquido.
4. **Reverso:** fórmula fechada em `i128`, com a base proporcional e o centavo residual no último item percentual.
5. **Prévia:** o cálculo da liquidação fica no servidor, numa rota que só calcula e não grava (decisão 13). A tela usa a própria conta apenas para responder enquanto a pessoa digita.

## O que muda no contrato da spec

| Ponto do contrato | Proposta da spec | Recomendação do estudo |
|---|---|---|
| Nomes do item | `name`, `direction`, `mode`, `amount`, `rate_bp`, `base_amount`, `computed_amount` | confirma |
| `gross_amount` e `adjustments` nos pedidos | Nos pedidos de criação e edição das avulsas e das recorrentes | confirma. Na criação, vai `expected_amount` ou `gross_amount`, nunca os dois (422 `conflicts_with_gross_amount`). Itens sem `gross_amount` dão 422 `gross_amount`/`required`. |
| `expected_amount` só leitura quando há itens | Sem itens, o pedido aceita `expected_amount` como hoje | confirma. Na edição, `expected_amount` sozinho numa movimentação com itens dá 422 `has_adjustments`. |
| `settled_gross_amount` e `settled_adjustments` | Na resposta da liquidação | confirma |
| Prévia `POST /api/v1/transactions/settlement-preview` | Pedido `{ settled_amount, adjustments }`; resposta `{ gross_amount, adjustments }` | muda: o pedido também leva `expected_gross_amount`, sem o qual a base digitada não escala. A resposta ganha `net_amount`. |
| `adjustments_by_name` no resumo | Em `GET /api/v1/finance/summary` | muda: a rota real é `GET /api/v1/financial-summaries`. O campo confirma. |
| Armazenamento | Em aberto para o estudo | Colunas `JSONB` na própria linha, preenchidas sob `NO FORCE` temporário na migração |

A spec já estava planejada quando o estudo terminou; as tarefas seguem esta versão do contrato, e a diferença fica registrada aqui para a finalização.

## O que muda nas tarefas

| Tarefa | Mudança | Status |
|---|---|---|
| TASK-04 | A prévia recebe `expected_gross_amount` e responde com `net_amount`; colunas `JSONB`; a migração única cobre as duas tabelas sob `NO FORCE` temporário | já na tarefa |
| TASK-05 | Recebe as colunas da recorrente prontas da TASK-04, sem migração própria | já na tarefa |
| TASK-06 | `adjustments_by_name` em `/api/v1/financial-summaries` | já na tarefa |
| TASK-08 | A tela chama a prévia com `expected_gross_amount` | já na tarefa |

## Decisões em aberto

Nenhuma.

## Fontes

- [Senior: Portaria Interministerial MPS/MF nº 13, tabela do INSS 2026](https://documentacao.senior.com.br/exigenciaslegais/noticias/trabalhista-previdenciaria/2026/2026-01-12-trabalhista-portaria-interministerial-mps-mf-n-13-nova-tabela-de-contribuicao-do-inss-para-2026/)
- [Debit: tabela INSS 2026, teto e alíquotas](https://www.debit.com.br/blog/tabela-inss-2026-teto-aliquotas)
- [meutudo: tabela do INSS 2026 e contribuição progressiva](https://meutudo.com.br/blog/noticias/2026/01/13/tabela-do-inss-2026-entra-em-vigor-com-novas-faixas-e-contribuicao-progressiva/)
- [Contabilidade.com: IRRF 2026, nova tabela e redução até R$ 7.350](https://contabilidade.com/blog/irrf-2026-como-calcular-o-imposto-de-renda-retido-na-fonte-com-a-nova-tabela-e-reducao-ate-r-7-350/)
- [Senior: Imposto de Renda 2026 e o redutor da Lei 15.270/2025](https://documentacao.senior.com.br/exigenciaslegais/destaques/imposto-de-renda-2026)
- [Senior: Lei 15.270/2025, reforma do Imposto de Renda](https://documentacao.senior.com.br/exigenciaslegais/noticias/trabalhista-previdenciaria/2025/2025-11-27-trabalhista-lei-15-270-2025-reforma-do-imposto-de-renda-2026)
- [Alterdata: o novo cálculo do IRRF em 2026](https://ajuda.alterdata.com.br/dpbase/como-funciona-o-novo-calculo-do-irrf-em-2026-e-como-ficara-no-sistema-308710172.html)
- [COAD: Receita Federal orienta o cálculo da redução a partir de janeiro de 2026](https://coad.com.br/home/noticias-detalhe/135095/receita-federal-orienta-fontes-pagadoras-e-contribuintes-a-calcular-a-reducao-do-imposto-de-renda-a-partir-de-1-de-janeiro-de-2026)
- [Trivium Contábil: IRPF 2026, isenção até R$ 5 mil](https://triviumcontabil.com.br/blog/irpf-2026)
- [B3 Bora Investir: a nova tabela do Imposto de Renda em 2026](https://borainvestir.b3.com.br/noticias/imposto-de-renda/veja-a-nova-tabela-do-imposto-de-renda-em-2026-e-o-que-muda-nos-descontos-dos-salarios/)
