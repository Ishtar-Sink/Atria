---
id: TASK-21
spec: SPEC-002
title: "Acervo: área de capa e envio com progresso"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 3
covers: [RF-22, RF-26, CT-21, CT-25]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: a200fbd7cbd94f8f297b92be612b0b0eb43caf7d7f6c2b87966e5cf15a74e53f
adjustments: 2
adjusted_at: 2026-11-01T12:26:37Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 35f287421cb0a4d38db83e5eedff1412e1e71dc669ee9cc28513e9a57e8a2cbb
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T12:26:37Z
---

# TASK-21: Acervo: área de capa e envio com progresso

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Acervo e leitor), RF-22, RF-26, CT-21, CT-25, FA-03, RNF-02, RNF-03 e a decisão 14 (inferência F) do "Registro de decisões".
- `vostok/work/tasks/SPEC-002/TASK-04.md` e `packages/ui/src/button/button.tsx`: o `Button` com `loading` e indicador visível (RF-25), usado sem mudança.
- `packages/ui/src/progress-bar/progress-bar.tsx`: `ProgressBar` (`label`, `value`, `max`), com `role="progressbar"` e `aria-valuenow`.
- `vostok/rules/project/frontend.md`: [project/frontend-02], [project/frontend-04], [project/frontend-08], [project/frontend-09], [project/frontend-10] e [project/frontend-17].
- `vostok/rules/project/code-style.md`: [project/code-style-09] e [project/code-style-10].
- `vostok/rules/project/security.md`: [project/security-03] (o envio mantém o cabeçalho `X-CSRF-Token`) e [project/security-10].
- `vostok/rules/project/testing.md`: [project/testing-04], [project/testing-09] e [project/testing-10].
- `prototype/atria-prototype.html` (linhas 672 a 682, CSS `.cover-drop`; linhas 1681 e 1689 a 1704, a área com `tabindex="0"`, `role="button"` e `aria-label="Escolher a capa: clique ou arraste uma imagem"`): a área de capa é o próprio controle.
- `docs/decisoes-do-prototipo.md`: PD-36 (capa por clique ou arrasto, PNG/JPEG/WebP até 5 MB, "Trocar" e "Remover") e PD-37 (capa à esquerda dos campos).
- `apps/web/src/features/library/cover-upload-field.tsx` e `apps/web/src/features/library/cover-upload-field.test.tsx`: a área atual com o botão interno "Escolher imagem".
- `apps/web/src/features/library/pdf-attachment-field.tsx`: o anexo de PDF, onde a barra do envio do PDF aparece.
- `apps/web/src/features/library/use-library-mutations.ts`: `uploadRaw` (envio por `fetch`), `sendFiles`, `useCreateItem`, `useUpdateItem`, `useCoverMutations` e `usePdfUpload`.
- `apps/web/src/features/library/library.module.css` (classes `.coverField`, `.coverDrop`, `.over`, `.dropBody`, `.coverTools`, `.pdfField`, `.pdfRow` e `.srOnly`, linhas 485 a 620).
- `apps/web/src/features/library/library-test-server.ts`: a API falsa por `fetch` usada pelos testes do Acervo (fn `stubLibraryServer`).
- `apps/web/src/features/library/book-form-page.test.tsx` (testes `creates a book with title, cover, author, publisher, pages and tags` e `attaches an optional pdf`), `apps/web/src/features/library/article-form-page.test.tsx` e `apps/web/src/features/library/video-form-page.test.tsx`: os envios de capa e PDF pelos formulários.
- `apps/web/src/features/library/i18n/pt-br.json`: chaves `library.cover.*` e `library.pdf.*`.
- `apps/web/src/shared/toast/toast-store.ts`: `pushToast` com `tone: 'success'`.
- `apps/web/src/features/library/evidence/harness.tsx`: página de evidência das rotas do Acervo (só leitura).
- `apps/web/scripts/evidence-library.mjs`: molde do script de evidência; ler por trecho: `startVite`, a API simulada, `openPage`, `baseChecks`, `gotoApp` e `sheet`.

### Mudar

- `apps/web/src/features/library/cover-upload-field.tsx` (alterar): a área de capa é ela mesma o controle (clique, Enter, Espaço e arrastar), sem botão interno, com a barra do envio da imagem (RF-22, RF-26).
- `apps/web/src/features/library/library.module.css` (alterar): estados de hover, foco, arrasto, desabilitado e a barra de envio da área de capa e do PDF (RF-22, RF-26).
- `apps/web/src/features/library/use-library-mutations.ts` (alterar): envio por `XMLHttpRequest` com progresso, estado do progresso por arquivo e aviso de sucesso ao terminar (RF-26).
- `apps/web/src/features/library/pdf-attachment-field.tsx` (alterar): barra do envio do PDF, o caso do CT-25 (PDF de 21 MB); entra além dos componentes do plano porque o progresso do PDF aparece no campo dele.
- `apps/web/src/features/library/i18n/pt-br.json` (alterar): nome acessível da área, textos da barra de envio e do aviso de sucesso.
- `apps/web/src/features/library/library-test-server.ts` (alterar): `XMLHttpRequest` falso ligado à mesma API em memória, com progresso, envio segurado e falha de rede.
- `apps/web/src/features/library/cover-upload-field.test.tsx` (alterar): testes da área como controle e da barra, mantendo os nomes dos testes existentes.
- `apps/web/src/features/library/use-library-mutations.test.tsx` (criar): testes do envio com progresso, do aviso de sucesso e da falha.
- `apps/web/src/features/library/book-form-page.test.tsx` (alterar): teste do envio do PDF com barra de progresso e aviso de sucesso pelo formulário.
- `apps/web/src/features/library/article-form-page.test.tsx` (alterar): o teste `pd36 uploads an article cover in 16 by 9` acha a área da capa como `button` e o `input` pelo `aria-label`, já que a área deixa de ser `group` (passo 7).
- `apps/web/src/features/library/video-form-page.test.tsx` (alterar): o mesmo nos testes `allows a manual thumbnail when none is fetched` e `pd37 places the thumbnail on the left and url, title, channel and status on the right`.
- `apps/web/scripts/evidence-cover-upload.mjs` (criar): vídeo do envio (área de capa com foco e arrasto, envio do PDF com a barra de progresso e o aviso de sucesso), gravado com `recordVideo` do Playwright no caminho recebido como argumento; as checagens dos dois temas e das duas larguras seguem sem vídeo.

### Passos

1. Ler os arquivos de "Ler" e conferir em `packages/ui/src/button/button.tsx` que o `loading` já mostra o indicador (TASK-04); esta tarefa não muda a `@atria/ui`.
2. Acrescentar em `apps/web/src/features/library/i18n/pt-br.json`: `cover.area_label_book` ("Capa do livro: clique ou arraste uma imagem"), `cover.area_label_article` ("Capa do artigo: clique ou arraste uma imagem"), `cover.area_label_video` ("Miniatura do vídeo: clique ou arraste uma imagem"), `cover.uploading` ("Enviando a imagem"), `pdf.uploading` ("Enviando o PDF"), `upload.percent` ("{percent}%") e `upload.success` ("Arquivo enviado."). Remover `cover.choose`, que deixa de ser usada.
3. Alterar `library-test-server.ts`, sem mudar a assinatura de `stubLibraryServer`: extrair o corpo do `fetch` falso para uma função `handle(input, init): Promise<Response>`; acrescentar ao `Server` os campos `hold_uploads: boolean` (padrão `false`), `release_uploads: () => void` e `fail_uploads_network: boolean` (padrão `false`); instalar com `vi.stubGlobal('XMLHttpRequest', FakeXhr)` uma classe `FakeXhr` com `open(method, url)`, `setRequestHeader`, `withCredentials`, `upload` com `onprogress`, `onload`, `onerror`, `status`, `responseText` e `send(body)`: em `send`, emite `upload.onprogress({ lengthComputable: true, loaded: size / 2, total: size })`; com `fail_uploads_network`, chama `onerror`; com `hold_uploads`, espera `release_uploads()`; depois emite `upload.onprogress` com `loaded: size`, chama `handle` com o mesmo método, cabeçalhos e corpo e preenche `status` e `responseText` antes de `onload`. Os envios continuam registrados em `server.calls` como hoje (`file` e `content_type`).
4. Escrever os testes antes do código:
   - `use-library-mutations.test.tsx` (novo, `describe('library uploads')`): `sends the file with the csrf header and the content type`, `reports the upload progress of the cover and of the pdf` (com `hold_uploads`, `useUploadProgress('pdf')` vale 50 antes de `release_uploads()` e volta a `null` depois), `shows a success notice when the files are sent` (toast `Arquivo enviado.`), `maps a refused upload to the api problem code` (`file_too_large`), `maps a network failure to network_error and clears the progress` (FA-03).
   - `cover-upload-field.test.tsx`: manter os nomes dos testes; em `pd36 uploads a cover by click and by drop`, o arrasto vai para `getByRole('button', { name: 'Capa do livro: clique ou arraste uma imagem' })`; em `pd36 uses 2 by 3 for books and 16 by 9 for articles and videos`, ler a classe nesse mesmo botão (nomes de artigo e vídeo); em `is operable by keyboard only`, o primeiro Tab foca a área e Enter e Espaço abrem o seletor de arquivo (espiar `HTMLInputElement.prototype.click`); acrescentar `has no inner choose button` (nenhum botão "Escolher imagem"), `opens the file chooser when the area is clicked`, `shows the upload progress inside the field while the cover is sent` (com `hold_uploads`, `progressbar` "Enviando a imagem" com `aria-valuenow` 50) e `ignores clicks while the cover is being sent` (área com `aria-disabled="true"`).
   - `book-form-page.test.tsx`: acrescentar `shows the progress of the pdf upload and a success notice after saving` (com `hold_uploads`, salvar com PDF, ver o `progressbar` "Enviando o PDF", liberar e ver o aviso `Arquivo enviado.`).
5. Rodar `pnpm --filter @atria/web exec vitest run src/features/library` e confirmar que os testes novos falham por falta da implementação.
6. Alterar `use-library-mutations.ts`:
   - Trocar o `fetch` de `uploadRaw` por `XMLHttpRequest`, com a assinatura `uploadRaw<T>(path, file, content_type, on_progress?: (percent: number) => void, method: 'PUT' = 'PUT')`: `open(method, '/api/v1' + path)`, os mesmos cabeçalhos (`Accept`, `Content-Type`, `X-CSRF-Token` do cookie `atria_csrf`), `upload.onprogress` chamando `on_progress(Math.round(loaded / total * 100))` quando `lengthComputable`, `onload` com `status` 2xx resolvendo o JSON de `responseText` (ou `undefined`) e fora disso lançando `ApiProblem` com `code` e `title` do corpo (como hoje), e `onerror`/`onabort` lançando `ApiProblem` `network_error` com `status: 0`.
   - Criar o estado do progresso no mesmo arquivo, no molde de `toast-store.ts`: `export type UploadTarget = 'cover' | 'pdf'`, um mapa `{ cover: number | null; pdf: number | null }` com assinantes, `setUploadProgress(target, value)` interno e `export function useUploadProgress(target: UploadTarget): number | null` com `useSyncExternalStore`.
   - `uploadCover` e `uploadPdf` passam o `on_progress` que grava no alvo e zeram o alvo (`null`) num `finally`.
   - `sendFiles` devolve se enviou algum arquivo; `useCreateItem` e `useUpdateItem` chamam `pushToast({ tone: 'success', message_key: 'library.upload.success' })` quando algum arquivo foi enviado, antes de navegar; `useCoverMutations().upload` e `usePdfUpload` fazem o mesmo no `onSuccess`. Os avisos de erro atuais continuam.
7. Alterar `cover-upload-field.tsx`: tirar o `Button` interno "Escolher imagem"; a área (`div`) ganha `role="button"`, `tabIndex={0}`, `aria-label={t('library.cover.area_label_<kind>')}`, `aria-disabled` enquanto `upload.isPending`, `onClick` que chama `input.current?.click()` e `onKeyDown` que faz o mesmo em Enter e Espaço (com `preventDefault`), ignorados enquanto o envio está pendente; o arrasto continua (`onDragOver`, `onDragLeave`, `onDrop`); o `input type="file"` sai de dentro da área e fica logo depois dela, ainda com `aria-label={label}`, escondido e com `tabIndex={-1}` (evita o clique do `input` subir para a área). Abaixo da área, quando `useUploadProgress('cover')` não é `null`, mostrar `ProgressBar` com `label={t('library.cover.uploading')}` e o texto `upload.percent`. "Trocar" e "Remover" continuam como estão.
8. Alterar `pdf-attachment-field.tsx`: abaixo da linha do PDF, quando `useUploadProgress('pdf')` não é `null`, mostrar `ProgressBar` com `label={t('library.pdf.uploading')}` e o texto `upload.percent`.
9. Alterar `library.module.css`, só com tokens: `.coverDrop` com `cursor: pointer`; `.coverDrop:hover, .coverDrop.over` com `--primary`, `--primary-soft` e cor `--primary`, como o protótipo; `.coverDrop:focus-visible` com `outline: 2px solid var(--primary)` e `outline-offset: 2px`; `.coverDrop[aria-disabled='true']` com `cursor: progress`, fundo `--surface-muted` e cor `--text-muted`, sem o realce de hover; `.uploadProgress` (barra e texto do percentual em linha, `gap: var(--s2)`, texto `--text-muted` em `--font-size-sm`); transições só com `--motion-*`. Remover `.dropBody` se ficar sem uso.
10. Rodar `pnpm --filter @atria/web exec vitest run src/features/library` até passar; depois `pnpm --filter @atria/web typecheck`, o ESLint e o Prettier da Verificação, sem nenhum warning.
10a. Em `article-form-page.test.tsx` e `video-form-page.test.tsx`, troque a busca da área por `getByRole('group', { name: ... })` pela área como `button` (o nome do passo 7) e o `input` pelo `aria-label` dele, sem mudar o que os testes conferem; rode `pnpm --filter @atria/web exec vitest run src/features/library` até passar.
11. Criar `apps/web/scripts/evidence-cover-upload.mjs`, em Node sem dependências novas, com código próprio no molde de `apps/web/scripts/evidence-library.mjs` (sem importá-lo): uso `node apps/web/scripts/evidence-cover-upload.mjs <caminho.png>`; sobe o Vite numa porta livre com a página virtual que carrega `src/features/library/evidence/harness.tsx` e encerra ao fim (KNW-006); simula a API (`POST /books`, `PUT /books/{id}/cover`, `PUT /books/{id}/pdf` segurado até o script liberar, `GET /books/{id}`); temas claro e escuro, em 1280 px e 360 px; em `/library/books/new`, captura: a área vazia; a área com foco por Tab (confere `document.activeElement` com `role="button"` e o contorno de foco); a área durante o arrasto (`dragover` com um arquivo, classe de arrasto); o formulário salvando com PDF de 21 MB (bytes gerados no script) com o `progressbar` "Enviando o PDF" visível e o botão Salvar com `aria-busy="true"`; e, depois de liberar, o aviso "Arquivo enviado.". Confere também que não há botão "Escolher imagem", o tema, a falta de rolagem horizontal, a falta de erro de JS e o axe sem violações (inclui `color-contrast`). Imprime `ok` ou `FALHA` por verificação, monta a prancha rotulada no caminho do argumento, imprime `png: <caminho> (N capturas)` e a última linha `ok  0 falha(s)`, e sai com código 1 se algo falhar.
12. Rodar o comando de print de "Evidências" com `VOSTOK_EVIDENCE` apontando para uma pasta temporária, corrigir o código da tarefa a cada `FALHA` e abrir a prancha para conferir.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/library --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/library --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/library`

### Verificação

```bash
# evidência: library-upload-tests.txt
pnpm --filter @atria/web exec vitest run src/features/library --reporter=verbose
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/library --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/library scripts/evidence-cover-upload.mjs
node --check apps/web/scripts/evidence-cover-upload.mjs
```

### Evidências

- `library-upload-tests.txt` (automática, da verificação)
  - Prova: os testes do Acervo passam, com a área de capa como controle por clique, teclado e arrasto, sem botão interno, a barra de progresso da capa e do PDF, o aviso de sucesso e a falha que limpa a barra (RF-22, RF-26, CT-21, CT-25, FA-03).
  - Trecho: `use-library-mutations.test.tsx` e `cover-upload-field.test.tsx` aprovados, entre eles `has no inner choose button`, `is operable by keyboard only`, `reports the upload progress of the cover and of the pdf`, `maps a network failure to network_error and clears the progress` e, em `book-form-page.test.tsx`, `shows the progress of the pdf upload and a success notice after saving`; a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `cover-upload.webm` (print): `node apps/web/scripts/evidence-cover-upload.mjs "$VOSTOK_EVIDENCE/cover-upload.webm"`
  - Requer: `apps/web/scripts/evidence-cover-upload.mjs`
  - Prova: no vídeo, a área de capa é o controle, com foco visível e estado de arrasto, sem botão interno, e o envio de um PDF de 21 MB mostra a barra de progresso e termina com o aviso de sucesso, nos dois temas e nas duas larguras (RF-22, RF-26, CT-21, CT-25).
  - Trecho: linhas `ok` de "sem botão Escolher imagem", "foco na área (role button)", "estado de arrasto", "barra Enviando o PDF visível", "Salvar com aria-busy", "aviso Arquivo enviado." e "axe sem violações (inclui color-contrast)", a linha `video:` e a última `ok  0 falha(s)`.
  - Falha: qualquer linha `FALHA` (botão interno presente, área sem foco, barra ausente, aviso ausente), a falta da linha `video:` ou código de saída diferente de 0.

### Concluída quando

- [x] A área de capa abre o seletor por clique, Tab com Enter ou Espaço, e aceita o arrasto, nos três formulários, sem botão interno (RF-22, CT-21).

  > Como comprovar: em `library-upload-tests.txt`, ver aprovados `pd36 uploads a cover by click and by drop`, `opens the file chooser when the area is clicked`, `is operable by keyboard only`, `has no inner choose button` e `pd36 uses 2 by 3 for books and 16 by 9 for articles and videos`; na prancha `cover-upload.webm`, ver a área vazia, com foco e em arrasto, sem botão dentro.

- [x] Os envios de capa e PDF mostram uma barra de progresso e, ao terminar, o aviso "Arquivo enviado." (RF-26, CT-25).

  > Como comprovar: ver aprovados `reports the upload progress of the cover and of the pdf`, `shows a success notice when the files are sent`, `shows the upload progress inside the field while the cover is sent` e `shows the progress of the pdf upload and a success notice after saving`; na prancha, ver a barra "Enviando o PDF" e o aviso.

- [x] Uma falha no envio para a barra, mostra o erro e o botão volta a aceitar o envio (FA-03).

  > Como comprovar: ver aprovados `maps a refused upload to the api problem code` e `maps a network failure to network_error and clears the progress`, e os testes existentes de erro (`pd36 shows the server error for unsupported_file_type and file_too_large`) continuam aprovados.

- [x] Os formulários do Acervo não têm violações no axe e funcionam pelo teclado, nos dois temas e a partir de 360 px (RNF-03, [project/frontend-10], [project/frontend-17]).

  > Como comprovar: ver aprovado `has no axe violations` em `cover-upload-field.test.tsx` e `book-form-page.test.tsx`; na prancha, só linhas `ok`, incluindo "axe sem violações" e "sem rolagem horizontal", e `ok  0 falha(s)`.

- [x] Testes, typecheck, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a Verificação e ver que termina sem erro.

## Descrição

### Resumo executivo

Faz da área tracejada da capa o próprio botão de escolher a imagem, por clique, teclado ou arrastando, sem o botão interno que confundia.
Os envios de capa e de PDF passam a mostrar uma barra de progresso e um aviso ao terminar, em vez de uma espera sem retorno num PDF grande.
Perfil padrão, risco baixo: muda só a tela do Acervo e o jeito de enviar o arquivo, com o mesmo endereço e a mesma proteção.
Depende do botão com carregando visível da biblioteca de componentes e não bloqueia outras tarefas.

### Detalhes técnicos

- **Abordagem:** a área de capa ganha `role="button"`, `tabIndex={0}`, clique e Enter/Espaço que abrem o `input type="file"` escondido, que sai de dentro da área; o envio de arquivos troca o `fetch` por `XMLHttpRequest` para ter `upload.onprogress`, com o progresso guardado num estado por arquivo (`cover`, `pdf`) lido pelos campos por `useUploadProgress`, e o aviso de sucesso pelo `pushToast` existente.
- **Componentes:** `cover-upload-field.tsx`, `pdf-attachment-field.tsx`, `use-library-mutations.ts`, `library.module.css` e `i18n/pt-br.json`; `ProgressBar` e `Button` (com `loading` da TASK-04) da `@atria/ui`, sem mudança nela.
- **Decisões:**
  - Área com `role="button"` e `tabIndex={0}`, como no protótipo; descartado um `label` envolvendo o `input`, que não aceita Enter de forma uniforme nem o anúncio de botão.
  - `XMLHttpRequest` para o progresso; descartado o `fetch` com corpo em stream (`duplex: 'half'`), que não tem suporte no Firefox (RNF-06) e exige HTTP/2.
  - Progresso num estado por alvo no arquivo dos hooks, no molde do `toast-store.ts`; descartado passar callbacks por props pelos formulários, que exigiria mudar os três formulários.
  - Barra dentro do campo de cada arquivo (capa e PDF); descartada a barra junto ao Salvar, porque os formulários não estão no plano e cada campo já tem o lugar do seu arquivo.
  - `pdf-attachment-field.tsx` entra além dos componentes do plano porque o CT-25 é o envio do PDF.
  - O `input` sai de dentro da área para o clique dele não subir e reabrir o seletor.
- **Riscos:** os testes do Acervo dependem do `fetch` falso; o `XMLHttpRequest` falso em `library-test-server.ts` reaproveita o mesmo tratamento para não mudar o comportamento dos testes existentes; o progresso de um arquivo pequeno pode ir direto a 100%, sem efeito no resultado.
- **Referências da spec:** RF-22, RF-26, CT-21, CT-25, FA-03, decisão 14 (inferência F); protótipo PD-36 e PD-37.
- **Evidências visuais:** um print gerado por `apps/web/scripts/evidence-cover-upload.mjs` sobre o harness do Acervo, conferido pelo usuário na finalização.
- **Arquivos em comum na onda 3:** nenhum.

### Card

- **Título:** Acervo: área de capa e envio com progresso
- **Tipo:** bug
- **Descrição:** A área tracejada da capa vira o próprio controle de escolha da imagem (clique, teclado e arrastar) e os envios de capa e PDF mostram barra de progresso e aviso de sucesso.
- **Critérios de aceite:**
  - [ ] A área de capa abre o seletor por clique, teclado e arrasto, sem botão interno.
  - [ ] Envio de capa e PDF com barra de progresso e aviso de sucesso ao terminar.
  - [ ] Falha no envio para a barra e mostra o erro.
  - [ ] Sem violações no axe, pelo teclado, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
| 4 | 2026-11-01 | ajuste | in_progress | article-form-page.test.tsx e video-form-page.test.tsx incluídos em Mudar (passo 10a), para acharem a área de capa como button; evidência visual passa de print a vídeo (cover-upload.webm, gravado pelo script com recordVideo) |
| 5 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 6 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 7 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário aceitou a diferença do comando 1: a linha nova é um teste novo aprovado cujo nome contém 'error', falso alarme do regression_alert; aceito(s): 1 |
| 8 | 2026-11-01 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 10 | 2026-11-01 | conferência | usuário | print cover-upload.webm conferido pelo usuário (sha256 0df72c9f) |
| 11 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-21/ |
| 12 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
| 2 | 2026-11-01 | agente | article-form-page.test.tsx e video-form-page.test.tsx incluídos em Mudar (passo 10a), para acharem a área de capa como button; evidência visual passa de print a vídeo (cover-upload.webm, gravado pelo script com recordVideo) |
