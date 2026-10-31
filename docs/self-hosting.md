# Autohospedagem do Atria

Este guia instala o Atria numa máquina própria com Docker: só o app e o PostgreSQL, atrás de um proxy reverso com TLS, funcionando inclusive numa rede interna sem internet.

## Requisitos

- Linux com Docker Engine e Docker Compose v2.24 ou superior (`docker compose version`).
- 1 GB de memória livre e espaço em disco para o banco e os arquivos (PDFs e capas).
- Um proxy reverso com TLS, como o Caddy (exemplo em `deploy/caddyfile-atria`).
- `openssl`, para gerar a chave de criptografia.
- Para compilar a imagem: acesso à internet durante o `docker compose build`, para baixar as dependências. Depois de pronta, a imagem roda sem internet.

## Instalação

1. Copie o repositório para o servidor e entre na pasta dele.
2. Crie o arquivo de configuração e edite os valores marcados com "troque":

   ```bash
   cp .env.example .env
   ```

3. Gere a chave de criptografia (veja [Chave de criptografia](#chave-de-criptografia)):

   ```bash
   mkdir -p secrets
   openssl rand -base64 32 > secrets/atria_key
   chmod 644 secrets/atria_key
   ```

4. Compile a imagem e suba os serviços:

   ```bash
   docker compose build
   docker compose up -d
   ```

5. Confira a saúde: `curl -fsS http://127.0.0.1:8080/healthz` deve responder com `"database":"ok"`.
6. Configure o proxy reverso (veja [Proxy reverso e TLS](#proxy-reverso-e-tls)) e acesse o endereço de `ATRIA_PUBLIC_URL`.

O app aplica as migrações do banco sozinho a cada subida.

## Configuração

Toda a configuração fica no `.env`, lido pelo `docker-compose.yml`. Segredos nunca vão no `.env` diretamente: a chave e as senhas ficam em arquivos.

| Variável | Obrigatória | Padrão | O que faz |
|---|---|---|---|
| `POSTGRES_DB` | não | `atria` | Nome do banco criado na primeira subida do serviço `db`. |
| `POSTGRES_USER` | não | `atria` | Usuário do banco. |
| `POSTGRES_PASSWORD` | sim | - | Senha do banco; o compose recusa subir sem ela. |
| `ATRIA_DATABASE_URL` | sim | - | Conexão do app com o banco, com a mesma senha de `POSTGRES_PASSWORD` e o host `db`. |
| `ATRIA_PUBLIC_URL` | sim | - | Endereço público do Atria. Com `https://`, o cookie leva `Secure` e as respostas, HSTS. |
| `ATRIA_KEY_PATH` | não | `./secrets/atria_key` | Arquivo no host com a chave de criptografia, montado como segredo em `/run/secrets/atria_key`. |
| `ATRIA_HOST_PORT` | não | `8080` | Porta do app no host, publicada só em `127.0.0.1`. |
| `ATRIA_TRUSTED_PROXIES` | não | vazio | Proxies (CIDR ou IP, separados por vírgula) cujos cabeçalhos `X-Forwarded-*` são aceitos. Vazio: nenhum. |
| `ATRIA_LOG_LEVEL` | não | `info` | Nível dos logs: `error`, `warn`, `info`, `debug` ou `trace`. |
| `ATRIA_SMTP_HOST` | não | vazio | Servidor de e-mail. Vazio: e-mail desligado. |
| `ATRIA_SMTP_PORT` | não | `587` | Porta do servidor de e-mail. |
| `ATRIA_SMTP_USER` | não | vazio | Usuário do servidor de e-mail. |
| `ATRIA_SMTP_PASSWORD_FILE` | não | vazio | Caminho, dentro do container, do arquivo com a senha do SMTP. |
| `ATRIA_SMTP_FROM` | não | vazio | Remetente dos e-mails. |
| `ATRIA_WEB_PUSH_VAPID_KEY_FILE` | não | vazio | Caminho, dentro do container, do arquivo com a chave VAPID do Web Push. Vazio: Web Push desligado. |
| `ATRIA_BIND_ADDRESS` | não | `0.0.0.0:8080` | Endereço em que o app escuta dentro do container; já definido pela imagem. |
| `ATRIA_ENCRYPTION_KEY_FILE` | não | `/run/secrets/atria_key` | Caminho da chave dentro do container; já definido pelo compose. |
| `ATRIA_STORAGE_PATH` | não | `/data/files` | Pasta dos arquivos enviados, no volume `files`; já definida pelo compose. |

Para usar a senha do SMTP ou a chave VAPID, monte o arquivo no serviço `app` (por exemplo, como mais um item de `secrets`) e aponte a variável para o caminho dentro do container.

## Chave de criptografia

O diário e as notas são criptografados em repouso com a chave de `secrets/atria_key`, que fica fora do banco e fora do repositório.

- Gere a chave uma única vez, antes da primeira subida: `openssl rand -base64 32 > secrets/atria_key`.
- **Sem a chave, o diário e as notas ficam ilegíveis para sempre**, mesmo com o backup do banco em mãos. Não existe recuperação.
- Guarde uma cópia da chave fora do servidor e separada do backup do banco (um gerenciador de senhas ou um pendrive guardado à parte). Quem tem o backup do banco e a chave juntos lê tudo.
- Nunca troque a chave de uma instalação com dados: o conteúdo cifrado com a antiga deixa de abrir.
- O container lê a chave como o usuário `10001`: o arquivo precisa ser legível por ele (`chmod 644 secrets/atria_key`, com a pasta `secrets` acessível só a quem administra o servidor).

## Proxy reverso e TLS

O app não termina TLS: ele escuta em `127.0.0.1:${ATRIA_HOST_PORT}` e o proxy reverso recebe o HTTPS de fora.

1. Instale o Caddy no host e importe `deploy/caddyfile-atria` no seu `Caddyfile`, trocando `atria.example.com` pelo domínio de `ATRIA_PUBLIC_URL`.
2. O Caddy envia `X-Forwarded-For` e `X-Forwarded-Proto`. O app só aceita esses cabeçalhos de quem estiver em `ATRIA_TRUSTED_PROXIES`. Com o Caddy no host, a conexão chega ao container pelo gateway da rede do Docker: use `ATRIA_TRUSTED_PROXIES=172.16.0.0/12` (ou a faixa exata mostrada por `docker network inspect <projeto>_edge`).
3. Rode `docker compose up -d` de novo depois de mudar o `.env`.

Outro proxy (nginx, Traefik) funciona do mesmo jeito: TLS no proxy, `proxy_pass` para `127.0.0.1:8080` e o endereço do proxy em `ATRIA_TRUSTED_PROXIES`.

## Rede interna sem internet

O Atria não depende de nenhum serviço externo: tudo funciona numa rede sem saída para a internet, com só o app e o PostgreSQL. O banco fica na rede `backend`, marcada como interna, e nunca fala com fora.

O que fica desligado ou muda sem internet:

- **Web Push:** depende do serviço de push do navegador, fora da rede. Os lembretes continuam aparecendo como notificação dentro do app, com a aba aberta.
- **Miniatura automática dos vídeos:** vem do oEmbed do site do vídeo. Sem internet, a miniatura é enviada à mão.
- **E-mail:** sem um servidor SMTP alcançável, nenhum e-mail sai; a recuperação de senha passa a ser um link de uso único gerado pelo admin.

Na rede interna, use um certificado próprio no proxy (o bloco `atria.local` com `tls internal` em `deploy/caddyfile-atria`).

## Primeiro acesso

Na primeira visita, o assistente de configuração cria a conta de admin. O admin é obrigado a configurar o 2FA por TOTP antes de continuar; depois disso, convida as outras pessoas pelas configurações da instância.

## Atualização

Atualizar nunca perde dados: as migrações são versionadas e só acrescentam.

1. Faça um backup antes (veja [Backup](#backup)).
2. Atualize o código (`git pull`) e recompile a imagem com `docker compose build`, ou, se usar uma imagem publicada, `docker compose pull`.
3. Suba de novo: `docker compose up -d`. As migrações rodam na subida.
4. Para aplicar as migrações à parte, antes de subir: `docker compose run --rm app migrate`.
5. Confira `/healthz` e `docker compose logs app`.

## Backup

Um backup completo tem três partes, guardadas em lugares diferentes: o banco, os arquivos e a chave.

- **Banco:**

  ```bash
  docker compose exec -T db pg_dump -U atria -Fc atria > atria.dump
  ```

- **Arquivos** (volume `files`, com PDFs e capas; troque `<projeto>` pelo nome do projeto do compose, por padrão o nome da pasta):

  ```bash
  docker run --rm -v <projeto>_files:/data -v "$PWD":/backup debian:bookworm-slim tar czf /backup/atria-files.tar.gz -C /data .
  ```

- **Chave:** `secrets/atria_key`, guardada em lugar separado do backup do banco (veja [Chave de criptografia](#chave-de-criptografia)).

Agende o backup do banco e dos arquivos (por exemplo, com `cron`) e teste a restauração de tempos em tempos.

## Restauração

1. Pare o app: `docker compose stop app`.
2. Recoloque a chave em `secrets/atria_key` (a mesma da época do backup).
3. Suba só o banco e restaure:

   ```bash
   docker compose up -d db
   docker compose exec -T db pg_restore -U atria -d atria --clean --if-exists < atria.dump
   ```

4. Restaure o volume de arquivos:

   ```bash
   docker run --rm -v <projeto>_files:/data -v "$PWD":/backup debian:bookworm-slim sh -c 'rm -rf /data/* && tar xzf /backup/atria-files.tar.gz -C /data'
   ```

5. Suba o app: `docker compose up -d app`, e confira `/healthz`.

## Saúde e logs

- `GET /healthz` responde `200` com `"status":"ok"` e `"database":"ok"`, ou `503` quando o banco não responde. A imagem usa esse endpoint no `HEALTHCHECK` (`docker compose ps` mostra `healthy`).
- `docker compose logs -f app` mostra os logs do app, em JSON, com o nível de `ATRIA_LOG_LEVEL`.
- Os logs nunca trazem conteúdo pessoal (diário, notas, valores, e-mails) nem segredos: só ids e nomes de variáveis.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `docker compose up` recusa com "defina ... no .env" | Variável obrigatória vazia. | Preencha `POSTGRES_PASSWORD`, `ATRIA_DATABASE_URL` e `ATRIA_PUBLIC_URL` no `.env`. |
| Log `configuração inválida` com `variable` | Valor inválido numa variável `ATRIA_`. | Corrija a variável indicada (o log mostra só o nome, nunca o valor). |
| Log `falha ao ler a chave de criptografia` | `secrets/atria_key` ausente ou ilegível para o usuário `10001`. | Gere a chave ou rode `chmod 644 secrets/atria_key`. |
| `/healthz` com `"database":"unavailable"` | Banco parado ou senha diferente entre `POSTGRES_PASSWORD` e `ATRIA_DATABASE_URL`. | Confira `docker compose ps` e as duas senhas. Mudar `POSTGRES_PASSWORD` depois da primeira subida não muda a senha do banco já criado. |
| Login falha atrás do proxy ou o IP no log é o do gateway | Proxy fora de `ATRIA_TRUSTED_PROXIES`. | Acrescente a faixa do proxy em `ATRIA_TRUSTED_PROXIES` e suba de novo. |
| Sessão não persiste com `http://` | Com `https://` em `ATRIA_PUBLIC_URL`, o cookie exige HTTPS. | Acesse pelo proxy com TLS, no endereço de `ATRIA_PUBLIC_URL`. |
| Erro de escrita fora de `/data/files` | O container roda com o sistema de arquivos somente leitura. | Use só o volume `files`; arquivos temporários vão para `/tmp`. |
