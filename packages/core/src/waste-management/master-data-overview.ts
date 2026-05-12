import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from './master-data-addresses.js';
import type { WasteLocationTourLinkRecord } from './master-data-tours.js';

export type WasteManagementMasterDataOverview = {
  readonly fractions: readonly WasteFractionRecord[];
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly collectionLocations: readonly WasteCollectionLocationRecord[];
  readonly locationTourLinks: readonly WasteLocationTourLinkRecord[];
};
