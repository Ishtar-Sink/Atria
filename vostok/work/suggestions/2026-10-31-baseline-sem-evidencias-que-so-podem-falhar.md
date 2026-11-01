---
type: improvement
issue: 8
title: "[harness-improvement] Baseline sem rodar evidências que só podem falhar antes da tarefa"
created_at: 2026-10-31T12:33:11Z
---

<!-- Sugestão de melhoria de algo que o harness Vostok já faz (CLI, skills, regras, templates e
     configuração distribuídos), não do projeto do usuário. Use só dados do harness: troque
     caminhos, nomes, trechos de código e saídas do projeto por exemplos neutros e mascare
     segredos. Valide com `vostok suggest check <arquivo>`. Comentários como este não vão para
     a issue. -->

## Versão

- vostok 0.2.4
- Linux 6.18 (WSL2)
- Agente: Claude Code

## Situação atual

O `vostok task start` coleta o baseline no mesmo comando. Além dos comandos de "Baseline", ele roda o comando de cada evidência automática e grava a saída antes da mudança. Depois, o `vostok task evidence` usa essa saída para avisar quando a evidência final ficou igual à de antes.

A skill `approve-plan` (passo 4, `#{TASK_EVIDENCE}`) já pede que cada evidência busque "algo que só existe depois da tarefa". Ou seja: a evidência foi pensada para não passar antes da mudança. Mesmo assim, o comando roda inteiro no baseline, qualquer que seja o custo.

O custo aparece numa tarefa de integração cujas evidências são suítes pesadas que dependem do que a própria tarefa cria. Num caso real:

- **Evidência `e2e.txt`:** roda a suíte ponta a ponta inteira do app web, com 48 testes em 4 larguras de tela, 192 execuções.
- **Por que ela falha antes:** as rotas só são registradas pela própria tarefa. Antes dela, nenhum teste acha a tela, e cada um espera o tempo-limite de 30 s antes de falhar.
- **Evidência `lighthouse.txt`:** roda o Lighthouse CI logado, cujo script de login também é criado pela tarefa.
- **Custo:** o `vostok task start` passou de 10 minutos e seguia rodando. A estimativa era de mais de 30 minutos só para gravar uma saída de falha já conhecida.
- **Rastro:** nesse tempo a tarefa continuou `approved` e sem nenhuma linha no registro. Para quem acompanha, não havia sinal de progresso.

O contorno foi ajustar a tarefa para que cada comando teste a pré-condição e pare na hora, com código 1, quando ela não existe. Exemplo neutro:

```markdown
- `e2e.txt` (automática): `if test -f src/app/registro.ts; then <executor-e2e> --reporter=list 2>&1; else echo "e2e não executado: src/app/registro.ts ainda não existe"; exit 1; fi`
```

Funciona, mas o ajuste derruba a aprovação: a tarefa volta para `pending` e precisa ser aprovada de novo. Além disso, a pré-condição fica escrita à mão em cada evidência.

## Melhoria proposta

**1. Evidência que pula o baseline (`vostok task start` e `vostok task baseline`)**

- **Marcação nova:** a evidência automática passa a aceitar a forma `(automática, sem baseline)`. Nela, o comando não roda antes da mudança, e o baseline grava só a linha `não executada no baseline: depende do que a tarefa cria`.
- **Na evidência final:** o `vostok task evidence` não faz a comparação com o baseline para essa evidência e não emite o aviso de "saída igual". Hoje esse aviso não faria sentido, porque não há saída anterior.

**2. Pré-condição declarada (alternativa à marcação)**

- **Subitem novo:** a evidência pode trazer `Requer:` com um ou mais caminhos de "Mudar" com ação `criar`.
- **No baseline:** se algum caminho de `Requer:` ainda não existe, o comando não roda, e o baseline grava `não executada: <caminho> ainda não existe`.
- **Na finalização:** o `vostok task evidence` roda o comando normalmente, porque os caminhos já existem.
- **Validação:** o `vostok plan approve validate` recusa um `Requer:` que não seja um caminho `criar` da própria tarefa.

**3. Orientação no planejamento (`approve-plan`, `#{TASK_EVIDENCE}`, e persona `qa-lead`)**

- Quando o comando de uma evidência depende de um caminho que a tarefa cria (rotas, scripts, servidor, configuração), usar a forma 1 ou 2. Vale principalmente para suítes ponta a ponta, auditorias de desempenho e scripts que sobem servidor.

**4. Progresso visível do baseline (`vostok task start`)**

- O `vostok task start` grava a linha `início` no registro antes de começar o baseline, e imprime cada comando do baseline ao iniciá-lo. Assim um baseline longo deixa rastro: a tarefa já aparece `in_progress`, e quem acompanha vê em qual comando ele está.

## Benefício

- **Quem executa:** o início de uma tarefa de integração cai de dezenas de minutos para segundos, sem gastar CPU com testes que só podem falhar por tempo-limite.
- **Quem planeja:** a dependência entre a evidência e o que a tarefa cria fica explícita na tarefa, e não escondida num `if` dentro do comando.
- **Quem aprova:** não é preciso ajustar e reaprovar a tarefa só para encurtar o baseline.
- **Quem acompanha:** com o progresso no registro e na saída, um baseline longo deixa de parecer travado.

## Alternativas consideradas

- **Pré-condição escrita no próprio comando, com `if test -f ...; then ...; else ...; exit 1; fi`:** é o contorno usado hoje. Funciona, mas cada tarefa repete o padrão à mão, o comando da evidência fica mais difícil de ler, e um erro no `if` pode mascarar uma falha real (por exemplo, `|| echo` no lugar de `else ...; exit 1`).
- **Tempo-limite menor no executor de testes do projeto:** reduz o custo, mas depende da ferramenta de cada projeto e muda o comportamento dos testes também depois da tarefa.
- **Não coletar baseline de nenhuma evidência:** perde o aviso de "saída igual ao baseline", que ajuda a pegar evidências que não provam a mudança.
