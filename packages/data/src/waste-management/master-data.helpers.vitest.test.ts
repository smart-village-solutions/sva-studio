import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../index.js';
import { createWasteMasterDataRepository } from '../index.js';

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('waste master-data custom recurrence presets (data package coverage)', () => {
  it('lists, reads, upserts and deletes custom recurrence presets', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          id: 'preset-1',
          name: '14-tägig',
          description: null,
          interval_days: 14,
          created_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T11:00:00.000Z',
        },
      ],
      [
        {
          id: 'preset-1',
          name: '14-tägig',
          description: 'jede zweite Woche',
          interval_days: 14,
          created_at: '2026-05-09T10:00:00.000Z',
          updated_at: '2026-05-09T11:00:00.000Z',
        },
      ],
      [],
      [],
    ]);
    const repository = createWasteMasterDataRepository(executor);

    await expect(repository.listWasteCustomRecurrencePresets()).resolves.toEqual([
      {
        id: 'preset-1',
        name: '14-tägig',
        description: undefined,
        intervalDays: 14,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T11:00:00.000Z',
      },
    ]);

    await expect(repository.getWasteCustomRecurrencePresetById('preset-1')).resolves.toEqual({
      id: 'preset-1',
      name: '14-tägig',
      description: 'jede zweite Woche',
      intervalDays: 14,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
    });

    await repository.upsertWasteCustomRecurrencePreset({
      id: 'preset-2',
      name: 'Monatlich',
      description: undefined,
      intervalDays: 28,
    });
    await repository.deleteWasteCustomRecurrencePreset('preset-2');

    expect(statements[0]?.text).toContain('FROM waste_custom_recurrence_presets');
    expect(statements[1]?.values).toEqual(['preset-1']);
    expect(statements[2]?.values).toEqual(['preset-2', 'Monatlich', null, 28]);
    expect(statements[3]?.text).toContain('DELETE FROM waste_custom_recurrence_presets');
  });
});
