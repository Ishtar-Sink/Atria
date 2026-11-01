### Concluída quando

- [x] A `@atria/ui` exporta um autocomplete que filtra as opções enquanto se digita, sem diferenciar maiúsculas nem acentos (RF-21, CT-16).

  > Como comprovar: em `autocomplete-tests.txt`, ver aprovado `ct16 filters the options while typing, ignoring case and accents`; no `autocomplete.webm`, ver a lista encolher a cada letra digitada.

- [x] Pelo teclado, as setas movem a opção ativa, o Enter escolhe e o Esc fecha sem mudar o valor (RF-21, RNF-05).

  > Como comprovar: em `autocomplete-tests.txt`, ver aprovados `ct16 picks the active option with the arrow keys and Enter` e `ct16 closes on Escape keeping the previous value`; no log do vídeo, `ok` em "setas e Enter escolhem Mercado" e "Esc fecha e mantém Mercado".

- [x] Sem resultado para o texto digitado, aparece "Nenhuma categoria encontrada" e o valor anterior continua (CB-10).

  > Como comprovar: em `autocomplete-tests.txt`, ver aprovado `cb10 shows the empty text and keeps the previous value`; no vídeo, ver a mensagem e o campo voltar a "Mercado" depois do Esc.

- [x] Na seleção múltipla, várias opções são escolhidas e cada uma é removida pelo × ou pelo Backspace (RF-21, CT-16).

  > Como comprovar: em `autocomplete-tests.txt`, ver aprovados `ct16 chooses several options and keeps the list open` e `ct16 removes each chosen option`; no vídeo, ver as pílulas entrando e saindo.

- [x] O autocomplete tem a altura e o visual do seletor da biblioteca, mostra erro e desabilitado nos dois temas e não tem violações de acessibilidade (RF-21).

  > Como comprovar: no `autocomplete-estados.png`, conferir os dois painéis com os campos alinhados e legíveis; na saída do print, `ok    axe sem violações` e `ok  0 falha(s)`; em `autocomplete-tests.txt`, ver aprovado `has no axe violations`.

- [x] Testes, lint, Prettier e checagem de tipos da `@atria/ui` e do `@atria/web` passam sem warning.

  > Como comprovar: rodar o bloco de "Verificação" e ver código 0.
