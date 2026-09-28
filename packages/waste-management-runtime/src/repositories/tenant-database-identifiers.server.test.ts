import { describe, expect, it } from 'vitest';

import { deriveWasteTenantDatabaseNames } from './tenant-database-identifiers.server.js';

const namesForBase = (base: string) => ({
  database: `${base}_db`,
  ownerRole: `${base}_owner`,
  migratorRole: `${base}_migrator`,
  appRole: `${base}_app`,
  publicAppRole: `${base}_public`,
});

describe('Waste tenant database identifiers', () => {
  it('derives stable, bounded and tenant-specific names', () => {
    const names = deriveWasteTenantDatabaseNames('bb-prignitz');
    expect(names).toEqual(namesForBase('sva_w_bb_prignitz_4fc528d5be47'));
    expect(Object.values(names).every((name) => /^[a-z][a-z0-9_]{0,62}$/u.test(name))).toBe(true);
    expect(names.database).not.toBe(deriveWasteTenantDatabaseNames('bb-guben').database);
  });

  it.each([
    ['ASCII separators', 'BB Prignitz__West', 'sva_w_bb_prignitz_west_f36ac2426242'],
    ['Unicode NFKD input', '  ÄÖÜ Straße № 12  ', 'sva_w_a_o_u_stra_e_no_12_33af1e752912'],
    ['separator-only input', '---___...', 'sva_w_tenant_e81773dbc284'],
    ['edge separators', '__bb-prignitz__', 'sva_w_bb_prignitz_28c143c3b0bb'],
    ['digit-leading input', '123-tenant', 'sva_w_t_123_tenant_fa322dc764a7'],
    ['empty input', '', 'sva_w_tenant_e3b0c44298fc'],
  ])('preserves exact names for %s', (_caseName, instanceId, expectedBase) => {
    expect(deriveWasteTenantDatabaseNames(instanceId)).toEqual(namesForBase(expectedBase));
  });

  it('preserves exact bounded names for a very long separator suffix', () => {
    const names = deriveWasteTenantDatabaseNames(`a${'-'.repeat(100_000)}`);

    expect(names).toEqual(namesForBase('sva_w_a_97113d83bdf9'));
    expect(Object.values(names).every((name) => name.length <= 63)).toBe(true);
    expect(Object.values(names).every((name) => /^[a-z][a-z0-9_]{0,62}$/u.test(name))).toBe(true);
  });
});
