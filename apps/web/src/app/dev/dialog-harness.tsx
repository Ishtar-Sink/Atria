// Página de evidência do diálogo, do campo de moeda e do botão carregando. Só é carregada por
// `apps/web/scripts/evidence-ui.mjs`; o app não a importa. Cena em `?cena=dialogo|campos`.
import { Button, Dialog, MoneyField, formatCents } from '@atria/ui';
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import '../global.css';
import { near, publishEvidence, type EvidenceCheck } from './evidence-checks';

const THEMES = [
  { theme: 'light', label: 'Tema claro', tag: 'claro' },
  { theme: 'dark', label: 'Tema escuro', tag: 'escuro' },
] as const;

const CENA = new URLSearchParams(location.search).get('cena') ?? 'dialogo';

function rect(element: Element | null): DOMRect | null {
  return element ? element.getBoundingClientRect() : null;
}

function measureDialog(): EvidenceCheck[] {
  const dialog = document.querySelector('dialog');
  const title = rect(dialog?.querySelector('h2') ?? null);
  const body = rect(dialog?.querySelector('[data-dialog-body]') ?? null);
  const actions = rect(dialog?.querySelector('[data-dialog-actions]') ?? null);
  const inner = rect(dialog?.querySelector('div') ?? null);
  const box = rect(dialog ?? null);
  const buttons = dialog ? [...dialog.querySelectorAll('[data-dialog-actions] button')] : [];
  const last = rect(buttons[buttons.length - 1] ?? null);
  if (!dialog || !title || !body || !actions || !inner || !box || !last) {
    return [{ name: 'diálogo aberto', ok: false }];
  }
  const gap = body.top - title.bottom;
  const below = actions.top - body.bottom;
  const pad = title.left - box.left;
  const right = inner.right - 24 - last.right;
  const focused = document.activeElement?.textContent === 'Cancelar';
  return [
    { name: 'diálogo aberto', ok: dialog.open },
    { name: 'título 8 px acima do corpo', ok: near(gap, 8), detail: gap.toFixed(2) },
    { name: 'ações 16 px abaixo do corpo', ok: near(below, 16), detail: below.toFixed(2) },
    { name: 'preenchimento de 24 px', ok: near(pad, 24, 1.5), detail: pad.toFixed(2) },
    { name: 'ações alinhadas à direita', ok: near(right, 0), detail: right.toFixed(2) },
    { name: 'largura até 480 px', ok: box.width <= 480.5, detail: box.width.toFixed(2) },
    { name: 'foco em Cancelar', ok: focused },
  ];
}

function measureFields(): EvidenceCheck[] {
  const checks: EvidenceCheck[] = [];
  for (const { theme, tag } of THEMES) {
    const panel = document.querySelector(`[data-panel="${theme}"]`);
    if (!panel) continue;
    const expected = [1450000, 1450050, null];
    panel.querySelectorAll('input').forEach((input, index) => {
      const cents = expected[index];
      if (cents === null || cents === undefined) return;
      const text = formatCents(cents, 'pt-BR', 'BRL');
      checks.push({
        name: `valor formatado: ${text} (${tag})`,
        ok: input.value === text,
        detail: input.value,
      });
    });
    checks.push({
      name: `erro em role="alert" (${tag})`,
      ok: panel.querySelector('[role="alert"]')?.textContent === 'Informe o valor.',
    });
    panel.querySelectorAll('button').forEach((button) => {
      const name = button.textContent;
      const spinner = rect(button.querySelector('[data-button-spinner]'));
      checks.push({
        name: `indicador de carregando visível: ${name} (${tag})`,
        ok: spinner !== null && spinner.width > 0 && spinner.height > 0,
      });
      checks.push({
        name: `aria-busy: ${name} (${tag})`,
        ok: button.getAttribute('aria-busy') === 'true',
      });
      checks.push({ name: `botão desabilitado: ${name} (${tag})`, ok: button.disabled });
    });
  }
  return checks;
}

function Fields() {
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
          <MoneyField label="Valor" value_cents={1450000} onChange={() => undefined} />
          <MoneyField label="Valor com centavos" value_cents={1450050} onChange={() => undefined} />
          <MoneyField
            label="Valor vazio"
            value_cents={null}
            onChange={() => undefined}
            error="Informe o valor."
          />
          <div style={{ display: 'flex', gap: 'var(--s3)' }}>
            <Button variant="primary" loading>
              Salvar
            </Button>
            <Button loading>Enviar</Button>
          </div>
        </section>
      ))}
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
        publishEvidence(CENA === 'campos' ? measureFields() : measureDialog());
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
        Diálogo, campo de moeda e botão carregando
      </h1>
      {CENA === 'campos' ? (
        <Fields />
      ) : (
        <Dialog
          open
          title="Registrar esta sessão de leitura?"
          onClose={() => undefined}
          actions={
            <>
              <Button data-autofocus="" variant="secondary">
                Cancelar
              </Button>
              <Button variant="primary">Registrar sessão</Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Você avançou da página 12 até a 30. O registro só entra no histórico e no progresso se
            você confirmar.
          </p>
        </Dialog>
      )}
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
