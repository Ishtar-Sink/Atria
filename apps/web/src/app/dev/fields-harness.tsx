// Página de evidência do período no cabeçalho de página e do campo de etiquetas, nos temas claro e
// escuro. Só é carregada por `apps/web/scripts/evidence-fields.mjs`; o app não a importa.
import { Button, FormGrid, PageHeader, PeriodField, TagField, TextField } from '@atria/ui';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../global.css';

interface FieldsCheck {
  name: string;
  ok: boolean;
  detail: string;
}

declare global {
  interface Window {
    __atria_fields_evidence?: FieldsCheck[];
  }
}

const THEMES = [
  { theme: 'light', tag: 'claro' },
  { theme: 'dark', tag: 'escuro' },
] as const;

const PERIOD_LABELS = {
  presets: {
    this_month: 'Este mês',
    last_month: 'Mês passado',
    next_30_days: 'Próximos 30 dias',
    last_30_days: 'Últimos 30 dias',
    this_year: 'Este ano',
    all: 'Qualquer período',
  },
  title: 'Escolher período',
  custom: 'Personalizado',
  apply: 'Aplicar',
  first_day: 'Escolha o primeiro dia.',
  last_day: 'escolha o último dia',
  first_day_error: 'Escolha o primeiro dia no calendário.',
  previous: 'Mês anterior',
  next: 'Próximo mês',
  today_marker: 'hoje',
};

function Panel({ theme }: { theme: string }) {
  const [tags, setTags] = useState<string[]>(['casa', 'mercado', 'mensal']);
  return (
    <section
      data-theme={theme}
      data-panel={theme}
      style={{ background: 'var(--bg)', color: 'var(--text)', padding: 'var(--s6)' }}
    >
      <PageHeader
        title="Financeiro"
        eyebrow="Dinheiro"
        subtitle="Contas, movimentações, faturas e um painel do mês."
        actions={
          <>
            <PeriodField
              label="Período"
              label_visible={false}
              placement="toolbar"
              today="2026-11-01"
              locale="pt-BR"
              labels={PERIOD_LABELS}
              onChange={() => undefined}
            />
            <Button>Relatórios</Button>
            <Button variant="primary">Novo registro</Button>
          </>
        }
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <FormGrid>
          <TextField label="Título" defaultValue="Compras do mês" />
          <TagField
            label="Etiquetas"
            value={tags}
            onChange={setTags}
            help="Enter ou vírgula adiciona a etiqueta."
            list_label="Etiquetas adicionadas"
            remove_label={(tag) => `Remover ${tag}`}
          />
        </FormGrid>
      </form>
    </section>
  );
}

function measure(panel: Element, tag: string): FieldsCheck[] {
  const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
  const buttons = [...panel.querySelectorAll('header button')];
  const byText = (text: string) => buttons.find((b) => b.textContent === text) ?? null;
  const period = buttons.find((b) => b.hasAttribute('aria-haspopup')) ?? null;
  const reports = rect(byText('Relatórios'));
  const create = rect(byText('Novo registro'));
  const p = rect(period);
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
  const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toFixed(2));
  const checks: FieldsCheck[] = [];

  checks.push({
    name: `período alinhado aos botões ao lado (${tag})`,
    ok:
      !!p &&
      !!reports &&
      !!create &&
      near(p.top, reports.top) &&
      near(p.bottom, reports.bottom) &&
      near(p.top, create.top) &&
      near(p.bottom, create.bottom),
    detail: `período ${fmt(p?.top)}–${fmt(p?.bottom)} · relatórios ${fmt(reports?.top)}–${fmt(reports?.bottom)} · novo ${fmt(create?.top)}–${fmt(create?.bottom)}`,
  });

  const labelledby = period?.getAttribute('aria-labelledby') ?? '';
  const labelId = labelledby.split(' ')[0] ?? '';
  const label = labelId ? document.getElementById(labelId) : null;
  const labelRect = rect(label);
  checks.push({
    name: `rótulo do período invisível e no nome acessível (${tag})`,
    ok: !!labelRect && labelRect.width <= 1 && label?.textContent === 'Período',
    detail: `largura ${fmt(labelRect?.width)} · texto "${label?.textContent ?? ''}" · aria-labelledby "${labelledby}"`,
  });

  const inputs = [...panel.querySelectorAll('form input')];
  const tagInput = inputs[inputs.length - 1];
  const list = panel.querySelector('ul');
  const help = [...panel.querySelectorAll('form p')].find((el) =>
    el.textContent.includes('Enter ou vírgula'),
  );
  const inputRect = rect(tagInput ?? null);
  const listRect = rect(list);
  const helpRect = rect(help ?? null);
  const gap = listRect && inputRect ? listRect.top - inputRect.bottom : NaN;
  checks.push({
    name: `etiquetas 12 px abaixo do campo (${tag})`,
    ok: near(gap, 12),
    detail: `${fmt(gap)} px`,
  });

  const items = [...(list?.querySelectorAll('li') ?? [])];
  const first = rect(items[0] ?? null);
  const second = rect(items[1] ?? null);
  const between = first && second ? second.left - first.right : NaN;
  checks.push({
    name: `4 px entre etiquetas (${tag})`,
    ok: near(between, 4),
    detail: `${fmt(between)} px`,
  });

  const below = helpRect && listRect ? helpRect.top - listRect.bottom : NaN;
  checks.push({
    name: `ajuda 4 px abaixo das etiquetas (${tag})`,
    ok: near(below, 4),
    detail: `${fmt(below)} px`,
  });
  return checks;
}

function Page() {
  useEffect(() => {
    void document.fonts.ready.then(() => {
      const checks = THEMES.flatMap(({ theme, tag }) => {
        const panel = document.querySelector(`[data-panel="${theme}"]`);
        return panel ? measure(panel, tag) : [];
      });
      window.__atria_fields_evidence = checks;
      document.documentElement.dataset['evidenceReady'] = 'true';
    });
  }, []);
  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {THEMES.map(({ theme }) => (
        <Panel key={theme} theme={theme} />
      ))}
    </main>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}
