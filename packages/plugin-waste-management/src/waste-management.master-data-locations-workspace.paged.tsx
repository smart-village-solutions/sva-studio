import { createPagedItems, usePagedRouteSync } from './waste-management.table-frame.js';

import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';
import { WasteMasterDataLocationsTableSection } from './waste-management.master-data-locations-workspace.parts.js';

export const WasteMasterDataPagedLocationsTable = ({
  collectionLocations,
  page,
  pageSize,
  onSyncPageChange,
  ...props
}: Pick<
  WasteMasterDataLocationsWorkspaceProps,
  | 'regions'
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
  | 'selectedTourId'
  | 'onPageChange'
  | 'onSyncPageChange'
  | 'onPageSizeChange'
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
  | 'getLocationLabel'
>) => {
  const pagedCollectionLocations = createPagedItems({ items: collectionLocations, page, pageSize });
  usePagedRouteSync({
    page,
    safePage: pagedCollectionLocations.safePage,
    onPageChange: props.onPageChange,
    onSyncPageChange,
  });

  return (
    <WasteMasterDataLocationsTableSection
      {...props}
      collectionLocations={pagedCollectionLocations.items}
      page={pagedCollectionLocations.safePage}
      pageSize={pageSize}
      pageCount={pagedCollectionLocations.pageCount}
      totalItems={pagedCollectionLocations.totalItems}
    />
  );
};
