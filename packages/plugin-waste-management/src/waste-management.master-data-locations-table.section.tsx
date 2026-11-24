import { usePluginTranslation } from '@sva/plugin-sdk';

import {
  WasteMasterDataLocationsEmptyState,
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';

const hasLocationFilters = (search: WasteMasterDataLocationsTableProps['search']) =>
  [
    search?.q.trim(),
    search?.status !== undefined && search.status !== 'all',
    search?.regionId,
    search?.cityId,
    search?.locationStreetId,
    search?.locationHouseNumberId,
    search?.tourId,
  ].some(Boolean);

export const WasteMasterDataLocationsTableSection = ({
  collectionLocations,
  search,
  allFilteredLocationsSelected,
  selectedLocationIds,
  matchingSelectedLocationsCount,
  maps,
  sortMode,
  sortDirection,
  onSort,
  onResetFilters,
  onToggleSelectAll,
  onToggleLocation,
  onCopyLocation,
  onDeleteLocation,
  onOpenEditLocation,
  onOpenEditTour,
}: Pick<WasteMasterDataLocationsTableProps, 'sortMode' | 'sortDirection'> & {
  readonly onSort: WasteMasterDataLocationsTableProps['onApplyFilters'];
  readonly onResetFilters?: WasteMasterDataLocationsTableProps['onResetFilters'];
  readonly collectionLocations: WasteMasterDataLocationsTableProps['collectionLocations'];
  readonly search: WasteMasterDataLocationsTableProps['search'];
  readonly allFilteredLocationsSelected: WasteMasterDataLocationsTableProps['allFilteredLocationsSelected'];
  readonly matchingSelectedLocationsCount?: number;
  readonly selectedLocationIds: readonly string[];
  readonly maps: Parameters<typeof WasteMasterDataLocationsRow>[0]['maps'];
  readonly onToggleSelectAll: WasteMasterDataLocationsTableProps['onToggleSelectAll'];
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onCopyLocation: WasteMasterDataLocationsTableProps['onCopyLocation'];
  readonly onDeleteLocation: WasteMasterDataLocationsTableProps['onDeleteLocation'];
  readonly onOpenEditLocation: WasteMasterDataLocationsTableProps['onOpenEditLocation'];
  readonly onOpenEditTour: WasteMasterDataLocationsTableProps['onOpenEditTour'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const someFilteredLocationsSelected =
    (matchingSelectedLocationsCount ?? selectedLocationIds.length) > 0 &&
    !allFilteredLocationsSelected;

  if (!collectionLocations.length) {
    const filtered = hasLocationFilters(search);
    return (
      <WasteMasterDataLocationsEmptyState filtered={filtered} onResetFilters={onResetFilters} />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full border-collapse"
        aria-label={pt('masterData.collectionLocations.title')}
      >
        <caption className="sr-only">{pt('masterData.locationsWorkspace.table.caption')}</caption>
        <WasteMasterDataLocationsHeader
          sortMode={sortMode}
          sortDirection={sortDirection}
          onSort={onSort}
          allFilteredLocationsSelected={allFilteredLocationsSelected}
          someFilteredLocationsSelected={someFilteredLocationsSelected}
          onToggleSelectAll={onToggleSelectAll}
        />
        <tbody>
          {collectionLocations.map((location) => (
            <WasteMasterDataLocationsRow
              key={location.id}
              location={location}
              search={search}
              maps={maps}
              selectedLocationIds={selectedLocationIds}
              onToggleLocation={onToggleLocation}
              onCopyLocation={onCopyLocation}
              onDeleteLocation={onDeleteLocation}
              onOpenEditLocation={onOpenEditLocation}
              onOpenEditTour={onOpenEditTour}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
