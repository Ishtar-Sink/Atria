### Baseline

- `ls docs/estudos | sort` (muda): a lista ganha `financeiro-descontos.md`, o estudo que a tarefa entrega; os três estudos atuais continuam.

### Verificação

```bash
test -f docs/estudos/financeiro-descontos.md
for section in '# Estudo: descontos nas entradas e saídas do Financeiro' '## Pergunta' '## Prática contábil da folha de 2026' '## Modelo de dados' '## Arredondamento' '## Cálculo reverso' '## Impacto no forecast e no resumo' '## Recomendação' '## O que muda no contrato da spec' '## O que muda nas tarefas' '## Decisões em aberto' '## Fontes'; do
  grep -qxF "$section" docs/estudos/financeiro-descontos.md || { echo "seção ausente: $section"; exit 1; }
done
for term in '15.270' 'transactions_settlement_coherent' 'expected_amount' 'rate_bp' 'base_amount' 'no_gross_for_net' '8.592,20' '1.887,09' 'Exemplo, não regra do sistema'; do
  grep -qF "$term" docs/estudos/financeiro-descontos.md || { echo "termo ausente: $term"; exit 1; }
done
test "$(grep -cE '^- \[.+\]\(https?://' docs/estudos/financeiro-descontos.md)" -ge 2
```

Resultado esperado: o arquivo existe, tem as doze seções com o título exato, cita o redutor da Lei 15.270/2025, a restrição `transactions_settlement_coherent`, o significado de `expected_amount`, os campos `rate_bp` e `base_amount`, o erro `no_gross_for_net`, os números do ct05 (bruto R$ 8.592,20) e do ct07 (IRPF R$ 1.887,09 depois do centavo), o aviso de exemplo da resposta 1A e pelo menos duas fontes com link; o script termina com código 0.

### Evidências

- `estudo-descontos.diff` (diff): `docs/estudos/financeiro-descontos.md`
  - Prova: o estudo foi escrito antes de qualquer código, com a prática contábil da folha de 2026 como exemplo, o modelo de dados, o arredondamento, o cálculo reverso, o impacto no forecast e no resumo e a recomendação sobre o contrato da spec (RF-16, CT-15).
  - Trecho: o arquivo novo inteiro, com as seções "Prática contábil da folha de 2026", "Modelo de dados", "Arredondamento", "Cálculo reverso", "Impacto no forecast e no resumo", "Recomendação" e "O que muda no contrato da spec", e a tabela dos casos reversos com bruto R$ 8.592,20 no ct05.
  - Falha: diff vazio, arquivo ausente ou sem alguma dessas seções, ou números do cálculo reverso diferentes da tabela comum das TASK-02 e TASK-03.
