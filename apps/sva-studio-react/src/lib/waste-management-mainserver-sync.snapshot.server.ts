import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';

import type { WasteMaterializationContext } from './waste-management-mainserver-sync.materialization.shared.js';
import { withWasteClient } from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

export type WasteMaterializationSyncState = Omit<
  WasteMaterializationContext,
  'currentYear' | 'nextYear'
> & {
  readonly cities: readonly WasteCityRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly locations: readonly WasteCollectionLocationRecord[];
  readonly locationTourPickupDates: NonNullable<
    WasteMaterializationContext['locationTourPickupDates']
  >;
  readonly tourAssignments: NonNullable<WasteMaterializationContext['tourAssignments']>;
  readonly streets: readonly WasteStreetRecord[];
  readonly tours: readonly WasteTourRecord[];
  readonly links: readonly WasteLocationTourLinkRecord[];
};

export const loadWasteMainserverStudioSnapshot = async (
  runtimeDeps: WasteOperationRuntimeDeps,
  instanceId: string
) =>
  await withWasteClient(runtimeDeps, instanceId, async ({ client, repository }) => {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');
    try {
      const sourceState = await repository.getWasteMainserverSourceRevision();
      if (!sourceState) {
        throw new Error('waste_mainserver_source_state_missing');
      }
      const studioState: WasteMaterializationSyncState = {
        tours: await repository.listWasteTours(),
        fractions: await repository.listWasteFractions(),
        links: await repository.listWasteLocationTourLinks(),
        locations: await repository.listWasteCollectionLocations(),
        houseNumbers: await repository.listWasteHouseNumbers(),
        locationTourPickupDates: await repository.listWasteLocationTourPickupDates(),
        tourAssignments: await repository.listWasteTourAssignments(),
        cities: await repository.listWasteCities(),
        streets: await repository.listWasteStreets(),
        tourDateShifts: await repository.listWasteTourDateShifts(),
        globalDateShifts: await repository.listWasteGlobalDateShifts(),
        holidayRules: await repository.listWasteHolidayRules(),
      };
      await client.query('COMMIT;');
      return { sourceState, studioState };
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    }
  });
