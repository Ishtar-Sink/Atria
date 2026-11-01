---
id: TASK-23
spec: SPEC-002
title: "Leitor: primeira página rápida e zoom"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-13]
wave: 3
covers: [RF-28, RF-29, CT-27, CT-28, CB-11]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 2c5527b16415a2928898138b8b76d8feab581036690c1bc4ae20e0b7e79244e2
adjustments: 1
adjusted_at: 2026-11-01T12:22:21Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: cbdbc1f25d44ffc5c112019cda49406e5788037cf0cf32bc4dd2dfd014d2c5f2
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T12:22:21Z
---

# TASK-23: Leitor: primeira página rápida e zoom

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor: o servidor lê o arquivo inteiro, 200 sem `Accept-Ranges`, e o 100% ocupa toda a largura do palco), RF-27, RF-28, RF-29, CT-26, CT-27, CT-28, CB-10, CB-11, RNF-05, RNF-06, o contrato `GET /files/{id}` com `Range` em "Contratos e interfaces", a decisão 6 (resposta 6A, sem compressão) e a decisão 15 (inferência G, 100% como largura de leitura de cerca de 960 px) do "Registro de decisões".
- `vostok/work/tasks/SPEC-002/TASK-13.md`: o envio parcial no servidor (206, `Content-Range`, `Accept-Ranges: bytes`, `Cache-Control: private`, 416), de que o carregamento em partes depende.
- `vostok/rules/project/frontend.md`: [project/frontend-10], [project/frontend-12] e [project/frontend-17].
- `vostok/rules/project/stack.md`: [project/stack-12] (sem dependência nova; o `pdfjs-dist` já está no `apps/web/package.json`).
- `vostok/rules/project/testing.md`: [project/testing-04], [project/testing-05] e [project/testing-07].
- `apps/web/src/features/reader/load-pdf.ts`: `loadPdf` (`getDocument({ url, withCredentials: true })`) e `PdfLoadError`.
- `apps/web/src/features/reader/pdf-viewer.tsx`: a largura medida do palco, `SIDE_PADDING` e o cálculo `fit * zoom`.
- `apps/web/src/features/reader/reader-page.tsx`: `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP`, `clampZoom` e o uso de `PdfViewer`.
- `apps/web/src/features/reader/pdf-page.tsx`: como a escala chega a `render_page` (só leitura).
- `apps/web/src/features/reader/use-pdf-document.ts`: `fileUrl` e o carregamento por `/api/v1/files/{id}` (só leitura).
- `apps/web/src/features/reader/reader-page.test.tsx`: `vi.mock('./load-pdf')`, `fakeDoc` (página de 600 × 800), `FakeIntersectionObserver`, `renderReader` e os testes `zooms in and out` e `renders only the pages near the viewport`.
- `apps/web/src/features/reader/reader.e2e.ts`: `buildPdf`, `createWithPdf`, `signIn` e os testes CT-35 a CT-38 da SPEC-001, molde dos e2e novos.
- `apps/web/src/features/reader/evidence/harness.tsx`: página de evidência das rotas do leitor (só leitura).
- `apps/web/scripts/evidence-reader.mjs`: molde do script de evidência (PDF montado em bytes, API simulada, `check()`, `baseChecks`, `sheet`); ler por trecho: `makePdf`, a API simulada, `openPage`, `baseChecks` e `sheet`.
- Documentação do `pdfjs-dist` instalado (`apps/web/node_modules/pdfjs-dist/types/src/display/api.d.ts`, `DocumentInitParameters`): `rangeChunkSize`, `disableAutoFetch` e `disableStream`.

### Mudar

- `apps/web/src/features/reader/load-pdf.ts` (alterar): abrir o PDF em partes (`Range`), sem baixar o arquivo inteiro antes da primeira página (RF-28).
- `apps/web/src/features/reader/pdf-viewer.tsx` (alterar): a escala de 100% passa a ser a largura de leitura, limitada pela largura do palco, com `readingScale` exportada (RF-29, CB-11).
- `apps/web/src/features/reader/reader-page.tsx` (alterar): a largura de leitura (`READING_WIDTH = 960`) junto dos níveis de zoom, passada ao `PdfViewer` (RF-29).
- `apps/web/src/features/reader/load-pdf.test.ts` (criar): testes das opções de carregamento em partes e dos erros tipados.
- `apps/web/src/features/reader/pdf-viewer.test.tsx` (criar): testes da escala de leitura.
- `apps/web/src/features/reader/reader-page.test.tsx` (alterar): teste da primeira página na largura de leitura.
- `apps/web/src/features/reader/reader.e2e.ts` (alterar): e2e do CT-27 (primeira página de um PDF de 21 MB em até 3 s, com pedidos `Range` e respostas 206) e do CT-28 (largura a 1920 px e a 360 px), contra o servidor real.
- `apps/web/scripts/evidence-reader-zoom.mjs` (criar): print do leitor a 1920 px e a 360 px com um PDF grande servido em partes, gravado no caminho recebido como argumento.

### Passos

1. Ler os arquivos de "Ler" e conferir em `apps/web/node_modules/pdfjs-dist/types/src/display/api.d.ts` os nomes `rangeChunkSize`, `disableAutoFetch` e `disableStream` de `DocumentInitParameters`.
2. Escrever os testes antes do código:
   - `load-pdf.test.ts` (novo, `describe('loadPdf')`), com `vi.mock('pdfjs-dist', ...)` (fakes de `getDocument`, `GlobalWorkerOptions`, `InvalidPDFException`, `PasswordException` e `TextLayer`) e `vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.js' }))`: `opens the pdf in ranges without downloading the whole file` (`getDocument` chamado com `expect.objectContaining({ url: '/api/v1/files/f-1', withCredentials: true, disableAutoFetch: true, disableStream: true, rangeChunkSize: 65536 })`), `reads the size of the first page at scale 1`, `maps a password error to protected` e `maps an invalid pdf to corrupted`.
   - `pdf-viewer.test.tsx` (novo, `describe('readingScale')`), só com a função pura: `uses the reading width at 100 percent on a wide stage` (palco 1888, página 600, leitura 960: `1.6`), `fits the stage on a narrow screen` (palco 360: `(360 - 32) / 600`), `scales a small pdf up to the reading width` (página 300: `3.2`, CB-11), `keeps the other zoom levels relative to the reading width` (zoom 1.5 no palco 1888: `2.4`) e `falls back to the zoom before the stage is measured` (palco 0: escala igual ao zoom, mínimo 0.1).
   - `reader-page.test.tsx`: acrescentar `renders the first page at the reading width on a wide screen`, com `clientWidth` do palco simulado em 1888 (`vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')`) e `render_page` chamado com `expect.objectContaining({ scale: 1.6 })` para a página 12; não renomear os testes existentes.
3. Rodar `pnpm --filter @atria/web exec vitest run src/features/reader` e confirmar que os testes novos falham por falta da implementação.
4. Alterar `load-pdf.ts`: criar `const RANGE_CHUNK_SIZE = 65536;` com um comentário do porquê (a primeira página chega em poucos pedidos de 64 KB, RF-28) e chamar `getDocument({ url, withCredentials: true, rangeChunkSize: RANGE_CHUNK_SIZE, disableAutoFetch: true, disableStream: true })`; nada mais muda: o resto do arquivo continua só pedido quando a página é renderizada. Sem compressão nem pré-carregamento (decisão 6).
5. Alterar `pdf-viewer.tsx`: exportar `export function readingScale(stage_width: number, page_width: number, zoom: number, reading_width: number): number`, que devolve `Math.max(0.1, zoom)` quando `stage_width <= SIDE_PADDING` ou `page_width <= 0`, e senão `Math.max(0.1, (Math.min(reading_width, stage_width - SIDE_PADDING) / page_width) * zoom)`; `PdfViewerProps` ganha `reading_width: number`, e o componente troca o cálculo de `fit` e `scale` por `readingScale(width, doc.first_page_size.width, zoom, reading_width)`. O resto (páginas perto da tela, rolagem e seleção) não muda.
6. Alterar `reader-page.tsx`: junto de `ZOOM_MIN`, `ZOOM_MAX` e `ZOOM_STEP`, criar `const READING_WIDTH = 960;` com um comentário (100% é a largura de leitura, inferência G) e passar `reading_width={READING_WIDTH}` ao `PdfViewer`. Os níveis de zoom (50% a 300%, passo 25%) continuam e passam a valer sobre essa largura.
7. Rodar `pnpm --filter @atria/web exec vitest run src/features/reader` até passar; depois `pnpm --filter @atria/web typecheck`, o ESLint e o Prettier da Verificação, sem nenhum warning.
8. Alterar `reader.e2e.ts`, sem rodar agora (roda contra o servidor real com o envio parcial da TASK-13): acrescentar `bigPdf()`, que monta o PDF de 64 páginas de `buildPdf` com um objeto de enchimento não referenciado de cerca de 21 MB antes da tabela `xref`; e o `test.describe('leitor com PDF grande')` com `CT-27 shows the first page of a 21 MB pdf in up to 3 seconds with range requests` (escuta `page.on('request')` e `page.on('response')` em `/api/v1/files/`, mede de `page.goto` até a camada de texto da página 1 visível, espera até 3000 ms, ao menos um pedido com o cabeçalho `range` respondido com 206, e a soma de `content-length` das respostas 206 até a primeira página menor que o tamanho do arquivo) e `CT-28 uses the reading width at 100 percent` (com `page.setViewportSize`: a 1920 × 1080, o `canvas` da página 1 com largura entre 900 e 960 px; a 360 × 760, o `canvas` cabe na janela, sem rolagem horizontal).
9. Criar `apps/web/scripts/evidence-reader-zoom.mjs`, em Node sem dependências novas, com código próprio no molde de `apps/web/scripts/evidence-reader.mjs` (sem importá-lo): uso `node apps/web/scripts/evidence-reader-zoom.mjs <caminho.png>`; sobe o Vite numa porta livre com a página virtual que carrega `src/features/reader/evidence/harness.tsx` e encerra ao fim (KNW-006); monta em bytes um PDF de 64 páginas com texto e enchimento de cerca de 21 MB antes da `xref`; simula a API do leitor e serve `/api/v1/files/{id}` com envio parcial: sem `Range`, 200 com `Accept-Ranges: bytes` e `Content-Length`; com `Range: bytes=a-b`, 206 com `Content-Range` e só esse trecho; conta os pedidos com `Range`; temas claro e escuro, a 1920 × 1080 e a 360 × 760, em `/library/books/{id}/read`; confere, antes de cada captura, a primeira página renderizada (camada de texto visível) e o tempo até ela (deve ser até 3000 ms), ao menos um pedido com `Range`, a largura do `canvas` da página 1 entre 900 e 960 px a 1920 px e dentro da janela a 360 px, o rótulo "Zoom 100%", o tema, a falta de rolagem horizontal, a falta de erro de JS e o axe sem violações (inclui `color-contrast`); imprime `ok` ou `FALHA` por verificação com os valores medidos, monta a prancha rotulada no caminho do argumento, imprime `png: <caminho> (N capturas)` e a última linha `ok  0 falha(s)`, e sai com código 1 se algo falhar.
10. Rodar o comando de print de "Evidências" com `VOSTOK_EVIDENCE` apontando para uma pasta temporária, corrigir o código da tarefa a cada `FALHA` e abrir a prancha para conferir.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/reader --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/reader --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/reader`

### Verificação

```bash
# evidência: reader-tests.txt
pnpm --filter @atria/web exec vitest run src/features/reader --reporter=verbose
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/reader --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/reader scripts/evidence-reader-zoom.mjs
node --check apps/web/scripts/evidence-reader-zoom.mjs
pnpm --filter @atria/web exec playwright test --list src/features/reader/reader.e2e.ts
```

### Evidências

- `reader-tests.txt` (automática, da verificação)
  - Prova: os testes do leitor passam, com o PDF aberto em partes de 64 KB sem buscar o resto antes da hora, a escala de 100% na largura de leitura, o encaixe em tela estreita, o PDF pequeno ampliado até a largura de leitura e os outros níveis relativos a ela (RF-28, RF-29, CT-27, CT-28, CB-11).
  - Trecho: `opens the pdf in ranges without downloading the whole file`, `uses the reading width at 100 percent on a wide stage`, `fits the stage on a narrow screen`, `scales a small pdf up to the reading width` e `renders the first page at the reading width on a wide screen` aprovados, e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `reader-zoom.png` (print): `node apps/web/scripts/evidence-reader-zoom.mjs "$VOSTOK_EVIDENCE/reader-zoom.png"`
  - Requer: `apps/web/scripts/evidence-reader-zoom.mjs`
  - Prova: com um PDF de cerca de 21 MB servido em partes, a primeira página aparece em até 3 s depois de pedidos com `Range`, e a 100% a página tem até cerca de 960 px a 1920 px e cabe na tela a 360 px, nos dois temas (RF-28, RF-29, CT-27, CT-28).
  - Trecho: linhas `ok` de "primeira página em N ms (até 3000)", "pedidos com Range: N", "largura da página a 1920 px: N px (900 a 960)", "página dentro da janela a 360 px", "Zoom 100%" e "axe sem violações (inclui color-contrast)", a linha `png:` e a última `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (nenhum pedido com `Range`, primeira página depois de 3 s, página mais larga que 960 px ou cortada a 360 px), a falta da linha `png:` ou código de saída diferente de 0.
- `reader-e2e-list.txt` (automática): `pnpm --filter @atria/web exec playwright test --list src/features/reader/reader.e2e.ts`
  - Prova: os e2e do CT-27 e do CT-28, que rodam contra o servidor real com o envio parcial da TASK-13, estão escritos e são reconhecidos pelo Playwright (CT-27, CT-28, RNF-05).
  - Trecho: as linhas `CT-27 shows the first page of a 21 MB pdf in up to 3 seconds with range requests` e `CT-28 uses the reading width at 100 percent`.
  - Falha: as duas linhas ausentes ou erro de compilação do e2e.

### Concluída quando

- [x] O leitor abre o PDF em partes e mostra a primeira página sem baixar o arquivo inteiro (RF-28, CT-27).

  > Como comprovar: em `reader-tests.txt`, ver aprovado `opens the pdf in ranges without downloading the whole file`; na prancha `reader-zoom.png`, ver as linhas `ok` de "pedidos com Range" e "primeira página em N ms (até 3000)".

- [x] A 100%, a página ocupa a largura de leitura de até cerca de 960 px, cabe na tela em 360 px e os outros níveis de zoom são relativos a ela; um PDF pequeno é ampliado até a largura de leitura sem passar do palco (RF-29, CT-28, CB-11).

  > Como comprovar: em `reader-tests.txt`, ver aprovados os testes de `readingScale` e `renders the first page at the reading width on a wide screen`; na prancha `reader-zoom.png`, ver a página centrada com cerca de 960 px a 1920 px e inteira a 360 px.

- [x] Os e2e do CT-27 e do CT-28 estão escritos para rodar contra o servidor real (CT-27, CT-28, RNF-05).

  > Como comprovar: em `reader-e2e-list.txt`, ver os dois testes listados pelo Playwright.

- [x] Os testes existentes do leitor continuam passando e testes, typecheck, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `zooms in and out` e `renders only the pages near the viewport` aparecem aprovados em `reader-tests.txt`.

## Descrição

### Resumo executivo

Faz o leitor mostrar a primeira página de um PDF grande logo, buscando só os pedaços do arquivo que a tela precisa, em vez de esperar o download inteiro.
Também muda o zoom de 100% para uma largura confortável de leitura (cerca de 960 px), em vez de esticar a página na tela toda.
Resolve o relato do PDF de 21 MB que demorava a abrir e da página grande demais.
Perfil padrão, risco baixo; depende do envio do arquivo em partes no servidor e não bloqueia outras tarefas.

### Detalhes técnicos

- **Abordagem:** o `getDocument` do pdf.js passa a abrir o arquivo por pedidos `Range` de 64 KB, sem stream do arquivo inteiro e sem buscar o resto em segundo plano (`disableStream`, `disableAutoFetch`), o que só funciona com o `Accept-Ranges` e o 206 do servidor (TASK-13); a escala de 100% vira `min(largura de leitura, largura do palco − margem) / largura da página`, numa função pura `readingScale` testável.
- **Componentes:** `load-pdf.ts`, `pdf-viewer.tsx` e `reader-page.tsx` do leitor; nenhuma dependência nova ([project/stack-12]).
- **Decisões:**
  - `disableStream` e `disableAutoFetch` ligados; descartado manter o stream, que baixa o arquivo inteiro em paralelo e disputa a banda com a primeira página, e descartada a compressão do PDF (decisão 6, resposta 6A).
  - Pedaço de 64 KB, o padrão do pdf.js e o tamanho do exemplo do contrato (`bytes=0-65535`); descartado um pedaço maior, que atrasa a primeira página em rede lenta.
  - 100% como largura de leitura de 960 px (decisão 15, inferência G); descartado o ajuste pela altura da página, que deixa a página pequena demais em telas largas.
  - A constante da largura fica em `reader-page.tsx`, junto dos níveis de zoom que dependem dela; o `PdfViewer` só aplica a escala.
  - PDF pequeno ampliado até a largura de leitura (CB-11), sem passar do palco.
- **Riscos:** sem o envio parcial no servidor ou atrás de um proxy que comprima a resposta, o pdf.js volta a baixar o arquivo inteiro (o leitor continua funcionando, só mais lento); a página atual é mantida no topo ao mudar a escala, pelo `useLayoutEffect` existente.
- **Referências da spec:** RF-28, RF-29, CT-27, CT-28, CB-11, RNF-05, decisões 6 (resposta 6A) e 15 (inferência G); depende de RF-27 (TASK-13).
- **E2E:** os testes do CT-27 e do CT-28 em `reader.e2e.ts` rodam contra o servidor real e não são executados na Verificação desta tarefa; o Playwright só confere que estão escritos (`--list`).
- **Evidências visuais:** um print gerado por `apps/web/scripts/evidence-reader-zoom.mjs` sobre o harness do leitor, com o PDF grande servido em partes, conferido pelo usuário na finalização.
- **Arquivos em comum na onda 3:** nenhum; a TASK-24 muda `session-offer-dialog.tsx` e `reader.module.css` do leitor, arquivos diferentes dos desta tarefa.

### Card

- **Título:** Leitor: primeira página rápida e zoom
- **Tipo:** bug
- **Descrição:** O leitor abre o PDF em partes para mostrar a primeira página logo, e o zoom de 100% passa a ser a largura de leitura de cerca de 960 px.
- **Critérios de aceite:**
  - [ ] Primeira página de um PDF de 21 MB em até 3 s, com pedidos em partes.
  - [ ] 100% com até cerca de 960 px a 1920 px e inteira a 360 px.
  - [ ] PDF pequeno ampliado até a largura de leitura e demais níveis relativos a ela.
  - [ ] E2E do CT-27 e do CT-28 escritos para o servidor real.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-13

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 1 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-11-01 | ajuste | in_progress | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário aceitou a diferença do comando 1: a linha nova é um teste novo aprovado cujo nome contém 'error', falso alarme do regression_alert; aceito(s): 1 |
| 7 | 2026-11-01 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 8 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 9 | 2026-11-01 | conferência | usuário | print reader-zoom.png conferido pelo usuário (sha256 7c529bc9) |
| 10 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-23/ |
| 11 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
