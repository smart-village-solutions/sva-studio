import { describe, expect, it } from 'vitest';

import { resolvePublicWasteSelection } from './public-waste-resolver.js';

describe('public waste resolver', () => {
  it('skips the region step when only one region is available', () => {
    const result = resolvePublicWasteSelection({
      availableRegions: [{ id: 'r-1', label: 'Musterregion' }],
      availableCities: [],
      availableStreets: [],
      availableHouseNumbers: [],
      selected: {},
    });

    expect(result.nextStep).toBe('city');
    expect(result.status).toBe('incomplete');
  });

  it('stops after city when only the catch-all street remains', () => {
    const result = resolvePublicWasteSelection({
      availableRegions: [{ id: 'r-1', label: 'Musterregion' }],
      availableCities: [{ id: 'c-1', label: 'Musterstadt', regionId: 'r-1' }],
      availableStreets: [{ id: 'all', label: 'Alle Straßen', cityId: 'c-1', isCatchAll: true }],
      availableHouseNumbers: [],
      selected: { regionId: 'r-1', cityId: 'c-1' },
    });

    expect(result.status).toBe('complete');
    expect(result.resolvedSelection).toEqual({
      regionId: 'r-1',
      cityId: 'c-1',
      streetId: 'all',
    });
  });
});
