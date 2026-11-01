import { Card } from '@atria/ui';
import type { ReactNode } from 'react';
import { formatMoney, formatNumber, formatPercent } from '../../shared/format/intl';
import { useT, type Translate } from '../../shared/i18n/i18n';
import { usePreferences } from '../../shared/preferences/preferences-context';
import styles from './reports.module.css';
import type {
  FinCatModel,
  FinDiffModel,
  FinFlowModel,
  GoalsProgressModel,
  JournalEmoModel,
  LibStatusModel,
  ProjCardsModel,
  ReadPagesModel,
  ReportModel,
  TasksDoneModel,
} from './use-report-result';
import type { ReportSearch } from './use-report-search';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'info';

const FILL: Record<Tone, string> = {
  primary: '',
  accent: styles.fillAccent ?? '',
  success: styles.fillSuccess ?? '',
  warning: styles.fillWarning ?? '',
  info: styles.fillInfo ?? '',
};

const classes = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

interface Bar {
  key: string;
  label: string;
  value: number;
  text: string;
  tone?: Tone;
}

/** Cada barra mostra o valor também em texto; a tabela é a mesma informação para leitor de tela. */
function BarChart({
  caption,
  label_header,
  value_header,
  bars,
}: {
  caption: string;
  label_header: string;
  value_header: string;
  bars: readonly Bar[];
}) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <>
      <ul className={styles.bars} aria-hidden="true">
        {bars.map((bar) => (
          <li key={bar.key} className={styles.bar}>
            <span className={styles.barLabel}>{bar.label}</span>
            <span className={styles.barValue}>{bar.text}</span>
            <span className={styles.track}>
              <span
                className={classes(styles.fill, FILL[bar.tone ?? 'primary'])}
                style={{ width: `${String(max > 0 ? (bar.value / max) * 100 : 0)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.visuallyHidden}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{label_header}</th>
              <th scope="col">{value_header}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.label}</th>
                <td>{bar.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface Series {
  name: string;
  tone: Tone;
}

interface Group {
  key: string;
  label: string;
  values: readonly { value: number; text: string }[];
}

/** Barras agrupadas (por mês): uma por série, sobre o maior valor de todo o gráfico. */
function GroupedBars({
  caption,
  label_header,
  series,
  groups,
}: {
  caption: string;
  label_header: string;
  series: readonly Series[];
  groups: readonly Group[];
}) {
  const max = Math.max(0, ...groups.flatMap((group) => group.values.map((item) => item.value)));
  return (
    <>
      <ul className={styles.legend} aria-hidden="true">
        {series.map((item) => (
          <li key={item.name}>
            <span className={classes(styles.dot, FILL[item.tone])} />
            {item.name}
          </li>
        ))}
      </ul>
      <ul className={styles.bars} aria-hidden="true">
        {groups.map((group) => (
          <li key={group.key}>
            <p className={styles.groupTitle}>{group.label}</p>
            <ul className={styles.bars}>
              {group.values.map((item, index) => (
                <li key={series[index]?.name ?? index} className={styles.bar}>
                  <span className={styles.barLabel}>{series[index]?.name}</span>
                  <span className={styles.barValue}>{item.text}</span>
                  <span className={styles.track}>
                    <span
                      className={classes(styles.fill, FILL[series[index]?.tone ?? 'primary'])}
                      style={{ width: `${String(max > 0 ? (item.value / max) * 100 : 0)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className={styles.visuallyHidden}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{label_header}</th>
              {series.map((item) => (
                <th key={item.name} scope="col">
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <th scope="row">{group.label}</th>
                {group.values.map((item, index) => (
                  <td key={series[index]?.name ?? index}>{item.text}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section">
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </Card>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className={styles.stat}>
      <p className={classes(styles.bigNumber, tone ? styles[tone] : undefined)}>{value}</p>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function NoData() {
  const t = useT();
  return <p className={styles.muted}>{t('reports.no_data')}</p>;
}

function useFormat() {
  const { locale } = usePreferences();
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const month = (key: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
      new Date(`${key}-01T00:00:00Z`),
    );
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);
  const number = (value: number) => formatNumber(value, locale);
  const percent = (value: number) => formatPercent(value / 100, locale);
  return { locale, day, month, money, number, percent };
}

type Format = ReturnType<typeof useFormat>;

function FinFlow({ model, f, t }: { model: FinFlowModel; f: Format; t: Translate }) {
  const money = (cents: number) => f.money(cents, model.currency);
  const groups = model.months.map((item) => ({
    key: item.month,
    label: f.month(item.month),
    values: [
      { value: item.income, text: money(item.income) },
      { value: item.expense, text: money(item.expense) },
    ],
  }));
  return (
    <Block title={t('reports.result.flow_title')}>
      <div className={styles.stats}>
        <Stat
          value={money(model.totals.income)}
          label={t('reports.result.income')}
          tone="success"
        />
        <Stat value={money(model.totals.expense)} label={t('reports.result.expense')} />
        <Stat value={money(model.totals.net)} label={t('reports.result.net')} />
      </div>
      {groups.length > 0 ? (
        <GroupedBars
          caption={t('reports.result.flow_caption')}
          label_header={t('reports.result.month')}
          series={[
            { name: t('reports.result.income'), tone: 'success' },
            { name: t('reports.result.expense'), tone: 'accent' },
          ]}
          groups={groups}
        />
      ) : (
        <NoData />
      )}
    </Block>
  );
}

function FinCat({ model, f, t }: { model: FinCatModel; f: Format; t: Translate }) {
  const bars = [...model.categories]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      key: item.category_id ?? item.name,
      label: item.name,
      value: item.amount,
      text: `${f.money(item.amount, model.currency)} · ${f.percent(item.percent)}`,
    }));
  return (
    <Block title={t('reports.result.cat_title')}>
      {bars.length > 0 ? (
        <BarChart
          caption={t('reports.result.cat_caption')}
          label_header={t('reports.result.category')}
          value_header={t('reports.result.amount')}
          bars={bars}
        />
      ) : (
        <NoData />
      )}
    </Block>
  );
}

function FinDiff({ model, f, t }: { model: FinDiffModel; f: Format; t: Translate }) {
  const money = (cents: number) => f.money(Math.abs(cents), model.currency);
  const groups = model.months.map((item) => ({
    key: item.month,
    label: f.month(item.month),
    values: [
      { value: item.savings + item.gains, text: money(item.savings + item.gains) },
      { value: Math.abs(item.losses), text: money(item.losses) },
    ],
  }));
  return (
    <Block title={t('reports.result.diff_title')}>
      <div className={styles.stats}>
        <Stat
          value={money(model.totals.savings + model.totals.gains)}
          label={t('reports.result.savings_and_gains')}
          tone="success"
        />
        <Stat
          value={money(model.totals.losses)}
          label={t('reports.result.losses')}
          tone="warning"
        />
      </div>
      {groups.length > 0 ? (
        <GroupedBars
          caption={t('reports.result.diff_caption')}
          label_header={t('reports.result.month')}
          series={[
            { name: t('reports.result.savings_and_gains'), tone: 'success' },
            { name: t('reports.result.losses'), tone: 'warning' },
          ]}
          groups={groups}
        />
      ) : (
        <NoData />
      )}
    </Block>
  );
}

function ReadPages({ model, f, t }: { model: ReadPagesModel; f: Format; t: Translate }) {
  const bars = model.books
    .filter((book) => book.pages > 0)
    .map((book) => ({
      key: book.book_id,
      label: book.title,
      value: book.pages,
      text: t('reports.result.pages_value', { count: f.number(book.pages) }),
      tone: 'accent' as const,
    }));
  return (
    <Block title={t('reports.result.pages_title')}>
      {bars.length > 0 ? (
        <BarChart
          caption={t('reports.result.pages_caption')}
          label_header={t('reports.result.book')}
          value_header={t('reports.result.pages')}
          bars={bars}
        />
      ) : (
        <NoData />
      )}
    </Block>
  );
}

const GROUP_TONE: Record<string, Tone> = { book: 'primary', article: 'info', video: 'accent' };

function LibStatus({ model, t }: { model: LibStatusModel; t: Translate }) {
  if (model.groups.length === 0) {
    return (
      <Block title={t('reports.result.status_generic')}>
        <NoData />
      </Block>
    );
  }
  return (
    <>
      {model.groups.map((group) => (
        <Block
          key={group.item_type}
          title={t('reports.result.status_title', { type: group.label })}
        >
          <BarChart
            caption={t('reports.result.status_caption', { type: group.label })}
            label_header={t('reports.result.status')}
            value_header={t('reports.result.count')}
            bars={group.statuses.map((item) => ({
              key: item.status,
              label: item.label,
              value: item.count,
              text: String(item.count),
              tone: GROUP_TONE[group.item_type] ?? 'primary',
            }))}
          />
        </Block>
      ))}
    </>
  );
}

function JournalEmo({ model, f, t }: { model: JournalEmoModel; f: Format; t: Translate }) {
  const bars = model.emotions.map((item) => ({
    key: item.emotion_id,
    label: item.name,
    value: item.count,
    text:
      item.average_intensity === null
        ? String(item.count)
        : `${String(item.count)} · ${f.number(item.average_intensity)}`,
    tone: 'accent' as const,
  }));
  return (
    <>
      <Block title={t('reports.result.entries_title')}>
        <Stat value={f.number(model.entry_count)} label={t('reports.result.entries_label')} />
        {model.average_intensity === null ? null : (
          <p className={styles.resultMeta}>
            {t('reports.result.average_intensity', { value: f.number(model.average_intensity) })}
          </p>
        )}
      </Block>
      <Block title={t('reports.result.emotions_title')}>
        {bars.length > 0 ? (
          <BarChart
            caption={t('reports.result.emotions_caption')}
            label_header={t('reports.result.emotion')}
            value_header={t('reports.result.intensity')}
            bars={bars}
          />
        ) : (
          <NoData />
        )}
      </Block>
    </>
  );
}

function GoalsProgress({ model, f, t }: { model: GoalsProgressModel; f: Format; t: Translate }) {
  const goals = model.goals.map((goal) => ({
    key: goal.goal_id,
    label: goal.title,
    value: goal.progress_percent,
    text: f.percent(goal.progress_percent),
    tone: goal.status === 'completed' ? ('success' as const) : ('primary' as const),
  }));
  return (
    <>
      <Block title={t('reports.result.goals_title')}>
        {goals.length > 0 ? (
          <BarChart
            caption={t('reports.result.goals_caption')}
            label_header={t('reports.result.goal')}
            value_header={t('reports.result.progress')}
            bars={goals}
          />
        ) : (
          <NoData />
        )}
      </Block>
      <Block title={t('reports.result.goal_status_title')}>
        <BarChart
          caption={t('reports.result.goal_status_caption')}
          label_header={t('reports.result.status')}
          value_header={t('reports.result.count')}
          bars={model.by_status.map((item) => ({
            key: item.status,
            label: item.label,
            value: item.count,
            text: String(item.count),
            tone: item.status === 'completed' ? ('success' as const) : ('primary' as const),
          }))}
        />
      </Block>
    </>
  );
}

function TasksDone({ model, t }: { model: TasksDoneModel; t: Translate }) {
  return (
    <Block title={t('reports.result.tasks_title')}>
      <BarChart
        caption={t('reports.result.tasks_caption')}
        label_header={t('reports.result.status')}
        value_header={t('reports.result.count')}
        bars={[
          {
            key: 'completed',
            label: t('reports.result.tasks_done'),
            value: model.completed,
            text: String(model.completed),
            tone: 'success',
          },
          {
            key: 'open',
            label: t('reports.result.tasks_open'),
            value: model.open,
            text: String(model.open),
            tone: 'warning',
          },
        ]}
      />
      <p className={styles.muted}>{t('reports.tasks_done_note')}</p>
    </Block>
  );
}

function ProjCards({
  model,
  search,
  t,
}: {
  model: ProjCardsModel;
  search: ReportSearch;
  t: Translate;
}) {
  const several = model.projects.length > 1;
  const projects = model.projects.map((project) => ({
    key: project.project_id,
    label: project.name,
    value: project.total_cards,
    text: String(project.total_cards),
  }));
  const lanes = model.projects.flatMap((project) =>
    project.lanes.map((lane) => ({
      key: lane.lane_id,
      label: several ? `${project.name} · ${lane.name}` : lane.name,
      value: lane.card_count,
      text: String(lane.card_count),
      tone: 'accent' as const,
    })),
  );
  return (
    <>
      {search.filters.project_id === undefined ? (
        <Block title={t('reports.result.projects_title')}>
          {projects.length > 0 ? (
            <BarChart
              caption={t('reports.result.projects_caption')}
              label_header={t('reports.result.project')}
              value_header={t('reports.result.cards')}
              bars={projects}
            />
          ) : (
            <NoData />
          )}
        </Block>
      ) : null}
      <Block title={t('reports.result.lanes_title')}>
        {lanes.length > 0 ? (
          <BarChart
            caption={t('reports.result.lanes_caption')}
            label_header={t('reports.result.lane')}
            value_header={t('reports.result.cards')}
            bars={lanes}
          />
        ) : (
          <NoData />
        )}
      </Block>
    </>
  );
}

function PeriodLine({ model, f, t }: { model: ReportModel; f: Format; t: Translate }) {
  if (!('period' in model)) return null;
  const params = { de: f.day(model.period.from), ate: f.day(model.period.to) };
  const text = model.any_period
    ? t('reports.period.any_resolved', params)
    : t('reports.period.range', params);
  return (
    <p className={styles.resultMeta}>
      {t('reports.result.period')}: {text}
    </p>
  );
}

function Body({
  model,
  search,
  f,
  t,
}: {
  model: ReportModel;
  search: ReportSearch;
  f: Format;
  t: Translate;
}) {
  switch (model.report) {
    case 'fin-flow':
      return <FinFlow model={model} f={f} t={t} />;
    case 'fin-cat':
      return <FinCat model={model} f={f} t={t} />;
    case 'fin-diff':
      return <FinDiff model={model} f={f} t={t} />;
    case 'read-pages':
      return <ReadPages model={model} f={f} t={t} />;
    case 'lib-status':
      return <LibStatus model={model} t={t} />;
    case 'journal-emo':
      return <JournalEmo model={model} f={f} t={t} />;
    case 'goals-progress':
      return <GoalsProgress model={model} f={f} t={t} />;
    case 'tasks-done':
      return <TasksDone model={model} t={t} />;
    case 'proj-cards':
      return <ProjCards model={model} search={search} t={t} />;
  }
}

/** O resultado do relatório gerado, a partir do modelo em JSON da API. */
export function ReportResult({ model, search }: { model: ReportModel; search: ReportSearch }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className={styles.result} data-rep-result="">
      <PeriodLine model={model} f={f} t={t} />
      <Body model={model} search={search} f={f} t={t} />
    </div>
  );
}
