import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import type { WasteManagementOutputOverview, WasteOutputPdfArtifactRecord } from './waste-management.api.js';

export type WasteMasterDataLocationsTableProps = {
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly collectionLocations: readonly WasteCollectionLocationRecord[];
  readonly locationTourLinks: readonly WasteLocationTourLinkRecord[];
  readonly outputOverview: WasteManagementOutputOverview | null;
  readonly selectedLocationIds: readonly string[];
  readonly allFilteredLocationsSelected: boolean;
  readonly selectedCollectionLocationsCount: number;
  readonly availableTours: readonly WasteTourRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
  readonly selectedTourId?: string;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onTourFilterChange: (tourId: string) => void;
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenCreateLocation: () => void;
  readonly onOpenBulkAssignments: () => void;
  readonly onCopyLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onDeleteLocation: (location: WasteCollectionLocationRecord) => Promise<void>;
  readonly onDeleteLocations: (locationIds: readonly string[]) => Promise<void>;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly getLocationLabel: (location: WasteCollectionLocationRecord) => string;
};

export type WasteMasterDataLocationsSortField =
  | 'region'
  | 'city'
  | 'street'
  | 'houseNumbers'
  | 'tours'
  | 'status';

export type WasteMasterDataLocationsSortDirection = 'asc' | 'desc';

export type WasteMasterDataLocationsTableMaps = {
  readonly regionsById: ReadonlyMap<string, WasteRegionRecord>;
  readonly citiesById: ReadonlyMap<string, WasteCityRecord>;
  readonly streetsById: ReadonlyMap<string, WasteStreetRecord>;
  readonly houseNumbersById: ReadonlyMap<string, WasteHouseNumberRecord>;
  readonly toursById: ReadonlyMap<string, WasteTourRecord>;
  readonly locationTourNamesByLocationId: ReadonlyMap<string, readonly string[]>;
  readonly outputPdfsByLocationId: ReadonlyMap<string, readonly WasteOutputPdfArtifactRecord[]>;
};
