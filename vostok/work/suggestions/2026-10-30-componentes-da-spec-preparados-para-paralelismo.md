---
type: improvement
issue: 4
title: "[harness-improvement] Refinamento deve preparar os componentes afetados para o paralelismo do plano"
created_at: 2026-10-30T13:34:20Z
---

<!-- Sugestão de melhoria de algo que o harness Vostok já faz (CLI, skills, regras, templates e
     configuração distribuídos), não do projeto do usuário. Use só dados do harness: troque
     caminhos, nomes, trechos de código e saídas do projeto por exemplos neutros e mascare
     segredos. Valide com `vostok suggest check <arquivo>`. Comentários como este não vão para
     a issue. -->

## Versão

- `vostok 0.2.0`
- `Linux 6.18.33.2-microsoft-standard-WSL2`
- Ferramenta do agente: Claude Code

## Situação atual

O `plan-tasks` exige paralelismo ([plan-tasks-09]): dependência só quando uma tarefa precisa do resultado de outra, e tarefas que podem rodar juntas não dividem arquivos. Cada tarefa do plano só pode assumir caminhos que estão em "Componentes afetados" da spec, e o `vostok plan score` marca em "Arquivos em comum por onda" os caminhos que duas tarefas da mesma onda assumem, o que obriga essas tarefas a rodar em sequência.

O refinamento não conhece essa ligação:

- `skills/default/refine-spec/references/sections.md` descreve "Componentes afetados" só como "um caminho por linha, com a ação `criar`, `alterar` ou `remover` e o motivo", sem nada sobre a granularidade nem sobre o efeito no plano.
- `vostok spec validate` confere só se a ação combina com a existência do caminho. Uma pasta inteira (ex.: `apps/server`, `apps/web`) é aceita.
- `vostok spec approve validate` aprova a spec sem nenhum aviso.

Resultado, num projeto novo com vários módulos independentes (ex.: os contextos `billing`, `notes` e `reports`): a spec lista `apps/server` e `apps/web` como componentes, é refinada, validada e aprovada. Só no `plan-tasks` aparece que toda tarefa de módulo assume os mesmos dois caminhos, então a onda inteira vira sequencial. Para corrigir, é preciso um `adjust-spec`, que derruba a aprovação, e uma nova aprovação antes de planejar.

## Melhoria proposta

1. **`refine-spec/references/sections.md`:** na linha de "Componentes afetados", orientar que os caminhos sejam detalhados no nível em que o trabalho pode ser dividido (por módulo, contexto ou feature, ex.: `apps/server/src/billing`, `apps/web/src/features/billing`), e que os pontos de integração compartilhados (ex.: registro de rotas, menu de navegação) sejam listados à parte, porque o plano usa esses caminhos para calcular o que roda em paralelo.
2. **`refine-spec` (passo 4, Analisar):** tratar como lacuna um componente que agrupa partes que a própria spec descreve como independentes (vários RF de módulos diferentes apontando para o mesmo caminho), resolvida por pergunta ou inferência.
3. **`vostok spec validate`:** emitir um aviso (não um erro) quando um mesmo caminho de "Componentes afetados" é a única referência de vários grupos de RF ou CT sem relação entre si, ou quando um caminho com ação `criar` é uma pasta de topo que contém outros caminhos citados nos contratos da spec.
4. **`approve-spec`:** mostrar esses avisos antes de aprovar, para que o ajuste aconteça sem derrubar uma aprovação.

## Benefício

- Quem planeja recebe uma spec já pronta para o paralelismo que o `plan-tasks` exige, sem um ciclo extra de `adjust-spec` e nova aprovação.
- As ondas do `vostok plan score` passam a refletir as dependências reais, e não a granularidade acidental dos caminhos.
- O `execute-task` em modo onda consegue de fato disparar subagentes em paralelo nos módulos independentes.
- A regra do paralelismo deixa de ser só do planejamento e passa a valer desde o refinamento, onde a decisão é mais barata.

## Alternativas consideradas

- **Permitir que o plano detalhe caminhos dentro de um componente da spec** (ex.: assumir `apps/server/src/billing` quando a spec lista `apps/server`): resolve no planejamento sem mexer na spec, mas o plano deixa de ser rastreável aos componentes aprovados.
- **Contorno usado hoje:** perceber o problema antes de planejar e rodar `adjust-spec` para detalhar os componentes, aprovando a spec de novo.
