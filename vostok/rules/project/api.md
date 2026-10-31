# API

Define o contrato HTTP entre o backend e o frontend do Atria.

[project/api-01]: REST com JSON sob `/api/v1`.
[project/api-02]: O OpenAPI é gerado do código Rust (`utoipa`) e os tipos TypeScript são gerados dele; o frontend não escreve tipos da API à mão.
[project/api-03]: Erros num formato único, `application/problem+json` (RFC 9457), com código estável.
[project/api-04]: Listagens com paginação por cursor e filtro, ordenação e busca no mesmo padrão em todas as entidades.
[project/api-05]: Ids públicos em UUID v7; nunca expor um id sequencial.
[project/api-06]: Movimentações financeiras aceitam `Idempotency-Key`, para que um envio repetido não crie a mesma movimentação duas vezes.
