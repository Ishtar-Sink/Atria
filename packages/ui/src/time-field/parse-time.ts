/** Normaliza "930", "9:30", "09:30" ou "9" para "HH:mm" em 24 h; `null` para vazio. */
export function parseTime(text: string): string | null {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits === '') return null;
  let hm = digits;
  if (hm.length === 3) hm = `0${hm}`;
  if (hm.length <= 2) hm = `${hm.padStart(2, '0')}00`;
  const hours = Math.min(23, Number(hm.slice(0, 2)));
  const minutes = Math.min(59, Number(hm.slice(2)));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Insere o ":" enquanto se digita. */
export function maskTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}
