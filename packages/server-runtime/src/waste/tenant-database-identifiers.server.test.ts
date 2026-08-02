import { describe, expect, it } from 'vitest';

import { deriveWasteTenantDatabaseNames } from './tenant-database-identifiers.server.js';

describe('Waste tenant database identifiers', () => {
  it('derives stable, bounded and tenant-specific names', () => {
    const names = deriveWasteTenantDatabaseNames('bb-prignitz');
    expect(names.database).toBe('sva_w_bb_prignitz_4fc528d5be47_db');
    expect(Object.values(names).every((name) => /^[a-z][a-z0-9_]{0,62}$/u.test(name))).toBe(true);
    expect(names.database).not.toBe(deriveWasteTenantDatabaseNames('bb-guben').database);
  });
});
