import { describe, expect, it } from 'vitest';

import { createWasteMasterDataDerivedState } from '../src/waste-management.master-data.derived.js';
import { createWasteMasterDataLocationActions } from '../src/waste-management.master-data.location-actions.js';

const createState = ({
  pageIds,
  total,
  selectedLocationIds,
  filteredLocationIds = [],
}: {
  readonly pageIds: readonly string[];
  readonly total: number;
  readonly selectedLocationIds: readonly string[];
  readonly filteredLocationIds?: readonly string[];
}) =>
  ({
    overview: null,
    collectionLocationPage: {
      items: pageIds.map((id) => ({ id })),
      page: 1,
      pageSize: 25,
      total,
      pageCount: total > 0 ? 1 : 0,
    },
    selectedLocationIds,
    filteredLocationIds,
  }) as never;

const search = {} as never;
const translate = (key: string) => key;

describe('waste master data derived selection state', () => {
  it('recognizes manual selection of every result when the complete filtered set is on the page', () => {
    const derived = createWasteMasterDataDerivedState(
      createState({
        pageIds: ['location-1', 'location-2'],
        total: 2,
        selectedLocationIds: ['location-1', 'location-2'],
      }),
      translate,
      search
    );

    expect(derived.allFilteredLocationsSelected).toBe(true);
  });

  it('does not infer full selection from an incomplete page without resolved filtered ids', () => {
    const derived = createWasteMasterDataDerivedState(
      createState({
        pageIds: ['location-1', 'location-2'],
        total: 3,
        selectedLocationIds: ['location-1', 'location-2'],
      }),
      translate,
      search
    );

    expect(derived.allFilteredLocationsSelected).toBe(false);
  });

  it('clears a manually selected complete page without loading filtered ids first', async () => {
    let selectedLocationIds: readonly string[] = ['location-1', 'location-2', 'outside-filter'];
    const state = {
      ...createState({
        pageIds: ['location-1', 'location-2'],
        total: 2,
        selectedLocationIds,
      }),
      setFilteredLocationIds: () => undefined,
      setSelectedLocationIds: (
        next: readonly string[] | ((current: readonly string[]) => readonly string[])
      ) => {
        selectedLocationIds = typeof next === 'function' ? next(selectedLocationIds) : next;
      },
    } as never;
    const loadFilteredLocationIds = async () => null;
    const actions = createWasteMasterDataLocationActions(
      state,
      search,
      loadFilteredLocationIds,
      () => undefined
    );

    await actions.toggleSelectAllFilteredLocations(false);

    expect(selectedLocationIds).toEqual(['outside-filter']);
  });
});
