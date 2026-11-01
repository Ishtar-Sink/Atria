# TASK-11: Excluir recorrência e desfazer liquidação na tela

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 9
- **Dependências:** TASK-10

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Excluir recorrência e desfazer liquidação na tela
- **Tipo:** tarefa
- **Descrição:** A recorrência ganha Excluir, e a cópia liquidada ganha "Desfazer liquidação" com a explicação.
- **Critérios de aceite:**
  - [x] A recorrência tem "Excluir" no "Mais ações" e é excluída depois de uma confirmação, sem precisar liquidar antes; cancelar não exclui (RF-01, CT-01, PD-14).
  - [x] Ao excluir, a ocorrência aberta e a previsão somem das listas na hora, e as cópias liquidadas continuam no histórico sem mudar o saldo (RF-02, RF-03, CT-01).
  - [x] Se o servidor recusar a exclusão, as listas voltam ao que eram e a pessoa é avisada ([project/frontend-18], RF-01).
  - [x] A cópia liquidada oferece "Desfazer liquidação" no lugar de "Excluir", e a confirmação explica que o valor volta ao saldo e que a ocorrência volta a ficar aberta (RF-04, CT-03).
  - [x] Os diálogos da exclusão e do desfazer não têm violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, [project/frontend-10]).
  - [x] Os e2e do CT-01 e do CT-03 estão escritos e compilam (CT-01, CT-03).
  - [x] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings e sem erros de tipo ([project/code-style-01]).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-10
