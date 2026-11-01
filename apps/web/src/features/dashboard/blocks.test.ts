import { describe, expect, it } from 'vitest';
import { DASHBOARD_BLOCKS, dashboardCells } from './blocks';

const only = (...ids: string[]) => DASHBOARD_BLOCKS.filter((block) => ids.includes(block.id));
const without = (...ids: string[]) => DASHBOARD_BLOCKS.filter((block) => !ids.includes(block.id));

describe('dashboardCells', () => {
  it('pairs the nth main block with the nth side block in the same row', () => {
    const cells = dashboardCells(DASHBOARD_BLOCKS);
    expect(cells.map((cell) => [cell.id, cell.row, cell.alone])).toEqual([
      ['today', 1, false],
      ['reminders', 2, false],
      ['upcoming', 3, false],
      ['journal', 1, false],
      ['balance', 2, false],
      ['reading', 3, false],
    ]);
  });

  it('pairs the visible blocks when some are hidden', () => {
    const cells = dashboardCells(without('journal', 'upcoming'));
    expect(cells.map((cell) => [cell.id, cell.zone, cell.row, cell.alone])).toEqual([
      ['today', 'main', 1, false],
      ['reminders', 'main', 2, false],
      ['balance', 'side', 1, false],
      ['reading', 'side', 2, false],
    ]);
  });

  it('marks the block without a pair as alone', () => {
    const cells = dashboardCells(without('journal'));
    const upcoming = cells.find((cell) => cell.id === 'upcoming');
    expect(upcoming).toMatchObject({ row: 3, alone: true });
    expect(cells.filter((cell) => cell.alone)).toHaveLength(1);
  });

  it('marks every block as alone when one zone is empty', () => {
    const cells = dashboardCells(only('today', 'reminders', 'upcoming'));
    expect(cells.map((cell) => [cell.id, cell.row, cell.alone])).toEqual([
      ['today', 1, true],
      ['reminders', 2, true],
      ['upcoming', 3, true],
    ]);
  });
});
