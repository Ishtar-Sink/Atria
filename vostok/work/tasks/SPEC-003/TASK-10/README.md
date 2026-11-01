# TASK-10: Remover o cartão nas telas

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 8
- **Dependências:** TASK-07

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Remover o cartão nas telas
- **Tipo:** tarefa
- **Descrição:** Saem a aba Faturas, o pagamento de fatura, o tipo cartão, as parcelas e o card Cartões.
- **Critérios de aceite:**
  - [ ] O Financeiro não tem mais a aba Faturas nem a tela de pagamento de fatura, e nada no app aponta para elas (RF-08, CT-07).
  - [ ] Contas só são comuns: o formulário não oferece o tipo cartão, o limite nem os dias de fechamento e vencimento, e o detalhe não mostra "Ver fatura", o tipo nem o limite (RF-07, CT-07).
  - [ ] Uma saída é criada sem parcelas em qualquer conta, e as listas e o detalhe não mostram mais "(n/total)" nem a parcela (RF-07, CT-07).
  - [ ] O painel do Financeiro não tem mais o card Cartões, e os demais cards continuam pareados (RF-09, CT-07).
  - [ ] A lista de contas continua com busca, visualização e um filtro na URL, agora por visibilidade ([project/frontend-12], [project/frontend-13], RF-07).
  - [ ] As telas alteradas não têm violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, CT-07).
  - [ ] O e2e do CT-07 substitui o de parcelas e faturas e compila (CT-07).
  - [ ] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings, e não sobra nenhum erro de tipo ligado ao cartão ([project/code-style-01], [project/code-style-08]).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-07
