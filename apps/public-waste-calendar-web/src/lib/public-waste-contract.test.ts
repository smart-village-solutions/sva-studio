import { describe, expect, it } from 'vitest';

import { buildPublicWasteLocationKey } from './public-waste-contract.js';

describe('public waste contract', () => {
  it('builds a stable location key from the resolved selection', () => {
    expect(
      buildPublicWasteLocationKey({
        regionId: 'r-1',
        cityId: 'c-1',
        streetId: 's-1',
        houseNumberId: 'h-1',
      })
    ).toBe('r-1:c-1:s-1:h-1');
  });
});
