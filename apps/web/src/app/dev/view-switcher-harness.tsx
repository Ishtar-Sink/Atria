// Página de evidência do seletor de visualização e dos seis ícones compartilhados, nos temas claro
// e escuro. Só é carregada por `apps/web/scripts/evidence-ui.mjs`; o app não a importa.
import {
  DayIcon,
  GridIcon,
  ListIcon,
  ShelfIcon,
  TableIcon,
  TextField,
  TimelineIcon,
  ViewSwitcher,
} from '@atria/ui';
import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../global.css';
import { near, publishEvidence, type EvidenceCheck } from './evidence-checks';

const THEMES = [
  { theme: 'light', label: 'Tema claro', tag: 'claro' },
  { theme: 'dark', label: 'Tema escuro', tag: 'escuro' },
] as const;

const PAIRS: { name: string; second: { value: string; label: string; icon: ReactNode } }[] = [
  { name: 'Estante', second: { value: 'shelf', label: 'Estante', icon: <ShelfIcon /> } },
  { name: 'Tabela', second: { value: 'table', label: 'Tabela', icon: <TableIcon /> } },
  { name: 'Por dia', second: { value: 'day', label: 'Por dia', icon: <DayIcon /> } },
  {
    name: 'Linha do tempo',
    second: { value: 'timeline', label: 'Linha do tempo', icon: <TimelineIcon /> },
  },
];

function Pair({ second }: { second: (typeof PAIRS)[number]['second'] }) {
  const [value, setValue] = useState(second.value);
  return (
    <ViewSwitcher
      label={`Visualização: ${second.label}`}
      value={value}
      onChange={setValue}
      options={[{ value: 'list', label: 'Lista', icon: <ListIcon /> }, second]}
    />
  );
}

function Panel({ theme, label }: { theme: string; label: string }) {
  const [view, setView] = useState('list');
  return (
    <section
      data-theme={theme}
      data-panel={theme}
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 'var(--s6)',
        display: 'grid',
        gap: 'var(--s5)',
        alignContent: 'start',
      }}
    >
      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{label}</h2>
      <div data-row="toolbar" style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--s3)' }}>
        <div style={{ flex: '1 1 180px' }}>
          <TextField label="Buscar" type="search" />
        </div>
        <ViewSwitcher
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'Lista', icon: <ListIcon /> },
            { value: 'grid', label: 'Grade', icon: <GridIcon /> },
          ]}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s4)' }}>
        {PAIRS.map((pair) => (
          <Pair key={pair.name} second={pair.second} />
        ))}
      </div>
    </section>
  );
}

function measure(): EvidenceCheck[] {
  const checks: EvidenceCheck[] = [];
  for (const { theme, tag } of THEMES) {
    const panel = document.querySelector(`[data-panel="${theme}"]`);
    if (!panel) continue;
    for (const group of panel.querySelectorAll('[role="group"]')) {
      for (const button of group.querySelectorAll('button')) {
        const name = button.getAttribute('aria-label') ?? '';
        const svg = button.querySelector('svg');
        if (svg) {
          const b = button.getBoundingClientRect();
          const s = svg.getBoundingClientRect();
          const dx = s.left + s.width / 2 - (b.left + b.width / 2);
          const dy = s.top + s.height / 2 - (b.top + b.height / 2);
          checks.push({
            name: `ícone centralizado: ${name} (${tag})`,
            ok: near(dx, 0) && near(dy, 0),
            detail: `dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`,
          });
        }
        checks.push({
          name: `só o ícone, com nome e dica: ${name} (${tag})`,
          ok: name !== '' && button.title === name && button.textContent === '',
        });
      }
    }
    const group = panel.querySelector('[data-row="toolbar"] [role="group"]');
    if (group) {
      const sum = [...group.querySelectorAll('button')].reduce(
        (total, button) => total + button.getBoundingClientRect().width,
        0,
      );
      const width = group.getBoundingClientRect().width;
      checks.push({
        name: `seletor da barra ocupa só a largura das opções (${tag})`,
        ok: near(width, sum + 2, 1),
        detail: `grupo=${width.toFixed(2)} opções+borda=${(sum + 2).toFixed(2)}`,
      });
    }
  }
  return checks;
}

function Harness() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void document.fonts.ready.then(() => {
      publishEvidence(measure());
    });
  }, []);
  return (
    <main>
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        Seletor de visualização
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {THEMES.map(({ theme, label }) => (
          <Panel key={theme} theme={theme} label={label} />
        ))}
      </div>
    </main>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );
}
