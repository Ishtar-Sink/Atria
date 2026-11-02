<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

Estudo em texto, sem código, que fecha o desenho antes da implementação (RF-16, CT-15; premissa "o estudo termina antes de qualquer mudança de código"). Ele segue o formato de `docs/estudos/financeiro-painel.md` e cobre seis pontos: a prática contábil da folha de 2026 como exemplo (resposta 1A), o modelo de dados, o arredondamento, o cálculo reverso, o impacto no forecast e no resumo e a recomendação sobre o contrato da spec. As TASK-02 a TASK-10 foram detalhadas com o contrato proposto pela spec; o primeiro passo de cada uma é ler este estudo e parar para ajuste da tarefa (skill adjust-task) se ele divergir.

## Componentes afetados

- `docs/estudos/financeiro-descontos.md` (criar). Nenhum arquivo de código.

## Decisões

- **A folha é exemplo, não regra.** O estudo mostra o INSS por faixas, o IRRF sobre o bruto menos o INSS e o redutor da Lei 15.270/2025 só para explicar como o usuário chega à alíquota efetiva (decisão 1, resposta 1A, "Fora do escopo"). Alternativa descartada: recomendar as tabelas oficiais no sistema, que a spec deixou de fora e exigiria atualização anual.
- **Modelo de dados com critério explícito.** O estudo compara a tabela de itens com a coluna `JSONB` pelos critérios de integridade ([project/database-05]), custo de RLS, FK e índices ([project/database-01], [project/database-07], [project/database-09]), leitura do forecast e do resumo (que já carregam as movimentações em memória) e precedente (`rule JSONB` da recorrente). A hipótese de partida das tarefas é a coluna `JSONB` (`adjustments`, `settled_adjustments`) com `gross_amount` e `settled_gross_amount` em `BIGINT`; o estudo pode trocar, e a troca volta para a spec por ajuste.
- **Migração com `NO FORCE` temporário (mudou na execução).** O plano previa uma migração só com DDL. Sob `FORCE ROW LEVEL SECURITY`, um `UPDATE` sem `app.current_user_id` afeta zero linhas sem erro (comentário da `20261103010001_remove-credit-cards.sql`). Por isso o estudo precisa dizer como as linhas antigas ficam com bruto igual ao líquido (RNF-03, decisão 10) sem copiar valores: bruto nulo lido como `expected_amount`, ou outra forma que não dependa de `UPDATE`. O estudo recomenda o mesmo caminho da TASK-04 e da `20261103010002_categories-color-hex.sql`: `NO FORCE ROW LEVEL SECURITY` temporário, preenchimento das colunas novas (`gross_amount = expected_amount`, `settled_gross_amount = settled_amount`, listas vazias), volta a `FORCE` e `NOT NULL`. Nenhum valor existente muda. Alternativas descartadas:
  - o `UPDATE` sob `FORCE`, que afetaria zero linhas;
  - o bruto nulo lido como `expected_amount`, que espalharia um caso especial pelas leituras e impediria o `NOT NULL`.
- **Cálculo reverso linear em inteiros.** O bruto equivalente sai de uma fórmula fechada com numerador e denominador inteiros e arredondamento meio para cima, e o centavo residual vai para o último item percentual (RN-06, RN-07, decisões 11 e 16). Alternativa descartada: busca iterativa do bruto, que não garante parada nem resultado igual na tela e no servidor (RNF-02).

## Tabela de casos comum

A mesma das TASK-02 e TASK-03 (RNF-02), em centavos; o estudo usa estes números nos exemplos.

| id | entrada | resultado |
|---|---|---|
| ct01 | bruto 800000; INSS desconto 1100 bp no bruto; Sindical desconto fixo 4000 | INSS 88000; líquido 708000 |
| ct02 | bruto 800000; INSS 1100 bp; IRPF desconto 1500 bp com base 712000 | IRPF 106800; líquido 605200 nas duas ordens |
| ct03 | bruto 20000; desconto 1000 bp; acréscimo fixo 500 | líquido 18500 |
| round | bruto 33333; desconto 1250 bp | desconto 4167; líquido 29166 |
| none | bruto 50000; sem itens | líquido 50000 |
| ct05 | líquido 650000; itens do ct02; bruto previsto 800000 | bruto 859220; INSS 94514; base 764706; IRPF 114706 |
| fixos | líquido 100000; Sindical fixo 4000; bruto previsto 104000 | bruto 104000 |
| ct07 | líquido 650000; INSS 1100 bp; IRPF 2250 bp com base 712000; bruto previsto 800000 | bruto 942370; INSS 103661; base 838709; IRPF 188709 (absorveu 1 centavo) |
| cb01 | líquido 0; INSS 1100 bp; Sindical fixo 4000; bruto previsto 800000 | bruto 4494; INSS 494 |

## Riscos

- Fontes de terceiros com valores de 2026 diferentes entre si: o passo 2 pede duas fontes por valor, e os valores ficam marcados como exemplo.
- O estudo recomendar outro nome ou armazenamento depois que as tarefas foram detalhadas: a seção "O que muda no contrato da spec" lista cada ponto, e a mudança volta para a spec por ajuste antes da TASK-02.

## Referências da spec

RF-16, CT-15, CA-01; RNF-01 a RNF-03; RN-01 a RN-11; CB-01, CB-02, CB-05; decisões 1, 7, 10, 11, 13, 15, 16 e 17; DEC-003, DEC-004 e DEC-005.

## Arquivos em comum com a onda

Nenhum: a onda 1 tem só esta tarefa.

## O que foi feito

- Criado `docs/estudos/financeiro-descontos.md`, com doze seções, de "Pergunta" a "Fontes", e dez links.
- **Folha de 2026:** os valores foram conferidos em mais de uma fonte.
  - INSS pela Portaria Interministerial MPS/MF nº 13/2026, com teto de R$ 8.475,55.
  - IRRF pela tabela mensal sem mudança, com o simplificado de R$ 607,20.
  - O redutor da Lei 15.270/2025 é medido pelo bruto do mês, como nos exemplos da Receita Federal publicados pela COAD.
  - Uma tabela com R$ 4.500,00 (isento), R$ 6.000,00 (IR de R$ 385,10) e R$ 8.000,00 (IR de R$ 1.037,85, sem redutor). O exemplo de R$ 8.000,00 dá líquido de R$ 6.040,64.
  - A pessoa digita as alíquotas efetivas: 11,52% de INSS e 14,66% de IR sobre a base. O arredondamento de `rate_bp` se afasta do holerite em centavos, e o item fixo é o caminho para bater exato.
- **Modelo:** confirma a coluna `JSONB` na própria linha, com `computed_amount` gravado, e uma restrição nova ao lado de `transactions_settlement_coherent`, que não muda.
- **Cálculo:** os números do arredondamento e do cálculo reverso são idênticos à tabela de casos acima.
- **Contrato:** cinco pontos confirmam e dois mudam:
  - a prévia recebe `expected_gross_amount` e responde com `net_amount`;
  - a rota do resumo é `/api/v1/financial-summaries`.

  As tarefas já usam essa forma; a spec precisa de ajuste (skill `adjust-spec`) antes da TASK-02.

## Pontos de atenção

- Os valores da folha vêm de fontes de terceiros que citam a Receita Federal. A página oficial não foi aberta diretamente.
