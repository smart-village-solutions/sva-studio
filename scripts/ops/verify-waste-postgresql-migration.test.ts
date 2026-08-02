import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  compareWasteDatabaseInventories,
  parseWasteDatabaseInventory,
} from './verify-waste-postgresql-migration.js';

const inventory = parseWasteDatabaseInventory(
  JSON.stringify({
    schema: 'public',
    objects: { tables: 2, indexes: 3 },
    rowCounts: { waste_a: 1, waste_b: 0 },
  })
);

describe('Waste-PostgreSQL-Migrationsprüfung', () => {
  it('akzeptiert identische Objekt- und Zeilenzahlen', () => {
    expect(compareWasteDatabaseInventories(inventory, inventory)).toEqual([]);
  });

  it('meldet fehlende Quelltabellen und abweichende Zeilenzahlen maschinenlesbar', () => {
    expect(
      compareWasteDatabaseInventories(inventory, {
        schema: 'public',
        objects: { tables: 1, indexes: 3 },
        rowCounts: { waste_a: 2 },
      })
    ).toEqual(['rowCounts.waste_a', 'rowCounts.waste_b']);
  });

  it('erlaubt migrationsbedingt zusätzliche Zieltabellen und Objektstrukturen', () => {
    expect(
      compareWasteDatabaseInventories(inventory, {
        schema: 'public',
        objects: { tables: 8, indexes: 25, constraints: 14, functions: 0 },
        rowCounts: { waste_a: 1, waste_b: 0, waste_new_technical_table: 4 },
      })
    ).toEqual([]);
  });

  it('meldet ein abweichendes Zielschema', () => {
    expect(
      compareWasteDatabaseInventories(inventory, {
        ...inventory,
        schema: 'waste',
      })
    ).toEqual(['schema']);
  });

  it('ist über den Node-tsx-Cutoverpfad direkt ausführbar', () => {
    const scriptPath = fileURLToPath(
      new URL('./verify-waste-postgresql-migration.ts', import.meta.url)
    );
    const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage: verify-waste-postgresql-migration');
    expect(result.stderr).not.toContain('Top-level await');
  });
});
