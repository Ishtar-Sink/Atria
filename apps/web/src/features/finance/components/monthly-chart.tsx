import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from 'recharts';
import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import type { MonthlyMode, MonthlyPoint } from '../hooks/use-financial-summary';
import styles from './finance.module.css';
import { EXPECTED_OPACITY } from './panel-charts';

export interface MonthlyChartProps {
  /** Nome acessível do gráfico e legenda da tabela para leitor de tela. */
  label: string;
  months: readonly MonthlyPoint[];
  currency: string;
  mode: MonthlyMode;
}

/** Abaixo desta largura os doze meses não cabem deitados: os rótulos do eixo ficam inclinados. */
const NARROW_WIDTH = 560;

interface MonthlyDatum extends MonthlyPoint {
  label: string;
}

interface Series {
  key: 'income' | 'expense' | 'balance';
  name: string;
  color: (datum: MonthlyDatum) => string;
}

/** Saldo negativo em âmbar, nunca em vermelho (RN-07, [project/frontend-14]). */
function balanceColor(datum: MonthlyDatum): string {
  return datum.balance < 0 ? 'var(--warning)' : 'var(--success)';
}

function useSeries(mode: MonthlyMode): Series[] {
  const t = useT();
  if (mode === 'balance') {
    return [{ key: 'balance', name: t('finance.panel.monthly_balance'), color: balanceColor }];
  }
  return [
    { key: 'income', name: t('finance.panel.income'), color: () => 'var(--success)' },
    { key: 'expense', name: t('finance.panel.expense'), color: () => 'var(--accent)' },
  ];
}

/**
 * Rótulo do eixo: o mês abreviado e, no primeiro mês e em janeiro, o ano na linha de baixo; doze
 * rótulos "jun. de 26" não cabem lado a lado. Em tela estreita, o rótulo fica inclinado.
 */
function MonthTick({
  x,
  y,
  payload,
  narrow,
  locale,
}: Pick<XAxisTickContentProps, 'x' | 'y' | 'payload'> & { narrow: boolean; locale: string }) {
  const key = String(payload.value);
  const date = new Date(`${key}-01T00:00:00Z`);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date);
  const year = payload.index === 0 || key.endsWith('-01') ? key.slice(0, 4) : null;
  const common = { fill: 'var(--text-muted)', fontSize: narrow ? 11 : 12 };
  if (narrow) {
    return (
      <g transform={`translate(${String(x)},${String(y)})`}>
        <text {...common} dy={8} textAnchor="end" transform="rotate(-60)">
          {year ? `${month} ${year.slice(2)}` : month}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${String(x)},${String(y)})`}>
      <text {...common} dy={12} textAnchor="middle">
        <tspan x={0}>{month}</tspan>
        {year ? (
          <tspan x={0} dy={14}>
            {year}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

function MonthlyTooltip({
  active,
  payload,
  series,
  money,
}: Pick<TooltipContentProps, 'active' | 'payload'> & {
  series: readonly Series[];
  money: (value: number) => string;
}) {
  const t = useT();
  const datum = payload[0]?.payload as MonthlyDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div data-chart-tooltip="" className={styles.chartTooltip}>
      <strong>{datum.label}</strong>
      <span>
        {t(datum.projected ? 'finance.panel.monthly_projected' : 'finance.panel.monthly_realized')}
      </span>
      {series.map((entry) => (
        <span key={entry.key}>
          {entry.name} {money(datum[entry.key])}
        </span>
      ))}
    </div>
  );
}

/** Card "Mês a mês": uma coluna por mês, os projetados em tom mais claro (RF-15, RF-16, CB-08). */
export function MonthlyChart({ label, months, currency, mode }: MonthlyChartProps) {
  const t = useT();
  const { locale } = usePreferences();
  const money = (value: number) => formatMoney(value, currency, locale);
  const compact = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
  });
  const [narrow, setNarrow] = useState(false);
  const month = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
  const data: MonthlyDatum[] = months.map((point) => ({
    ...point,
    label: month.format(new Date(`${point.month}-01T00:00:00Z`)),
  }));
  const series = useSeries(mode);
  return (
    <figure aria-label={label} className={styles.figure}>
      <div className={styles.chartFrame}>
        <ResponsiveContainer
          width="100%"
          height={narrow ? 280 : 240}
          initialDimension={{ width: 640, height: 240 }}
          onResize={(width) => {
            setNarrow(width < NARROW_WIDTH);
          }}
        >
          <BarChart
            data={data}
            accessibilityLayer
            margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              interval={0}
              height={narrow ? 48 : 40}
              tick={(props: XAxisTickContentProps) => (
                <MonthTick {...props} narrow={narrow} locale={locale} />
              )}
            />
            <YAxis
              tickFormatter={(value: number) => compact.format(value / 100)}
              width={64}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)' }}
              content={({ active, payload }) => (
                <MonthlyTooltip active={active} payload={payload} series={series} money={money} />
              )}
            />
            {series.map((entry) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.name}
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
                shape={(props: BarShapeProps) => {
                  const datum = props.payload as MonthlyDatum;
                  return (
                    <Rectangle
                      {...props}
                      fill={entry.color(datum)}
                      fillOpacity={datum.projected ? EXPECTED_OPACITY : 1}
                    />
                  );
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend} aria-hidden="true">
        {series.map((entry) => (
          <li key={entry.key}>
            <span
              className={styles.dot}
              style={{
                backgroundColor: entry.key === 'expense' ? 'var(--accent)' : 'var(--success)',
              }}
            />
            {entry.name}
          </li>
        ))}
        <li>
          <span className={`${styles.dot ?? ''} ${styles.dotProjected ?? ''}`} />
          {t('finance.panel.monthly_projected_legend')}
        </li>
      </ul>
      <div className={styles.srOnly}>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{t('finance.panel.monthly_month')}</th>
              <th scope="col">{t('finance.panel.monthly_kind')}</th>
              {series.map((entry) => (
                <th key={entry.key} scope="col">
                  {entry.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.month}>
                <th scope="row">{datum.label}</th>
                <td>
                  {t(
                    datum.projected
                      ? 'finance.panel.monthly_projected'
                      : 'finance.panel.monthly_realized',
                  )}
                </td>
                {series.map((entry) => (
                  <td key={entry.key}>{money(datum[entry.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
