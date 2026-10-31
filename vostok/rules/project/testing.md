# Testes

Define o que é testado, com quais ferramentas e com quais critérios no Atria.

[project/testing-01]: Toda regra de negócio do domínio tem teste unitário (ex.: saldo só muda na liquidação, cálculo de economia e perda, recorrências, conta padrão não excluível).
[project/testing-02]: Testes de integração rodam contra um PostgreSQL real em container, sem mock de banco.
[project/testing-03]: Cada endpoint tem teste de autorização: ler ou alterar dado de outro usuário, ou dado pessoal fora do compartilhamento, retorna 404.
[project/testing-04]: Componentes e hooks testados com Vitest e Testing Library.
[project/testing-05]: Testes ponta a ponta com Playwright nos fluxos críticos: cadastro por convite, login, recuperação de senha, liquidação de movimentação e ligação entre entidades.
[project/testing-06]: Cobertura mínima de 80% nas camadas `domain` e `application`.
[project/testing-07]: Testes determinísticos: relógio e geração de ids injetáveis, nada depende da data atual.
[project/testing-08]: Recorrências testadas nos casos de borda: fim de mês, 29/02, fuso horário e horário de verão.
[project/testing-09]: Todo bug corrigido ganha um teste de regressão.
[project/testing-10]: Verificação de acessibilidade com axe nos testes de componente e ponta a ponta, sem violações.
[project/testing-11]: Auditoria com Lighthouse (Lighthouse CI) nas telas principais, com pontuação mínima de 90 em desempenho, acessibilidade e boas práticas.
