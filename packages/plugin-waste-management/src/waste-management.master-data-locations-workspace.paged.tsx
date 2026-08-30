import { usePagedRouteSync } from './waste-management.table-frame.js';

import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';
import { WasteMasterDataLocationsTableSection } from './waste-management.master-data-locations-workspace.parts.js';

export const WasteMasterDataPagedLocationsTable = ({
  collectionLocations,
  page,
  pageSize,
  pageCount,
  totalItems,
  pageResponseReceived = true,
  onSyncPageChange,
  ...props
}: Pick<
  WasteMasterDataLocationsWorkspaceProps,
  | 'regions'
  | 'search'
  | 'cities'
  | 'streets'
  | 'houseNumbers'
  | 'collectionLocations'
  | 'locationTourLinks'
  | 'selectedLocationIds'
  | 'allFilteredLocationsSelected'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'page'
  | 'pageSize'
  | 'pageCount'
  | 'totalItems'
  | 'pageResponseReceived'
  | 'sortMode'
  | 'sortDirection'
  | 'selectedTourId'
  | 'onPageChange'
  | 'onSyncPageChange'
  | 'onPageSizeChange'
  | 'onSortModeChange'
  | 'onSortDirectionChange'
  | 'onTourFilterChange'
  | 'onToggleSelectAll'
  | 'onToggleLocation'
  | 'onOpenCreateRegion'
  | 'onOpenCreateCity'
  | 'onOpenCreateStreet'
  | 'onOpenCreateHouseNumber'
  | 'onOpenCreateLocation'
  | 'onOpenBulkAssignments'
  | 'onCopyLocation'
  | 'onDeleteLocation'
  | 'onDeleteLocations'
  | 'onOpenEditLocation'
  | 'onOpenEditTour'
  | 'getLocationLabel'
>) => {
  const safePage = pageResponseReceived ? (pageCount > 0 ? Math.min(page, pageCount) : 1) : page;
  usePagedRouteSync({
    page,
    safePage,
    onPageChange: props.onPageChange,
    onSyncPageChange,
  });

  return (
    <WasteMasterDataLocationsTableSection
      {...props}
      collectionLocations={collectionLocations}
      page={safePage}
      pageSize={pageSize}
      pageCount={pageCount}
      totalItems={totalItems}
    />
  );
};
