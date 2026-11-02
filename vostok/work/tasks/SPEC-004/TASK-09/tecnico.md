<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- Nova fn `Adjustments` em `finance-panel-screen.tsx`, um `DataCard` "Descontos do período" no fim da zona lateral, pareado com o "Previsto x realizado" na linha 4. O painel passou a ter 8 blocos, 4 em cada zona, todos pareados. Os dados vêm de `summary.adjustments_by_name` (TASK-06): a tela não soma nem agrupa (RN-11, CB-07, CT-12), como o resto do painel (RF-35 da SPEC-001).
- Dois grupos, "Descontos" e "Acréscimos", cada um com `h3` e uma lista ligada a ele por `aria-labelledby` (RNF-04). Os ids vêm de `useId`. Cada linha mostra o liquidado com o sinal e, abaixo, "de R$ … previstos", como o Fechamento.
- O valor usa `adjustmentText` da TASK-07, a mesma escrita do detalhamento: "−" no desconto e "+" no acréscimo, na cor do texto.
- Sem linhas, o cartão mostra o texto explicativo ([project/frontend-12]); no erro, entra o bloco `failed` com a própria tentativa.

## Decisões

- Valores na cor do texto, com o sinal em texto e sem vermelho, seguindo as regras de cor aprovadas na SPEC-003 ([project/frontend-14]). Descartado: o `MoneyAmount` com `kind="income"` nos acréscimos, que pintaria de verde um juro pago numa saída (o resumo junta nomes de entradas e saídas); o verde fica para entrada e saldo positivo.
- O cartão fica na zona lateral, depois de "Economias e perdas". Descartado: na zona principal, que deixaria "Previsto x realizado" sozinho e tiraria o cartão da leitura junto dos outros totais.
- O cartão aparece sempre, com o estado vazio. Descartado: escondê-lo sem itens, que mudaria o pareamento das linhas conforme o período.

## Riscos

- O significado de `expected` e `settled` vem da TASK-06 (`expected` é o total previsto do período; `settled`, o já liquidado no período). O passo 1 confere e para se divergir; a execução seguiu até o fim sem essa parada.
- O pareamento do painel mudou de 7 para 8 blocos. Os testes de pareamento e o modo `painel` do script de evidências foram rodados de novo, e o modo `painel` segue com 0 falhas.

## Arquivos alterados

- `apps/web/src/features/finance/screens/finance-panel-screen.tsx`: fn `Adjustments` (cartão "Descontos do período" com os grupos, o estado vazio e o bloco de erro), entrada `adjustments` no fim das listas `side` e da lateral do estado de erro. `isEmpty` não mudou., 1 deletion(-))
- `apps/web/src/features/finance/screens/finance-panel-screen.module.css`: classe `.groupTitle`, só com tokens.
- `apps/web/src/features/finance/i18n/pt-br.json`: quatro textos `panel.adjustments.*` (título, "Descontos", "Acréscimos" e o texto vazio), sem mudar as chaves existentes.)
- `apps/web/src/features/finance/screens/finance-panel-screen.test.tsx`: `adjustments_by_name` na fixture `summary` (o tipo `FinancialSummary` passou a exigi-lo); testes de pareamento, ordem em coluna única e estados de erro ajustados para 8 blocos; novos testes rf14, ct12, cartão vazio, rn07 e rnf04.)
- `apps/web/scripts/evidence-finance.mjs`: `adjustments_by_name: []` no resumo simulado dos modos de hoje; constante `PANEL_ADJUSTMENTS` e fn `panelAdjustmentsWorld()`; grupo `descontos-painel` com dois cenários e a prancha `finance-descontos-painel.png`.)

## Verificação

- Testes: os 209 testes do Financeiro passam. Os novos (rf14, ct12, cartão vazio, rn07, rnf04) e os quatro ajustados (pareamento, coluna única, estados vazio, carregando e erro) foram confirmados.
- Typecheck do app inteiro passa, sem `any` nem `@ts-ignore`. ESLint e Prettier sem erro.
- Evidência: o modo `descontos-painel` gerou a prancha `finance-descontos-painel.png` com 6 capturas e 0 falhas, conferida pelo usuário. O modo `painel` segue com 0 falhas.
- Regressão: 3 comandos iguais ao baseline e 1 mudança esperada (a checagem de tipos, que terminava com código 2 pela fixture do painel e agora termina com 0). 1 diferença aceita pelo usuário: falso alarme do filtro de palavra "error" no nome do teste cb01 da TASK-08, que passa.

## Pontos de atenção

- O teste "shows closing with realized…", o primeiro do arquivo de testes do painel, carrega o painel a frio e roda o axe na página inteira, que ficou maior. Ele passou a estourar às vezes o limite padrão de 5 s do Vitest. Por decisão do usuário, ganhou limite próprio de 15 s, sem mudar o que confere. Se voltar a falhar por tempo, é o primeiro suspeito.
- O filtro de regressão alerta por palavras no nome do teste: "error" no nome de um teste que passa gera falso alarme (caso do cb01 da TASK-08, aceito).
- Com 8 blocos, todo cartão novo do painel precisa manter o pareamento em 4 e 4; senão os testes de pareamento falham.
- Qualquer fixture de `FinancialSummary` precisa do campo `adjustments_by_name`, mesmo que vazio.
- Acréscimos não usam `MoneyAmount` com `kind="income"` (ver Decisões).

## Referências da spec

RF-14, RN-11, CB-07, CT-12, RNF-04, RNF-05; decisão 14.

## Arquivos em comum

Na onda 6, esta tarefa e a TASK-08 dividem `apps/web/src/features/finance/i18n/pt-br.json` e `apps/web/scripts/evidence-finance.mjs`: o Coordenador as executa em sequência, nunca ao mesmo tempo.
