import { describe, expect, it } from 'vitest';

import { buildPublicWasteLocationKey, parsePublicWasteLocationKey } from './public-waste-contract.js';

describe('public waste contract', () => {
  it('builds a stable location key from the resolved selection', () => {
    expect(
      buildPublicWasteLocationKey({
        regionId: '11111111-1111-4111-8111-111111111111',
        cityId: '22222222-2222-4222-8222-222222222222',
        streetId: '33333333-3333-4333-8333-333333333333',
        houseNumberId: '44444444-4444-4444-8444-444444444444',
      })
    ).toBe(
      '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444'
    );
  });

  it('rejects malformed location keys', () => {
    expect(parsePublicWasteLocationKey('r-1:c-1:s-1:h-1')).toBeNull();
  });
});
