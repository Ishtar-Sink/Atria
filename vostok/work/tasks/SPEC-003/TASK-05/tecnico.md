<!-- Escrito na finalização da tarefa. -->

A cor da categoria passa a ser um HEX livre `#rrggbb` (PD-12, RF-18), sempre gravado em minúsculas (RN-09). Antes, a coluna aceitava só os nomes `primary`, `accent`, `success`, `warning`, `danger` e `info`. Esta tarefa fez a migração das cores por nome, a validação no domínio e o ajuste dos contratos e dos testes.

## O que mudou, por arquivo

- `apps/server/src/finance/migrations/20261103010002_categories-color-hex.sql` (novo): remove o `CHECK` `categories_color_check`, faz `NO FORCE ROW LEVEL SECURITY` só durante a conversão, converte cada nome no HEX do token do tema claro (`primary` → `#6d28d9`, `accent` → `#0e7490`, `success` → `#047857`, `warning` → `#92400e`, `danger` → `#be123c`, `info` → `#0369a1`), volta a `FORCE ROW LEVEL SECURITY` e cria o novo `CHECK` `^#[0-9a-f]{6}$`. As migrações já aplicadas (`20261101070002` e `20261102010001`) não foram editadas.
- `apps/server/src/finance/domain/category.rs`: `CategoryColor` passa a ser uma string validada por `parse`, no mesmo molde de `LaneColor::parse`. Aceita só `#` seguido de seis dígitos hexadecimais, guarda o texto em minúsculas e, se inválido, devolve `FinanceError::invalid("color", "invalid")`. `SystemCategory::color` devolve os HEX do tema claro para as sete categorias padrão.
- `apps/server/src/finance/application/categories.rs`: `NewCategory.color` e `CategoryPatch.color` viram texto. `create` e `update` validam a cor com `CategoryColor::parse` antes de tocar no repositório.
- `apps/server/src/finance/infrastructure/pg_categories.rs`: `CategoryRow::into_domain` usa `parse` e, se a linha estiver corrompida, devolve erro de dado corrompido. As queries não mudaram de texto, então a `.sqlx` não foi regenerada.
- `apps/server/src/finance/interface/dto.rs`: sai o `CategoryColorDto`. `color` passa a `String` em `CreateCategoryRequest`, `UpdateCategoryRequest`, `CategoryResponse` e `WhereItemDto`.
- `apps/server/src/finance/interface/handlers.rs`: `create_category` e `update_category` repassam a cor em texto ao caso de uso.
- `apps/server/src/finance/interface/openapi.rs`: `CategoryColorDto` sai da lista de `schemas`, pois o tipo deixou de existir.
- `apps/server/src/reports/infrastructure/mod.rs`: sem mudança de código. A exportação já grava `category.color.as_str()`, e agora esse valor é o HEX.

## Testes

- `apps/server/src/finance/tests/categories.rs`: novos testes `ct12_category_is_created_and_edited_with_hex_color`, `rn09_category_color_is_stored_in_lowercase`, `invalid_category_color_is_rejected`, `ct12_default_categories_have_theme_hex_colors` e `rnf01_category_color_migration_converts_names_to_hex`. O último roda a migração sobre dados antigos, confere a conversão, o novo `CHECK` e a listagem pela API. A constante `THEME_HEX` concentra a tabela de conversão.
- `apps/server/src/finance/domain/category.rs`: o teste de tons do tema virou `category_color_accepts_only_hex_rrggbb`, e `system_category_colors_are_theme_hex` foi acrescentado.
- Testes existentes com cor por nome (`transfers.rs`, `summaries.rs`, `authorization.rs`, `transactions.rs`, `listings.rs`, `reports/tests.rs`) passaram a usar HEX, sem renomear nenhum teste. Em `transfers.rs`, `#ff0000` passa a ser aceito. Em `reports/tests.rs`, a exportação JSON passou a ser conferida com cores HEX.
- `apps/server/src/http/tests/isolation.rs`: ajuste feito durante a execução, por decisão do usuário. Em `overrides`, o caso `"categories"` manda `{"color": "#6d28d9"}`. A amostra gerada a partir do OpenAPI não é mais um valor de enum, e uma cor de exemplo fora do HEX seria recusada.

## Decisões

- Cor HEX livre (PD-12), e não uma paleta fechada. A restrição fica no banco (`CHECK`) e no domínio (`parse`), nos dois lugares.
- Conversão dos tons antigos para o HEX do tema claro (inferência B). Assim, o dado existente mantém a aparência do tema claro.
- A migração usa `NO FORCE` apenas dentro da própria transação, para que o dono da tabela atualize as linhas de todas as pessoas apesar da RLS. A proteção volta com `FORCE` logo em seguida.
- Compilações do `atria-server` foram feitas uma por vez (KNW-007).

## Pontos de atenção

- Clientes da API que ainda enviam nomes como `primary` passam a receber 422 com `validation_failed` e erro em `color`. O contrato OpenAPI perdeu o enum `CategoryColorDto`, então clientes gerados a partir dele precisam ser regenerados.
- A migração é irreversível para os nomes: depois de aplicada, o dado guarda só o HEX. Qualquer reversão exige um script próprio.
- Cores são normalizadas para minúsculas. Um valor como `#AABBCC` é gravado e devolvido como `#aabbcc`.

## Verificação

- Baseline coletado antes da mudança (5 comandos, todos com código de saída 0).
- Testes: sem falhas, com a saída em `vostok/work/tasks/SPEC-003/TASK-05/validation/tests.out`.
- Regressão: 5 comandos iguais ao baseline, todos passaram.
- Evidências: 1 registrada em `vostok/work/tasks/SPEC-003/TASK-05/evidencias/`.
- Conferência por `grep`: nenhuma cor por nome restou nos testes listados.
