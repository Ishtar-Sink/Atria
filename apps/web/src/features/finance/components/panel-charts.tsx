import { Link } from '@tanstack/react-router';
import { formatMoney } from '../../../shared/format/intl';
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

export interface ExpectedVsSettledColumnsProps {
  label: string;
  groups: readonly ColumnGroup[];
  expected_label: string;
  settled_label: string;
  currency: string;
}

/** Colunas de previsto (`info`) e realizado (`primary`), com legenda e valores em texto. */
export function ExpectedVsSettledColumns({
  label,
  groups,
  expected_label,
  settled_label,
  currency,
}: ExpectedVsSettledColumnsProps) {
  const { locale } = usePreferences();
  const max = Math.max(0, ...groups.flatMap((group) => [group.expected, group.settled]));
  const money = (value: number) => formatMoney(value, currency, locale);
  return (
    <figure aria-label={label} className={styles.figure}>
      <div className={styles.columns} aria-hidden="true">
        {groups.map((group) => (
          <div key={group.id} className={styles.columnGroup}>
            <div className={styles.columnBars}>
              <span
                className={`${styles.columnBar ?? ''} ${styles.fillExpected ?? ''}`}
                style={{ blockSize: percent(group.expected, max) }}
              />
              <span
                className={`${styles.columnBar ?? ''} ${styles.fillSettled ?? ''}`}
                style={{ blockSize: percent(group.settled, max) }}
              />
            </div>
            <span className={styles.columnLabel}>{group.label}</span>
          </div>
        ))}
      </div>
      <ul className={styles.legend} aria-hidden="true">
        <li>
          <span className={`${styles.dot ?? ''} ${styles.fillExpected ?? ''}`} />
          {expected_label}
        </li>
        <li>
          <span className={`${styles.dot ?? ''} ${styles.fillSettled ?? ''}`} />
          {settled_label}
        </li>
      </ul>
      <dl className={styles.legendValues} aria-hidden="true">
        {groups.map((group) => (
          <div key={group.id} className={styles.factRow}>
            <dt>{group.label}</dt>
            <dd>
              {expected_label} {money(group.expected)} · {settled_label} {money(group.settled)}
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.srOnly}>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">{expected_label}</th>
              <th scope="col">{settled_label}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <th scope="row">{group.label}</th>
                <td>{money(group.expected)}</td>
                <td>{money(group.settled)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
