import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

export type WasteManagementMasterDataOverview = Readonly<{
  fractions: readonly WasteFractionRecord[];
  regions: readonly WasteRegionRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
  houseNumbers: readonly WasteHouseNumberRecord[];
  collectionLocations: readonly WasteCollectionLocationRecord[];
  locationTourLinks: readonly WasteLocationTourLinkRecord[];
}>;
