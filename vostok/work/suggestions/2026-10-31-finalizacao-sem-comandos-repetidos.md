---
type: improvement
issue: 7
title: "[harness-improvement] Finalização sem comandos repetidos: Verificação focada no escopo e evidências reaproveitando a saída da Verificação"
created_at: 2026-10-31T11:17:50Z
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

A finalização de uma tarefa (skill `finish-task`) roda três etapas. Cada uma executa os próprios comandos, sem aproveitar o que a etapa anterior já rodou:

1. `vostok task tests` executa o bloco de "Verificação".
2. `vostok task regression` executa de novo os comandos de "Baseline".
3. `vostok task evidence` executa de novo o comando de cada evidência automática.

Os três blocos são escritos no planejamento, no passo 4 da skill `approve-plan` (`skills/default/approve-plan/SKILL.md`):

- **`#{TASK_BASELINE}`:** já orienta a preferir "comandos focados no que a tarefa toca à suíte inteira".
- **`#{TASK_VERIFY}`:** diz só "bloco `bash` com os comandos que comprovam a tarefa (testes, validações) e o resultado esperado". Não fala de escopo, nem de custo, nem de repetição com as evidências.
- **`#{TASK_EVIDENCE}`:** cada evidência automática é um comando próprio. Não há como apontar para a saída de um comando que a Verificação já rodou.

O mesmo vale para a persona `qa-lead` (`personas/qa-lead.md`), que escreve Verificação, Evidências e Concluída quando sem regra sobre escopo ou reaproveitamento.

Numa spec real com uma onda de 16 tarefas de tela, uma por pasta de feature de um mesmo pacote web, o planejamento gerou em cada tarefa um padrão como este:

```bash
# Verificação
pnpm --filter <pacote> test -- src/features/<feature>
pnpm --filter <pacote> typecheck
pnpm --filter <pacote> lint
```

```markdown
### Baseline
- `pnpm --filter <pacote> typecheck`

### Evidências
- `<feature>-tests.txt` (automática): `pnpm --filter <pacote> test -- src/features/<feature> --reporter=verbose`
```

Na finalização de cada tarefa, isso dá:

- **Testes duas vezes:** a Verificação roda os testes da feature, e a evidência roda os mesmos testes de novo, só para gravar a saída detalhada.
- **Typecheck duas vezes:** a Verificação roda o typecheck, e a regressão roda o mesmo comando logo depois, porque ele é o comando do baseline.
- **Suíte inteira em vez da feature:** com o `--`, o executor de testes trata o que vem depois como argumento posicional. O filtro de pasta, o `--reporter` e o `-t` deixam de valer, e cada comando roda a suíte inteira do pacote, com centenas de testes, em vez de dezenas. Nada no planejamento conferiu que o comando de teste seleciona só o que a tarefa toca.
- **Evidência sem o que provar:** a evidência gravou só o resumo da suíte, sem nenhuma linha por teste. Os critérios de "Concluída quando" que mandavam "ver aprovado o teste X em `<feature>-tests.txt`" não podiam ser conferidos. Foi preciso ajustar 11 tarefas com `adjust-task`.

Na onda inteira, a suíte completa do pacote rodaria pelo menos 32 vezes só na finalização: duas por tarefa.

## Melhoria proposta

**1. Verificação focada, no planejamento (`approve-plan`, `#{TASK_VERIFY}`, e persona `qa-lead`)**

- Levar para a Verificação a mesma orientação que o Baseline já tem: comandos focados no escopo da tarefa (a pasta ou o módulo de "Mudar"), e não a suíte inteira. A suíte inteira fica para a tarefa de integração, ou para quem roda a onda inteira.
- Na regra do QA Lead, pedir que cada comando de teste da Verificação e das Evidências seja rodado uma vez no planejamento, conferindo que seleciona só os testes do escopo. Na saída, aparecem só os arquivos ou nomes esperados, e as opções como reporter e filtro de nome fazem efeito. É o mesmo cuidado que `#{TASK_EVIDENCE}` já pede ("rode o comando e confira que a saída de hoje não é a esperada").
- Opcional: o `vostok plan approve validate` avisa quando um comando de teste da Verificação passa argumentos depois de `--` para um script do gerenciador de pacotes. Esse é um padrão comum de filtro ignorado.

**2. Evidência que reaproveita a saída da Verificação (`vostok task tests` e `vostok task evidence`)**

- O `vostok task tests` grava a saída de cada comando da Verificação separada, em `validation/verify-NN.out`, além do `tests.out` atual.
- Uma evidência automática pode apontar para essa saída em vez de repetir o comando, por exemplo:

  ```markdown
  - `<feature>-tests.txt` (automática, da verificação): 1
  ```

  O `vostok task evidence` copia `validation/verify-01.out` para `<feature>-tests.txt`, sem rodar nada de novo. Para isso valer, a Verificação já usa a forma detalhada do comando de teste (com o `--reporter=verbose` do exemplo).
- O `approve-plan` passa a preferir essa forma quando a evidência é a saída de um teste que a Verificação já roda.

**3. Regressão que reaproveita um comando idêntico (`vostok task regression`)**

- Quando um comando de "Baseline" é idêntico, em texto, a um comando que a Verificação acabou de rodar na mesma validação, o `vostok task regression` usa a saída gravada no passo 2, em vez de executá-lo de novo. Continua comparando com o baseline e filtrando `regression_ignore` dos dois lados, como hoje.
- Se o comando não for idêntico, ou não houver saída gravada, nada muda.

## Benefício

- **Quem planeja:** a regra deixa explícito que cada comando de teste precisa ser focado e conferido. Isso evita o erro de um filtro ignorado se espalhar por uma onda inteira e só aparecer na finalização.
- **Quem finaliza (QA e usuário):** cada tarefa roda os testes uma vez, e não duas, e roda só os do escopo, e não a suíte inteira. Em ondas grandes de tarefas no mesmo pacote, a finalização fica várias vezes mais rápida, e o usuário espera menos entre um pedido e outro.
- **Evidências:** a evidência de testes passa a ser exatamente a saída que comprovou a tarefa. Não há mais o risco de a Verificação e a evidência rodarem comandos levemente diferentes e provarem coisas diferentes.
- **Ambiente:** menos execuções pesadas ao mesmo tempo, quando várias tarefas são finalizadas em sequência.

## Alternativas consideradas

- **Ajustar as tarefas uma a uma com `adjust-task`:** é o contorno usado hoje. Resolve o escopo, mas cada tarefa ajustada volta a zerar os resultados, o trabalho se repete em todas as tarefas da onda e nada impede que o próximo planejamento repita o padrão.
- **Tirar os testes da Verificação e deixar só na evidência:** reduz a repetição, mas a Verificação deixa de comprovar a tarefa por conta própria, e o `max_attempts` passa a contar falhas da etapa errada.
- **Cache no próprio executor de testes do projeto:** depende da ferramenta de cada projeto e não ajuda com typecheck, lint ou scripts. O reaproveitamento no harness vale para qualquer comando.
