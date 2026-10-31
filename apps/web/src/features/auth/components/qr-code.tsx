import { useMemo } from 'react';
import { encodeQr } from '../lib/qr-encoder';
import styles from './qr-code.module.css';

export interface QrCodeProps {
  value: string;
  label: string;
}

/** QR code em SVG inline, gerado no navegador: o segredo do 2FA não sai da página. */
export function QrCode({ value, label }: QrCodeProps) {
  const symbol = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      // Texto longo demais para o gerador: a tela segue com o segredo em texto.
      return null;
    }
  }, [value]);
  if (symbol === null) return null;
  const size = symbol.length;
  const path = symbol
    .flatMap((line, row) =>
      line.flatMap((dark, col) => (dark ? [`M${String(col)} ${String(row)}h1v1h-1z`] : [])),
    )
    .join('');
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className={styles.root}
      shapeRendering="crispEdges"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
