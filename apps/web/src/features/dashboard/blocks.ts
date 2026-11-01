export type DashboardZone = 'main' | 'side';

export interface DashboardBlockDef {
  readonly id: DashboardBlockId;
  readonly zone: DashboardZone;
  readonly sensitive: boolean;
}

export type DashboardBlockId =
  'today' | 'reminders' | 'upcoming' | 'journal' | 'balance' | 'reading';

/** Os ids são os que Configurações › Dashboard grava (PD-25, PD-27, PD-30). */
export const DASHBOARD_BLOCKS: readonly DashboardBlockDef[] = Object.freeze([
  { id: 'today', zone: 'main', sensitive: false },
  { id: 'reminders', zone: 'main', sensitive: false },
  { id: 'upcoming', zone: 'main', sensitive: false },
  { id: 'journal', zone: 'side', sensitive: true },
  { id: 'balance', zone: 'side', sensitive: true },
  { id: 'reading', zone: 'side', sensitive: false },
]);

/** Tarefas e lembretes de hoje. */
export const DASH_TODAY_LIMIT = 3;
/** Próximos dias e contas do Dinheiro. */
export const DASH_LIMIT = 5;

const IDS = new Set<string>(DASHBOARD_BLOCKS.map((block) => block.id));

export function isDashboardBlockId(value: unknown): value is DashboardBlockId {
  return typeof value === 'string' && IDS.has(value);
}

export function isSensitiveBlock(id: DashboardBlockId): boolean {
  return DASHBOARD_BLOCKS.some((block) => block.id === id && block.sensitive);
}

export interface DashboardCell {
  readonly id: DashboardBlockId;
  readonly zone: DashboardZone;
  readonly row: number;
  readonly alone: boolean;
}

/**
 * Pareia o N-ésimo bloco visível da zona principal com o N-ésimo da lateral (SPEC-002, RF-09).
 * A saída lista a zona principal e depois a lateral: é a ordem de leitura, de Tab e de uma coluna.
 */
export function dashboardCells(visible: readonly DashboardBlockDef[]): DashboardCell[] {
  const main = visible.filter((block) => block.zone === 'main');
  const side = visible.filter((block) => block.zone === 'side');
  const cellsOf = (blocks: readonly DashboardBlockDef[], other: readonly DashboardBlockDef[]) =>
    blocks.map((block, index) => ({
      id: block.id,
      zone: block.zone,
      row: index + 1,
      alone: index >= other.length,
    }));
  return [...cellsOf(main, side), ...cellsOf(side, main)];
}
