---
id: TASK-13
spec: SPEC-002
title: "Envio parcial dos arquivos do Acervo"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-12]
wave: 2
covers: [RF-27, CT-26, CB-10]
type: tarefa
labels: [SPEC-002, julgamento]
status: done
content_hash: 8aa147ae24c4a6d1c399ce23453add77e7b9f6000f05fe6924842af3d7a8e2ed
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 0c58146711912fd6d6f872ede7818c4faf3f04c5fa2bdb62c1f369e1bd834f33
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-opus-5-5
---

# TASK-13: Envio parcial dos arquivos do Acervo

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor: o servidor lê o arquivo inteiro e responde 200 sem `Accept-Ranges` e com `no-store`), RF-27, CT-26, CB-10, RN-03, RNF-05, o contrato `GET /files/{id}` com `Range` em "Contratos e interfaces", o risco "Envio parcial expor arquivos de outra pessoa" e a decisão 6 (resposta 6A).
- `vostok/work/.archive/SPEC-001/spec.md`: RN-25 (arquivo só para o dono).
- `vostok/rules/project/security.md` e `vostok/rules/project/stack.md`: [project/stack-11] (armazenamento atrás de uma interface).
- `vostok/rules/project/api.md`: [project/api-02] e [project/api-03].
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-03] e [project/testing-09].
- `vostok/memory/knowledge.md` (KNW-007): uma compilação pesada do servidor por vez.
- `vostok/work/tasks/SPEC-002/TASK-12.md`: as rotas de destaque que a TASK-12 já acrescentou a `apps/server/src/library/interface/mod.rs` e `apps/server/src/library/interface/openapi.rs` (não mexer nelas).
- `apps/server/src/storage/mod.rs`: trait `FileStorage`, `StorageError` e os testes do módulo.
- `apps/server/src/storage/local.rs`: `LocalFileStorage`, `not_found_as` e `get`.
- `apps/server/src/library/application/files.rs`: `FileService` e `read`.
- `apps/server/src/library/application/ports.rs` (trait `FileStore`, linhas 230 a 256).
- `apps/server/src/library/infrastructure/pg_files.rs` (fn `load`, linhas 105 a 132): a query de metadados e a leitura do storage.
- `apps/server/src/library/domain/library_file.rs` (struct `LibraryFile`: `size_bytes`, `sha256`, `content_type`, `download_name`).
- `apps/server/src/library/interface/files.rs`: `get_file`.
- `apps/server/src/library/interface/mod.rs` (fn `file_response`, linhas 88 a 120): usada também pelas capas de livro e artigo, que continuam com `no-store`.
- `apps/server/src/library/interface/openapi.rs`: `LibraryApi`.
- `apps/server/src/shared/error.rs` (fn `ApiError::new` e `impl IntoResponse for ApiError`).
- `apps/server/src/library/tests/files.rs` (testes `rn25_file_is_served_only_to_owner` e `file_response_has_nosniff_and_inline_disposition`) e `apps/server/src/library/tests/mod.rs` (`Harness::download`, `upload_ok`, `minimal_pdf`, `book_body`).

### Mudar

- `apps/server/src/library/interface/files.rs` (alterar): `GET /files/{id}` lê o cabeçalho `Range`, responde 200, 206 ou 416 e documenta as respostas (RF-27, CB-10).
- `apps/server/src/library/interface/mod.rs` (alterar): resposta dos arquivos com `Accept-Ranges`, `ETag`, cache privado e `Content-Range` (RF-27).
- `apps/server/src/storage/local.rs` (alterar): leitura de um trecho do arquivo, sem ler o resto (RF-27).
- `apps/server/src/library/interface/openapi.rs` (alterar): teste do documento com as respostas 206 e 416 de `GET /files/{id}`.
- `apps/server/src/storage/mod.rs` (alterar): `get_range` no trait `FileStorage` e testes; necessário porque o Acervo usa o storage por `Arc<dyn FileStorage>` ([project/stack-11]).
- `apps/server/src/library/application/ports.rs` (alterar): `find` e `load_range` no trait `FileStore`; necessário para a interface saber o tamanho antes de ler o trecho.
- `apps/server/src/library/application/files.rs` (alterar): `describe` e `read_range` em `FileService`, com a checagem de dono (RN-03).
- `apps/server/src/library/infrastructure/pg_files.rs` (alterar): `find` e `load_range`, reaproveitando a query de metadados de `load`.
- `apps/server/src/library/tests/files.rs` (alterar): testes de integração de `Range` (CT-26, CB-10, RN-03) e do cache novo.

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Testes primeiro.
   - Em `apps/server/src/storage/mod.rs`, no `mod tests`: `get_range_reads_only_the_requested_slice` (grava `b"0123456789"` e `get_range(&key, 2, 3)` devolve `b"234"`), `get_range_stops_at_end_of_file` (`get_range(&key, 8, 10)` devolve `b"89"`) e `get_range_of_missing_file_returns_not_found`.
   - Em `apps/server/src/library/interface/files.rs`, num `#[cfg(test)] mod tests` no fim do arquivo, testes da função pura `requested_range` (passo 6) com tamanho 100: sem cabeçalho → `Whole`; `bytes=0-9` → `Part { start: 0, end: 9 }`; `bytes=90-` → `Part { 90, 99 }`; `bytes=-10` → `Part { 90, 99 }`; `bytes=-500` → `Part { 0, 99 }`; `bytes=0-999` → `Part { 0, 99 }`; `bytes=100-`, `bytes=50-10`, `bytes=abc`, `bytes=-0` e `bytes=` → `Unsatisfiable`; `bytes=0-1,5-6` e `items=0-1` → `Whole` (ignorados, RFC 9110).
   - Em `apps/server/src/library/tests/files.rs`, um auxiliar local `async fn get_with_range(h: &Harness, session: &TestSession, uri: &str, range: &str) -> (StatusCode, HeaderMap, Vec<u8>)` que monta o pedido com `session.request(Method::GET, uri).header(header::RANGE, range)` e o envia com `h.app.clone().oneshot(...)`, como `Harness::download`, e os testes:
     - `ct26_range_returns_206_with_content_range`: PDF de 200000 bytes (`let mut pdf = minimal_pdf(); pdf.resize(200_000, b'0');`, enviado com `upload_ok`); `Range: bytes=0-65535` devolve 206, 65536 bytes iguais a `pdf[..65536]`, `content-range` `bytes 0-65535/200000`, `accept-ranges` `bytes` e `cache-control` `private, max-age=3600`.
     - `ct26_suffix_range_returns_last_bytes`: `Range: bytes=-4` devolve 206 com os 4 últimos bytes.
     - `ct26_without_range_returns_200_with_accept_ranges_and_etag`: sem `Range`, 200 com o arquivo inteiro, `accept-ranges` `bytes`, `cache-control` `private, max-age=3600` e `etag` igual a `"<sha256 do arquivo em hexadecimal>"` (calcule com `sha2::Sha256::digest`).
     - `cb10_range_beyond_size_returns_416_with_size`: `Range: bytes=200000-` devolve 416, `content-range` `bytes */200000` e o problema com `code` `range_not_satisfiable`.
     - `ct26_malformed_range_returns_416`: `Range: bytes=abc` devolve 416.
     - `rn03_range_from_other_user_returns_404`: o Bob, com `Range: bytes=0-3`, recebe 404 `file_not_found`, sem `%PDF` no corpo; a Alice, com o id malformado e `Range`, também recebe 404.
     - Atualize `file_response_has_nosniff_and_inline_disposition` para esperar `cache-control` `private, max-age=3600` e `accept-ranges` `bytes`, mantendo o nome.
   - Em `apps/server/src/library/interface/openapi.rs`, um `#[cfg(test)] mod tests` com `documents_partial_file_responses`: no `LibraryApi::openapi()`, `GET /api/v1/files/{id}` tem as respostas `200`, `206`, `404` e `416` e o parâmetro de cabeçalho `Range`.
   Rode `cargo test -p atria-server -- library::tests::files library::interface:: storage::` e confira que os testes novos falham.
3. Em `apps/server/src/storage/mod.rs`, acrescente ao trait `FileStorage`: `fn get_range<'a>(&'a self, key: &'a StorageKey, start: u64, len: u64) -> StorageFuture<'a, Bytes>;` com o doc "Lê só `len` bytes a partir de `start`, ou menos no fim do arquivo; o PDF grande não é carregado inteiro (RF-27)".
4. Em `apps/server/src/storage/local.rs`, implemente `get_range`: `tokio::fs::File::open` (com `not_found_as`), `seek(SeekFrom::Start(start))` e `take(len).read_to_end(&mut buffer)` (`tokio::io::{AsyncReadExt, AsyncSeekExt}`), devolvendo `Bytes::from(buffer)`; a capacidade inicial do `Vec` usa `usize::try_from(len)` com teto de 1 MiB, sem `unwrap`.
5. Na aplicação e na infraestrutura do Acervo:
   - `apps/server/src/library/application/ports.rs`, trait `FileStore`: `fn find(&self, owner_id: Uuid, id: Uuid) -> impl Future<Output = Result<Option<LibraryFile>, LibraryError>> + Send;` (só metadados, do dono e não excluído) e `fn load_range(&self, file: &LibraryFile, start: u64, len: u64) -> impl Future<Output = Result<Option<Bytes>, LibraryError>> + Send;` (`None` se o conteúdo sumiu do storage).
   - `apps/server/src/library/infrastructure/pg_files.rs`: extraia a leitura de metadados de `load` para uma função privada `find_live(&self, owner_id, id) -> Result<Option<LibraryFile>, LibraryError>`, sem mudar o texto da query (assim a `.sqlx` não muda); `load` e `find` a usam; `load_range` chama `self.storage.get_range(&storage_key(&file.storage_key)?, start, len)`, com `StorageError::NotFound` virando `Ok(None)`.
   - `apps/server/src/library/application/files.rs`, `FileService`: `pub async fn describe(&self, owner_id: Uuid, id: Uuid) -> Result<LibraryFile, LibraryError>` (`FileNotFound` quando `find` devolve `None`: inexistente, excluído ou de outra pessoa, RN-03) e `pub async fn read_range(&self, file: &LibraryFile, start: u64, len: u64) -> Result<Bytes, LibraryError>` (`FileNotFound` quando `load_range` devolve `None`). `read` continua para as capas.
6. Em `apps/server/src/library/interface/files.rs`:
   - `pub(crate) enum RangeRequest { Whole, Part { start: u64, end: u64 }, Unsatisfiable }` e `pub(crate) fn requested_range(header: Option<&HeaderValue>, size: u64) -> RangeRequest`, com as regras do passo 2: só a unidade `bytes` e um único intervalo; `a-b` com `b` limitado a `size - 1`; `a-` até o fim; `-n` os últimos `n` (todo o arquivo se `n >= size`); início fora do arquivo, fim antes do início, sufixo zero ou sintaxe inválida em `bytes=` → `Unsatisfiable`; outra unidade ou mais de um intervalo → `Whole`.
   - `get_file` recebe também `headers: HeaderMap`; chama `file_service(&state).describe(user.user_id, id)` antes de olhar o `Range` (quem não é dono recebe 404 sem nenhuma leitura de conteúdo, RN-03); converte `file.size_bytes` com `u64::try_from` (erro vira `ApiError::internal()`); `Whole` lê `read_range(&file, 0, size)` e responde 200; `Part` lê `read_range(&file, start, end - start + 1)` e responde 206; `Unsatisfiable` responde com `range_not_satisfiable(size)` (passo 7), sem ler o storage.
   - Atualize o `#[utoipa::path]`: parâmetro `("Range" = Option<String>, Header, description = "Um intervalo em bytes, como bytes=0-65535")` e respostas `200` (arquivo inteiro com `Accept-Ranges`), `206` (trecho com `Content-Range`), `404` (`file_not_found`, também para arquivo de outra pessoa) e `416` (`range_not_satisfiable`, `Content-Range: bytes */tamanho`).
7. Em `apps/server/src/library/interface/mod.rs`:
   - `pub(crate) fn stored_file_response(file: &LibraryFile, bytes: Bytes, download: bool, part: Option<(u64, u64)>) -> Result<Response, ApiError>`: os mesmos `Content-Type`, `Content-Disposition` e `nosniff` de `file_response`, mais `Accept-Ranges: bytes`, `ETag: "<sha256>"` e `Cache-Control: private, max-age=3600` (o conteúdo de um id nunca muda: um envio novo gera outro id); com `part = Some((start, end))`, status 206 e `Content-Range: bytes start-end/size`; senão 200.
   - `pub(crate) fn range_not_satisfiable(size: u64) -> Response`: `ApiError::new(StatusCode::RANGE_NOT_SATISFIABLE, "range_not_satisfiable", "Range Not Satisfiable")` com os cabeçalhos `Content-Range: bytes */size` e `Accept-Ranges: bytes`.
   - `file_response` não muda: as capas (`/books/{id}/cover`, `/articles/{id}/cover`) mudam de conteúdo na mesma URL e continuam `private, no-store`.
8. Rode `cargo test -p atria-server library::` e `cargo test -p atria-server storage::` até passar; depois `cargo fmt` e a Verificação inteira.

### Baseline

- `cargo test -p atria-server library:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server storage:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
# evidência: range-tests.txt
cargo test -p atria-server -- library::tests::files library::interface::files::tests library::interface::openapi::tests storage::
cargo test -p atria-server library::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando sem mudar a `.sqlx` e `test result: ok` nos testes de `Range`, do storage, do Acervo e do `http` (rotas, OpenAPI juntado e isolamento).

### Evidências

- `range-tests.txt` (automática, da verificação)
  - Prova: `GET /files/{id}` responde 206 com `Content-Range` a um pedido com `Range`, 200 com `Accept-Ranges`, `ETag` e cache privado sem `Range`, 416 com `Content-Range: bytes */tamanho` a um intervalo fora do arquivo ou inválido, e 404 a quem não é dono; o storage lê só o trecho pedido (RF-27, CT-26, CB-10, RN-03).
  - Trecho: as linhas `test library::tests::files::ct26_range_returns_206_with_content_range ... ok`, `ct26_without_range_returns_200_with_accept_ranges_and_etag ... ok`, `cb10_range_beyond_size_returns_416_with_size ... ok`, `rn03_range_from_other_user_returns_404 ... ok`, `test storage::tests::get_range_reads_only_the_requested_slice ... ok` e `test library::interface::openapi::tests::documents_partial_file_responses ... ok`, e `test result: ok` sem falhas.
  - Falha: `FAILED`, `test result: FAILED` ou a ausência das linhas `ct26_`, `cb10_` e `rn03_` (testes novos ausentes).

### Concluída quando

- [x] Um pedido do dono com `Range: bytes=0-65535` recebe 206 com só aquele trecho, `Content-Range` com o tamanho total e `Accept-Ranges: bytes`, e o storage lê só o trecho (RF-27, CT-26).

  > Como comprovar: em `range-tests.txt`, ver `ct26_range_returns_206_with_content_range`, `ct26_suffix_range_returns_last_bytes` e `get_range_reads_only_the_requested_slice` com `ok`.

- [x] Sem `Range`, o arquivo vem inteiro com 200, `Accept-Ranges: bytes`, `ETag` e `Cache-Control: private, max-age=3600` (RF-27, CT-26).

  > Como comprovar: em `range-tests.txt`, ver `ct26_without_range_returns_200_with_accept_ranges_and_etag` e `file_response_has_nosniff_and_inline_disposition` com `ok`.

- [x] Um intervalo fora do tamanho do arquivo ou inválido recebe 416 com `Content-Range: bytes */<tamanho>` (CB-10, CT-26).

  > Como comprovar: em `range-tests.txt`, ver `cb10_range_beyond_size_returns_416_with_size` e `ct26_malformed_range_returns_416` com `ok`.

- [x] Quem não é dono recebe 404 também com `Range`, sem nenhum byte do arquivo (RN-03, CT-26).

  > Como comprovar: em `range-tests.txt`, ver `rn03_range_from_other_user_returns_404` e `rn25_file_is_served_only_to_owner` com `ok`.

- [x] O OpenAPI documenta 206 e 416 em `GET /files/{id}`, as capas continuam sem cache, e o servidor passa em fmt, clippy e nos testes do Acervo e do `http` (RF-27).

  > Como comprovar: em `range-tests.txt`, ver `documents_partial_file_responses ... ok`; rodar a Verificação e ver todos os comandos terminarem sem erro.

## Descrição

### Resumo executivo

O servidor passa a entregar os PDFs e as capas do Acervo em partes, sob pedido, e a deixar o navegador guardar uma cópia por uma hora.
É o que permite ao leitor mostrar a primeira página de um livro grande sem baixar o arquivo inteiro.
Perfil julgamento: mexe num contrato público e num ponto sensível de privacidade (arquivo de outra pessoa continua respondendo 404).
Depende dos destaques no servidor (TASK-12) e desbloqueia o leitor (TASK-23) e a geração do contrato (TASK-15).

### Detalhes técnicos

**Abordagem.** A interface consulta os metadados do arquivo pelo dono (`FileService::describe`), interpreta o `Range` contra o tamanho gravado e lê do storage só o trecho (`FileStorage::get_range`, com `seek` e `take` no disco local). A resposta de `/files/{id}` ganha `Accept-Ranges`, `ETag` (o SHA-256 gravado no envio) e `Cache-Control: private, max-age=3600`; 206 leva `Content-Range`, e 416 é um `problem+json` com `Content-Range: bytes */tamanho`.

**Decisões (perfil julgamento: alternativas e critério).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| Como ler o trecho | `get_range` no trait `FileStorage`, com `seek` no arquivo | Ler o arquivo inteiro e fatiar na interface (só `files.rs` e `mod.rs`) | O PDF.js pede dezenas de trechos de um PDF de 21 MB; ler tudo a cada pedido multiplica E/S e memória e ameaça RNF-05. Exige mexer em `storage/mod.rs`, `ports.rs`, `files.rs` e `pg_files.rs`, fora dos componentes do plano. |
| Ordem das checagens | Dono primeiro (`describe`), depois o `Range` | Validar o `Range` antes | RN-03: quem não é dono recebe 404 mesmo com `Range` inválido, sem revelar o tamanho no `Content-Range`. |
| `Range` inválido | 416 para sintaxe inválida e intervalo fora do arquivo; outra unidade ou vários intervalos são ignorados (200) | 200 para qualquer `Range` inválido (permitido pela RFC 9110) | CT-26 pede 416 para "Range inválido"; vários intervalos (`multipart/byteranges`) não são usados pelo leitor. |
| Cache | `private, max-age=3600` e `ETag` só em `/files/{id}` | O mesmo nas capas por item | O conteúdo de um id nunca muda (um envio novo gera outro id); a URL da capa por item muda de conteúdo e continua `no-store`. |
| `If-None-Match` e `If-Range` | Fora desta tarefa | Responder 304 | O contrato só pede `ETag`; o cache de uma hora já evita o novo download. |

**Riscos técnicos.** Um arquivo apagado do disco depois de `describe` vira 404 (`load_range` devolve `None`). `size_bytes` é `BIGINT`: a conversão para `u64` falha só com dado corrompido (500). A query de metadados de `pg_files.rs` não muda de texto, então a `.sqlx` continua válida.

**Referências da spec.** RF-27, CT-26, CB-10, RN-03, RNF-05; contrato `GET /files/{id}`; decisão 6 (resposta 6A); risco "Envio parcial expor arquivos de outra pessoa".

**Arquivos em comum.** Na onda 2 não há outra tarefa de servidor. `apps/server/src/library/interface/mod.rs`, `apps/server/src/library/interface/openapi.rs` e `apps/server/src/library/application/ports.rs` já foram mudados pela TASK-12 (onda 1, da qual esta depende): preserve as rotas e operações de destaque.

### Card

- **Título:** Envio parcial dos arquivos do Acervo
- **Tipo:** tarefa
- **Descrição:** Os arquivos do Acervo passam a ser servidos em partes (`Range`, 206 e 416), com `Accept-Ranges`, `ETag` e cache privado, só para o dono, lendo do disco só o trecho pedido.
- **Critérios de aceite:**
  - [ ] `Range: bytes=0-65535` do dono recebe 206 com `Content-Range`.
  - [ ] Sem `Range`, 200 com `Accept-Ranges`, `ETag` e cache privado.
  - [ ] Intervalo fora do arquivo ou inválido recebe 416 com `Content-Range: bytes */tamanho`.
  - [ ] Quem não é dono recebe 404, também com `Range`.
  - [ ] OpenAPI com 206 e 416; fmt, clippy e testes do Acervo e do `http` sem falha.
- **Rótulos:** SPEC-002, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-12

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 3 comando(s) iguais ao baseline; 2 com acréscimo |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-13/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
