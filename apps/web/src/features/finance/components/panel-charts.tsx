import { Link } from '@tanstack/react-router';
import {
  Bar,
  BarChart,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts';
import { formatMoney } from '../../../shared/format/intl';
import { useT } from '../../../shared/i18n/i18n';
import { usePreferences } from '../../../shared/preferences/preferences-context';
import styles from './finance.module.css';

export interface BarItem {
  id: string;
  label: string;
  value: number;
  /** HEX da categoria; sem cor, a barra usa o tom neutro. */
  color?: string;
  href?: string;
  search?: Record<string, string>;
}

export interface HorizontalBarsProps {
  /** Nome acessível do gráfico e legenda da tabela para leitor de tela. */
  label: string;
  items: readonly BarItem[];
  currency: string;
}

function percent(value: number, max: number): string {
  return `${String(max > 0 ? Math.round((Math.max(0, value) / max) * 100) : 0)}%`;
}

/** Barras horizontais com o valor em texto; o significado nunca fica só na cor. */
export function HorizontalBars({ label, items, currency }: HorizontalBarsProps) {
  const { locale } = usePreferences();
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <figure aria-label={label} className={styles.figure}>
      <ul className={styles.bars} aria-hidden="true">
        {items.map((item) => (
          <li key={item.id} className={styles.bar}>
            {item.href ? (
              <Link
                to={item.href}
                search={item.search ?? {}}
                className={styles.barLabel}
                tabIndex={-1}
              >
                {item.label}
              </Link>
            ) : (
              <span className={styles.barLabel}>{item.label}</span>
            )}
            <span className={styles.num}>{formatMoney(item.value, currency, locale)}</span>
            <span className={styles.barTrack}>
              <span
                className={
                  item.color
                    ? styles.barFill
                    : `${styles.barFill ?? ''} ${styles.barFillNeutral ?? ''}`
                }
                style={{
                  inlineSize: percent(item.value, max),
                  ...(item.color ? { backgroundColor: item.color } : {}),
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.srOnly}>
        <table>
          <caption>{label}</caption>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  {item.href ? (
                    <Link to={item.href} search={item.search ?? {}}>
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </th>
                <td>{formatMoney(item.value, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export interface ColumnGroup {
  id: string;
  label: string;
  expected: number;
  settled: number;
}

export interface ExpectedVsSettledBarsProps {
  label: string;
  groups: readonly ColumnGroup[];
  expected_label: string;
  settled_label: string;
  currency: string;
}

interface ExpectedDatum extends ColumnGroup {
  difference: number;
  color: string;
}

/** Previsto mais claro que o realizado, na mesma cor do grupo (ajuste 1 da spec). */
export const EXPECTED_OPACITY = 0.45;

type Money = (value: number) => string;

function useDifferenceText(money: Money) {
  const t = useT();
  return (difference: number) => {
    if (difference === 0) return t('finance.panel.difference_none');
    return t(difference < 0 ? 'finance.panel.difference_below' : 'finance.panel.difference_above', {
      value: money(Math.abs(difference)),
    });
  };
}

/**
 * Valor escrito acima da barra, sobre o fundo do card: dentro da barra sólida o texto não teria
 * contraste AA nos dois temas (RNF-02).
 */
function barLabel(text: (value: number) => string) {
  function BarValueLabel({ x, y, value }: LabelProps) {
    return (
      <text
        x={Number(x)}
        y={Number(y) - 4}
        fill="var(--text)"
        fontSize={12}
        className="recharts-label-value"
      >
        {text(Number(value))}
      </text>
    );
  }
  return BarValueLabel;
}

/** Barra na cor do grupo; o previsto usa a mesma cor, mais clara. */
function barShape(opacity: number) {
  function ExpectedBarShape(props: BarShapeProps) {
    const datum = props.payload as ExpectedDatum;
    return <Rectangle {...props} fill={datum.color} fillOpacity={opacity} />;
  }
  return ExpectedBarShape;
}

function ExpectedTooltip({
  active,
  payload,
  money,
  expected_label,
  settled_label,
}: Pick<TooltipContentProps, 'active' | 'payload'> & {
  money: Money;
  expected_label: string;
  settled_label: string;
}) {
  const t = useT();
  const difference = useDifferenceText(money);
  const datum = payload[0]?.payload as ExpectedDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div data-chart-tooltip="" className={styles.chartTooltip}>
      <strong>{datum.label}</strong>
      <span>
        {expected_label} {money(datum.expected)}
      </span>
      <span>
        {settled_label} {money(datum.settled)}
      </span>
      <span>
        {t('finance.panel.difference')}: {difference(datum.difference)}
      </span>
    </div>
  );
}

/** Previsto e realizado em barras horizontais, nas cores de entrada e saída (RF-13, RF-14). */
export function ExpectedVsSettledBars({
  label,
  groups,
  expected_label,
  settled_label,
  currency,
}: ExpectedVsSettledBarsProps) {
  const t = useT();
  const { locale } = usePreferences();
  const money = (value: number) => formatMoney(value, currency, locale);
  const difference = useDifferenceText(money);
  const data: ExpectedDatum[] = groups.map((group) => ({
    ...group,
    difference: group.settled - group.expected,
    color: group.id === 'income' ? 'var(--success)' : 'var(--accent)',
  }));
  const ExpectedLabel = barLabel((value) =>
    t('finance.panel.expected_value', { value: money(value) }),
  );
  const SettledLabel = barLabel((value) =>
    t('finance.panel.settled_value', { value: money(value) }),
  );
  return (
    <figure aria-label={label} className={styles.figure}>
      <div className={styles.chartFrame}>
        <ResponsiveContainer
          width="100%"
          height={232}
          initialDimension={{ width: 560, height: 232 }}
        >
          <BarChart
            layout="vertical"
            data={data}
            accessibilityLayer
            margin={{ top: 16, right: 16, bottom: 4, left: 4 }}
            barCategoryGap={18}
            barGap={18}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={72}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--text)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)' }}
              content={({ active, payload }) => (
                <ExpectedTooltip
                  active={active}
                  payload={payload}
                  money={money}
                  expected_label={expected_label}
                  settled_label={settled_label}
                />
              )}
            />
            <Bar
              dataKey="expected"
              name={expected_label}
              isAnimationActive={false}
              radius={[0, 4, 4, 0]}
              barSize={18}
              shape={barShape(EXPECTED_OPACITY)}
            >
              <LabelList dataKey="expected" content={ExpectedLabel} />
            </Bar>
            <Bar
              dataKey="settled"
              name={settled_label}
              isAnimationActive={false}
              radius={[0, 4, 4, 0]}
              barSize={18}
              shape={barShape(1)}
            >
              <LabelList dataKey="settled" content={SettledLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.srOnly}>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">{expected_label}</th>
              <th scope="col">{settled_label}</th>
              <th scope="col">{t('finance.panel.difference')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.id}>
                <th scope="row">{datum.label}</th>
                <td>{money(datum.expected)}</td>
                <td>{money(datum.settled)}</td>
                <td>{difference(datum.difference)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
