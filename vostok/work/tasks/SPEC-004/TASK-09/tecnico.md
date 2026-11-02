<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- Nova fn `Adjustments` em `finance-panel-screen.tsx`, um `DataCard` "Descontos do período" no fim da zona lateral, pareado com o "Previsto x realizado" na linha 4 (o painel passa a ter 8 blocos, 4 em cada zona). Os dados vêm de `summary.adjustments_by_name` (TASK-06): a tela não soma nem agrupa (RN-11, CB-07, CT-12), como o resto do painel (RF-35 da SPEC-001).
- Dois grupos, "Descontos" e "Acréscimos", cada um com `h3` e uma lista ligada a ele por `aria-labelledby` (RNF-04). Cada linha mostra o liquidado com o sinal e, abaixo, "de R$ … previstos", como o Fechamento.
- O valor usa `adjustmentText` da TASK-07, a mesma escrita do detalhamento: "−" no desconto e "+" no acréscimo, na cor do texto.
- Sem linhas, o cartão mostra o texto explicativo ([project/frontend-12]); no erro, entra o bloco `failed` com a própria tentativa.

## Decisões

- Valores na cor do texto, com o sinal em texto e sem vermelho, seguindo as regras de cor aprovadas na SPEC-003 ([project/frontend-14]). Descartado: o `MoneyAmount` com `kind="income"` nos acréscimos, que pintaria de verde um juro pago numa saída (o resumo junta nomes de entradas e saídas); o verde fica para entrada e saldo positivo.
- O cartão fica na zona lateral, depois de "Economias e perdas". Descartado: na zona principal, que deixaria "Previsto x realizado" sozinho e tiraria o cartão da leitura junto dos outros totais.
- O cartão aparece sempre, com o estado vazio. Descartado: escondê-lo sem itens, que mudaria o pareamento das linhas conforme o período.

## Riscos

- O significado de `expected` e `settled` vem da TASK-06; o passo 1 confere e para se divergir.
- O pareamento do painel muda de 7 para 8 blocos: os testes de pareamento e o modo `painel` do script de evidências são rodados de novo (passo 8).

## Referências da spec

RF-14, RN-11, CB-07, CT-12, RNF-04, RNF-05; decisão 14.

## Arquivos em comum

Na onda 6, esta tarefa e a TASK-08 dividem `apps/web/src/features/finance/i18n/pt-br.json` e `apps/web/scripts/evidence-finance.mjs`: o Coordenador as executa em sequência, nunca ao mesmo tempo.
