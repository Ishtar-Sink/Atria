# TASK-05: Cor da categoria em HEX no servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 5
- **Dependências:** TASK-04

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cor da categoria em HEX no servidor
- **Tipo:** tarefa
- **Descrição:** A categoria guarda `#rrggbb`, com a migração das cores por nome.
- **Critérios de aceite:**
  - [x] A pessoa cria e edita uma categoria com uma cor HEX livre, e a cor gravada aparece no detalhe e no "Para onde foi" do resumo (RF-18, CT-12).
  - [x] A cor é sempre guardada como `#rrggbb` em minúsculas, e um nome de tom ou um HEX malformado é recusado com 422 no campo `color` (RF-18, RN-09).
  - [x] As categorias padrão de uma pessoa nova nascem com o HEX do tema claro equivalente ao tom que tinham (RF-18, RF-20).
  - [x] A migração converte cada cor por nome das categorias existentes, inclusive das excluídas, no HEX do tema claro, sem perder nenhuma linha, e o banco passa a aceitar só `#rrggbb`; as migrações antigas não foram editadas (RF-20, CT-14, RNF-01).
  - [x] A exportação de dados traz a cor da categoria em HEX, e o servidor compila sem banco, sem aviso de formatação ou do clippy, com os testes do Financeiro, dos relatórios e do `http` passando (RF-18, RF-20).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04
