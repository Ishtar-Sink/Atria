# Banco de dados

Define a modelagem, a integridade e o desempenho do PostgreSQL do Atria.

[project/database-01]: Toda tabela de entidade tem `id`, `owner_id`, `visibility`, `created_at` e `updated_at`.
[project/database-02]: Dinheiro em `BIGINT` (centavos) com `currency CHAR(3)`.
[project/database-03]: A liquidação de uma movimentação e a atualização do saldo da conta acontecem na mesma transação.
[project/database-04]: A conta padrão que não pode ser excluída é garantida no banco, não só na aplicação.
[project/database-05]: Integridade no banco com FK, `CHECK` e `UNIQUE`, além da validação na aplicação.
[project/database-06]: Busca com coluna `tsvector` gerada e índice GIN em cada entidade indexável, menos o diário e as notas: criptografados em repouso ([project/security-18]), eles ficam fora do `tsvector` e são buscados no servidor, descriptografando em memória só os dados da própria pessoa.
[project/database-07]: Índice em toda chave estrangeira e em todo filtro frequente.
[project/database-08]: Exclusão lógica (`deleted_at`) nas entidades do usuário, para permitir uma lixeira.
[project/database-09]: Row Level Security do PostgreSQL como segunda camada de isolamento entre usuários.
