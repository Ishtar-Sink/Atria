---
id: TASK-15
spec: SPEC-002
title: "Contrato gerado da API"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-09, TASK-11, TASK-13, TASK-14]
wave: 3
covers: [RF-11, RF-19, RF-27, RF-32, RF-38, CT-10]
type: tarefa
labels: [SPEC-002, padrao]
status: done
content_hash: 6da5f63584d2301d0817965c48380a8a1ee1b4475b086ac572deb3dcb469404f
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 7b1d3640bb1441362c2f38ffc78fb6e3e3685e0a0edd439d6a9089f284fbc642
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-15: Contrato gerado da API

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Contratos e interfaces" (mudanças na API refletidas em `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`), RF-11, RF-19, RF-27, RF-32, RF-38 e CT-10.
- `vostok/rules/project/api.md`: [project/api-02] (o frontend não escreve tipos da API à mão).
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-03].
- `vostok/memory/knowledge.md` (KNW-007): uma compilação pesada do servidor por vez.
- `vostok/work/tasks/SPEC-002/TASK-09.md`, `TASK-10.md`, `TASK-11.md`, `TASK-12.md`, `TASK-13.md` e `TASK-14.md`: o que cada tarefa de servidor mudou no contrato (`system_key`, descrição de `upcoming_bills`, `icon`, rotas de destaque, `Range` em `/files/{id}`, `TaskRecurrenceRule` e `next_occurrence`).
- `packages/contracts/package.json`: scripts `generate`, `check` e `typecheck`.
- `packages/contracts/src/index.ts`: reexporta `paths`, `components` e `operations` de `schema.ts` (não muda).
- `apps/server/src/main.rs` (comando `openapi`, linha 58): imprime o OpenAPI juntado sem precisar de configuração.
- `vostok/work/.archive/SPEC-001/tasks/TASK-35.md` (Verificação, linhas 130 a 135): os mesmos comandos de conferência do contrato.

### Mudar

- `packages/contracts/openapi.json` (alterar): gerado de novo do servidor, com as mudanças das TASK-09 a TASK-14.
- `packages/contracts/src/schema.ts` (alterar): tipos TypeScript gerados do `openapi.json` novo.
- `apps/web/src/features/tasks/hooks/use-tasks.ts` (alterar): só o tipo do contrato das rotas de Tarefas passa a `Schemas['TaskRecurrenceRule']`, sem mudar comportamento, para o typecheck do app continuar passando com o contrato novo (nenhuma tarefa da onda 3 mexe neste arquivo).

### Passos

1. Leia os arquivos de "Ler". Confira em `vostok task status SPEC-002` que a TASK-09, a TASK-10, a TASK-11, a TASK-12, a TASK-13 e a TASK-14 estão `done`; se alguma não estiver, **PARE** e registre o bloqueio com o ID. Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Gere o contrato do servidor: `cargo run -q -p atria-server -- openapi > packages/contracts/openapi.json`. Não edite o arquivo à mão.
3. Gere os tipos: `pnpm --filter @atria/contracts generate` (que roda `openapi-typescript openapi.json -o src/schema.ts`). Não edite `schema.ts` à mão.
4. Confira que nada mais mudou além dos dois arquivos: `git status --porcelain -- packages/contracts` lista só `openapi.json` e `src/schema.ts`.
5. Em `apps/web/src/features/tasks/hooks/use-tasks.ts`, troque `type ContractRule = Schemas['RecurrenceRule'];` por `type ContractRule = Schemas['TaskRecurrenceRule'];`. Em `toRule`, troque `time: rule.time === '' ? null : rule.time` por `time: rule.time === undefined || rule.time === '' ? null : rule.time`, o mínimo para o `time` opcional; `toRequestRule` continua igual. Não mude mais nada no arquivo nem nos testes: o comportamento é o mesmo (a tela já tratava o horário como opcional). Rode `pnpm --filter @atria/web typecheck`; se aparecer erro em outro arquivo por causa do contrato novo, **PARE** e registre o bloqueio com o arquivo e a mensagem, para o arquivo entrar em "Mudar" por ajuste da tarefa.
6. Rode a Verificação inteira.

### Baseline

- `pnpm --filter @atria/contracts typecheck`
- `pnpm --filter @atria/contracts check`
- `pnpm --filter @atria/web typecheck`
- `pnpm --filter @atria/web exec vitest run src/features/tasks --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/tasks/hooks/use-tasks.ts --max-warnings 0`

### Verificação

```bash
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec vitest run src/features/tasks
pnpm --filter @atria/web exec eslint src/features/tasks/hooks/use-tasks.ts --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/tasks/hooks/use-tasks.ts
test "$(git status --porcelain -- packages/contracts | grep -cvE 'packages/contracts/(openapi\.json|src/schema\.ts)$')" -eq 0
# evidência: contract-fields.txt
node -e 'const d=require(process.argv[1]);const s=d.components.schemas,p=d.paths;const checks=[["CategoryResponse.system_key",!!s.CategoryResponse?.properties?.system_key],["EmotionResponse.icon",!!s.EmotionResponse?.properties?.icon],["CreateEmotionRequest.icon",!!s.CreateEmotionRequest?.properties?.icon],["TaskResponse.next_occurrence",!!s.TaskResponse?.properties?.next_occurrence],["TaskRecurrenceRule.time opcional",!!s.TaskRecurrenceRule&&!(s.TaskRecurrenceRule.required??[]).includes("time")],["RecurrenceRule.time obrigatorio",(s.RecurrenceRule?.required??[]).includes("time")],...["books","articles"].map(k=>{const o=p[`/api/v1/${k}/{id}/highlights/{highlight_id}`]??{};return [`${k} highlight patch+delete`,!!o.patch&&!!o.delete]}),["files 206+416",["206","416"].every(c=>c in (p["/api/v1/files/{id}"]?.get?.responses??{}))]];for(const [n,ok] of checks)console.log(`${ok?"ok":"FALHA"}  ${n}`);process.exit(checks.every(c=>c[1])?0:1)' "$PWD/packages/contracts/openapi.json"
```

Resultado esperado: o `openapi.json` igual ao que o servidor gera, o `schema.ts` igual ao gerado do `openapi.json`, os tipos do pacote e o app web compilando, os testes de Tarefas do app passando, só os dois arquivos mudados no pacote e as nove linhas `ok` do contrato.

### Evidências

- `contract-fields.txt` (automática, da verificação)
  - Prova: o contrato publicado para o frontend traz os campos e as rotas novas do servidor: `system_key` das categorias, `icon` das emoções, `next_occurrence` das tarefas, `TaskRecurrenceRule` com `time` opcional (e a `RecurrenceRule` dos lembretes e do Financeiro ainda exigindo `time`), `PATCH` e `DELETE` dos destaques de livros e artigos e as respostas 206 e 416 de `GET /files/{id}` (RF-11, RF-19, RF-27, RF-32, RF-38, CT-10).
  - Trecho: nove linhas começando por `ok`, entre elas `ok  CategoryResponse.system_key`, `ok  TaskResponse.next_occurrence`, `ok  books highlight patch+delete` e `ok  files 206+416`.
  - Falha: qualquer linha `FALHA` (contrato sem a mudança de uma das tarefas de servidor) ou código de saída 1.
- `contract-sync.txt` (automática): `cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json && echo 'openapi.json igual ao servidor' && pnpm --filter @atria/contracts check && echo 'schema.ts igual ao gerado'`
  - Prova: o contrato versionado é exatamente o que o servidor publica, e os tipos TypeScript são exatamente os gerados dele ([project/api-02], RF-11, RF-19, RF-27, RF-32, RF-38).
  - Trecho: as linhas `openapi.json igual ao servidor` e `schema.ts igual ao gerado`.
  - Falha: `differ: byte` ou `differ: char` (contrato desatualizado, como antes da tarefa) e código de saída diferente de 0.

### Concluída quando

- [x] O `openapi.json` do pacote de contratos é igual ao que o servidor gera, com as mudanças das tarefas de servidor da SPEC-002 (RF-11, RF-19, RF-27, RF-32, RF-38).

  > Como comprovar: em `contract-sync.txt`, ver `openapi.json igual ao servidor`; em `contract-fields.txt`, ver as nove linhas `ok`.

- [x] O `schema.ts` é o gerado do `openapi.json` novo, sem edição à mão, e os tipos do pacote compilam (RF-11, CT-10).

  > Como comprovar: em `contract-sync.txt`, ver `schema.ts igual ao gerado`; rodar `pnpm --filter @atria/contracts typecheck` e ver saída sem erro.

- [x] Só `openapi.json` e `src/schema.ts` mudaram no pacote, e o app web continua compilando com o contrato novo, com a troca mínima de tipo em `use-tasks.ts` e sem mudar o comportamento de Tarefas (RF-38).

  > Como comprovar: rodar `git status --porcelain -- packages/contracts` e ver só os dois arquivos; rodar `pnpm --filter @atria/web typecheck` e ver saída sem erro; rodar `pnpm --filter @atria/web exec vitest run src/features/tasks` e ver a linha `Tests` sem falhas.

## Descrição

### Resumo executivo

Atualiza o contrato entre o servidor e o app web com tudo o que as tarefas de servidor mudaram: categorias padrão, ícone das emoções, destaques editáveis, envio de arquivos em partes e a próxima ocorrência das tarefas.
Sem isso, as telas não enxergam os campos novos.
Perfil padrão, risco baixo: os arquivos do contrato são gerados por comando, e o app recebe só um ajuste de tipo, sem mudar comportamento.
Libera as telas do Financeiro (TASK-16), do Diário (TASK-20), de notas e destaques (TASK-25) e de Tarefas (TASK-28).

### Detalhes técnicos

**Abordagem.** Regenerar uma vez só, depois de todas as tarefas de servidor que mudam a API, com os mesmos comandos da SPEC-001: `cargo run -q -p atria-server -- openapi > packages/contracts/openapi.json` e `pnpm --filter @atria/contracts generate`. A conferência usa `cmp` contra o servidor e o script `check` do pacote.

**Decisões.**
- Uma tarefa só de geração, e não regenerar em cada tarefa de servidor: as TASK-09, 11, 12, 13 e 14 rodam na mesma onda ou em sequência e disputariam os dois arquivos gerados.
- A TASK-10 não está nas dependências porque não muda o esquema (só a descrição de `upcoming_bills`); como ela é da onda 1 e esta é da onda 3, a descrição nova entra no contrato.
- O typecheck do app web continua obrigatório: a troca de `RecurrenceRule` por `TaskRecurrenceRule` nas rotas de Tarefas (TASK-14) quebraria `apps/web/src/features/tasks/hooks/use-tasks.ts`, então esta tarefa faz a troca mínima do tipo nesse arquivo, sem mudar comportamento (decisão do Coordenador). Descartado deixar o app quebrado até a TASK-28, que contaminaria o baseline das tarefas da onda 4; a TASK-28 continua dona das mudanças de comportamento em `use-tasks.ts`.
- A evidência de campos lê o `openapi.json` como dado (JSON), não como texto, e confere cada mudança do contrato de "Contratos e interfaces" da spec.

**Riscos técnicos.** Se outro arquivo do app falhar no typecheck por causa do contrato novo, a tarefa para (passo 5) e o arquivo entra por ajuste. A geração depende da versão fixada do `openapi-typescript` (7.13.0) em `packages/contracts/package.json`.

**Referências da spec.** RF-11, RF-19, RF-27, RF-32, RF-38, CT-10; "Contratos e interfaces"; [project/api-02].

**Arquivos em comum na onda 3.** Nenhum: as outras tarefas da onda (TASK-21, TASK-22, TASK-23 e TASK-24) não mexem em `apps/web/src/features/tasks`. A TASK-28 (onda 4) muda `use-tasks.ts` depois desta.

### Card

- **Título:** Contrato gerado da API
- **Tipo:** tarefa
- **Descrição:** Gera de novo o `openapi.json` e o `schema.ts` do pacote de contratos com as mudanças das tarefas de servidor, conferidos contra o servidor.
- **Critérios de aceite:**
  - [ ] `openapi.json` igual ao gerado pelo servidor.
  - [ ] `schema.ts` igual ao gerado do `openapi.json`, e os tipos do pacote compilam.
  - [ ] O contrato traz `system_key`, `icon`, `next_occurrence`, `TaskRecurrenceRule`, as rotas de destaque e as respostas 206 e 416.
  - [ ] Só os dois arquivos gerados mudam no pacote.
  - [ ] O app web compila com o contrato novo, sem mudança de comportamento em Tarefas.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-09, TASK-11, TASK-13, TASK-14

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 5 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-15/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
