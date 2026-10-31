---
id: TASK-02
spec: SPEC-001
title: "Monorepo e CI"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-01]
wave: 2
covers: []
type: tarefa
labels: [SPEC-001, padrao]
status: done
content_hash: e4c0f27558afb6c078b3f04c65a41b0e4d8a21434fcd10cba48cca50100fa48f
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: 5d21e2cb62113f09d10955fc96f725f5d2d88331ed6c807e20d80f7166331a5c
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
---

# TASK-02: Monorepo e CI

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: componentes afetados (raiz do monorepo, CI, `lighthouserc.json`, `LICENSE`, `docs/glossario.md`), RNF-05 e decisões 53 a 60.
- `vostok/rules/project/architecture.md`: [project/architecture-01] (monorepo com pnpm e Cargo).
- `vostok/rules/project/stack.md`: Node 22 ou superior, pnpm, Rust edição 2024, licença AGPL-3.0 e justificativa de dependência nova ([project/stack-12]).
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-06] (CI com lint, typecheck, testes e auditoria).
- `vostok/rules/project/security.md`: [project/security-14] (`cargo deny` e `pnpm audit`).
- `vostok/rules/project/testing.md`: [project/testing-02], [project/testing-05] e [project/testing-11] (PostgreSQL em container, Playwright e Lighthouse CI).
- `vostok/rules/project/language.md`: [project/language-07] (glossário pt-br ↔ en).
- `vostok/rules/project/naming-convention.md`: escopo `@atria/` e prefixo `atria-`.
- `../nebula/package.json`, `../nebula/pnpm-workspace.yaml` e `../nebula/Cargo.toml`: referência da estrutura do monorepo.
- `../nebula/LICENSE`: texto integral da AGPL-3.0, a ser copiado.

### Mudar

- `package.json` (criar): raiz privada do workspace pnpm, com `packageManager`, `engines.node >=22` e os scripts `lint`, `typecheck`, `test`, `e2e` e `lhci`.
- `pnpm-workspace.yaml` (criar): pacotes `apps/*` e `packages/*`.
- `Cargo.toml` (criar): Cargo workspace com o membro `apps/server`, `resolver = "3"`, edição 2024 e lints comuns.
- `LICENSE` (criar): texto integral da AGPL-3.0 ([project/stack-10]).
- `.github/workflows/ci.yml` (criar): CI com lint, typecheck, testes, auditoria de dependências, ponta a ponta e Lighthouse CI.
- `lighthouserc.json` (criar): telas principais e notas mínimas de 90 em desempenho, acessibilidade e boas práticas (RNF-05).
- `docs/glossario.md` (criar): glossário pt-br ↔ en dos termos do domínio ([project/language-07]).

### Passos

1. Leia os arquivos de "Ler". Rode o bloco de "Verificação" e confirme que ele falha (nenhum arquivo existe ainda).
2. Crie `package.json`:

   ```json
   {
     "name": "atria",
     "private": true,
     "license": "AGPL-3.0-only",
     "packageManager": "pnpm@11.21.0",
     "engines": { "node": ">=22" },
     "scripts": {
       "lint": "pnpm -r --if-present lint",
       "typecheck": "pnpm -r --if-present typecheck",
       "test": "pnpm -r --if-present test",
       "e2e": "pnpm --filter @atria/web e2e",
       "lhci": "lhci autorun"
     },
     "devDependencies": {
       "@lhci/cli": "^0.15.0"
     }
   }
   ```

   Antes de gravar, confira com `pnpm --version` a versão instalada e use-a em `packageManager`, e com `npm view @lhci/cli version` a versão estável mais recente, usando-a com `^`. Não rode `pnpm install` nesta tarefa: o primeiro pacote do workspace nasce na TASK-03, que gera o `pnpm-lock.yaml`.
3. Crie `pnpm-workspace.yaml`:

   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```

4. Crie `Cargo.toml`:

   ```toml
   [workspace]
   resolver = "3"
   members = ["apps/server"]

   [workspace.package]
   edition = "2024"
   license = "AGPL-3.0-only"
   publish = false

   [workspace.lints.rust]
   unsafe_code = "forbid"

   [workspace.lints.clippy]
   unwrap_used = "deny"
   expect_used = "deny"
   panic = "deny"

   [profile.release]
   lto = "thin"
   strip = true
   ```

   O membro `apps/server` é criado pela TASK-04; até lá, comandos `cargo` na raiz falham, o que é esperado.
5. Copie o texto integral da AGPL-3.0 de `../nebula/LICENSE` para `LICENSE`, sem alterações.
6. Crie `lighthouserc.json`:

   ```json
   {
     "ci": {
       "collect": {
         "startServerCommand": "pnpm --filter @atria/web preview --port 4173 --strictPort",
         "startServerReadyPattern": "Local",
         "numberOfRuns": 1,
         "url": [
           "http://localhost:4173/",
           "http://localhost:4173/finance",
           "http://localhost:4173/goals",
           "http://localhost:4173/tasks",
           "http://localhost:4173/reminders",
           "http://localhost:4173/notes",
           "http://localhost:4173/journal",
           "http://localhost:4173/library",
           "http://localhost:4173/projects",
           "http://localhost:4173/reports",
           "http://localhost:4173/settings"
         ],
         "settings": { "preset": "desktop" }
       },
       "assert": {
         "assertions": {
           "categories:performance": ["error", { "minScore": 0.9 }],
           "categories:accessibility": ["error", { "minScore": 0.9 }],
           "categories:best-practices": ["error", { "minScore": 0.9 }]
         }
       },
       "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
     }
   }
   ```

7. Crie `.github/workflows/ci.yml` com `name: CI`, gatilhos `push` e `pull_request`, `permissions: contents: read`, `concurrency` por branch com `cancel-in-progress: true` e estes jobs, todos em `ubuntu-latest`:
   - `web`: só roda quando houver pacote JS (`if: hashFiles('apps/*/package.json', 'packages/*/package.json') != ''`); passos `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` com `node-version: 22` e `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm audit --audit-level high`.
   - `server`: só roda quando existir `apps/server/Cargo.toml` (`if: hashFiles('apps/server/Cargo.toml') != ''`); passos `actions/checkout@v4`, `dtolnay/rust-toolchain@stable` com `components: rustfmt, clippy`, `Swatinem/rust-cache@v2`, `cargo fmt --all --check`, `cargo clippy -p atria-server --all-targets -- -D warnings`, `cargo test -p atria-server` (os testes de integração usam testcontainers com o Docker do runner, sem serviço declarado no job) e a auditoria com `taiki-e/install-action@v2` (`tool: cargo-deny`) seguido de `cargo deny check advisories`.
   - `e2e`: `needs: [web, server]`, só quando existir `apps/web/package.json`; instala dependências, roda `pnpm --filter @atria/web exec playwright install --with-deps chromium` e `pnpm e2e`.
   - `lighthouse`: `needs: [web]`, só quando existir `apps/web/package.json`; instala dependências, roda `pnpm --filter @atria/web build` e `pnpm lhci`.
   Toda versão de action fica fixada na major (`@v4`, `@v2`), sem `@main`. Nenhum segredo é usado.
8. Crie `docs/glossario.md` com o título `# Glossário do domínio`, um parágrafo dizendo que o código usa os termos em inglês e a interface em português ([project/language-07]), e uma tabela `| Termo (pt-br) | Termo no código (en) | Contexto | Observação |` com, no mínimo, estas linhas: Conta ↔ `Account`; Conta principal ↔ `default account` (`is_default`); Cartão de crédito ↔ `CreditCard`; Fatura ↔ `Statement`; Parcela ↔ `Installment`; Movimentação ↔ `Transaction`; Entrada ↔ `income`; Saída ↔ `expense`; Transferência ↔ `Transfer`; Categoria ↔ `Category`; Recorrência ↔ `Recurrence`; Ocorrência ↔ `Occurrence`; Liquidação ↔ `Settlement`; Economia ↔ `saving`; Ganho ↔ `gain`; Perda ↔ `loss`; Meta ↔ `Goal`; Marco ↔ `Milestone`; Tarefa ↔ `Task`; Lembrete ↔ `Reminder`; Nota ↔ `Note`; Diário ↔ `Journal`; Entrada do diário ↔ `JournalEntry`; Emoção ↔ `Emotion`; Intensidade ↔ `intensity`; Acervo ↔ `Library`; Livro ↔ `Book`; Artigo ↔ `Article`; Vídeo ↔ `Video`; Sessão de leitura ↔ `ReadingSession`; Nota do livro ↔ `BookNote`; Nota do artigo ↔ `ArticleNote`; Posição de leitura ↔ `ReadingPosition`; Destaque ↔ `Highlight`; Modo leitura ↔ `Reader`; Projeto ↔ `Project`; Raia ↔ `Lane`; Cartão do Kanban ↔ `Card`; Ligação ("Conecta com") ↔ `Link`; Conexões ↔ `connections`; Visibilidade ↔ `Visibility`; Pessoal ↔ `personal`; Compartilhada ↔ `shared`; Usuário ↔ `User`; Convite ↔ `Invite`; Papel ↔ `Role` (`admin`, `elevated`, `user`); Assistente de primeira execução ↔ `setup`; Redefinição de senha ↔ `PasswordReset`; Sessão ↔ `Session`; Instância ↔ `Instance`; Preferências ↔ `Preferences`; Busca global ↔ `search`; Contexto da busca ↔ `context`; Paleta de comandos ↔ `CommandPalette`; Relatório ↔ `Report`; Exportação ↔ `Export`; Arquivo ↔ `File`. A coluna "Contexto" usa o nome do contexto do servidor (`finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`, `links`, `auth`, `search`, `reports`, ou `shared`).
9. Rode o bloco de "Verificação" até terminar sem erro.

### Baseline

- `for p in package.json pnpm-workspace.yaml Cargo.toml LICENSE .github/workflows/ci.yml lighthouserc.json docs/glossario.md; do test -e "$p" && echo "$p existe" || echo "$p ausente"; done`

### Verificação

```bash
for p in package.json pnpm-workspace.yaml Cargo.toml LICENSE .github/workflows/ci.yml lighthouserc.json docs/glossario.md; do
  test -s "$p" || { echo "FALHA: $p ausente ou vazio"; exit 1; }
done

# package.json e lighthouserc.json válidos e com o conteúdo esperado.
node -e '
const pkg = require("./package.json");
for (const s of ["lint", "typecheck", "test", "e2e", "lhci"]) if (!pkg.scripts[s]) throw new Error("script ausente: " + s);
if (pkg.private !== true || pkg.license !== "AGPL-3.0-only") throw new Error("private/license");
if (!/^>=\s*22/.test(pkg.engines.node)) throw new Error("engines.node");
const lh = require("./lighthouserc.json");
const a = lh.ci.assert.assertions;
for (const c of ["performance", "accessibility", "best-practices"]) if (a["categories:" + c][1].minScore !== 0.9) throw new Error("minScore " + c);
if (lh.ci.upload.target !== "filesystem") throw new Error("upload externo");
console.log("package.json e lighthouserc.json ok");
'

# YAML e TOML válidos e com o conteúdo esperado.
python3 - <<'EOF'
import tomllib, yaml
ws = yaml.safe_load(open("pnpm-workspace.yaml"))
assert ws["packages"] == ["apps/*", "packages/*"], ws
cargo = tomllib.load(open("Cargo.toml", "rb"))
assert cargo["workspace"]["members"] == ["apps/server"], cargo
assert cargo["workspace"]["package"]["edition"] == "2024"
ci = yaml.safe_load(open(".github/workflows/ci.yml"))
jobs = ci["jobs"]
for job in ("web", "server", "e2e", "lighthouse"):
    assert job in jobs, f"job ausente: {job}"
text = open(".github/workflows/ci.yml").read()
for cmd in ("pnpm lint", "pnpm typecheck", "pnpm test", "pnpm audit --audit-level high",
            "cargo fmt --all --check", "cargo clippy -p atria-server --all-targets -- -D warnings",
            "cargo test -p atria-server", "cargo deny check advisories", "pnpm e2e", "pnpm lhci"):
    assert cmd in text, f"comando ausente na CI: {cmd}"
assert "@main" not in text and "secrets." not in text
print("pnpm-workspace.yaml, Cargo.toml e ci.yml ok")
EOF

# Licença e glossário.
head -1 LICENSE | grep -q "GNU AFFERO GENERAL PUBLIC LICENSE"
cmp -s LICENSE ../nebula/LICENSE
for t in JournalEntry Library Transaction Settlement Statement Installment ReadingSession Highlight Lane Link Visibility Invite; do
  grep -q "\`$t\`" docs/glossario.md || { echo "FALHA: termo ausente no glossário: $t"; exit 1; }
done
echo "verificação da TASK-02 ok"
```

Resultado esperado: código 0 e a última linha `verificação da TASK-02 ok`.

### Evidências

- `ci-jobs.txt` (automática): `python3 -c "import yaml; print('jobs da CI:', ', '.join(yaml.safe_load(open('.github/workflows/ci.yml'))['jobs']))"`
  - Prova: a CI existe com lint, typecheck, testes, auditoria, ponta a ponta e Lighthouse em jobs separados ([project/development-methodology-06], [project/security-14], RNF-05).
  - Trecho: a linha `jobs da CI: web, server, e2e, lighthouse`.
  - Falha: `FileNotFoundError` ou algum job faltando.
- `workspace.txt` (automática): `node -e 'const p=require("./package.json"); console.log("scripts:", Object.keys(p.scripts).join(", "), "| licença:", p.license)'`
  - Prova: a raiz do workspace pnpm tem os scripts comuns e a licença AGPL-3.0.
  - Trecho: a linha `scripts: lint, typecheck, test, e2e, lhci | licença: AGPL-3.0-only`.
  - Falha: `Cannot find module` ou script ausente.
- `glossario.txt` (automática): `echo "termos no glossário: $(grep -cE '^\| [^-|]' docs/glossario.md)"`
  - Prova: o glossário pt-br ↔ en foi criado com os termos do domínio ([project/language-07]).
  - Trecho: a linha `termos no glossário: N`, com N de pelo menos 58 (as linhas de termo mais o cabeçalho da tabela).
  - Falha: `termos no glossário: ` sem número (arquivo inexistente) ou número menor que 58.

### Concluída quando

- [x] O monorepo tem a raiz pnpm (`apps/*` e `packages/*`) e o Cargo workspace com `apps/server`, edição 2024 e `unsafe_code` proibido ([project/architecture-01]).

  > Como comprovar: rodar a "Verificação" e ver `pnpm-workspace.yaml, Cargo.toml e ci.yml ok`; em `workspace.txt`, ver os cinco scripts.

- [x] A CI roda lint, typecheck, testes, `pnpm audit`, `cargo deny`, testes ponta a ponta e Lighthouse CI, cada job só quando o código dele existe ([project/development-methodology-06], [project/security-14]).

  > Como comprovar: abrir `ci-jobs.txt` e ver `jobs da CI: web, server, e2e, lighthouse`; a "Verificação" confere cada comando no arquivo.

- [x] O Lighthouse CI exige pelo menos 90 em desempenho, acessibilidade e boas práticas nas telas principais, sem envio de relatório para fora (RNF-05).

  > Como comprovar: abrir `lighthouserc.json` e ver `minScore: 0.9` nas três categorias e `upload.target: filesystem`.

- [x] O repositório tem a licença AGPL-3.0 em texto integral ([project/stack-10]).

  > Como comprovar: a primeira linha de `LICENSE` é `GNU AFFERO GENERAL PUBLIC LICENSE` e a "Verificação" confere que o texto é igual ao do Nebula.

- [x] O glossário pt-br ↔ en cobre os termos do domínio de todos os contextos ([project/language-07]).

  > Como comprovar: abrir `docs/glossario.md` e achar, por exemplo, Diário ↔ `JournalEntry`, Acervo ↔ `Library` e Movimentação ↔ `Transaction`; `glossario.txt` mostra pelo menos 58 linhas na tabela.

## Descrição

### Resumo executivo

Cria a estrutura do repositório do Atria: a organização dos projetos, a licença aberta, o glossário dos termos do produto e a esteira automática de qualidade.
A esteira barra qualquer mudança que quebre o código, os testes, a segurança das dependências ou a nota mínima de qualidade das telas.
Perfil de execução padrao: arquivos de configuração com decisões locais já tomadas.
Risco baixo; a esteira só passa a rodar cada parte quando o código dela existir.
Desbloqueia o tema e a biblioteca de componentes (TASK-03) e o núcleo do servidor (TASK-04).

### Detalhes técnicos

**Abordagem.** Arquivos de configuração na raiz, seguindo a estrutura do Nebula ([project/architecture-01]): workspace pnpm com `apps/*` e `packages/*`, Cargo workspace com o único crate `atria-server` (`apps/server`, criado pela TASK-04), CI no GitHub Actions e a configuração do Lighthouse CI que a TASK-35 executa.

**Componentes.** `package.json`, `pnpm-workspace.yaml`, `Cargo.toml`, `LICENSE`, `.github/workflows/ci.yml`, `lighthouserc.json` e `docs/glossario.md`.

**Decisões.**
- Scripts da raiz com `pnpm -r --if-present`: cada pacote declara os próprios `lint`, `typecheck` e `test`, e a raiz só orquestra. Descartado: ESLint, Prettier e Vitest configurados na raiz, porque cada pacote tem ambiente de teste diferente (jsdom no frontend, nenhum no tema).
- Membro `apps/server` explícito no Cargo workspace. Descartado: glob `apps/*`, que falharia ao encontrar `apps/web` sem `Cargo.toml`.
- Jobs da CI condicionados a `hashFiles(...)`: a esteira fica verde enquanto o monorepo é construído tarefa a tarefa. Descartado: jobs sempre ativos, que deixariam a CI vermelha até a TASK-05.
- Testes de integração do servidor com testcontainers usando o Docker do runner ([project/testing-02]). Descartado: `services: postgres` no job, que duplicaria a forma de subir o banco entre a máquina local e a CI.
- `cargo deny check advisories` em vez de `cargo deny check` completo: [project/security-14] trata de vulnerabilidades, e a checagem de licenças exigiria um `deny.toml`, que não está entre os componentes da spec. Descartado: `cargo audit`, porque a regra cita o `cargo deny`.
- Lighthouse sobre o `vite preview` do frontend compilado, com `upload.target: filesystem`. Descartado: `temporary-public-storage`, que envia relatórios para um serviço externo ([project/architecture-12]).
- Dependência nova `@lhci/cli` (devDependency da raiz), justificada por [project/testing-11] e RNF-05: é a ferramenta oficial do Lighthouse CI.
- Sem `pnpm install` nesta tarefa: o `pnpm-lock.yaml` é gerado na primeira instalação, na TASK-03, e o `Cargo.lock` no primeiro build, na TASK-04; ambos são artefatos gerados pelas ferramentas.

**Riscos técnicos.** As URLs do `lighthouserc.json` assumem as rotas `/<feature>` do frontend; a TASK-35, que roda o Lighthouse, as confirma ao registrar as rotas. As telas autenticadas dependem de sessão no momento da coleta, tratado pela TASK-35.

**Referências da spec.** RNF-05; componentes afetados; decisões 53 a 56 e 60. A tarefa não cobre RF nem CT (coluna "Cobre" vazia).

**Arquivos em comum na onda 2.** Nenhum: a tarefa está sozinha na onda.

### Card

- **Título:** Monorepo e CI
- **Tipo:** tarefa
- **Descrição:** Estrutura do monorepo do Atria (pnpm e Cargo), licença AGPL-3.0, glossário pt-br ↔ en do domínio e CI com lint, typecheck, testes, auditoria, ponta a ponta e Lighthouse.
- **Critérios de aceite:**
  - [ ] Workspaces pnpm e Cargo criados na raiz.
  - [ ] CI com lint, typecheck, testes, auditoria de dependências, ponta a ponta e Lighthouse.
  - [ ] Lighthouse CI com nota mínima de 90 em desempenho, acessibilidade e boas práticas.
  - [ ] Licença AGPL-3.0 e glossário do domínio no repositório.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-01

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: Usuário aceitou [1]: os 7 arquivos são a entrega da tarefa; aceito(s): 1 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | passed | 3 evidência(s) em evidence/TASK-02/ |
| 9 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
