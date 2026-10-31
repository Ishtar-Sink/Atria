---
id: TASK-36
spec: SPEC-001
title: "Autohospedagem"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04, TASK-05]
wave: 5
covers: []
type: tarefa
labels: [SPEC-001, julgamento]
status: done
content_hash: dcd3a917a18a33fd5c7b2b977cc7fa257599f348dc4c093a7363ba34714721c1
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: b8b5d62afb239d49198e9715f1f8692d43608e35d25eecd7ff4252cda818005b
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
---

# TASK-36: Autohospedagem

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RNF-07, variáveis de ambiente do contrato, fluxo principal (passo 1), premissas (Web Push e SMTP opcionais, oEmbed com internet) e o risco de perda da chave de criptografia.
- `vostok/rules/project/self-hosting.md`: [project/self-hosting-01] a [project/self-hosting-07].
- `vostok/rules/project/security.md`: [project/security-12] (segredos só por variável ou arquivo) e [project/security-18] (chave fora do banco).
- `vostok/rules/project/architecture.md`: [project/architecture-12] (nada externo obrigatório).
- `apps/server/Cargo.toml`, `apps/server/src/main.rs` e `apps/server/src/http/config.rs`: subcomandos `serve` e `migrate`, variáveis `ATRIA_`, padrões e leitura de segredos de arquivo (TASK-04).
- `apps/server/src/http/healthz.rs` e `apps/server/src/http/static_files.rs`: `/healthz` e o frontend embutido de `apps/web/dist` (TASK-04).
- `apps/web/package.json` e `apps/web/vite.config.ts`: script `build` e saída em `apps/web/dist` (TASK-05).
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` e `Cargo.toml`: workspaces e versões de Node e pnpm (TASK-02).
- `../translunar/deploy/caddyfile-translunar`: referência do exemplo de proxy reverso.

### Mudar

- `Dockerfile` (criar): imagem oficial em três estágios (build do frontend, build do servidor com o frontend embutido e execução), rodando sem root ([project/self-hosting-01]).
- `docker-compose.yml` (criar): instalação de referência com o app e o PostgreSQL, rede interna para o banco, volumes e a chave como segredo em arquivo.
- `.env.example` (criar): todas as variáveis `ATRIA_` e as do PostgreSQL, com padrões seguros e comentários ([project/self-hosting-03]).
- `deploy/caddyfile-atria` (criar): exemplo de proxy reverso Caddy com TLS terminado fora do app ([project/self-hosting-04]).
- `docs/self-hosting.md` (criar): guia em pt-br de instalação, configuração, proxy, atualização, backup e restauração do banco, dos arquivos e da chave ([project/self-hosting-07]).

### Passos

1. Leia os arquivos de "Ler". Confirme com `docker version` e `docker compose version` que o Docker Engine e o Compose v2.24 ou superior estão disponíveis. Rode o bloco de "Verificação" e confirme que ele falha.
2. Escolha as imagens base com a versão fixada (sem `latest`), conferindo as tags atuais no Docker Hub: `node:22.<minor>-bookworm-slim`, `rust:1.<minor>-bookworm`, `debian:bookworm-slim` e `postgres:17.<minor>-alpine`. Use a mesma major de Node de `package.json` (`engines`) e a versão de pnpm de `packageManager`.
3. Crie `Dockerfile` com `# syntax=docker/dockerfile:1` e três estágios:
   - `web` (`node:22...-bookworm-slim`): `WORKDIR /src`; `corepack enable`; copie `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/web/package.json`, `packages/theme/package.json`, `packages/ui/package.json` e, se existir no momento da execução, `packages/contracts/package.json`, cada um no mesmo caminho; `pnpm install --frozen-lockfile`; copie `apps/web` e `packages`; `pnpm --filter @atria/web build`.
   - `server` (`rust:1...-bookworm`): `WORKDIR /src`; copie `Cargo.toml`, `Cargo.lock` e `apps/server`; `COPY --from=web /src/apps/web/dist apps/web/dist` (o `rust-embed` da TASK-04 embute essa pasta); `ENV SQLX_OFFLINE=true`; `cargo build --release --locked -p atria-server`, com `--mount=type=cache` em `/usr/local/cargo/registry` e em `/src/target`, copiando o binário para `/out/atria-server`.
   - `runtime` (`debian:bookworm-slim`): `apt-get install --no-install-recommends -y ca-certificates curl` e limpeza de `/var/lib/apt/lists`; `useradd --system --uid 10001 --home-dir /nonexistent --shell /usr/sbin/nologin atria`; `mkdir -p /data/files && chown 10001:10001 /data/files`; `COPY --from=server /out/atria-server /usr/local/bin/atria-server`; `ENV ATRIA_BIND_ADDRESS=0.0.0.0:8080 ATRIA_STORAGE_PATH=/data/files ATRIA_LOG_LEVEL=info`; `VOLUME /data/files`; `EXPOSE 8080`; `USER 10001:10001`; `HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1`; `ENTRYPOINT ["atria-server"]`; `CMD ["serve"]`. Rótulos OCI `org.opencontainers.image.title="Atria"` e `org.opencontainers.image.licenses="AGPL-3.0-only"`.
4. Crie `docker-compose.yml` sem a chave `version`, com:
   - `services.db`: imagem `postgres:17...-alpine`; `environment` `POSTGRES_DB: ${POSTGRES_DB:-atria}`, `POSTGRES_USER: ${POSTGRES_USER:-atria}` e `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no .env}`; volume `db-data:/var/lib/postgresql/data`; `healthcheck` com `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`; só na rede `backend`; `restart: unless-stopped`.
   - `services.app`: `build: .` e `image: atria:local`; `depends_on: db: condition: service_healthy`; `environment` com cada variável `ATRIA_` do contrato interpolada do `.env` (`ATRIA_DATABASE_URL: ${ATRIA_DATABASE_URL:?...}`, `ATRIA_PUBLIC_URL: ${ATRIA_PUBLIC_URL:?...}`, `ATRIA_ENCRYPTION_KEY_FILE: /run/secrets/atria_key`, `ATRIA_STORAGE_PATH: /data/files`, `ATRIA_TRUSTED_PROXIES: ${ATRIA_TRUSTED_PROXIES:-}`, `ATRIA_LOG_LEVEL: ${ATRIA_LOG_LEVEL:-info}` e as de SMTP e Web Push com padrão vazio); `secrets: [atria_key]`; volume `files:/data/files`; `ports: ["127.0.0.1:${ATRIA_HOST_PORT:-8080}:8080"]` (só no host local, para o proxy); `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`; redes `backend` e `edge`; `restart: unless-stopped`.
   - `secrets.atria_key.file: ${ATRIA_KEY_PATH:-./secrets/atria_key}`.
   - `volumes`: `db-data` e `files`.
   - `networks`: `backend` com `internal: true` (o banco nunca fala com fora) e `edge` (publica a porta do app).
   Um comentário no topo diz que o app sobe e aplica as migrações sozinho ([project/self-hosting-06]).
5. Crie `.env.example`, em pt-br nos comentários, com um bloco por grupo: PostgreSQL (`POSTGRES_DB=atria`, `POSTGRES_USER=atria`, `POSTGRES_PASSWORD=troque-esta-senha`); obrigatórias (`ATRIA_DATABASE_URL=postgres://atria:troque-esta-senha@db:5432/atria`, `ATRIA_PUBLIC_URL=https://atria.example.com`); chave (`ATRIA_KEY_PATH=./secrets/atria_key`, com o comando `openssl rand -base64 32 > secrets/atria_key` e o aviso de que sem ela o diário e as notas ficam ilegíveis); rede (`ATRIA_HOST_PORT=8080`, `ATRIA_TRUSTED_PROXIES=` com o exemplo `172.16.0.0/12` para o gateway do Docker); logs (`ATRIA_LOG_LEVEL=info`); opcionais (`ATRIA_SMTP_HOST=`, `ATRIA_SMTP_PORT=587`, `ATRIA_SMTP_USER=`, `ATRIA_SMTP_PASSWORD_FILE=`, `ATRIA_SMTP_FROM=`, `ATRIA_WEB_PUSH_VAPID_KEY_FILE=`). `ATRIA_BIND_ADDRESS`, `ATRIA_ENCRYPTION_KEY_FILE` e `ATRIA_STORAGE_PATH` aparecem comentadas, explicando que o `docker-compose.yml` já as define. Nenhum segredo real.
6. Crie `deploy/caddyfile-atria`, com comentário no topo no estilo de `../translunar/deploy/caddyfile-translunar`: um bloco `atria.example.com` com `encode zstd gzip` e `reverse_proxy 127.0.0.1:8080`, e um segundo bloco comentado para rede interna sem domínio público (`atria.local` com `tls internal`). Explique nos comentários que o Caddy envia `X-Forwarded-For` e `X-Forwarded-Proto` e que o endereço de onde ele conecta precisa estar em `ATRIA_TRUSTED_PROXIES`.
7. Crie `docs/self-hosting.md` em pt-br com as seções `## Requisitos`, `## Instalação`, `## Configuração` (tabela com cada variável do `.env.example`: nome, obrigatória ou não, padrão e o que faz), `## Chave de criptografia`, `## Proxy reverso e TLS`, `## Rede interna sem internet` (o que funciona sem internet e o que fica desligado: Web Push e a miniatura automática dos vídeos, que passa a ser enviada à mão, e o SMTP, que sem servidor de e-mail deixa a recuperação de senha com o admin), `## Primeiro acesso` (o assistente cria o admin e exige o 2FA), `## Atualização` (`docker compose pull` ou `build`, `docker compose up -d`; as migrações rodam na subida, ou à parte com `docker compose run --rm app migrate`; fazer backup antes), `## Backup` (banco com `docker compose exec -T db pg_dump -U atria -Fc atria > atria.dump`; arquivos com `docker run --rm -v <projeto>_files:/data -v "$PWD":/backup debian:bookworm-slim tar czf /backup/atria-files.tar.gz -C /data .`; a chave `secrets/atria_key` guardada em lugar separado do backup do banco), `## Restauração` (subir só o `db`, `pg_restore --clean --if-exists`, restaurar o volume `files`, recolocar a chave e subir o `app`), `## Saúde e logs` (`/healthz`, `docker compose logs app`, logs em JSON sem conteúdo pessoal) e `## Solução de problemas`.
8. Rode `docker compose --env-file .env.example config --quiet` e corrija até passar; depois rode o bloco de "Verificação" até terminar sem erro. Se o build do servidor falhar por falta dos dados offline do `sqlx` (`SQLX_OFFLINE`), **PARE** e registre o bloqueio: os dados são gerados na integração do servidor (TASK-18), fora desta tarefa.

### Baseline

- `for p in Dockerfile docker-compose.yml .env.example deploy/caddyfile-atria docs/self-hosting.md; do test -e "$p" && echo "$p existe" || echo "$p ausente"; done`

### Verificação

```bash
for p in Dockerfile docker-compose.yml .env.example deploy/caddyfile-atria docs/self-hosting.md; do
  test -s "$p" || { echo "FALHA: $p ausente ou vazio"; exit 1; }
done

# .env.example cobre todas as variáveis ATRIA_ do contrato da spec.
for v in DATABASE_URL BIND_ADDRESS PUBLIC_URL ENCRYPTION_KEY_FILE STORAGE_PATH TRUSTED_PROXIES LOG_LEVEL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD_FILE SMTP_FROM WEB_PUSH_VAPID_KEY_FILE; do
  grep -qE "^#? ?ATRIA_$v=" .env.example || { echo "FALHA: ATRIA_$v ausente no .env.example"; exit 1; }
done
if grep -nE "FROM [^ ]+:latest|FROM [a-z/]+( |$)" Dockerfile; then echo "FALHA: imagem base sem versão fixada"; exit 1; fi

# Guia com backup e restauração do banco, dos arquivos e da chave.
for s in "## Instalação" "## Chave de criptografia" "## Proxy reverso e TLS" "## Rede interna sem internet" "## Atualização" "## Backup" "## Restauração"; do
  grep -q "^$s" docs/self-hosting.md || { echo "FALHA: seção ausente: $s"; exit 1; }
done
grep -q "pg_dump" docs/self-hosting.md
grep -q "atria_key" docs/self-hosting.md

# Compose válido, imagem sem root.
docker compose --env-file .env.example config --quiet
docker build -t atria:verify .
test "$(docker image inspect -f '{{.Config.User}}' atria:verify)" = "10001:10001"

# Sobe app + PostgreSQL com todas as redes internas (sem saída para a internet) e confere a saúde.
tmp=$(mktemp -d)
openssl rand -base64 32 > "$tmp/atria_key"
export ATRIA_KEY_PATH="$tmp/atria_key"
trap 'docker compose -p atria-verify --env-file .env.example down -v >/dev/null 2>&1; rm -rf "$tmp"' EXIT
docker compose -p atria-verify --env-file .env.example -f docker-compose.yml -f - up -d --build --wait <<'EOF'
networks:
  edge:
    internal: true
EOF
docker compose -p atria-verify --env-file .env.example exec -T app curl -fsS http://127.0.0.1:8080/healthz | grep -q '"database":"ok"'
docker compose -p atria-verify --env-file .env.example exec -T app sh -c 'test "$(id -u)" = 10001'
if docker compose -p atria-verify --env-file .env.example exec -T app curl -fsS --max-time 5 https://example.com >/dev/null 2>&1; then
  echo "FALHA: o app alcançou a internet na verificação"; exit 1
fi
echo "verificação da TASK-36 ok"
```

Resultado esperado: código 0 e a última linha `verificação da TASK-36 ok`; os containers de verificação são removidos no fim.

### Evidências

- `imagem.txt` (automática): `docker image inspect -f 'usuario={{.Config.User}} entrypoint={{json .Config.Entrypoint}} cmd={{json .Config.Cmd}} healthcheck={{json .Config.Healthcheck.Test}}' atria:verify`
  - Prova: a imagem oficial roda sem root, com o binário do servidor como entrada e o `/healthz` como checagem de saúde ([project/self-hosting-01], [project/self-hosting-05]).
  - Trecho: `usuario=10001:10001 entrypoint=["atria-server"] cmd=["serve"]` e o `curl -fsS http://127.0.0.1:8080/healthz` no healthcheck.
  - Falha: `Error: No such image: atria:verify`, usuário vazio ou `root`.
- `compose-servicos.txt` (automática): `docker compose --env-file .env.example config --services | sort`
  - Prova: a instalação de referência tem só o app e o PostgreSQL ([project/self-hosting-01], [project/self-hosting-02]).
  - Trecho: as duas linhas `app` e `db`, nada mais.
  - Falha: erro `no configuration file provided` ou serviço a mais.
- `guia-secoes.txt` (automática): `grep -E '^## ' docs/self-hosting.md`
  - Prova: o guia cobre instalação, configuração, chave, proxy, rede sem internet, atualização, backup e restauração ([project/self-hosting-07]).
  - Trecho: as linhas `## Instalação`, `## Chave de criptografia`, `## Rede interna sem internet`, `## Backup` e `## Restauração`.
  - Falha: `No such file or directory` ou seção faltando.

### Concluída quando

- [x] A imagem Docker oficial roda sem root, com o frontend compilado embutido no mesmo processo do servidor e a checagem de saúde no `/healthz` ([project/self-hosting-01], [project/self-hosting-02], [project/self-hosting-05]).

  > Como comprovar: abrir `imagem.txt` e ver `usuario=10001:10001`, `entrypoint=["atria-server"]` e o healthcheck com `/healthz`.

- [x] O `docker-compose.yml` de referência sobe só o app e o PostgreSQL e funciona numa rede sem saída para a internet (RNF-07).

  > Como comprovar: rodar a "Verificação" e ver `verificação da TASK-36 ok`: ela sobe os dois serviços com todas as redes internas, recebe `"database":"ok"` do `/healthz` e confirma que o app não alcança a internet; `compose-servicos.txt` mostra só `app` e `db`.

- [x] Toda configuração é feita por variáveis `ATRIA_`, documentadas no `.env.example` com padrões seguros, e a chave de criptografia é um segredo em arquivo, fora do banco e do repositório ([project/self-hosting-03], [project/security-12], [project/security-18]).

  > Como comprovar: a "Verificação" confere as treze variáveis do contrato no `.env.example`; abrir o `docker-compose.yml` e ver a chave em `secrets`, montada em `/run/secrets/atria_key`.

- [x] O exemplo de proxy reverso termina o TLS fora do app e explica como liberar o proxy em `ATRIA_TRUSTED_PROXIES` ([project/self-hosting-04]).

  > Como comprovar: abrir `deploy/caddyfile-atria` e ver o `reverse_proxy 127.0.0.1:8080` e o comentário sobre `ATRIA_TRUSTED_PROXIES`.

- [x] O guia ensina a instalar, atualizar sem perder dados e fazer backup e restauração do banco, dos arquivos e da chave ([project/self-hosting-06], [project/self-hosting-07]).

  > Como comprovar: em `guia-secoes.txt`, ver as seções de atualização, backup e restauração; no guia, ver o `pg_dump`, o backup do volume de arquivos e a chave guardada à parte.

## Descrição

### Resumo executivo

Empacota o Atria para que qualquer pessoa o instale no próprio computador ou servidor com poucos comandos, inclusive numa rede sem internet.
Inclui a instalação de referência, o exemplo de acesso seguro pela internet e o guia de instalação, atualização, cópia de segurança e restauração.
Perfil de execução julgamento: escolhas de empacotamento e de segurança que afetam toda instalação.
Risco alto: perder a chave de criptografia torna o diário e as notas ilegíveis, por isso o guia trata a chave como parte obrigatória do backup.
Depende do núcleo do servidor e da base do frontend (TASK-04 e TASK-05) e não bloqueia outras tarefas.

### Detalhes técnicos

**Abordagem.** Imagem em três estágios: o frontend é compilado com pnpm, embutido no binário Rust pelo `rust-embed` da TASK-04 e executado numa imagem enxuta, sem root. O `docker-compose.yml` sobe o app e o PostgreSQL, com o banco numa rede interna, a chave como segredo em arquivo e os arquivos num volume. A configuração é toda por variáveis `ATRIA_` interpoladas do `.env`.

**Componentes.** `Dockerfile`, `docker-compose.yml`, `.env.example`, `deploy/caddyfile-atria` e `docs/self-hosting.md`.

**Decisões e critérios.** Critérios: superfície de ataque, funcionamento sem internet ([project/architecture-12]), simplicidade para quem hospeda e nenhuma perda de dados na atualização.

| Tema | Escolha | Alternativas descartadas | Motivo |
|---|---|---|---|
| Imagem de execução | `debian:bookworm-slim` com `ca-certificates` e `curl`, usuário 10001 | `distroless/cc` (sem shell nem `curl`, o healthcheck exigiria um subcomando novo no servidor, que esta tarefa não altera); `alpine` com musl (build Rust mais lento e diferenças de alocador e DNS) | Healthcheck simples e glibc igual à do build, com pouca superfície. |
| Frontend | Embutido no binário (TASK-04) | Container do Nginx para os estáticos | Um único processo além do banco ([project/self-hosting-02]). |
| Chave de criptografia | `secrets` do Compose em `/run/secrets/atria_key`, caminho de origem em `ATRIA_KEY_PATH` | Chave em variável de ambiente (aparece em `docker inspect`); chave dentro do volume do banco (o backup do banco levaria a chave junto) | Segredo em arquivo e separado do banco ([project/security-12], [project/security-18]). |
| Rede | `backend` interna para o banco e `edge` só para publicar a porta, presa a `127.0.0.1` | Porta do banco publicada; porta do app em `0.0.0.0` | O banco nunca fica exposto e o acesso de fora passa pelo proxy com TLS. |
| Endurecimento do container | `read_only`, `tmpfs /tmp`, `cap_drop: ALL` e `no-new-privileges` | Padrão do Docker | O app só escreve em `/data/files`. |
| Migrações | Na subida do `serve` e à parte com `migrate` (TASK-04) | Container de migração separado | Atualizar é só subir a versão nova, com backup antes ([project/self-hosting-06]). |
| Proxy de exemplo | Caddy, como no Translunar | Nginx e Traefik | TLS automático e o mesmo padrão já usado no ecossistema. |
| Backup | `pg_dump -Fc` do banco, `tar` do volume de arquivos e a chave guardada à parte | Cópia da pasta de dados do PostgreSQL com o banco ligado | Backup consistente sem parar o serviço, restaurável em outra versão do PostgreSQL. |

**Riscos técnicos.** O build da imagem usa `SQLX_OFFLINE=true` e depende dos dados offline do `sqlx` (`.sqlx`), gerados na integração do servidor (TASK-18); se eles ainda não existirem, a verificação para no build e o bloqueio é registrado. A verificação baixa as imagens base e compila o servidor, o que leva vários minutos. Atrás do proxy em Docker, o endereço de onde o proxy conecta é o gateway da rede, que precisa estar em `ATRIA_TRUSTED_PROXIES`, explicado no guia. Perder a chave torna o diário e as notas ilegíveis (risco da spec), por isso ela entra no procedimento de backup.

**Referências da spec.** RNF-07; contrato das variáveis `ATRIA_`; fluxo principal (passo 1); premissas de Web Push, SMTP e oEmbed opcionais; risco de perda da chave. A tarefa não cobre RF nem CT (coluna "Cobre" vazia).

**Arquivos em comum na onda 5.** Nenhum: TASK-16 e TASK-17, da mesma onda, só mexem em `apps/server/src/search` e `apps/server/src/reports`.

### Card

- **Título:** Autohospedagem
- **Tipo:** tarefa
- **Descrição:** Imagem Docker oficial sem root, `docker-compose.yml` de referência com o app e o PostgreSQL, `.env.example`, exemplo de proxy reverso com TLS e o guia de instalação, atualização, backup e restauração.
- **Critérios de aceite:**
  - [ ] Imagem oficial roda sem root, com o frontend embutido e checagem de saúde.
  - [ ] Instalação de referência sobe só o app e o PostgreSQL e funciona sem internet.
  - [ ] Configuração toda por variáveis `ATRIA_`, com a chave como segredo em arquivo.
  - [ ] Exemplo de proxy reverso com TLS.
  - [ ] Guia de instalação, atualização, backup e restauração, incluindo a chave.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04, TASK-05

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-31 | regressão | passed | 0 comando(s) iguais ao baseline; 1 ignorado(s) por medir a entrega |
| 5 | 2026-10-31 | evidências | passed | 3 evidência(s) em evidence/TASK-36/ |
| 6 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
