### Baseline

- `cargo test -p atria-server finance::domain:: 2>&1 | grep ' \.\.\. ' | grep -v 'finance::domain::adjustment::' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
# evidência: adjustment-domain-tests.txt
cargo test -p atria-server finance::domain::adjustment::
cargo test -p atria-server finance::domain::
```

Resultado esperado: formatação e clippy sem aviso; os 17 testes de `finance::domain::adjustment::tests` com `ok` e `test result: ok. 17 passed`; os demais testes do domínio do Financeiro continuam passando.

### Evidências

- `adjustment-domain-tests.txt` (automática, da verificação)
  - Prova: o cálculo do domínio fecha a tabela de casos comum com a tela: líquido a partir do bruto com percentual no bruto, base digitada e fixos, sem efeito da ordem (CT-01, CT-02, CT-03, RF-03 a RF-07, RN-01 a RN-05); arredondamento meio para cima por item (RN-03); bruto equivalente ao líquido com a base proporcional e só fixos (CT-05, CB-02, RN-06); centavo residual no último percentual com a identidade exata (CT-07, CB-05, RN-07); líquido zero e sem bruto possível (CB-01); e as recusas de validação (CT-13, CB-03, CB-04, CB-08, CB-09).
  - Trecho: as linhas `test finance::domain::adjustment::tests::ct01_percent_on_gross_and_fixed_deduction ... ok`, `...::ct02_typed_base_and_order_do_not_change_net ... ok`, `...::ct05_reverse_scales_typed_base_with_gross ... ok`, `...::ct07_residual_cent_goes_to_last_percent ... ok`, `...::ct13_invalid_items_are_refused ... ok` e `test result: ok. 17 passed`.
  - Falha: `FAILED`, `panicked` com `not yet implemented` ou com os valores esperados e obtidos de um caso, `test result: FAILED` ou `running 0 tests` (testes ausentes).
  - Espera: `test result: ok. 17 passed`
