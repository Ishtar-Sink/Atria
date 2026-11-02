<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## O que a tarefa entregou

O componente `MoneyAmount` e a função `signedMoney` aplicam o sinal e a cor de cada valor pelo tipo (entrada, saída ou saldo). A tarefa cobre RF-11, RF-12, RN-06, RN-07, CT-08 e CB-07.

## Como foi feito

- `money-amount.tsx` (novo): `signedMoney(amount, currency, kind, locale)` formata o valor absoluto com `formatMoney` e devolve `{ text, tone }`.
  - `income`: `+` e `positive`.
  - `expense`: `−` (U+2212) e nenhum tom.
  - `balance`: `positive` quando positivo, `−` e `negative` quando negativo, e nenhum tom quando zero.
  - `MoneyAmount` monta o `span` com `.amount`, o tom e `data-kind`.
- `transaction-row.tsx`: o valor da linha passou a usar o `MoneyAmount` com `item.kind`, mantendo a classe `rowEnd`. O `formatMoney` saiu do import.
- `finance-panel-screen.tsx`, com o `MoneyAmount` em:
  - Fechamento: o `fig` ganhou o parâmetro `kind`, e a Sobra prevista usa `balance`.
  - Saldo atual e saldo de cada conta.
  - Próximas movimentações.
  - Economias e perdas não mudaram (PD-54).
- `finance.module.css`: `.amount` (`tabular-nums`, `nowrap`), `.positive` (`--success`) e `.negative` (`--warning`).
- Testes:
  - Saiu `formats values without plus or minus sign`.
  - Entraram `rf11`, `rn06`, `rf12`, `cb07`, `rn07`, `rnf03` e `rnf02` no componente, `rf12` e `cb07` no painel e `ct08` nas listas.
  - O Fechamento passou a esperar `+`/`−`.
  - Pelo ajuste 1, `shows the value above the status, recurring and difference badges` espera `−R$ 180,00`, e `shows a negative surplus in warning tone, never danger` confere a classe `negative` no valor de saldo.
- `evidence-finance.mjs`: o modo `sinais` tem 4 cenários nos 4 temas e larguras, com o mundo `signedWorld`: sobra negativa, uma conta negativa e uma zerada.

## Decisões

- O sinal vem do tipo, nunca do número guardado (RN-06). O valor é sempre formatado em absoluto, e o hífen do `Intl` não é usado.
- A saída fica na cor do texto e só o saldo negativo usa âmbar (RN-07, PD-54). Na conferência, o usuário considerou saídas em vermelho, ou em laranja com o vermelho para saldos negativos, e manteve as cores aprovadas. Mudar isso exige uma spec nova, que atualize RN-07 e PD-54.

## Verificação

- A Verificação passou, com 78 testes nos três arquivos e o Financeiro inteiro. Tipos, ESLint e Prettier passaram sem warning, e não há cor literal no CSS.
- A regressão não bloqueou. Houve o acréscimo dos 10 testes novos e a saída esperada do teste antigo.
- A prancha `finance-sinais.png` deu 0 falha e foi conferida pelo usuário.

## Pontos de atenção

- O sinal é o U+2212 (−), não o hífen. Os testes e buscas de texto precisam usar esse caractere.
- O `MoneyAmount` concentra a regra de sinal e cor, então uma mudança futura de cores muda só `signedMoney` e as classes `.positive` e `.negative`.
- `finance-panel-screen.module.css` ainda tem `.positive` e `.negative` próprias, usadas por Economias e perdas.
