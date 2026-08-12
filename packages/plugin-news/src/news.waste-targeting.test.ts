import { describe, expect, it, vi } from 'vitest';

const requestMainserverJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/plugin-sdk')>()),
  requestMainserverJson: requestMainserverJsonMock,
}));

import {
  findStaleWasteLocationKeys,
  loadNewsWasteMasterData,
  resolveNewsWasteTargetOptions,
} from './news.waste-targeting.js';

const timestamp = '2026-08-12T10:00:00.000Z';

describe('News Waste targeting', () => {
  const overview = {
    fractions: [],
    regions: [{ id: 'r1', name: 'Nord', createdAt: timestamp, updatedAt: timestamp }],
    cities: [
      {
        id: 'c1',
        name: 'Musterstadt',
        postalCode: '12345',
        regionId: 'r1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    streets: [
      { id: 's1', name: 'Hauptstraße', cityId: 'c1', createdAt: timestamp, updatedAt: timestamp },
    ],
    houseNumbers: [
      { id: 'h1', number: '1', streetId: 's1', createdAt: timestamp, updatedAt: timestamp },
    ],
    collectionLocations: [
      {
        id: 'l1',
        cityId: 'c1',
        regionId: 'r1',
        streetId: 's1',
        houseNumberId: 'h1',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'l2',
        cityId: 'c1',
        regionId: 'r1',
        streetId: 's1',
        houseNumberId: 'h1',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'inactive',
        cityId: 'c1',
        streetId: 's1',
        active: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    locationTourLinks: [],
  } as const;

  it('loads the lightweight targeting scope without tour-link data', async () => {
    requestMainserverJsonMock.mockResolvedValueOnce({ data: overview });

    await expect(loadNewsWasteMasterData()).resolves.toEqual(overview);
    expect(requestMainserverJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/waste-management/master-data?scope=targeting',
      })
    );
  });

  it('maps active locations to deduplicated address keys including the house number', () => {
    expect(resolveNewsWasteTargetOptions(overview)).toEqual([
      expect.objectContaining({
        key: { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' },
        label: 'Hauptstraße 1, 12345 Musterstadt',
      }),
    ]);
  });

  it('preserves keys that no longer resolve to current master data', () => {
    const options = resolveNewsWasteTargetOptions(overview);
    const currentKey = options[0]?.key;
    expect(currentKey).toBeDefined();
    if (!currentKey) {
      throw new Error('Expected a resolved target key');
    }
    expect(
      findStaleWasteLocationKeys(
        [currentKey, { street: 'Alte Straße', zip: '12345', city: 'Musterstadt' }],
        options
      )
    ).toEqual([{ street: 'Alte Straße', zip: '12345', city: 'Musterstadt' }]);
  });

  it('does not offer locations whose city has no postal code', () => {
    expect(
      resolveNewsWasteTargetOptions({
        ...overview,
        cities: [{ ...overview.cities[0], postalCode: undefined }],
      })
    ).toEqual([]);
  });
});
