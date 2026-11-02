# TASK-08: Liquidação pelo líquido na tela

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 6
- **Dependências:** TASK-07

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Liquidação pelo líquido na tela
- **Tipo:** historia
- **Descrição:** Cartão de liquidação com o líquido, a prévia do servidor e a edição dos itens.
- **Critérios de aceite:**
  - [x] Na liquidação, a pessoa informa o líquido e vê, antes de confirmar, o bruto e cada item recalculados pelo servidor, com a base digitada ajustada na proporção do bruto (RF-09, CT-05).
  - [x] Os itens podem ser editados antes de confirmar; o bruto é recalculado com o item editado e a regra da recorrente não muda (RF-10, CT-06).
  - [x] Sem bruto possível, o cartão mostra o erro; sem itens, a liquidação continua como antes.
  - [x] O cartão de liquidação com a prévia e o editor é acessível e funciona em 360 px sem rolagem horizontal, sem vermelho (RNF-04, RNF-05).
  - [x] Testes do Financeiro, ESLint, Prettier e tipos passam sem warning.
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-07
