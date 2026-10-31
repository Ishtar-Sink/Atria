# Metodologia de desenvolvimento

Define como o trabalho é conduzido, versionado e integrado no Atria.

[project/development-methodology-01]: TDD: o teste que falha é escrito antes do código que o faz passar, em toda regra de negócio, endpoint e correção de bug.
[project/development-methodology-02]: Mudança de esquema do banco só por migração versionada; uma migração já aplicada nunca é editada.
[project/development-methodology-03]: Mudança no contrato da API atualiza o OpenAPI na mesma tarefa.
[project/development-methodology-04]: Uma decisão que vale para o ecossistema inteiro é levada para `Ishtar-Sink/.github`, não fica só no Atria.
[project/development-methodology-05]: Commits no padrão Conventional Commits (`feat:`, `fix:`, ...), com a descrição em `pt-br`.
[project/development-methodology-06]: A CI roda lint, typecheck, testes e auditoria de dependências; uma falha em qualquer um impede a integração.
