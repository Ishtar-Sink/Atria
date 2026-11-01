// Confere no build que a biblioteca de gráficos fica fora dos chunks iniciais e só num chunk
// carregado sob demanda pelo painel do Financeiro (RNF-04 da SPEC-003). Rode depois do build.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(app, 'dist');
const assets = join(dist, 'assets');
// Classe que o recharts põe no SVG de todo gráfico: só existe no código da biblioteca.
const LIBRARY_MARKER = 'recharts-surface';
// Chave de texto usada só pela tela do painel do Financeiro.
const PANEL_MARKER = 'finance.panel.monthly_label';

function fail(reason) {
  console.log(`FALHA ${reason}`);
  process.exit(1);
}

if (!existsSync(join(dist, 'index.html'))) fail('sem dist/index.html: rode o build antes');

const pkg = JSON.parse(readFileSync(join(app, 'node_modules/recharts/package.json'), 'utf8'));
console.log(`recharts ${pkg.version} · licença ${pkg.license}`);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = /<script[^>]+src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
if (!entry) fail('chunk de entrada não encontrado em dist/index.html');

const chunks = new Map(
  readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => [name, readFileSync(join(assets, name), 'utf8')]),
);

/** Imports estáticos (`from"./x.js"`, `import"./x.js"`); `import("./x.js")` fica de fora. O build usa aspas ou crase. */
function staticImports(name) {
  const code = chunks.get(name) ?? '';
  return [...code.matchAll(/(?:\bfrom|\bimport)\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((m) => m[1]);
}

function dynamicImports(name) {
  const code = chunks.get(name) ?? '';
  return [...code.matchAll(/\bimport\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g)].map((m) => m[1]);
}

/** O chunk e tudo o que ele carrega por import estático. */
function closure(start) {
  const seen = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name) || !chunks.has(name)) continue;
    seen.add(name);
    queue.push(...staticImports(name));
  }
  return seen;
}

const initial = closure(entry);
const library = [...chunks.keys()].filter((name) => chunks.get(name).includes(LIBRARY_MARKER));
const in_initial = library.filter((name) => initial.has(name));
const on_demand = library.filter((name) => !initial.has(name));
const panel = new Set([...chunks.keys()].filter((name) => chunks.get(name).includes(PANEL_MARKER)));

// Quem chega à biblioteca por `import()`: o chunk importado sob demanda a contém ou a importa.
const importers = new Set();
for (const name of chunks.keys()) {
  for (const target of dynamicImports(name)) {
    if (on_demand.some((lib) => closure(target).has(lib))) importers.add(name);
  }
}

console.log(`iniciais: ${[...initial].sort().join(', ')}`);
console.log(`biblioteca nos iniciais: ${String(in_initial.length)}`);
console.log(`biblioteca sob demanda: ${on_demand.join(', ') || '-'}`);
console.log(`importado por: ${[...importers].sort().join(', ') || '-'}`);
console.log(`painel do Financeiro: ${[...panel].sort().join(', ') || '-'}`);

if (in_initial.length > 0) fail(`biblioteca num chunk inicial: ${in_initial.join(', ')}`);
if (on_demand.length === 0) fail('biblioteca em nenhum chunk sob demanda');
if (![...importers].some((name) => panel.has(name))) {
  fail('a biblioteca não é importada sob demanda a partir do chunk do painel');
}
console.log('ok');
