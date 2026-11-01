---
issue: 9
title: "[harness-bug] task finish move executivo.md e tecnico.md para o registro.md e os deixa vazios"
created_at: 2026-11-01T21:11:08Z
---

<!-- Relato de defeito do próprio harness Vostok (CLI, skills, regras, templates e configuração
     distribuídos), não do projeto do usuário. Use só dados do harness: troque caminhos, nomes,
     trechos de código e saídas do projeto por exemplos neutros e mascare segredos. Valide com
     `vostok bug check <arquivo>`. Comentários como este não vão para a issue. -->

## Versão

- vostok 0.2.7
- Linux 6.18 (WSL2)
- Claude Code

## Comportamento atual

Numa tarefa em pasta, a skill `finish-task` escreve `executivo.md` e `tecnico.md` a partir do `vostok task describe`, e em seguida `vostok task finish SPEC-001 TASK-01` conclui a tarefa (`Tarefa TASK-01 concluída: status 'done'.`). Depois do `finish`:

- Todo o conteúdo de `executivo.md` e de `tecnico.md` a partir do primeiro título `## ` vai para o início de `registro.md`, antes de `## Registro de execução`. O executivo vem primeiro e o técnico logo depois, sem nada separando os dois.
- Nos dois arquivos fica só o que vinha antes do primeiro `## `. Com o template padrão, isso é o comentário `<!-- Escrito na finalização da tarefa. -->`. Se o texto começava com um título `# TASK-01: ...`, o arquivo fica vazio (1 byte), e o título `#` some.
- O texto em prosa sem nenhum `## ` fica no lugar. Um executivo sem títulos continua inteiro. Um técnico com um parágrafo e depois seções fica só com o parágrafo.
- O `README.md` gerado continua com os links `[Resumo executivo](executivo.md)` e `[Detalhes técnicos](tecnico.md)`, que agora levam a arquivos vazios ou só com o comentário.

Aconteceu em 10 das 11 tarefas concluídas de uma mesma spec. A única que escapou tinha o executivo e o técnico só em prosa, sem títulos `## `.

## Comportamento esperado

O `vostok task finish` só acrescenta a linha de conclusão à tabela do `registro.md`. O `executivo.md` e o `tecnico.md` continuam como foram escritos, com títulos `## ` ou sem eles. A própria skill `finish-task` exige os dois escritos para concluir e não fala em movê-los.

## Como reproduzir

1. Num projeto de exemplo, planeje uma spec `SPEC-001` com uma tarefa em pasta `TASK-01`, aprove e execute (`vostok task start SPEC-001 TASK-01 --model m`).
2. Rode `vostok task tests`, `vostok task regression` e `vostok task evidence` até ficarem `passed`, e marque os critérios em `criterios.md`.
3. Escreva `vostok/work/tasks/SPEC-001/TASK-01/executivo.md` com:

   ```markdown
   <!-- Escrito na finalização da tarefa. -->

   ## O que mudou

   Texto do executivo.
   ```

   e `tecnico.md` com:

   ```markdown
   <!-- Escrito na finalização da tarefa. -->

   ## O que foi feito

   Texto do técnico.
   ```

4. Rode `vostok task finish SPEC-001 TASK-01`.
5. Veja que `executivo.md` e `tecnico.md` ficaram só com o comentário, e que `registro.md` começa com `## O que mudou`, `Texto do executivo.`, `## O que foi feito` e `Texto do técnico.`, antes de `## Registro de execução`.

## Causa provável

Ao regravar a pasta da tarefa (ao acrescentar a linha de conclusão ao registro), o vostok parece dividir o conteúdo da tarefa pelos títulos conhecidos. As seções `### ` de `execucao.md`, `verificacao.md` e `criterios.md` são reconhecidas, mas `executivo.md` e `tecnico.md` não têm título próprio no template. Daí qualquer seção `## ` deles cai na parte do registro, que é o único arquivo que começa com `## `. A causa está na leitura e escrita da tarefa em pasta do `vostok task finish`, ou numa rotina comum a ela.

## O que já foi tentado

- Recuperação manual: as seções foram separadas de volta do início de `registro.md` para `executivo.md` e `tecnico.md`, e o registro ficou só com `## Registro de execução` e `## Histórico de ajustes`. Funciona, mas qualquer nova regravação do registro dessas tarefas deve mover o texto de novo.
- Escrever o executivo e o técnico só em prosa, sem `## `, evita o defeito, mas contraria a estrutura de seções que o `describe` sugere.
