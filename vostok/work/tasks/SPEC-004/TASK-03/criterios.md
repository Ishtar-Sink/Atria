### Concluída quando

- [x] A tela calcula o líquido a partir do bruto e dos itens com o mesmo resultado do servidor nos casos diretos da tabela comum (RF-13, CT-11).

  > Como comprovar: em `adjustments-lib-tests.txt`, ver `✓` em `ct01 percent on gross and fixed deduction` (líquido 708000), `ct02 typed base and order do not change net` (605200 nas duas ordens), `ct03 percent deduction and fixed addition` (18500) e `rn03 percent rounds half up per item` (29166).

- [x] A tela calcula o bruto equivalente a um líquido com a base proporcional e o centavo residual no último percentual, com os mesmos números do servidor (RF-13, CT-11).

  > Como comprovar: no mesmo arquivo, ver `✓` em `ct05 reverse scales typed base with gross` (bruto 859220), `ct07 residual cent goes to last percent` (IRPF 188709), `ct07 residual follows list order`, `cb01 reverse with zero net` e `cb02 reverse with only fixed items`.

- [x] A tela recusa os mesmos itens inválidos do servidor, com o mesmo campo e o mesmo código (RF-13, CT-11).

  > Como comprovar: no mesmo arquivo, ver `✓` em `ct13 invalid items are refused`, `cb03 net not positive is refused`, `cb04 rate outside range is refused`, `cb09 typed base must be positive` e `cb01 reverse without possible gross is refused`.

- [x] Os testes da pasta `lib` do Financeiro, o ESLint, o Prettier e a checagem de tipos passam (RF-13).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro, com `Tests  17 passed (17)` no primeiro e nenhum aviso do ESLint.
