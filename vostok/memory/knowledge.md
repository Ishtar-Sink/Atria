---
type: knowledge
title: "Conhecimentos"
description: "Descobertas e peculiaridades do projeto sem documentação primária. Consulte antes de pesquisar ou investigar um assunto pouco documentado."
updated_at: 2026-11-01T14:06:30Z
---

# Conhecimentos

Descobertas e peculiaridades do projeto sem documentação primária. Consulte antes de pesquisar ou investigar um assunto pouco documentado.

Entradas criadas por `vostok memory add` e consultadas por `vostok memory search`. Não carregue este arquivo inteiro.

## KNW-001: Coordenador coleta o baseline antes de disparar o subagente

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** execute-task, baseline, subagente, coordenador
- **Conhecimento:** Um subagente disparado pela `execute-task` pode iniciar a tarefa e implementar sem rodar `vostok task baseline`, deixando a tarefa sem baseline. O Coordenador deve rodar `vostok task start` e `vostok task baseline` antes de disparar o subagente (opção prevista no passo 5 da skill) e conferir no "Registro de execução" a linha `baseline`.
- **Como foi descoberto:** Na TASK-01 da SPEC-001, o subagente criou `prototype/atria-prototype.html` sem coletar o baseline. A recuperação foi tirar a pasta do lugar, coletar o baseline do estado anterior e devolver a pasta conferida por SHA-256.
- **Validade:** Toda execução de tarefa ou onda por subagente neste projeto.

## KNW-002: Avisar em destaque quando o app abrir no navegador

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** navegador, web, localhost, aviso, execute-task, finish-task
- **Conhecimento:** O usuário pediu para ser avisado em destaque (título em negrito no topo da resposta, com o endereço e o comando para subir) assim que o Atria puder ser aberto no navegador, mesmo incompleto. Marcos: depois da TASK-05 (onda 4), `pnpm --filter @atria/web dev` abre o layout vazio em `http://localhost:5173` (só a casca, sem telas); as telas com dados vêm na onda 7 (TASK-19 a TASK-34) e a ligação com o servidor na TASK-35 (onda 8).
- **Como foi descoberto:** Pedido do usuário em 2026-10-30, durante a execução da onda 3 da SPEC-001.
- **Validade:** Até o app web da SPEC-001 abrir com as telas reais; depois, avisar a cada marco novo visível no navegador.

## KNW-003: web-push 0.11 exige OpenSSL do sistema

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** rust, web-push, openssl, ece, cargo, apps/server
- **Conhecimento:** O crate `web-push` 0.11 depende de `openssl-sys` mesmo com `default-features = false`: pelo `ece` (criptografia da mensagem) e, com a feature `hyper-client`, pelo `hyper-tls`/`native-tls`. A compilação exige `pkg-config` e os cabeçalhos do OpenSSL (`libssl-dev`), ausentes no WSL do projeto, ou a feature `vendored` do `openssl` (compila o OpenSSL com perl, make e cc, presentes).
- **Como foi descoberto:** Na TASK-04 da SPEC-001, `cargo test -p atria-server --no-run` falhou em `failed to run custom build command for openssl-sys`; `cargo tree -i openssl-sys` mostrou `ece` e `hyper-tls` vindos de `web-push`.
- **Validade:** Enquanto `apps/server` usar `web-push` 0.11; vale também para a imagem Docker (TASK-36).

## KNW-004: cargo fmt --check não confere os módulos dos contextos do atria-server

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** rust, rustfmt, cargo-fmt, apps/server, contextos
- **Conhecimento:** Em `apps/server/src/main.rs`, cada `mod <contexto>;` leva `#[rustfmt::skip]`, então `cargo fmt` e `cargo fmt --check` não formatam nem conferem nenhum arquivo dentro de `apps/server/src/<contexto>/`: o `--check` passa mesmo com o contexto mal formatado. Para conferir um contexto, rode do diretório `apps/server`: `rustfmt --edition 2024 --check src/<contexto>/mod.rs` (e sem `--check` para formatar só ele, sem tocar nos outros contextos).
- **Como foi descoberto:** Na TASK-12 da SPEC-001, uma linha mal formatada posta de propósito em `src/journal/domain/mod.rs` passou em `cargo fmt --check` (saída 0) e falhou em `rustfmt --edition 2024 --check src/journal/mod.rs` (saída 1).
- **Validade:** Enquanto os `mod` dos contextos tiverem `#[rustfmt::skip]` no `main.rs` (o comentário diz que sai junto com a condição `cfg`, na TASK-18).

## KNW-005: Aceite geral de regressão do tipo pasta criada pela tarefa

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** finish-task, regressao, baseline, issue-6, aceite
- **Conhecimento:** O usuário autorizou aceitar, sem perguntar de novo, a regressão do mesmo tipo do defeito da issue 6 do harness: um comando do Baseline que confere a existência de um caminho criado pela própria tarefa e passa de "ausente" para "existe". Na finalização, retome com `vostok task resume ... --accept-regression <N>` citando esse aceite e informe na resposta. Qualquer outra diferença de regressão continua exigindo a decisão do usuário.
- **Como foi descoberto:** Mensagem do usuário em 2026-10-30, ao finalizar a TASK-09 da SPEC-001: "se a regressão for do mesmo tipo, aceitar".
- **Validade:** Enquanto a issue 6 (Ishtar-Sink/Vostok) não for corrigida, nas finalizações da SPEC-001. Continua valendo a regra de uma tarefa por pedido.

## KNW-006: Servidores de desenvolvimento ficam no terminal do usuário

- **Data:** 2026-10-30
- **Status:** válido
- **Tags:** servidor, dev, processos, ambiente
- **Conhecimento:** Não deixe servidores de longa duração (por exemplo `pnpm --filter @atria/web dev`) rodando em segundo plano pela sessão do agente: o usuário prefere subi-los no próprio terminal. Quando ele precisar ver algo no navegador, entregue o comando para ele rodar. Processos temporários de um script (servidor que o próprio script sobe e encerra) estão ok, mas cada subagente deve encerrar o que subiu antes de terminar.
- **Como foi descoberto:** Mensagem do usuário em 2026-10-30, ao ver no painel de tarefas um servidor de dev aberto havia 1h36 e outro esquecido por um subagente havia 2h.
- **Validade:** Todo o projeto.

## KNW-007: Uma compilação pesada do servidor por vez

- **Data:** 2026-10-31
- **Status:** válido
- **Tags:** rust, cargo, docker, desempenho, execute-task, finish-task, onda
- **Conhecimento:** Compilações paralelas do `atria-server` (`cargo test`/`cargo build` de tarefas diferentes, `docker build` da imagem) disputam CPU e a trava de `target/` e deixam cada etapa muito lenta. Combinado com o usuário: finalizar (finish-task) uma tarefa só quando nenhuma outra estiver compilando o servidor, e, em ondas grandes, limitar quantos subagentes compilam o servidor ao mesmo tempo (o frontend compila rápido e pode ter mais paralelismo). Não usar a Mac (`mac-build`) para isso: o harness precisa rodar testes, regressão e evidências localmente, com o Postgres de testes local.
- **Como foi descoberto:** Na onda 5 da SPEC-001 (2026-10-30), a finalização da TASK-16 levou dezenas de minutos enquanto a TASK-17 rodava `cargo test` e a TASK-36 fazia `docker build` em release; o usuário perguntou o motivo e concordou com a serialização.
- **Validade:** Todo o projeto, enquanto o servidor for um único crate grande.

## KNW-008: Cache de target do Docker mantém cfg antigo do build.rs

- **Data:** 2026-10-31
- **Status:** válido
- **Tags:** docker, buildkit, cargo, build.rs, cache, apps/server, Dockerfile
- **Conhecimento:** O `Dockerfile` monta `/src/target` como cache do BuildKit (`--mount=type=cache`), compartilhado entre builds. O `build.rs` do `atria-server` liga cada contexto (`cfg atria_context`) só se `src/<contexto>/mod.rs` existe; quando um build posterior roda numa árvore em que a pasta do contexto não existe mais, o cargo reaproveita a saída antiga do `build.rs` e falha com `file not found for module` (E0583), mesmo depois de `touch` em `src`. Solução: `docker buildx prune -f --filter type=exec.cachemount` (remove só os caches de `RUN --mount=type=cache`) e buildar de novo.
- **Como foi descoberto:** Na TASK-36 da SPEC-001, o `docker build` pegou o contexto `search` em edição pela TASK-16; ao validar numa cópia da árvore sem a pasta `search`, o build falhou com E0583 em `main.rs` até limpar o cache de montagem.
- **Validade:** Enquanto o `build.rs` decidir os contextos pela existência das pastas e o `Dockerfile` usar cache de `target`; só ocorre quando uma pasta de contexto some entre builds.

## KNW-009: Macros do sqlx mapeiam datas para time, não chrono

- **Data:** 2026-10-31
- **Status:** válido
- **Tags:** rust, sqlx, chrono, time, macros, query!, apps/server
- **Conhecimento:** O `tower-sessions-sqlx-store` liga o recurso `time` do `sqlx`; com `time` e `chrono` ligados, as macros (`query!`, `query_as!`, `query_scalar!`) mapeiam `DATE`/`TIMESTAMPTZ` para `time::Date`/`OffsetDateTime`, e o sqlx 0.8 não tem opção para preferir `chrono`. Parâmetros chrono precisam de `valor as _`; colunas de saída precisam de `AS "col: _"` em `query_as!` (usa o tipo do campo da struct) ou `AS "col: DateTime<Utc>"`/`"col: NaiveDate"` em `query!`/`query_scalar!`. Enums próprios (`Visibility`, status) seguem a mesma regra. O `sqlx-cli` precisa ser da mesma versão do `sqlx` (0.8.6).
- **Como foi descoberto:** Na TASK-18 da SPEC-001, ao trocar as queries de produção pelas macros: todo parâmetro e coluna de data falhou com `expected OffsetDateTime, found DateTime<Utc>`; `cargo tree -i sqlx -e features` mostrou o `time` vindo do store de sessões.
- **Validade:** Enquanto o store de sessões depender do recurso `time` do sqlx e o projeto usar `chrono` (sqlx 0.8; o 0.9 tem sobreposição de tipos no `sqlx.toml`). Para regenerar a `.sqlx` num banco vazio, aplique as migrações com um binário compilado com `SQLX_OFFLINE=true` (com `DATABASE_URL` apontando para o banco vazio o crate não compila), e só depois rode `cargo sqlx prepare --workspace`: uma falha no `prepare` apaga a `.sqlx`.

## KNW-010: Responder sempre em pt-br, inclusive em mensagens curtas de progresso entre comandos

- **Data:** 2026-11-01
- **Status:** válido
- **Tags:** idioma, respostas, pt-br
- **Conhecimento:** Toda mensagem ao usuário sai em pt-br, inclusive as frases curtas de progresso escritas entre chamadas de ferramenta, que tendem a escapar em inglês.
- **Como foi descoberto:** O usuário reclamou duas vezes de respostas em inglês, a última na finalização da onda 1 da SPEC-002.
- **Validade:** Permanente, em todas as skills e sessões do projeto.

## KNW-011: vostok task evidence --reviewed aceita várias vezes na mesma chamada

- **Data:** 2026-11-01
- **Status:** válido
- **Tags:** vostok, evidências, prints, finish-task
- **Conhecimento:** Cada `vostok task evidence` roda de novo todas as evidências e regera os prints, o que zera a conferência dos prints que não vieram no `--reviewed` da chamada. Numa tarefa com mais de um print ou vídeo, registre todos numa só chamada, repetindo a opção: `vostok task evidence SPEC TASK --reviewed a.webm --reviewed b.png`.
- **Como foi descoberto:** Na finalização da onda 4 da SPEC-002, registrar um print por chamada deixou as TASK-20 e 28 com prints sem conferência, e o `vostok task finish` recusou.
- **Validade:** Enquanto o `vostok task evidence` regerar todos os prints a cada chamada.
