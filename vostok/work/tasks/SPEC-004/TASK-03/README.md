# TASK-03: Cálculo na tela

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 2
- **Dependências:** TASK-01

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cálculo na tela
- **Tipo:** tarefa
- **Descrição:** Biblioteca da tela com o mesmo cálculo e a mesma tabela de casos do servidor.
- **Critérios de aceite:**
  - [x] A tela calcula o líquido a partir do bruto e dos itens com o mesmo resultado do servidor nos casos diretos da tabela comum (RF-13, CT-11).
  - [x] A tela calcula o bruto equivalente a um líquido com a base proporcional e o centavo residual no último percentual, com os mesmos números do servidor (RF-13, CT-11).
  - [x] A tela recusa os mesmos itens inválidos do servidor, com o mesmo campo e o mesmo código (RF-13, CT-11).
  - [x] Os testes da pasta `lib` do Financeiro, o ESLint, o Prettier e a checagem de tipos passam (RF-13).
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-01
