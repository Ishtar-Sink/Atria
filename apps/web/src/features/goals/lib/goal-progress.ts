// Os tipos vêm do pacote de contratos gerado do OpenAPI ([project/api-02], DEC-009).
import type { BadgeTone } from '@atria/ui';
import type { Schemas } from '@atria/contracts';

export type Goal = Schemas['GoalResponse'];
export type GoalPage = Schemas['GoalPage'];
export type GoalStatus = Schemas['GoalStatus'];
export type Milestone = Schemas['MilestoneResponse'];
export type MilestonePage = Schemas['MilestonePage'];
export type Visibility = Schemas['Visibility'];

export const GOAL_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'abandoned',
] as const satisfies readonly GoalStatus[];

/** Tom do selo de status: calmo, sem vermelho para uma meta que ainda não terminou. */
export const STATUS_TONE: Record<GoalStatus, BadgeTone> = {
  planned: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  abandoned: 'warning',
};

/**
 * Progresso de 0 a 100 (RN-15): porcentagem de marcos concluídos; sem marcos, o status decide.
 * Recebe só os marcos que existem: um marco removido sai da lista e deixa de contar.
 */
export function goalProgress(
  goal: Pick<Goal, 'status'>,
  milestones: readonly Pick<Milestone, 'completed'>[],
): number {
  if (milestones.length === 0) return goal.status === 'completed' ? 100 : 0;
  const done = milestones.filter((milestone) => milestone.completed).length;
  return Math.floor((done * 100) / milestones.length);
}

const percent_formats = new Map<string, Intl.NumberFormat>();
const date_formats = new Map<string, Intl.DateTimeFormat>();

/** 25 vira "25%", pelo `Intl` no locale do usuário ([project/frontend-16]). */
export function formatProgress(percent: number, locale: string): string {
  let format = percent_formats.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    percent_formats.set(locale, format);
  }
  return format.format(percent / 100);
}

/**
 * O prazo é uma data sem hora (`YYYY-MM-DD`): formatá-la em outro fuso mostraria o dia anterior,
 * por isso ela é lida e escrita em UTC.
 */
export function formatDeadline(date: string, locale: string): string {
  let format = date_formats.get(locale);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
    date_formats.set(locale, format);
  }
  return format.format(new Date(`${date}T00:00:00Z`));
}
