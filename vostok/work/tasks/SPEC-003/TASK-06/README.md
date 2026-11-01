# TASK-06: Cor do destaque em HEX no servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 6
- **Dependências:** TASK-05

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cor do destaque em HEX no servidor
- **Tipo:** tarefa
- **Descrição:** O destaque guarda `#rrggbb`, com a migração das cores por nome.
- **Critérios de aceite:**
  - [ ] A pessoa cria um destaque de livro ou de artigo e troca a cor dele com uma cor HEX livre, e a listagem do leitor devolve essa cor para marcar o PDF (RF-19, CT-13).
  - [ ] A cor do destaque é sempre guardada como `#rrggbb` em minúsculas, e um nome de tom ou um HEX malformado é recusado com 422 no campo `color` (RF-19, RN-09).
  - [ ] A migração converte cada cor por nome dos destaques existentes, inclusive dos excluídos, no HEX do tema claro, sem perder nenhuma linha, e o banco passa a aceitar só `#rrggbb`; as migrações antigas não foram editadas (RF-20, CT-14, RNF-01).
  - [ ] O servidor compila sem banco, sem aviso de formatação ou do clippy, e os testes do Acervo, dos relatórios e do `http` continuam passando (RF-19, RF-20).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05
