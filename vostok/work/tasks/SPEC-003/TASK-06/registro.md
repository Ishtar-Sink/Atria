## O que mudou, por arquivo

- `apps/server/src/library/migrations/20261103010003_highlights-color-hex.sql` (novo): remove a restrição antiga `highlights_color_check`, converte os nomes existentes para o HEX do tema claro e cria a nova restrição `^#[0-9a-f]{6}$`. As migrações antigas (`20261101130001_create-library.sql` e `20261102010003_add-highlights-deleted-at.sql`) não foram editadas.
- `apps/server/src/library/domain/highlight.rs`: `HighlightColor` deixa de ser enum e passa a ser um tipo com `String` interna. `parse` valida o formato e guarda a versão em minúsculas (modelo: `LaneColor::parse` em `apps/server/src/projects/domain/lane.rs`); `as_str` devolve o texto. `HighlightColor` perde `Serialize`, `Deserialize` e `ToSchema`; `HighlightRect` mantém os três. Os testes do módulo foram trocados por `highlight_color_accepts_only_hex_rrggbb`.
- `apps/server/src/library/application/mod.rs`: `HighlightInput.color` e o parâmetro `color` de `update_highlight` são `String`, validados com `HighlightColor::parse` no início de `create_highlight` e `update_highlight`.
- `apps/server/src/library/interface/dto.rs`: `color` vira `String` em `CreateHighlightRequest`, `UpdateHighlightRequest` e `HighlightResponse`, com exemplo `#0e7490` no schema da criação e da troca.
- `apps/server/src/library/interface/openapi.rs`: `HighlightColor` sai do `use` e da lista de `schemas`.
- `apps/server/src/library/tests/highlights.rs`: novos testes `ct13_book_highlight_is_created_and_recolored_with_hex`, `ct13_article_highlight_is_created_and_recolored_with_hex`, `rn09_highlight_color_is_stored_in_lowercase`, `named_highlight_color_is_rejected` e `rnf01_highlight_color_migration_converts_names_to_hex`; constante `THEME_HEX` com a tabela de conversão; testes existentes trocaram as cores por nome pelo HEX, sem renomear nenhum.
- `apps/server/src/library/tests/books.rs` e `apps/server/src/library/tests/articles.rs`: cores dos corpos das requisições trocadas por HEX, porque nomes passam a ser recusados.

Sem mudança de código: `interface/mod.rs` (passa `body.color` adiante), `infrastructure/pg_item_notes.rs` (usa `HighlightColor::parse` e `as_str()`, mesma assinatura) e `reports/infrastructure/mod.rs` (a exportação grava `as_str()`, então passa a exportar o HEX).

Diferença por arquivo (`git diff --stat` na época da execução): `highlight.rs` 27+/34-; `application/mod.rs` 5+/3-; `dto.rs` 10+/5-; `openapi.rs` 1+/2-; `tests/highlights.rs` 238+/12-; `tests/books.rs` 7+/7-; `tests/articles.rs` 3+/3-. A migração é um arquivo novo, ainda não rastreado.

## Decisões

- Conversão dos nomes para os tons do tema claro, em `packages/theme/src/tokens.css`: `accent` → `#0e7490`, `primary` → `#6d28d9`, `success` → `#047857`, `warning` → `#92400e`, `info` → `#0369a1`. Segue a decisão 10 (inferência B) do registro da spec e a PD-12 de `docs/decisoes-do-prototipo.md`, que define a cor gravada como um HEX livre.
- A migração troca temporariamente a RLS para `NO FORCE` e volta para `FORCE` no fim. O motivo: a migração roda com o papel dono da tabela e precisa atualizar os destaques de todas as pessoas. Os testes rodam as migrações com `atria_app`, dono das tabelas, sem superusuário e sem `BYPASSRLS`, como em `apps/server/src/shared/test_support.rs`.
- A normalização para minúsculas acontece em `parse`, antes de gravar. A restrição do banco é uma segunda barreira, não a única.
- O teste de migração (`rnf01_highlight_color_migration_converts_names_to_hex`) grava um destaque por nome antigo (um deles excluído), roda `library::migrator()` inteiro e confere contagem, cores e a recusa de um nome por `INSERT` após a migração.
- Nenhuma consulta mudou de texto, então o cache `.sqlx` não foi regenerado. Seguiu-se KNW-007 (uma compilação pesada do servidor por vez) e KNW-009.

## Verificação

- Baseline coletado: 5 comandos, todos com código de saída 0.
- Testes: passed, sem falhas (saída em `vostok/work/tasks/SPEC-003/TASK-06/validation/tests.out`).
- Regressão: passed, os 5 comandos iguais ao baseline.
- Evidências: passed, 1 evidência em `vostok/work/tasks/SPEC-003/TASK-06/evidencias/`.

## Pontos de atenção

- Qualquer cliente ou integração que ainda envie nomes (`accent`, `primary`, etc.) recebe `422` com `code` `validation_failed` e `errors[0]` igual a `{ "field": "color", "code": "invalid" }`. Isso vale para criação e troca. Os valores aceitos são só `#` seguido de seis dígitos hexadecimais, sem atalho de três dígitos e sem transparência.
- Ao trocar a cor, a lista de destaques continua mostrando a cor anterior quando a troca é recusada.
- Como a cor agora é texto livre na API, a documentação gerada deixa de listar uma lista fechada de cores.
- Se for preciso alterar a regra do formato, mudar `HighlightColor::parse` e a restrição da migração juntos; hoje as duas usam o mesmo padrão.

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 5 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em TASK-06/evidencias/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
