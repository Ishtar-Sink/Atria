### Concluída quando

- [ ] O `openapi.json` do pacote de contratos é igual ao que o servidor gera e não tem mais o cartão: sem as rotas de faturas, sem `AccountKindDto` e sem `credit_cards` no resumo (RF-07).

  > Como comprovar: em `contract-sync.txt`, ver `openapi.json igual ao servidor`; em `contract-fields.txt`, ver `ok  sem /credit-cards`, `ok  sem AccountKindDto` e `ok  FinancialSummaryResponse sem credit_cards`.

- [ ] O contrato traz o `DELETE` da recorrência, o `DELETE` da conta com `move_to` e a série `monthly` do resumo (RF-07, RF-17).

  > Como comprovar: em `contract-fields.txt`, ver `ok  DELETE /recurring-transactions/{id}`, `ok  DELETE /accounts/{id} com move_to` e `ok  FinancialSummaryResponse.monthly`.

- [ ] A cor das categorias, do "Para onde foi" e dos destaques aparece no contrato como texto, sem os enums de cor por nome (RF-18, RF-19).

  > Como comprovar: em `contract-fields.txt`, ver as sete linhas `ok  ... .color string` e `ok  sem CategoryColorDto e HighlightColor`.

- [ ] O `schema.ts` é o gerado do `openapi.json` novo, sem edição à mão, os tipos do pacote compilam e só os dois arquivos mudaram no pacote, sem mexer no app web ([project/api-02]).

  > Como comprovar: em `contract-sync.txt`, ver `schema.ts igual ao gerado`; rodar `pnpm --filter @atria/contracts typecheck` e ver saída sem erro; rodar `git status --porcelain -- packages/contracts` e ver só `openapi.json` e `src/schema.ts`.
