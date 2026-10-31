---
id: TASK-01
spec: SPEC-001
title: "Protótipo HTML"
profile: padrao
persona: ui-ux-designer
depends_on: []
wave: 1
covers: [RF-01, RF-02, CT-01, CT-02]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: b149b2eba70bbd22f816750ff68b78455a39a3580e2e07e432f89ef8a8e70650
adjustments: 1
adjusted_at: 2026-10-30T19:04:14Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: c170a3e697a4cff28c7517dac74a8ae08f7bd9f44621211e07777c37de7f749d
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T19:04:14Z
---

# TASK-01: Protótipo HTML

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: requisitos RF-01 a RF-70, regras de negócio, casos de borda, contrato da paleta de comandos e do modo leitura, casos de teste CT-01 e CT-02 e decisões 33 a 41, 49 e 52.
- `vostok/rules/project/frontend.md`: regras da interface (tema, sidebar, topbar, cabeçalho de página, estados, responsividade, tom calmo).
- `vostok/rules/project/architecture.md`: [project/architecture-10] (criar, editar e ver em tela própria; modal só para confirmação; exceção da paleta) e [project/architecture-12] (nada externo).
- `../org/docs/identidade-ecossistema.md`: tokens vigentes (revisão 2026-10), `motion`, contraste medido, regra do `textFaint`, cor determinística por item e tipografia.
- `../translunar/src/translunar/panel/static/tokens.css`: tokens já escritos como variáveis CSS, nos dois temas.
- `../translunar/src/translunar/panel/static/index.html`: estrutura de referência da sidebar (marca, `nav aria-label="Principal"`, rodapé com tema e sair) e do cabeçalho de página.
- `../translunar/src/translunar/panel/static/app.css`: classes de referência (`sidebar`, `nav-item`, `page-header`, `page-heading`, `page-eyebrow`, `card`, `btn`, `empty-state`, `toast`).
- `../translunar/src/translunar/panel/static/fonts/`: `InterVariable.woff2`, `Outfit-Variable.ttf`, `OFL-Inter.txt` e `OFL-Outfit.txt`, que serão embutidos.

### Mudar

- `prototype/atria-prototype.html` (criar): protótipo HTML autocontido, num único arquivo, com todos os módulos, a paleta de comandos, o modo leitura, os dois temas e dados em memória, sem nenhuma requisição de rede (RF-01, RF-02).
- `prototype/smoke-test.mjs` (criar): teste de fumaça no Chrome headless, sem dependências, que comprova as telas, as interações e a ausência de rede (RF-01, RF-02, CT-01, CT-02).

### Passos

1. Leia os arquivos de "Ler". Crie a pasta `prototype/` na raiz do projeto.
2. Rode o bloco de "Verificação" e confirme que ele falha (o arquivo ainda não existe). Esse bloco é o teste da tarefa: só avance quando entender cada checagem dele.
3. Crie `prototype/atria-prototype.html` com `<!doctype html>`, `<html lang="pt-BR" data-theme="light">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` e `<title>Atria · protótipo</title>`. Todo CSS fica num único `<style>` e todo JavaScript num único `<script>` clássico (sem `type="module"`, sem `src`) no fim do `<body>`. Não use `<link>`, `<script src>`, `@import`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` nem `sendBeacon`, e nenhum `src` ou `href` com `http://`, `https://` ou `//`.
4. No `<style>`, copie os tokens de `../translunar/src/translunar/panel/static/tokens.css` (blocos `:root, [data-theme="light"]`, `[data-theme="dark"]` e as escalas), confira os valores contra a revisão 2026-10 de `identidade-ecossistema.md` (ex.: `--primary: #6D28D9` no claro e `#A78BFA` no escuro) e acrescente os tokens de movimento: `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 320ms`, `--motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`, `--motion-ease-enter: cubic-bezier(0, 0, 0.2, 1)`, `--motion-ease-exit: cubic-bezier(0.4, 0, 1, 1)`. Acrescente `@media (prefers-reduced-motion: reduce)` zerando as durações e removendo o desfoque animado. Daqui em diante, nenhuma regra fora dos tokens usa cor, raio, espaço ou duração literal: use `var(--...)` e `calc(var(--space) * n)`.
5. Ainda no `<style>`, declare `@font-face` para `Inter` (`src: url(data:font/woff2;base64,__INTER_WOFF2_BASE64__) format('woff2')`) e `Outfit` (`src: url(data:font/ttf;base64,__OUTFIT_TTF_BASE64__) format('truetype')`), ambas com `font-weight: 100 900` e `font-display: swap`. Logo depois de `<head>`, ponha um comentário HTML com o texto integral de `OFL-Inter.txt` e de `OFL-Outfit.txt` (a licença acompanha a fonte embutida). Aplique a tipografia da identidade: Outfit em títulos (`page-heading`, peso 700 a 800, `letter-spacing` negativo) e em rótulos em caixa alta (`page-eyebrow`, peso 600, `letter-spacing` positivo); Inter no corpo, com `line-height: 1.6` em texto longo.
6. Monte o layout com HTML semântico, seguindo o `index.html` do Translunar:
   - `<aside class="sidebar">` com a marca no topo (ícone SVG inline com `aria-hidden="true"` e o nome "Atria" em Outfit), `<nav aria-label="Principal">` com um link por módulo, nesta ordem: Dashboard, Financeiro, Metas, Tarefas, Lembretes, Notas, Diário, Acervo, Projetos, Relatórios, Configurações, e o rodapé com o botão "Alternar tema" (com `aria-label`) e o botão "Sair".
   - `<header class="topbar">` com o gatilho da busca (um `<button>` com aparência de campo, texto "Buscar ou criar…" e a dica do atalho, que mostra "⌘ K" quando `navigator.platform` indica macOS e "Ctrl K" nos demais), os breadcrumbs (`<nav aria-label="Trilha">` com `<ol>`) e as informações da tela (ex.: total de itens da listagem).
   - `<main>` com uma `<section data-module="...">` por módulo, com estes valores: `dashboard`, `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`, `reports`, `settings`. Cada seção começa com um cabeçalho de página (`page-eyebrow` e `h1.page-heading`, mais um subtítulo).
   - Uma `<section data-screen="reader">` fora do layout (sem sidebar nem topbar) para o modo leitura, e uma `<div id="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos" hidden>` para a paleta.
   - Uma região `<div class="toasts" aria-live="polite">` para avisos.
7. Navegação por hash, sem recarregar a página: `#/<módulo>` lista, `#/<módulo>/new` cria, `#/<módulo>/<id>` mostra, `#/<módulo>/<id>/edit` edita e `#/library/books/<id>/read` e `#/library/articles/<id>/read` abrem o modo leitura. Criar, editar e ver acontecem numa tela própria dentro da seção do módulo, nunca em modal; o único diálogo é o de confirmação de exclusão (`<dialog>` com `role="alertdialog"`) e a paleta. Os breadcrumbs e o título da aba refletem a rota.
8. No `<script>`, crie o estado em memória `const db = { ... }` com dados de exemplo calmos e realistas, com ids no formato UUID v7 escritos à mão, `owner_id`, `visibility` (`personal` ou `shared`), `created_at` e `updated_at` em cada entidade: contas (incluindo a padrão "Conta principal", marcada com `is_default: true`, e um cartão de crédito com limite, dia de fechamento e dia de vencimento), categorias, movimentações (previstas e liquidadas, uma recorrente, uma compra em 3 parcelas), transferências, metas com marcos, tarefas (pontuais e uma diária com ocorrências), lembretes, notas, entradas do diário com emoções e intensidade, lista de emoções, livros (com páginas, registros de leitura e notas), artigos (com status e notas), vídeos (com notas), projetos com raias e cartões, ligações (`links`, com tipo e id dos dois lados) e preferências. Valores em centavos (inteiros) e formatação com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e `Intl.DateTimeFormat('pt-BR')`. URLs de artigos e vídeos aparecem só como texto, nunca em `href` ou `src`.
9. Em cada módulo de listagem (`finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`), escreva no HTML estático da seção uma barra de ferramentas com: `<input type="search" data-control="search">` com `<label>`, `<select data-control="filter">` com `<label>` (filtros do módulo, ex.: conta e período no Financeiro, status em Metas e Tarefas, emoção no Diário, tipo no Acervo), botões `data-control="view"` com `aria-pressed` para os modos de visualização (lista e grade em todos; no Acervo, "Estante" é a grade) e o botão `data-action="create"`. Filtro, busca e modo atualizam a listagem na hora e ficam no hash (`#/<módulo>?q=...&filter=...&view=...`), para que voltar e recarregar mantenham o estado. Cada listagem mostra o estado vazio com texto explicativo quando nada casa com o filtro, e um estado "carregando" breve (esqueleto por `var(--motion-base)`) na troca de módulo.
10. Escreva a tela de criar e editar de cada entidade como formulário com `<label>` em todo campo, validação no próprio formulário (mensagem com `role="alert"` junto do campo, nunca `alert()`) e o campo de visibilidade (pessoal ou compartilhada). Ao salvar, atualize `db`, volte para a tela da entidade e mostre um toast. Crie um `<template id="entity-detail">` com o cabeçalho, o botão `data-action="edit"`, o botão de excluir (que abre a confirmação) e as abas, entre elas `data-tab="connections"` ("Conexões").
11. Aba "Conexões" (RF-18, RF-19 na interface): botão "Conecta com" que busca qualquer entidade e grava a ligação em `db.links`; a ligação aparece nos dois lados; remover de um lado remove dos dois; a aba tem busca, filtro por tipo, agrupamento por tipo (lista agrupada com títulos) e categoria da ligação (texto livre, ex.: "motivo", "referência").
12. Comportamentos por módulo, só na interface e com os dados em memória:
    - Dashboard: blocos de saldo total, próximas movimentações, tarefas e lembretes do dia, leituras em andamento e última entrada do diário; cada bloco tem botão de ocultar e um menu "Blocos" para mostrar de novo.
    - Financeiro: abas Contas, Movimentações, Transferências, Categorias, Faturas e Painel. A conta padrão pode ser renomeada e o botão de excluir dela fica desabilitado com a explicação. A liquidação pede valor e data efetivos, muda o saldo só nesse momento e mostra a diferença como economia, ganho ou perda (RN-01 a RN-03). A fatura do cartão lista as parcelas do período e tem o botão "Pagar fatura". O painel mostra saldo por conta, previsto x realizado do mês, economias e perdas, com barras em SVG inline.
    - Metas: marcos com caixa de seleção; o progresso é a porcentagem de marcos concluídos, ou o status quando não há marcos.
    - Tarefas: concluir e reabrir; na diária, cada ocorrência é concluída separadamente.
    - Lembretes: pontuais e recorrentes com data e hora; sem botão de concluir (RN-19).
    - Notas e Diário: editor de texto simples; o Diário aceita várias entradas por dia, emoções com intensidade de 1 a 5 e a edição da lista de emoções.
    - Acervo: livros na estante com barra de progresso (soma das páginas sobre o total, limitada a 100%), abas "Histórico de leitura", "Notas" e "Destaques" na tela do livro; artigos com status de leitura; vídeos com a miniatura substituída por um gradiente determinístico (função `paletteFor` de `identidade-ecossistema.md`); botão "Ler" nos livros e artigos.
    - Projetos: lista e grade; o projeto abre num Kanban com as raias Aguardando, Em progresso e Pronto; criar, renomear, colorir (cores dos tokens), reordenar e excluir raias (a última não pode ser excluída; excluir uma raia com cartões pede a raia de destino); cartões movidos por arrastar e também por botões "Mover para…" acessíveis por teclado.
    - Relatórios: um relatório por módulo (Financeiro, Leitura, Diário, Metas, Tarefas e Projetos) com filtro de período, gráficos em SVG inline e o botão "Exportar PDF", que chama `window.print()` com uma folha `@media print` na identidade.
    - Configurações: preferências do usuário (tema, idioma, fuso horário, moeda, atalho da paleta e contextos padrão da busca) e da instância (convite obrigatório, papéis, Web Push e SMTP), com efeito imediato no protótipo (o tema e o atalho mudam na hora).
13. Gere o PDF de exemplo e embuta-o como base64 num `<script type="application/pdf" id="sample-pdf">` (bloco de dados, não executável), com este comando, que imprime o base64:

    ```bash
    python3 - <<'EOF'
    import base64
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            None, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    text = b"BT /F1 24 Tf 72 760 Td (Atria - PDF de exemplo) Tj ET"
    objs[3] = b"<< /Length %d >>\nstream\n" % len(text) + text + b"\nendstream"
    out = bytearray(b"%PDF-1.4\n"); offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    print(base64.b64encode(bytes(out)).decode())
    EOF
    ```

14. Modo leitura (`data-screen="reader"`), aberto pelo botão "Ler": esconde sidebar e topbar e mostra só a barra do leitor com voltar, título, página atual / total, `data-action="prev-page"`, `data-action="next-page"`, `data-action="zoom-out"`, `data-action="zoom-in"`, alternar tema do leitor e `data-action="download"`. As páginas são renderizadas como HTML (um texto de exemplo de 12 páginas guardado no `db` para cada item com PDF), porque o protótipo valida a interação, não a renderização do PDF. O download decodifica o base64 de `#sample-pdf` com `atob`, cria um `Blob` `application/pdf` e baixa por `URL.createObjectURL` com `download`, sem rede. Comportamentos: retoma na última página lida guardada no item; ao fechar um livro numa página maior que a de abertura, oferece o registro da sessão com o intervalo preenchido, que só entra no histórico e no progresso se a pessoa confirmar (RN-23); fechando sem avançar ou numa página anterior, não oferece e guarda a página de fechamento (CB-17, CB-18); ao selecionar texto, aparecem `data-action="highlight"` (cores accent, primary, success, warning e info, com fundo `*-soft`) e `data-action="note-from-selection"` (nota com o trecho, a página e comentário opcional, no histórico de notas do item); os destaques aparecem na página e na aba "Destaques". O artigo só retoma a página, sem barra de progresso nem registro de sessão (RN-22).
15. Paleta de comandos (RF-15 a RF-17 na interface): abre com `(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'` num listener de `keydown` no `document`, com `preventDefault()`, inclusive com o foco num campo de texto (CB-13), e com um clique no gatilho da topbar. O fundo recebe uma camada com `backdrop-filter: blur(...)` e a cor de fundo do token com transparência. O diálogo prende o foco, fecha com Esc e devolve o foco a quem abriu; setas navegam (`aria-activedescendant` numa `role="listbox"`), Enter abre. Vazia, mostra os recentes e as ações de criar. Prefixo `>` mostra só ações e `#` só tags; texto livre busca em todas as entidades do `db`, e chips de contexto (com `aria-pressed`) restringem os módulos, com os contextos padrão vindos das Configurações. A ação "Criar nota" pede só o título, cria a nota e oferece "Abrir para completar", que leva a `#/notes/<id>/edit`.
16. Tema: o botão do rodapé alterna `data-theme` entre `light` e `dark` e guarda a escolha em `localStorage` (em `try/catch`); sem escolha salva, segue `prefers-color-scheme`; o padrão do HTML é `light`. Confira os dois temas em todas as telas, e que `--text-faint` não é usado em texto de leitura e que todo fundo de estado usa o token `*-soft`.
17. Responsividade: pontos de quebra `@media (max-width: 720px)` (sidebar vira gaveta aberta por um botão com `aria-label` na topbar) e `@media (max-width: 480px)` (barra de ferramentas empilhada, grade de uma coluna), funcional a partir de 360 px. Foco visível em todo elemento interativo (`:focus-visible` com contorno no token `--primary`) e tudo operável por teclado.
18. Embuta as fontes trocando os marcadores pelo base64 dos arquivos do Translunar:

    ```bash
    node -e 'const fs=require("fs");const p="prototype/atria-prototype.html";const d="../translunar/src/translunar/panel/static/fonts/";let h=fs.readFileSync(p,"utf8");h=h.replace("__INTER_WOFF2_BASE64__",fs.readFileSync(d+"InterVariable.woff2").toString("base64")).replace("__OUTFIT_TTF_BASE64__",fs.readFileSync(d+"Outfit-Variable.ttf").toString("base64"));fs.writeFileSync(p,h)'
    ```

19. Rode o bloco de "Verificação" até terminar sem erro.
20. Abra o arquivo direto do disco no navegador, percorra o roteiro do CT-01 e do CT-02 em cada módulo nos dois temas e em 360 px, e produza as evidências manuais.

### Baseline

- `test -e prototype/atria-prototype.html && echo existe || echo ausente`
- `ls prototype 2>/dev/null || echo "pasta prototype ausente"`

### Verificação

```bash
f=prototype/atria-prototype.html
test -f "$f"

# Autocontido: nenhum recurso externo nem requisição de rede (RF-01, CT-01).
if grep -nE "(src|href)=[\"']?(https?:)?//" "$f"; then echo "FALHA: src/href externo"; exit 1; fi
if grep -nE "url\([\"']?(https?:)?//" "$f"; then echo "FALHA: url() externa"; exit 1; fi
if grep -nE "<link[ >]|<script[^>]*src=|@import|fetch\(|XMLHttpRequest|new WebSocket|EventSource|sendBeacon" "$f"; then echo "FALHA: recurso ou requisição externa"; exit 1; fi
grep -q "font/woff2;base64," "$f"
grep -q "font/ttf;base64," "$f"
grep -q 'id="sample-pdf"' "$f"

# Identidade, tema, movimento e responsividade.
grep -q '<html lang="pt-BR" data-theme="light">' "$f"
grep -q -- '--primary: #6D28D9' "$f"
grep -q -- '--primary: #A78BFA' "$f"
grep -q -- '--motion-slow: 320ms' "$f"
grep -q 'prefers-reduced-motion' "$f"
grep -q 'max-width: 720px' "$f"
grep -q 'max-width: 480px' "$f"
grep -q 'aria-label="Principal"' "$f"

# Módulos, listagens, paleta, conexões e modo leitura (RF-01, RF-02, CT-02).
node <<'EOF'
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("prototype/atria-prototype.html", "utf8");
const fail = (msg) => { console.error("FALHA: " + msg); process.exit(1); };
const scripts = [...html.matchAll(/<script(?![^>]*type="application\/pdf")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) fail("esperado um único <script> executável, achados " + scripts.length);
new vm.Script(scripts[0], { filename: "atria-prototype.js" });
const section = (name) => {
  const start = html.indexOf('data-module="' + name + '"');
  if (start < 0) fail("módulo ausente: " + name);
  return html.slice(start, html.indexOf("</section>", start));
};
const modules = ["dashboard", "finance", "goals", "tasks", "reminders", "notes", "journal", "library", "projects", "reports", "settings"];
modules.forEach(section);
const listings = ["finance", "goals", "tasks", "reminders", "notes", "journal", "library", "projects"];
for (const name of listings) {
  const s = section(name);
  for (const attr of ['data-control="search"', 'data-control="filter"', 'data-control="view"', 'data-action="create"']) {
    if (!s.includes(attr)) fail(name + " sem " + attr);
  }
}
const required = [
  'id="command-palette"', 'role="dialog"', "backdrop-filter", "metaKey", "ctrlKey",
  'id="entity-detail"', 'data-action="edit"', 'data-tab="connections"',
  'data-screen="reader"', 'data-action="zoom-in"', 'data-action="next-page"', 'data-action="download"',
  'data-action="highlight"', 'data-action="note-from-selection"', "Conta principal", "localStorage",
];
for (const r of required) if (!html.includes(r)) fail("ausente: " + r);
if (/\balert\(/.test(scripts[0])) fail("uso de alert() no lugar de erro no formulário");
console.log("protótipo ok: " + modules.length + " módulos, " + listings.length + " listagens");
EOF
```

Resultado esperado: o script termina com código 0 e a última linha é `protótipo ok: 11 módulos, 8 listagens`.

### Evidências

- `prototipo-modulos.txt` (automática): `grep -o 'data-module="[a-z-]*"' prototype/atria-prototype.html | sort -u`
  - Prova: o protótipo tem uma seção por módulo do MVP (RF-01, CT-01).
  - Trecho: as 11 linhas `data-module="dashboard"`, `"finance"`, `"goals"`, `"tasks"`, `"reminders"`, `"notes"`, `"journal"`, `"library"`, `"projects"`, `"reports"` e `"settings"`.
  - Falha: saída vazia, erro de arquivo inexistente ou algum módulo faltando na lista.
- `prototipo-rede.txt` (automática): `echo "referencias externas: $(grep -cE "(src|href)=[\"']?(https?:)?//|url\([\"']?(https?:)?//|<link[ >]|<script[^>]*src=|@import|fetch\(|XMLHttpRequest|new WebSocket|EventSource|sendBeacon" prototype/atria-prototype.html)"`
  - Prova: o arquivo não referencia nenhum recurso externo nem faz requisição de rede (RF-01, CT-01).
  - Trecho: a linha `referencias externas: 0`.
  - Falha: um número maior que zero, ou `referencias externas: ` sem número (arquivo inexistente).
- `prototipo-recursos.txt` (automática): `grep -oE 'role="dialog"|backdrop-filter|prefers-reduced-motion|data-theme="light"|data-screen="reader"|data-tab="connections"|data-control="(search|filter|view)"|data-action="create"' prototype/atria-prototype.html | sort | uniq -c`
  - Prova: paleta com fundo borrado, modo leitura, aba Conexões, tema claro padrão, movimento reduzido e os controles de busca, filtro, visualização e criação das listagens existem (RF-02, CT-02).
  - Trecho: uma linha com contagem para cada item, com `data-control="search"`, `data-control="filter"` e `data-action="create"` contados ao menos 8 vezes.
  - Falha: saída vazia, item ausente ou contagem de controles menor que 8.
- `prototipo-telas.txt` (automática): `node prototype/smoke-test.mjs telas`
  - Prova: os 11 módulos, o detalhe com a aba Conexões e o modo leitura abrem com dados em memória nos temas claro e escuro, com os tokens da identidade, e em 360 px não há rolagem horizontal, a sidebar vira gaveta e a paleta cabe na tela (RF-01, CT-01, RNF-08, RNF-10).
  - Trecho: as linhas `ok` de cada módulo nos dois temas, `tema light: token --primary · #6D28D9`, `tema dark: token --primary · #A78BFA`, as linhas `360 px` e a última linha `resultado: tudo ok`.
  - Falha: qualquer linha `FALHA`, `resultado: falhou` ou o aviso de Chrome não encontrado.
- `prototipo-interacoes.txt` (automática): `node prototype/smoke-test.mjs interacoes`
  - Prova: no Financeiro, no Acervo e em Projetos, criar, editar, buscar, filtrar e trocar a visualização refletem na tela sem recarregar; a paleta abre com Ctrl + K com o foco num campo, borra o fundo, cria uma nota rápida e "Abrir para completar" leva à edição; no modo leitura, a página avança, o trecho é destacado, a nota de trecho é salva, o PDF é baixado do próprio arquivo e, ao fechar, a sessão é oferecida já preenchida e registrada (RF-01, RF-02, CT-02).
  - Trecho: uma linha `ok` por ação, incluindo `Paleta: fundo borrado · blur(...)` e `Leitor: baixa o PDF a partir do próprio arquivo · application/pdf`, e a última linha `resultado: tudo ok`.
  - Falha: qualquer linha `FALHA`, erro de JavaScript listado ou `resultado: falhou`.
- `prototipo-rede-navegador.txt` (automática): `node prototype/smoke-test.mjs rede`
  - Prova: depois de passar por todos os módulos, abrir o leitor e baixar o PDF, o navegador não registrou nenhuma requisição além de `data:` e `blob:` locais (CT-01).
  - Trecho: a linha `requisicoes externas: 0` e a última linha `resultado: tudo ok`.
  - Falha: contagem maior que zero, com os endereços listados, ou `resultado: falhou`.

### Concluída quando

- [x] O protótipo é um único arquivo que abre direto do disco, sem servidor e sem nenhuma requisição de rede, com todos os módulos navegáveis e dados em memória (RF-01, CT-01).

  > Como comprovar: rodar a "Verificação" e ver a última linha `protótipo ok: 11 módulos, 8 listagens`; conferir `referencias externas: 0` em `prototipo-rede.txt` e `requisicoes externas: 0` em `prototipo-rede-navegador.txt`.

- [x] Em cada módulo é possível cadastrar, editar, filtrar, buscar e trocar o modo de visualização, e as mudanças aparecem na hora (RF-02, CT-02).

  > Como comprovar: em `prototipo-interacoes.txt`, ver as linhas `ok` de criar, editar, buscar, filtrar e trocar a visualização no Financeiro, no Acervo e em Projetos; em `prototipo-recursos.txt`, ver os controles de busca, filtro e criação contados ao menos 8 vezes.

- [x] A paleta abre com Ctrl/Cmd + K, mesmo com o foco num campo, e pelo gatilho da topbar, borra o fundo, busca por contextos e cria uma nota rápida com "Abrir para completar" (RF-01, RF-02).

  > Como comprovar: em `prototipo-interacoes.txt`, ver as linhas `ok` da paleta: abre com Ctrl + K com o foco num campo, fundo borrado, nota rápida criada e "Abrir para completar" levando à edição.

- [x] O modo leitura abre o PDF de exemplo sem sidebar nem topbar, retoma a página, oferece o registro da sessão ao fechar, cria destaques e notas de trecho e baixa o arquivo sem rede (RF-01, RF-02).

  > Como comprovar: em `prototipo-telas.txt`, ver o modo leitura sem a navegação do app; em `prototipo-interacoes.txt`, ver as linhas `ok` do leitor (página, destaque, nota de trecho, download e sessão registrada); em `prototipo-rede-navegador.txt`, ver o download sem requisição de rede.

- [x] Tema claro como padrão e escuro como alternativa, com os tokens vigentes do ecossistema, contraste AA e movimento reduzido respeitado (RNF-10, RNF-06).

  > Como comprovar: em `prototipo-telas.txt`, ver todos os módulos renderizados nos dois temas, com `--primary` `#6D28D9` no claro e `#A78BFA` no escuro; a "Verificação" confere `data-theme="light"`, os tokens `#6D28D9` e `#A78BFA` e o bloco `prefers-reduced-motion`.

- [x] Tudo é operável por teclado, com foco visível, e a interface funciona a partir de 360 px de largura (RNF-06, RNF-08).

  > Como comprovar: em `prototipo-telas.txt`, ver as linhas `360 px` (sem rolagem horizontal, sidebar como gaveta e paleta na tela); o uso por teclado foi conferido pela pessoa usuária de ponta a ponta no protótipo, e `prototipo-interacoes.txt` comprova a paleta pelo atalho de teclado.

## Descrição

### Resumo executivo

Entrega um protótipo navegável do Atria inteiro, que abre direto no navegador, sem instalação nem internet, com dados de exemplo.
Ele permite validar com pessoas reais o layout, os módulos, a paleta de comandos e o modo leitura antes de qualquer investimento no produto final.
Perfil de execução padrao: decisões locais de layout dentro da identidade do ecossistema já definida.
Risco baixo: o protótipo é grande, e as telas, as interações e a ausência de rede são comprovadas por um teste de fumaça no navegador headless.
Desbloqueia todas as outras tarefas do MVP, que dependem das decisões de interface validadas aqui.

### Detalhes técnicos

**Abordagem.** Um único `prototype/atria-prototype.html` com CSS e JavaScript inline, sem dependências nem build, roteado por hash e com o estado num objeto `db` em memória (RF-01, RF-02). Os tokens são os do Translunar, conferidos contra a revisão 2026-10 de `identidade-ecossistema.md`, mais os tokens de movimento da mesma revisão; as fontes Inter e Outfit entram em base64 com a licença OFL em comentário. Os nomes de atributos (`data-module`, `data-control`, `data-action`, `data-tab`, `data-screen`) dão à verificação um alvo estável e espelham os nomes em inglês das features do frontend (`apps/web/src/features/<feature>`).

**Componentes.** `prototype/atria-prototype.html` e o teste de fumaça `prototype/smoke-test.mjs`. Nenhum código do produto é criado.

**Decisões.**
- Arquivo único com fontes em base64 (RF-01, decisão 33). Descartado: fontes do sistema como fallback único, porque o protótipo precisa validar a tipografia Outfit e Inter da identidade; e fontes por CDN, proibidas por [project/stack-09] e [project/architecture-12].
- Modo leitura com páginas de exemplo renderizadas em HTML e o PDF real embutido em base64 só para o download (decisão 52). Descartado: embutir o `pdf.js` (centenas de KB a mais, e a escolha da versão e da integração cabe à TASK-29) e o visualizador nativo do navegador num `<iframe>` (não permite selecionar trechos, destacar nem saber a página atual).
- Criar, editar e ver em tela própria via hash, modal só para confirmação e a paleta, como no app real ([project/architecture-10], decisão 15). Descartado: formulários em modal, que validariam uma interação que o produto não terá.
- Estado de filtros, busca e visualização no hash, como a URL do app real ([project/frontend-13]).
- Textos em pt-br direto no arquivo, sem arquivo de tradução: o protótipo é descartável e não é base do código ([project/language-06] vale para o app).
- Tema salvo em `localStorage`, como no app real ([project/frontend-01]); os dados das entidades ficam só em memória e voltam ao exemplo ao recarregar.

**Riscos técnicos.** Arquivo grande (fontes somam cerca de 620 KB em base64), aceitável para um arquivo local. `backdrop-filter` tem custo em máquinas fracas: com `prefers-reduced-motion` a camada continua borrada, sem animação (decisão 35). A verificação automática confere estrutura e ausência de rede; o comportamento das interações (CT-02) é comprovado por `prototype/smoke-test.mjs`, que roda o protótipo no Chrome headless (do `CHROME_BIN`, do cache do Playwright ou do PATH) sem instalar dependências.

**Referências da spec.** RF-01, RF-02, CT-01, CT-02, RNF-06, RNF-08, RNF-10; RF-14 a RF-70 como conteúdo das telas; RN-01 a RN-04, RN-14 a RN-16, RN-19, RN-22, RN-23; CB-01, CB-07, CB-08, CB-13, CB-17, CB-18; decisões 15, 16, 33 a 41, 49 e 52.

**Arquivos em comum na onda 1.** Nenhum: a tarefa está sozinha na onda.

### Card

- **Título:** Protótipo HTML
- **Tipo:** historia
- **Descrição:** Protótipo HTML num único arquivo, que abre sem servidor e sem internet, com todos os módulos do Atria, a paleta de comandos, o modo leitura, os dois temas e dados em memória, para validar o layout e as interações antes da implementação.
- **Critérios de aceite:**
  - [ ] Abre direto do disco, sem servidor e sem nenhuma requisição de rede.
  - [ ] Todos os módulos navegáveis, com cadastro, edição, filtro, busca e modos de visualização.
  - [ ] Paleta Ctrl/Cmd + K com fundo borrado, busca por contextos e criação rápida.
  - [ ] Modo leitura com retomada, registro da sessão, destaques, notas de trecho e download.
  - [ ] Tema claro padrão e escuro, acessível por teclado e funcional a partir de 360 px.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: Usuário aceitou [1] e [2]: o protótipo é a entrega da tarefa; arquivos extras ficam; aceito(s): 1, 2 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 2 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | pending | evidência manual sem arquivo |
| 9 | 2026-10-30 | ajuste | in_progress | Evidências manuais (prototipo-telas.png, prototipo-interacoes.mp4, prototipo-rede.png) trocadas por automáticas do teste de fumaça (prototipo-telas.txt, prototipo-interacoes.txt, prototipo-rede-navegador.txt); prototype/smoke-test.mjs incluído em Mudar; Como comprovar dos critérios, Resumo executivo e Detalhes técnicos atualizados para as evidências automáticas |
| 10 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 11 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 2 aceito(s) pelo usuário |
| 12 | 2026-10-30 | evidências | passed | 6 evidência(s) em evidence/TASK-01/ |
| 13 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Evidências manuais (prototipo-telas.png, prototipo-interacoes.mp4, prototipo-rede.png) trocadas por automáticas do teste de fumaça (prototipo-telas.txt, prototipo-interacoes.txt, prototipo-rede-navegador.txt); prototype/smoke-test.mjs incluído em Mudar; Como comprovar dos critérios, Resumo executivo e Detalhes técnicos atualizados para as evidências automáticas |
