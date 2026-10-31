---
issue: 6
title: "[harness-bug] Baseline gerado no planejamento checa os arquivos que a tarefa cria e a regressão sempre bloqueia"
created_at: 2026-10-30T19:18:39Z
---

<!-- Relato de defeito do próprio harness Vostok (CLI, skills, regras, templates e configuração
     distribuídos), não do projeto do usuário. Use só dados do harness: troque caminhos, nomes,
     trechos de código e saídas do projeto por exemplos neutros e mascare segredos. Valide com
     `vostok bug check <arquivo>`. Comentários como este não vão para a issue. -->

## Versão

- vostok 0.2.1
- Linux 6.18.33.2-microsoft-standard-WSL2
- Agente: Claude Code

## Comportamento atual

Ao detalhar as tarefas (skill `approve-plan`), o "Baseline" de cada tarefa recebe comandos que conferem a existência dos arquivos que a própria tarefa cria (itens "(criar)" em "Mudar"), por exemplo:

```
- `for p in package.json Cargo.toml LICENSE; do test -e "$p" && echo "$p existe" || echo "$p ausente"; done`
```

Na finalização (skill `finish-task`), `vostok task regression` roda o comando de novo, a saída muda de `ausente` para `existe` e a tarefa fica bloqueada:

```
Comandos com resultado diferente do baseline (saídas em ~/.../evidence/TASK-02/validation/regression):
- [1] for p in package.json Cargo.toml LICENSE; do test -e "$p" && echo "$p existe" || echo "$p ausente"; done
    < package.json ausente
    ---
    > package.json existe
Erro: a tarefa TASK-02 ficou bloqueada por regressão. PARE: responda com o template `blocker`, mostrando os comandos, e aguarde a decisão do usuário
```

Como quase toda tarefa cria arquivos, a regressão bloqueia praticamente todas as tarefas da spec, e cada uma exige `vostok task resume --accept-regression` com uma decisão do usuário. Numa spec de 36 tarefas, todas tinham baseline desse tipo; as duas primeiras finalizadas bloquearam pelo mesmo motivo.

## Comportamento esperado

O baseline deveria medir só o que não pode mudar com a tarefa (testes, lint e comportamentos já existentes), e a regressão só deveria bloquear uma mudança inesperada. A criação dos arquivos que a própria tarefa entrega não deveria contar como regressão: ou a `approve-plan` não gera esse tipo de comando no "Baseline", ou a regressão trata como esperada a diferença ligada aos caminhos marcados "(criar)" em "Mudar".

## Como reproduzir

1. Num projeto com o harness, crie e refine uma spec cuja tarefa crie arquivos novos (por exemplo, `src/exemplo.rs` como "(criar)" em "Mudar").
2. Planeje e aprove o plano (skills `plan-tasks` e `approve-plan`).
3. Veja que o "Baseline" da tarefa traz um comando como `test -e src/exemplo.rs && echo existe || echo ausente`.
4. Execute a tarefa (skill `execute-task`): o baseline grava `ausente`.
5. Finalize a tarefa (skill `finish-task`): `vostok task tests` passa e `vostok task regression` bloqueia a tarefa, porque a saída virou `existe`.

## Causa provável

Na skill `approve-plan`, a orientação de `#{TASK_BASELINE}` pede só "comandos estáveis: sem data, sem caminho temporário e sem nada que mude entre execuções". Ela não diz que o baseline serve para detectar regressão e que não pode medir a própria entrega da tarefa. O engenheiro acaba usando a existência dos arquivos a criar como "estado anterior". O `vostok task regression` compara a saída inteira e não sabe quais diferenças a tarefa prevê.

## O que já foi tentado

- Aceitar a diferença com `vostok task resume <SPEC_ID> <TASK_ID> --accept-regression 1 "..."`: funciona, mas exige uma parada e uma decisão do usuário em toda tarefa.
- Ajustar o "Baseline" pela skill `adjust-task`: não é possível depois de o baseline ser coletado (regra adjust-task-10). Antes da execução é possível, mas a tarefa volta para `pending` e precisa ser aprovada de novo, uma por uma.
