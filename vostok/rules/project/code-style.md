# Estilo de código

Define as regras de escrita e qualidade do código TypeScript e Rust.

[project/code-style-01]: TypeScript sem `any` e sem `@ts-ignore`; ESLint e Prettier sem nenhum warning.
[project/code-style-02]: Rust passa limpo em `cargo fmt` e em `cargo clippy -- -D warnings`.
[project/code-style-03]: Rust sem `unwrap`, `expect` ou `panic!` fora dos testes; erros tipados com `thiserror`, convertidos em resposta HTTP só na camada `interface`.
[project/code-style-04]: `#![forbid(unsafe_code)]` em todos os crates.
[project/code-style-05]: Dinheiro é um inteiro em centavos (`i64`) com o código da moeda, nunca ponto flutuante.
[project/code-style-06]: Datas e horas guardadas em UTC e convertidas para o fuso do usuário só na apresentação; recorrências guardam o fuso de origem.
[project/code-style-07]: Funções curtas, com retorno antecipado e um único nível de abstração.
[project/code-style-08]: Sem código morto ou comentado; um `TODO` só existe com o ID da spec ou da tarefa.
[project/code-style-09]: Componentes React são funções sem regra de negócio; dados e lógica ficam em hooks da feature.
[project/code-style-10]: Estilos só com tokens do tema: nenhuma cor, raio, espaço ou duração literal.
[project/code-style-11]: Comentários explicam o porquê, não o quê.
