---
issue: 5
title: "[harness-bug] Subagente da execute-task implementa a tarefa sem coletar o baseline e nada no harness impede"
created_at: 2026-10-30T14:56:01Z
---

<!-- Relato de defeito do próprio harness Vostok (CLI, skills, regras, templates e configuração
     distribuídos), não do projeto do usuário. Use só dados do harness: troque caminhos, nomes,
     trechos de código e saídas do projeto por exemplos neutros e mascare segredos. Valide com
     `vostok bug check <arquivo>`. Comentários como este não vão para a issue. -->

## Versão

- `vostok 0.2.1` (o defeito ocorreu com a 0.2.0)
- `Linux 6.18.33.2-microsoft-standard-WSL2`
- Ferramenta do agente: Claude Code, com subagentes (`.claude/agents/vostok-<persona>.md`)

## Comportamento atual

Na skill `execute-task`, o Coordenador disparou um subagente `vostok-ui-ux-designer` para uma tarefa com interface, usando o "Pedido ao subagente" da própria skill (passos "Carregar a tarefa", "Coletar o baseline", "Implementar os testes" e "Implementar o código"). O subagente:

1. rodou `vostok task start SPEC-001 TASK-01 --model sonnet` (aceito, status `in_progress`);
2. criou o arquivo da lista "Mudar" (`prototype/exemplo.html`);
3. **não rodou `vostok task baseline`**;
4. devolveu ao Coordenador que a tarefa estava pronta, sem citar o baseline.

O "Registro de execução" ficou só com a linha de início:

```
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
```

e a pasta `evidence/TASK-01/baseline/` não existia. Nenhum comando do harness avisou ou recusou: o `vostok task start` não exige o baseline em seguida, e nada impede que os arquivos de "Mudar" sejam criados antes dele. A falta só foi percebida porque o Coordenador conferiu o registro à mão. Depois disso, um `vostok task baseline` gravaria o estado já alterado, e a comparação da `finish-task` perderia o valor.

## Comportamento esperado

A regra [execute-task-03] ("Colete o baseline antes de mudar qualquer arquivo do projeto") deveria ser garantida pelo harness, não só pelo texto da skill:

- O subagente não deveria conseguir chegar ao fim da execução sem o baseline, ou o Coordenador deveria ser avisado de forma determinística.
- O `vostok task baseline` não deveria aceitar em silêncio um estado já alterado (por exemplo, quando um caminho com ação `criar` em "Mudar" já existe).
- A `finish-task` deveria recusar uma tarefa sem baseline, com mensagem clara.

## Como reproduzir

1. Num projeto vazio com o harness, crie uma spec com uma tarefa de interface aprovada, com persona `ui-ux-designer` e "Mudar" contendo `- \`prototype/exemplo.html\` (criar): ...`, e "Baseline" com `- \`test -e prototype/exemplo.html && echo existe || echo ausente\``.
2. Peça "executa a TASK-01". O Coordenador dispara o subagente `vostok-ui-ux-designer` com o "Pedido ao subagente" padrão, sem iniciar a tarefa nem coletar o baseline antes (o passo 5 deixa isso opcional).
3. O subagente roda `vostok task start`, cria `prototype/exemplo.html` e devolve sem rodar `vostok task baseline`.
4. Confira o "Registro de execução": não há linha `baseline`. Rode `vostok task baseline SPEC-001 TASK-01`: ele aceita e grava `existe`, o estado já alterado, sem aviso.

## Causa provável

- **Persona `ui-ux-designer` sem a regra do baseline:** `personas/desenvolvedor.md` diz "Coleta o baseline antes de qualquer mudança", mas `personas/ui-ux-designer.md` não cita o baseline. O subagente de tarefa com interface carrega só essa persona (pelo `.claude/agents/vostok-ui-ux-designer.md`) e depende de ler o roteiro inteiro da skill.
- **Coleta delegada por padrão:** no passo 5 da `execute-task`, o Coordenador iniciar e coletar o baseline antes de disparar é opcional ("pode"), e só é sugerido para ondas com mais de uma tarefa. Para uma tarefa, a coleta fica toda com o subagente.
- **CLI sem barreira:** o `vostok task start` não registra que o baseline está pendente, e o `vostok task baseline` não confere se os caminhos `criar` de "Mudar" ainda não existem. O passo 6 (Consolidar) só manda conferir se a tarefa está `in_progress`, não se o baseline foi coletado.

Sugestões de correção:

- Tornar obrigatório no passo 5 que o Coordenador rode `vostok task start` e `vostok task baseline` antes de disparar qualquer subagente, inclusive numa onda de uma tarefa.
- No passo 6, conferir no registro a linha `baseline` de cada tarefa.
- Acrescentar a regra do baseline a todas as personas que executam tarefas (ou ao "Pedido ao subagente", em negrito, como pré-condição).
- No `vostok task baseline`, avisar ou recusar quando um caminho `criar` de "Mudar" já existe.
- Na `finish-task` / `vostok task tests`, recusar tarefa `in_progress` sem baseline.

## O que já foi tentado

- **Contorno usado:** mover a pasta criada para fora do projeto, rodar `vostok task baseline` (gravou `ausente`, o estado anterior real), devolver a pasta e conferir com `sha256sum -c` que o arquivo não mudou. Funcionou porque a tarefa só criava um arquivo novo; numa tarefa que altera arquivos existentes, esse contorno não reconstrói o estado anterior.
- **Prevenção local:** registrado na memória do projeto que o Coordenador deve coletar o baseline antes de disparar o subagente.
