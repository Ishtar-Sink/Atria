## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | Teste do valor acima dos selos passa a esperar a saída com −; teste da sobra negativa em âmbar passa a conferir o valor de saldo, já que as Saídas também levam − |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo; 1 mudança(s) esperada(s) |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-02 | conferência | usuário | print finance-sinais.png conferido pelo usuário (sha256 ca042a00) |
| 8 | 2026-11-02 | evidências | passed | 2 evidência(s) em TASK-17/evidencias/ |
| 9 | 2026-11-02 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Teste do valor acima dos selos passa a esperar a saída com −; teste da sobra negativa em âmbar passa a conferir o valor de saldo, já que as Saídas também levam − |
