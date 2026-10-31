// Teste de fumaça do protótipo no Chrome headless, sem dependências: injeta um roteiro numa cópia
// temporária do arquivo, abre a cópia direto do disco e lê o resultado que o roteiro escreve no DOM.
// Uso: node prototype/smoke-test.mjs telas|interacoes|rede
// O Chrome vem de CHROME_BIN, do cache do Playwright (~/.cache/ms-playwright) ou do PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const MODE = process.argv[2];
const SRC = new URL('./atria-prototype.html', import.meta.url);

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) { const p = join(cache, d, sub); if (existsSync(p)) return p; }
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [bin], { encoding: 'utf8' }).trim(); } catch { /* tenta o próximo */ }
  }
  return null;
}

// Funções comuns do roteiro, executadas dentro da página
const PRELUDE = `
window.__errs = [];
addEventListener('error', (e) => window.__errs.push(e.message));
addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason)));
window.__out = [];
// Ajudantes num objeto próprio, para não colidir com as funções globais do protótipo (go, $...)
window.T = {};
T.W = (ms) => new Promise((r) => setTimeout(r, ms));
T.ok = (cond, name, extra) => window.__out.push((cond ? 'ok     ' : 'FALHA  ') + name + (extra ? ' · ' + extra : ''));
T.go = async (h, ms) => { location.hash = h; await T.W(ms || 700); };
T.visible = (el) => !!el && !el.hidden && !el.closest('[hidden]') && el.getBoundingClientRect().width > 0;
T.noOverflow = () => document.documentElement.scrollWidth <= innerWidth + 1;
T.fill = (form, name, value) => { const el = form.elements[name]; el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
T.finish = () => { T.ok(window.__errs.length === 0, 'nenhum erro de JavaScript', window.__errs.join(' | ')); const p = document.createElement('pre'); p.id = 'SMOKE'; p.textContent = window.__out.join('\\n'); document.body.append(p); };
`;

const MODULES = ['dashboard', 'finance', 'goals', 'tasks', 'reminders', 'notes', 'journal', 'library', 'projects', 'reports', 'settings'];

// Cada cenário: largura da janela e o roteiro
const SCENARIOS = {
  telas: [
    { label: 'desktop', width: 1440, script: `
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase();
        ok(primary === (theme === 'light' ? '#6D28D9' : '#A78BFA'), 'tema ' + theme + ': token --primary', primary);
        for (const m of ${JSON.stringify(MODULES)}) {
          await go('#/' + m);
          const s = document.querySelector('[data-module="' + m + '"]');
          ok(visible(s) && s.innerText.trim().length > 40, 'tema ' + theme + ': módulo ' + m + ' renderiza com dados', (s.querySelector('h1') || {}).textContent);
        }
        const g = db.goals[0];
        await go('#/goals/' + g.id + '?tab=connections');
        const tab = document.querySelector('[data-module="goals"] [role="tab"][aria-selected="true"]');
        ok(tab && /Conex/.test(tab.textContent), 'tema ' + theme + ': detalhe com a aba Conexões', tab && tab.textContent);
        const b = db.books.find((x) => x.has_pdf);
        await go('#/library/books/' + b.id + '/read', 900);
        const rd = document.querySelector('[data-screen="reader"]');
        ok(visible(rd) && !visible(document.querySelector('.sidebar')), 'tema ' + theme + ': modo leitura sem a navegação do app');
        await go('#/dashboard');
      }
      document.documentElement.setAttribute('data-theme', 'light');
      ok(matchMedia('(prefers-reduced-motion: reduce)') && [...document.styleSheets].some((ss) => [...ss.cssRules].some((r) => r.conditionText && r.conditionText.includes('prefers-reduced-motion'))), 'regras de movimento reduzido presentes');
    ` },
    { label: '360 px', width: 360, script: `
      for (const h of ['#/dashboard', '#/tasks', '#/finance']) {
        await go(h);
        ok(noOverflow(), '360 px: sem rolagem horizontal em ' + h, document.documentElement.scrollWidth + ' de ' + innerWidth);
      }
      const menu = document.getElementById('menu-btn');
      ok(visible(menu) && document.querySelector('.sidebar').getBoundingClientRect().right <= 1, '360 px: sidebar vira gaveta com botão de menu');
      document.getElementById('search-trigger').click(); await W(200);
      ok(visible(document.getElementById('command-palette')) && noOverflow(), '360 px: paleta aberta cabe na tela');
    ` },
  ],
  interacoes: [
    { label: 'desktop', width: 1440, script: `
      const rows = (m) => document.querySelectorAll('[data-module="' + m + '"] [data-body] .row, [data-module="' + m + '"] [data-body] .tile').length;
      // Financeiro: criar, editar, filtrar e buscar
      await go('#/finance/new?type=transaction&flow=expense');
      let f = document.querySelector('[data-module="finance"] form');
      fill(f, 'description', 'Teste de fumaça'); fill(f, 'amount', '12,34'); f.requestSubmit(); await W(500);
      const t = db.transactions.find((x) => x.description === 'Teste de fumaça');
      await go('#/finance?tab=expense&period=all');
      ok(!!t && document.querySelector('[data-module="finance"] [data-body]').innerText.includes('Teste de fumaça'), 'Financeiro: movimentação criada aparece na listagem sem recarregar');
      await go('#/finance/' + t.id + '/edit');
      f = document.querySelector('[data-module="finance"] form'); fill(f, 'description', 'Teste de fumaça editado'); f.requestSubmit(); await W(500);
      ok(db.transactions.some((x) => x.description === 'Teste de fumaça editado'), 'Financeiro: edição salva');
      await go('#/finance?tab=expense&period=all');
      const before = rows('finance');
      const q = document.querySelector('[data-module="finance"] [data-control="search"]'); q.value = 'fumaça editado'; q.dispatchEvent(new Event('input', { bubbles: true })); await W(500);
      ok(rows('finance') === 1 && before > 1, 'Financeiro: busca reduz a lista', before + ' → ' + rows('finance'));
      q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await W(500);
      const fs = document.querySelector('[data-module="finance"] [data-control="filter"]'); const opt = [...fs.options].find((o) => o.value && o.value !== fs.value);
      fs.value = opt.value; fs.dispatchEvent(new Event('change', { bubbles: true })); await W(500);
      ok(rows('finance') < before, 'Financeiro: filtro por conta reduz a lista', before + ' → ' + rows('finance'));
      // Acervo: criar e trocar a visualização
      await go('#/library/new?type=book');
      f = document.querySelector('[data-module="library"] form'); fill(f, 'title', 'Livro de fumaça'); fill(f, 'author', 'Autoria de teste'); f.requestSubmit(); await W(500);
      await go('#/library?tab=book');
      ok(document.querySelector('[data-module="library"] [data-body]').innerText.includes('Livro de fumaça'), 'Acervo: livro criado aparece na listagem');
      document.querySelector('[data-module="library"] [data-control="view"][data-view="grid"]').click(); await W(500);
      ok(document.querySelectorAll('[data-module="library"] [data-body] .tile').length > 0, 'Acervo: troca para estante');
      document.querySelector('[data-module="library"] [data-control="view"][data-view="list"]').click(); await W(500);
      ok(document.querySelectorAll('[data-module="library"] [data-body] .row').length > 0, 'Acervo: volta para lista');
      // Projetos: criar cartão e ver no quadro
      const p = db.projects[0];
      await go('#/projects/' + p.id + '/cards/new?lane=' + p.lanes[0].id);
      f = document.querySelector('[data-module="projects"] form'); fill(f, 'title', 'Cartão de fumaça'); f.requestSubmit(); await W(500);
      await go('#/projects/' + p.id + '?tab=board');
      ok(document.querySelector('[data-module="projects"]').innerText.includes('Cartão de fumaça'), 'Projetos: cartão criado aparece no quadro');
      // Paleta: Ctrl+K com o foco num campo, fundo borrado, nota rápida e "Abrir para completar"
      await go('#/notes');
      const field = document.querySelector('[data-module="notes"] [data-control="search"]'); field.focus();
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); await W(200);
      const pal = document.getElementById('command-palette');
      ok(visible(pal), 'Paleta: abre com Ctrl+K com o foco num campo');
      ok(/blur/.test(getComputedStyle(pal).backdropFilter || getComputedStyle(pal).webkitBackdropFilter || ''), 'Paleta: fundo borrado', getComputedStyle(pal).backdropFilter);
      const inp = document.getElementById('palette-input'); const key = (k) => inp.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      inp.value = '>criar nota'; inp.dispatchEvent(new Event('input', { bubbles: true })); key('Enter'); await W(100);
      inp.value = 'Nota rápida de fumaça'; inp.dispatchEvent(new Event('input', { bubbles: true })); key('Enter'); await W(200);
      ok(db.notes.some((n) => n.title === 'Nota rápida de fumaça'), 'Paleta: cria nota rápida');
      key('Enter'); await W(700);
      ok(/#\\/notes\\/[^/]+\\/edit/.test(location.hash), 'Paleta: "Abrir para completar" abre a edição da nota', location.hash.slice(0, 30));
      // Modo leitura: navegar, destacar, nota de trecho, baixar e registrar a sessão ao fechar
      const b = db.books.find((x) => x.has_pdf); const readings = b.readings.length;
      await go('#/library/books/' + b.id + '/read', 900);
      const pos = () => document.querySelector('[data-slot="reader-pos"]').textContent;
      const p0 = pos(); document.querySelector('[data-action="next-page"]').click(); await W(200);
      ok(pos() !== p0, 'Leitor: avança de página', p0 + ' → ' + pos());
      const pick = async () => { const tw = document.createTreeWalker(document.querySelector('.reader-page'), NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim().length >= 20 && !n.parentElement.closest('mark, h2') ? 1 : 3) }); const el = tw.nextNode(); const r = document.createRange(); r.setStart(el, 0); r.setEnd(el, 20); getSelection().removeAllRanges(); getSelection().addRange(r); await W(200); };
      const hl = db.highlights.length; await pick();
      document.querySelector('[data-action="highlight"][data-color="primary"]').click(); await W(200);
      ok(db.highlights.length === hl + 1, 'Leitor: destaca o trecho selecionado');
      const nn = db.item_notes.length; await pick();
      document.querySelector('[data-action="note-from-selection"]').click(); await W(100);
      document.querySelector('#sel-note input').value = 'Nota de trecho de fumaça';
      document.querySelector('[data-action="save-selection-note"]').click(); await W(200);
      ok(db.item_notes.length === nn + 1, 'Leitor: cria nota do trecho');
      let blobType = ''; const orig = URL.createObjectURL; URL.createObjectURL = (bl) => { blobType = bl.type; return orig.call(URL, bl); };
      document.querySelector('[data-action="download"]').click(); await W(200); URL.createObjectURL = orig;
      ok(blobType === 'application/pdf', 'Leitor: baixa o PDF a partir do próprio arquivo', blobType);
      document.querySelector('[data-action="close-reader"]').click(); await W(300);
      const dlg = document.getElementById('confirm-dialog'); const ses = document.getElementById('ses-pages');
      ok(dlg.open && ses && Number(ses.value) > 0, 'Leitor: ao fechar, oferece a sessão com as páginas preenchidas', ses && ses.value);
      document.querySelector('[data-confirm="ok"]').click(); await W(800);
      ok(b.readings.length === readings + 1, 'Leitor: sessão registrada no histórico');
    ` },
  ],
  rede: [
    { label: 'desktop', width: 1440, script: `
      for (const m of ${JSON.stringify(MODULES)}) await go('#/' + m, 500);
      const b = db.books.find((x) => x.has_pdf);
      await go('#/library/books/' + b.id + '/read', 900);
      document.querySelector('[data-action="download"]').click(); await W(300);
      await go('#/dashboard', 500);
      const ext = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !/^(data|blob):/.test(n));
      window.__out.push('requisicoes externas: ' + ext.length);
      ext.forEach((n) => window.__out.push('  ' + n));
      ok(ext.length === 0, 'nenhuma requisição de rede depois de navegar por todos os módulos, abrir o leitor e baixar o PDF');
    ` },
  ],
};

if (!SCENARIOS[MODE]) { console.error('uso: node prototype/smoke-test.mjs telas|interacoes|rede'); process.exit(2); }
const chrome = findChrome();
if (!chrome) { console.error('FALHA  Chrome ou Chromium não encontrado (defina CHROME_BIN)'); process.exit(1); }

const html = readFileSync(SRC, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'atria-smoke-'));
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
let failed = false;
try {
  for (const sc of SCENARIOS[MODE]) {
    const page = html
      .replace('<head>', '<head><script>' + PRELUDE + '</script>')
      .replace('</body>', '<script>(async () => { const { W, ok, go, visible, noOverflow, fill } = T; await W(800); ' + sc.script + ' })().catch((e) => window.__errs.push("roteiro: " + e.message)).finally(T.finish);</script></body>');
    const file = join(dir, 'prototipo.html'); writeFileSync(file, page);
    // O Chrome headless não abre janela com menos de 500 px: larguras menores rodam num iframe dessa largura
    let target = 'file://' + file + '#/dashboard';
    if (sc.width < 500) {
      const wrap = join(dir, 'moldura.html');
      writeFileSync(wrap, '<!doctype html><body style="margin:0"><iframe id="f" src="prototipo.html#/dashboard" style="width:' + sc.width + 'px;height:800px;border:0"></iframe><script>const t = setInterval(() => { const d = document.getElementById("f").contentDocument; const o = d && d.getElementById("SMOKE"); if (o) { clearInterval(t); const p = document.createElement("pre"); p.id = "SMOKE"; p.textContent = o.textContent; document.body.append(p); } }, 200);</script></body>');
      target = 'file://' + wrap;
    }
    const dom = execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--window-size=' + Math.max(sc.width, 500) + ',900', '--virtual-time-budget=60000', '--dump-dom', target], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = dom.match(/<pre id="SMOKE">([\s\S]*?)<\/pre>/);
    console.log('## ' + MODE + ' · ' + sc.label + ' (' + sc.width + ' px)');
    if (!m) { console.log('FALHA  o roteiro não terminou'); failed = true; continue; }
    const out = unescape(m[1]); console.log(out);
    if (/^FALHA/m.test(out)) failed = true;
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(failed ? 'resultado: falhou' : 'resultado: tudo ok');
process.exit(failed ? 1 : 0);
