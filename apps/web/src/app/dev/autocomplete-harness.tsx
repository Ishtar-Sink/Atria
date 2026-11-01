// Página de evidência do autocomplete: estados nos dois temas e a cena do vídeo. Só é carregada por
// `apps/web/scripts/evidence-ui.mjs` e `evidence-autocomplete.mjs`; o app não a importa.
// Cena em `?cena=estados|video`.
import { Autocomplete, SelectField } from '@atria/ui';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../global.css';
import { near, publishEvidence, type EvidenceCheck } from './evidence-checks';

const OPTIONS = [
  { value: '', label: 'Todas as categorias' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'saude', label: 'Saúde' },
] as const;

const THEMES = [
  { theme: 'light', label: 'Tema claro', tag: 'light' },
  { theme: 'dark', label: 'Tema escuro', tag: 'dark' },
] as const;

const CENA = new URLSearchParams(location.search).get('cena') ?? 'estados';

const noop = () => undefined;
const REMOVE = (label: string) => `Remover ${label}`;

function measureStates(): EvidenceCheck[] {
  const checks: EvidenceCheck[] = [];
  for (const { theme, tag } of THEMES) {
    const panel = document.querySelector(`[data-panel="${theme}"]`);
    if (!panel) continue;
    const field = panel.querySelector<HTMLInputElement>('input[role="combobox"]#cat-' + theme);
    const select = panel.querySelector('button[aria-haspopup="listbox"]');
    const multi = panel.querySelector('ul[aria-label="Categorias escolhidas"]');
    const heightField = field?.getBoundingClientRect().height ?? 0;
    const heightSelect = select?.getBoundingClientRect().height ?? -1;
    checks.push({
      name: `campo com o valor escolhido: Mercado (${tag})`,
      ok: field?.value === 'Mercado',
      detail: field?.value,
    });
    checks.push({
      name: `mesma altura do SelectField (${tag})`,
      ok: near(heightField, heightSelect),
      detail: `${heightField.toFixed(2)} x ${heightSelect.toFixed(2)}`,
    });
    checks.push({
      name: `duas pílulas na seleção múltipla (${tag})`,
      ok: multi?.querySelectorAll('li').length === 2,
    });
    checks.push({
      name: `botão Remover Lazer com nome (${tag})`,
      ok: panel.querySelector('button[aria-label="Remover Lazer"]') !== null,
    });
    checks.push({
      name: `erro em role="alert" (${tag})`,
      ok: panel.querySelector('[role="alert"]')?.textContent === 'Escolha uma categoria.',
    });
    const disabled = panel.querySelector<HTMLInputElement>('input#cat-off-' + theme);
    checks.push({ name: `campo desabilitado (${tag})`, ok: disabled?.disabled === true });
  }
  return checks;
}

function States() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          data-panel={theme}
          style={{
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: 'var(--s6)',
            display: 'grid',
            gap: 'var(--s4)',
            alignContent: 'start',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{label}</h2>
          <SelectField
            id={`conta-${theme}`}
            label="Conta"
            options={[
              { value: 'corrente', label: 'Conta corrente' },
              { value: 'poupanca', label: 'Poupança' },
            ]}
            value="corrente"
            onChange={noop}
          />
          <Autocomplete
            id={`cat-${theme}`}
            label="Categoria"
            options={OPTIONS}
            empty_text="Nenhuma categoria encontrada"
            value="mercado"
            onChange={noop}
          />
          <Autocomplete
            id={`cat-vazia-${theme}`}
            label="Categoria vazia"
            options={OPTIONS}
            empty_text="Nenhuma categoria encontrada"
            placeholder="Todas as categorias"
            value={null}
            onChange={noop}
          />
          <Autocomplete
            multiple
            id={`cat-multi-${theme}`}
            label="Categorias"
            options={OPTIONS}
            empty_text="Nenhuma categoria encontrada"
            value={['lazer', 'transporte']}
            onChange={noop}
            list_label="Categorias escolhidas"
            remove_label={REMOVE}
          />
          <Autocomplete
            id={`cat-erro-${theme}`}
            label="Categoria com erro"
            options={OPTIONS}
            empty_text="Nenhuma categoria encontrada"
            value={null}
            onChange={noop}
            error="Escolha uma categoria."
          />
          <Autocomplete
            id={`cat-off-${theme}`}
            label="Categoria desabilitada"
            options={OPTIONS}
            empty_text="Nenhuma categoria encontrada"
            value="mercado"
            onChange={noop}
            disabled
          />
        </section>
      ))}
    </div>
  );
}

function VideoScene() {
  const [single, setSingle] = useState<string | null>('');
  const [multiple, setMultiple] = useState<string[]>([]);
  return (
    <div
      data-theme="light"
      style={{
        width: 640,
        margin: '0 auto',
        padding: 'var(--s6)',
        display: 'grid',
        gap: 'var(--s4)',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <Autocomplete
        id="video-categoria"
        label="Categoria"
        options={OPTIONS}
        empty_text="Nenhuma categoria encontrada"
        value={single}
        onChange={setSingle}
      />
      <output data-value="single">Valor: {single ?? ''}</output>
      <Autocomplete
        multiple
        id="video-categorias"
        label="Categorias"
        options={OPTIONS}
        empty_text="Nenhuma categoria encontrada"
        value={multiple}
        onChange={setMultiple}
        list_label="Categorias escolhidas"
        remove_label={REMOVE}
      />
      <output data-value="multiple">Valores: {multiple.join(', ')}</output>
    </div>
  );
}

function Harness() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        publishEvidence(
          CENA === 'video'
            ? [
                {
                  name: 'cena do vídeo montada',
                  ok:
                    document.querySelector('#video-categoria') !== null &&
                    document.querySelector('#video-categorias') !== null,
                },
              ]
            : measureStates(),
        );
      });
    });
  }, []);
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
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
        Autocomplete
      </h1>
      {CENA === 'video' ? <VideoScene /> : <States />}
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
