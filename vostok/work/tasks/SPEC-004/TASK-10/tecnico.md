<!-- Escrito no planejamento com o que a tarefa vai fazer e enriquecido na conclusão com o que foi feito. -->

## Abordagem

- Dois testes novos em `finance.e2e.ts`, com os utilitários do arquivo (`createAccount`, `choose`, `expectBalance`, `checkPage`) e três novos (`addAdjustment`, `expectedNet` e `settleNow`):
  - `ct05 …` entra com uma pessoa só dele (`signIn`), porque confere o Fechamento e o cartão do painel, que somam tudo da pessoa (como `transfer does not count in totals`). Os números são os casos ct02 e ct05 da tabela comum: líquido previsto R$ 6.052,00 e, para o líquido de R$ 6.500,00, o bruto R$ 8.592,20, a base do IRPF R$ 7.647,06, o INSS R$ 945,14 e o IRPF R$ 1.147,06.
  - `fa02 …` cobre o FA-02 da spec (saída de R$ 200,00 com desconto de 10% e taxa de R$ 5,00, líquido R$ 185,00 no saldo).
- Os testes rodam nos projetos `desktop-session` e `w360-session` contra a pilha do `docker-compose.e2e.yml`, com o build `e2e` servido pelo próprio Playwright. Cada tela passa pelo `checkPage` (axe e rolagem horizontal) (RNF-04, RNF-05).
- O vídeo `finance-descontos.webm` reaproveita, no script de evidências, o mundo, as respostas simuladas e as constantes das TASK-07 a TASK-09.

## Decisões

- O e2e confere os valores sem o "R$" (`toContainText('8.592,20')`) ou com regex `\s`, porque o `Intl` escreve um espaço sem quebra depois do símbolo. Descartado: o texto exato com "R$ ", que falharia pelo espaço.
- O teste do FA-02 leva o prefixo `fa02` para não confundir com o `ct03 undoing a settled copy reopens the occurrence`, que já existe no arquivo.
- A pilha é a do usuário quando já está de pé, e a tarefa só derruba o que subiu (KNW-006). Descartado: subir e derrubar sempre, que mataria uma pilha aberta pelo usuário.

## Riscos

- `docker compose up --build` compila o servidor: só rode sem outra compilação pesada em andamento (KNW-007).
- O `reuseExistingServer` do Playwright reaproveitaria uma prévia antiga na porta 4173; o passo 2 confere que a porta está livre.
- A evidência `descontos-e2e.txt` leva `Tempo-limite: 900`, porque o comando gera o build `e2e` e roda o arquivo inteiro em duas larguras, o que passa do limite padrão do baseline.

## Referências da spec

RF-08, RF-09, CT-03, CT-05, FA-02, RNF-04 e RNF-05.

## Arquivos em comum

A TASK-10 é a única da onda 7. `apps/web/scripts/evidence-finance.mjs` já foi alterado pelas TASK-07, TASK-08 e TASK-09, que vêm antes.
