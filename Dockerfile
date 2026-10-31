# syntax=docker/dockerfile:1
# Imagem oficial do Atria ([project/self-hosting-01]): o frontend compilado vai
# embutido no binário do servidor, um único processo além do banco
# ([project/self-hosting-02]), e a execução roda sem root.

# --- Estágio 1: build do frontend ---
FROM node:22.23.4-bookworm-slim AS web
WORKDIR /src
RUN corepack enable
# Só os manifestos primeiro, para o cache da instalação sobreviver a mudanças no código.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/theme/package.json packages/theme/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
# Os node_modules do host apontam para fora do contexto: nunca entram na imagem.
COPY --exclude=**/node_modules --exclude=apps/web/dist apps/web apps/web
COPY --exclude=**/node_modules packages packages
RUN pnpm --filter @atria/web build

# --- Estágio 2: build do servidor, com o frontend embutido pelo rust-embed ---
FROM rust:1.99.1-bookworm AS server
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY apps/server apps/server
COPY --from=web /src/apps/web/dist apps/web/dist
ENV SQLX_OFFLINE=true
# O OpenSSL do web-push é compilado junto (feature `vendored`, KNW-003): perl, make e cc
# já vêm na imagem do Rust, então nada a instalar aqui.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked -p atria-server \
    && mkdir -p /out \
    && cp target/release/atria-server /out/atria-server

# --- Estágio 3: execução ---
FROM debian:bookworm-slim AS runtime
LABEL org.opencontainers.image.title="Atria" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
# curl só para o HEALTHCHECK; ca-certificates para SMTP, Web Push e oEmbed com TLS.
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 --home-dir /nonexistent --shell /usr/sbin/nologin atria \
    && mkdir -p /data/files \
    && chown 10001:10001 /data/files
COPY --from=server /out/atria-server /usr/local/bin/atria-server
ENV ATRIA_BIND_ADDRESS=0.0.0.0:8080 \
    ATRIA_STORAGE_PATH=/data/files \
    ATRIA_LOG_LEVEL=info
VOLUME /data/files
EXPOSE 8080
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["atria-server"]
CMD ["serve"]
