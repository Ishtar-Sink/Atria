### Concluída quando

- [ ] O Financeiro não tem mais a aba Faturas nem a tela de pagamento de fatura, e nada no app aponta para elas (RF-08, CT-07).

  > Como comprovar: em `sem-cartao-testes.txt`, ver aprovado `ct07 shows the finance tabs without Faturas` (as abas são Painel, Entradas, Saídas, Transferências, Contas e Configurações); na Verificação, a busca por `statements-screen`, `use-statements` e `/finance/statements` em `apps/web/src` não encontra nada; na prancha `finance-sem-cartao.png`, nenhuma aba Faturas.

- [ ] Contas só são comuns: o formulário não oferece o tipo cartão, o limite nem os dias de fechamento e vencimento, e o detalhe não mostra "Ver fatura", o tipo nem o limite (RF-07, CT-07).

  > Como comprovar: em `sem-cartao-testes.txt`, ver aprovados `rf07 creates an account without card fields`, `rf07 creates an account without the card type` e `rf07 shows edit and more actions on the account detail without the statement`; na prancha, a nova conta só com nome e visibilidade e o detalhe sem "Ver fatura".

- [ ] Uma saída é criada sem parcelas em qualquer conta, e as listas e o detalhe não mostram mais "(n/total)" nem a parcela (RF-07, CT-07).

  > Como comprovar: em `sem-cartao-testes.txt`, ver aprovados `rf07 creates an expense without installments on any account` e `shows the value above the status, recurring and difference badges` (o título é só "Luz"); na prancha, a nova saída na conta "Cartão Nu" sem o campo "Parcelas".

- [ ] O painel do Financeiro não tem mais o card Cartões, e os demais cards continuam pareados (RF-09, CT-07).

  > Como comprovar: em `sem-cartao-testes.txt`, ver aprovados `rf09 shows balance, upcoming bills and savings and losses without the cards block`, `pairs the panel cards in rows` e `keeps one column below 960 px with the main zone first`; na prancha, o painel sem Cartões nos dois temas e larguras.

- [ ] A lista de contas continua com busca, visualização e um filtro na URL, agora por visibilidade ([project/frontend-12], [project/frontend-13], RF-07).

  > Como comprovar: em `sem-cartao-testes.txt`, ver aprovados `lists accounts with filters in the url` e `/finance/accounts keeps q, view and filters in the URL`; na prancha, os chips "Todas", "Pessoais" e "Compartilhadas".

- [ ] As telas alteradas não têm violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, CT-07).

  > Como comprovar: rodar `node apps/web/scripts/evidence-finance.mjs sem-cartao` e ver a última linha `ok  0 falha(s)`, com as linhas de axe sem violações; abrir `finance-sem-cartao.png` e conferir as quatro combinações de tema e largura.

- [ ] O e2e do CT-07 substitui o de parcelas e faturas e compila (CT-07).

  > Como comprovar: em `sem-cartao-e2e-list.txt`, ver a linha `ct07 finance has no card, statements or installments` e nenhuma linha `installments fall in the right statements and payment settles them`.

- [ ] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings, e não sobra nenhum erro de tipo ligado ao cartão ([project/code-style-01], [project/code-style-08]).

  > Como comprovar: rodar o bloco de "Verificação" e ver todos os comandos terminarem com código 0, inclusive a contagem de erros de tipo do cartão em 0.
