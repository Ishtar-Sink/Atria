# TASK-07: Contrato gerado da API

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 7
- **Dependências:** TASK-06

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Contrato gerado da API
- **Tipo:** tarefa
- **Descrição:** O OpenAPI e os tipos TypeScript refletem as mudanças das TASK-01 a TASK-06.
- **Critérios de aceite:**
  - [ ] O `openapi.json` do pacote de contratos é igual ao que o servidor gera e não tem mais o cartão: sem as rotas de faturas, sem `AccountKindDto` e sem `credit_cards` no resumo (RF-07).
  - [ ] O contrato traz o `DELETE` da recorrência, o `DELETE` da conta com `move_to` e a série `monthly` do resumo (RF-07, RF-17).
  - [ ] A cor das categorias, do "Para onde foi" e dos destaques aparece no contrato como texto, sem os enums de cor por nome (RF-18, RF-19).
  - [ ] O `schema.ts` é o gerado do `openapi.json` novo, sem edição à mão, os tipos do pacote compilam e só os dois arquivos mudaram no pacote, sem mexer no app web ([project/api-02]).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-06
