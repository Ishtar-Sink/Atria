## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 2, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-11-01 | ajuste | in_progress | Caso ct15 de Saídas segue o autocomplete da TASK-08 (busca por trecho, ordem alfabética, primeira opção ativa) (decisão do usuário); executivo.md e tecnico.md escritos com o que a tarefa vai fazer (harness 0.2.8) |
| 4 | 2026-11-01 | ajuste | in_progress | E2e e vídeo do ct15 seguem o mesmo comportamento do autocomplete (ordem alfabética, primeira opção ativa): ArrowDown, ArrowUp e Enter escolhem Mercado (decisão do usuário no ajuste 1) |
| 5 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 7 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário aceitou: [1] sai o teste apagado pela TASK-11; [4] typecheck passou de erro para código 0 com a TASK-13; aceito(s): 1, 4 |
| 8 | 2026-11-01 | regressão | passed | 3 igual(is) ao baseline, 2 aceito(s) pelo usuário |
| 9 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 10 | 2026-11-01 | evidências | erro | evidência automática com erro |
| 11 | 2026-11-01 | conferência | usuário | print filtro-categoria.png conferido pelo usuário (sha256 ecb4abd8) |
| 12 | 2026-11-01 | conferência | usuário | print filtro-categoria.webm conferido pelo usuário (sha256 5e740330) |
| 13 | 2026-11-01 | evidências | passed | 5 evidência(s) em TASK-16/evidencias/ |
| 14 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Caso ct15 de Saídas segue o autocomplete da TASK-08 (busca por trecho, ordem alfabética, primeira opção ativa) (decisão do usuário); executivo.md e tecnico.md escritos com o que a tarefa vai fazer (harness 0.2.8) |
| 2 | 2026-11-01 | agente | E2e e vídeo do ct15 seguem o mesmo comportamento do autocomplete (ordem alfabética, primeira opção ativa): ArrowDown, ArrowUp e Enter escolhem Mercado (decisão do usuário no ajuste 1) |
