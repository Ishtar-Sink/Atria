import type { Schemas } from '@atria/contracts';
import { useQuery } from '@tanstack/react-query';
import type { PeriodRange } from '@atria/ui';
import { api } from '../../../shared/api/client';
import { financeKeys } from './finance-cache';

export type FinancialSummary = Schemas['FinancialSummaryResponse'];
export type MonthlyPoint = FinancialSummary['monthly'][number];
export type MonthlyMode = 'flow' | 'balance';

/**
 * Resumo do Painel (RF-35, PD-58). Sem período ("Qualquer período") o servidor vai da primeira
 * movimentação até hoje, sem comparação (DEC-004); a tela não recalcula totais nem saldos (RN-01).
 */
export function useFinancialSummary(period: PeriodRange | null) {
  return useQuery({
    queryKey: [...financeKeys.summary, period?.from ?? null, period?.to ?? null],
    queryFn: ({ signal }) =>
      api.get<FinancialSummary>('/financial-summaries', {
        query: period ? { from: period.from, to: period.to } : {},
        signal,
      }),
  });
}
