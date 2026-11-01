<!-- Escrito na finalização da tarefa. -->

## O que foi feito

Regeneração do contrato do servidor e dos tipos TypeScript do pacote de contratos, refletindo as mudanças das TASK-01 a TASK-06 (RF-07, RF-17, RF-18 e RF-19). Nenhum código de servidor ou de app foi alterado nesta tarefa.

## Arquivos alterados

- `packages/contracts/openapi.json`: gerado de novo a partir do servidor com `cargo run -q -p atria-server -- openapi`. Diff de 118 inserções e 459 remoções. Traz a remoção das rotas e schemas de cartão e faturas, o `DELETE` da recorrência, o `DELETE` da conta com `move_to`, a série `monthly` em `FinancialSummaryResponse` e as cores como `string` em HEX (categorias e destaques).
- `packages/contracts/src/schema.ts`: regenerado com `pnpm --filter @atria/contracts generate` (`openapi-typescript openapi.json -o src/schema.ts`). Diff de 98 inserções e 208 remoções.
- Nenhum outro arquivo do pacote `packages/contracts` mudou: `git status --porcelain -- packages/contracts` lista somente esses dois.

## Como foi feito

Os dois arquivos foram gerados, não editados à mão ([project/api-02]). Antes da geração, conferiu-se que TASK-01 a TASK-06 estavam `done`; caso contrário a tarefa pararia com o bloqueio registrado. Nenhuma outra compilação do `atria-server` rodou em paralelo (KNW-007).

## Decisões

- Contrato sempre gerado a partir do servidor, e não mantido à mão, para evitar divergência entre o que o servidor expõe e o que o frontend tipa.
- Geração feita só depois das seis tarefas de servidor, para que o contrato reflita o estado final.
- `apps/web` não foi tocado. As correções dos usos de campos e rotas removidos ficam para as tarefas de tela (TASK-10, TASK-13 e TASK-14); por isso nem a Verificação nem o Baseline rodam o typecheck do app web.

## Pontos de atenção

- Typecheck do app web: `pnpm --filter @atria/web typecheck` passa a acusar os usos de campos e rotas removidos (cartão, faturas, parcelas, `credit_cards` e cores por nome). Esses erros são esperados até as tarefas de tela (TASK-10, TASK-13 e TASK-14) e não devem ser corrigidos nesta tarefa.
- Para conferir se o contrato está em dia, `cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json` deve terminar sem saída. O comando `openapi` não exige configuração.
- Em `packages/contracts`, `pnpm --filter @atria/contracts check` deve terminar sem saída após a geração dos tipos.

## Verificação

- Baseline coletado com 2 comandos, ambos com código de saída 0.
- Testes: passaram, sem falhas. Saída gravada em `validation/tests.out`.
- Regressão: os 2 comandos são iguais ao baseline e passaram.
- Evidências: 2 gravadas em `TASK-07/evidencias/`, incluindo `contract-sync.txt`, gerada automaticamente.
