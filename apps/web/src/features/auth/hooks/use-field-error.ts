import type { FieldError } from 'react-hook-form';
import { useT } from '../../../shared/i18n/i18n';

/** Traduz a chave que o `zod` deixou no erro do campo; sem erro, devolve `undefined`. */
export function useFieldError() {
  const t = useT();
  return (error: FieldError | undefined) => (error?.message ? t(error.message) : undefined);
}
