# TASK-09: Cartão Descontos do período

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 6
- **Dependências:** TASK-06, TASK-07

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cartão Descontos do período
- **Tipo:** historia
- **Descrição:** Cartão do painel com descontos e acréscimos por nome.
- **Critérios de aceite:**
  - [x] O painel tem o cartão "Descontos do período" com o total dos descontos e o dos acréscimos do período, agrupados por nome (RF-14).
  - [x] Cada nome aparece uma vez, com o total que o servidor somou, inclusive nomes que diferem só por maiúsculas (CT-12, CB-07).
  - [x] Sem descontos no período, o cartão mostra o texto explicativo; no erro, o cartão tem a própria tentativa, e os cartões continuam pareados.
  - [x] O cartão não usa vermelho, é acessível e funciona em 360 px sem rolagem horizontal (RNF-04, RNF-05).
  - [x] Testes do Financeiro, a checagem de tipos do app inteiro, ESLint e Prettier passam sem warning.
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-06, TASK-07
