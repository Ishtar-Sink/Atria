### Ler

- `vostok/work/specs/refined/SPEC-003-financeiro-pronto-para-o-lancamento.md`: "Contratos e interfaces" (mudanças na API refletidas em `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`: rotas removidas e novas, schemas removidos, cores em `string` e `FinancialSummaryResponse.monthly`), RF-07, RF-17, RF-18 e RF-19.
- `vostok/rules/project/api.md`: [project/api-02] (o frontend não escreve tipos da API à mão).
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-03].
- `vostok/memory/knowledge.md` (KNW-007): uma compilação pesada do servidor por vez.
- `vostok/work/tasks/SPEC-003/TASK-01/execucao.md`, `TASK-02/execucao.md`, `TASK-03/execucao.md`, `TASK-04/execucao.md`, `TASK-05/execucao.md` e `TASK-06/execucao.md` (seção "Mudar"): o que cada tarefa de servidor mudou no contrato (fim do cartão e das faturas, `DELETE` da recorrência, `DELETE` da conta com `move_to`, série `monthly` e cores HEX das categorias e dos destaques).
- `packages/contracts/package.json`: scripts `generate`, `check` e `typecheck`.
- `packages/contracts/src/index.ts`: reexporta `paths`, `components` e `operations` de `schema.ts` e o tipo `Schemas` (não muda).
- `apps/server/src/main.rs` (comando `openapi`, linha 58): imprime o OpenAPI juntado sem precisar de configuração.
- `vostok/work/.archive/SPEC-002/tasks/TASK-15.md` (Passos, Verificação e Evidências): o mesmo fluxo de geração e conferência do contrato.

### Mudar

- `packages/contracts/openapi.json` (alterar): gerado de novo do servidor, com as mudanças das TASK-01 a TASK-06 (RF-07, RF-17, RF-18, RF-19).
- `packages/contracts/src/schema.ts` (alterar): tipos TypeScript gerados do `openapi.json` novo ([project/api-02]).

### Passos

1. Leia os arquivos de "Ler". Confira em `vostok task status SPEC-003` que a TASK-01, a TASK-02, a TASK-03, a TASK-04, a TASK-05 e a TASK-06 estão `done`; se alguma não estiver, **PARE** e registre o bloqueio com o ID. Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. `packages/contracts/openapi.json` (alterar): gere o contrato do servidor com `cargo run -q -p atria-server -- openapi > packages/contracts/openapi.json`. Não edite o arquivo à mão. Confira: `cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json` termina sem saída.
3. `packages/contracts/src/schema.ts` (alterar): gere os tipos com `pnpm --filter @atria/contracts generate` (que roda `openapi-typescript openapi.json -o src/schema.ts`). Não edite `schema.ts` à mão. Confira: `pnpm --filter @atria/contracts check` termina sem saída.
4. Confira que nada mais mudou no pacote: `git status --porcelain -- packages/contracts` lista só `openapi.json` e `src/schema.ts`.
5. Não mude nenhum arquivo de `apps/web`. Com o contrato novo, `pnpm --filter @atria/web typecheck` passa a acusar os usos dos campos e rotas removidos (cartão, faturas, parcelas, `credit_cards` e as cores por nome); esses erros são esperados e são corrigidos pelas tarefas de tela (TASK-10, TASK-13 e TASK-14), por isso nem a Verificação nem o Baseline rodam o typecheck do app web. Não tente corrigi-los aqui.
6. Rode a Verificação inteira.
