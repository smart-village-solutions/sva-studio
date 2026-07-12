import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useMemo, useState } from 'react';
import { StudioConfirmDialog } from '@sva/studio-ui-react';
import {
  WasteMasterDataActiveTourBanner,
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
  type WasteMasterDataLocationsTableMaps,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';
import { useLocationsFiltersOpen } from './waste-management.master-data-locations-table.filters-state.js';
import { WasteMasterDataLocationsTableSection } from './waste-management.master-data-locations-table.section.js';
import type {
  WasteMasterDataLocationsSortDirection,
  WasteMasterDataLocationsSortField,
} from './waste-management.master-data-locations-table.types.js';
import { WastePanelTableBottomBar, WastePanelTableTopBar } from './waste-management.table-frame.js';

type WasteMasterDataLocationsTableContentProps = WasteMasterDataLocationsTableProps & {
  readonly filtersOpen: boolean;
  readonly onToggleFiltersOpen: () => void;
};

const getLocationSortValue = (
  location: WasteCollectionLocationRecord,
  field: WasteMasterDataLocationsSortField,
  maps: WasteMasterDataLocationsTableMaps
): string => {
  const values: Record<WasteMasterDataLocationsSortField, () => string> = {
    region: () => (location.regionId ? (maps.regionsById.get(location.regionId)?.name ?? '') : ''),
    city: () => maps.citiesById.get(location.cityId)?.name ?? '',
    street: () => (location.streetId ? (maps.streetsById.get(location.streetId)?.name ?? '') : ''),
    houseNumbers: () =>
      location.houseNumberId
        ? (maps.houseNumbersById.get(location.houseNumberId)?.number ?? '')
        : '',
    tours: () => (maps.locationTourNamesByLocationId.get(location.id) ?? []).join('|'),
    status: () => (location.active ? 'active' : 'inactive'),
  };
  return values[field]();
};

const WasteMasterDataLocationsTableContent = ({
  filtersOpen,
  onToggleFiltersOpen,
  ...props
}: WasteMasterDataLocationsTableContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const maps = createLocationsTableMaps(props);
  const selectedTour = props.selectedTourId ? maps.toursById.get(props.selectedTourId) : undefined;
  const [pendingDeleteLocation, setPendingDeleteLocation] =
    useState<WasteCollectionLocationRecord | null>(null);
  const [bulkDeleteRequested, setBulkDeleteRequested] = useState(false);
  const [sortField, setSortField] = useState<WasteMasterDataLocationsSortField>('region');
  const [sortDirection, setSortDirection] = useState<WasteMasterDataLocationsSortDirection>('asc');
  const sortedCollectionLocations = useMemo(() => {
    return [...props.collectionLocations].sort((left, right) => {
      const leftValue = getLocationSortValue(left, sortField, maps);
      const rightValue = getLocationSortValue(right, sortField, maps);
      const comparison = leftValue.localeCompare(rightValue, 'de', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [maps, props.collectionLocations, sortDirection, sortField]);

  return (
    <>
      <section className="rounded-none border-y border-border bg-card shadow-shell">
        <WastePanelTableTopBar>
          <WasteMasterDataLocationsTableToolbar
            selectedCollectionLocationsCount={props.selectedCollectionLocationsCount}
            availableTours={props.availableTours}
            filtersOpen={filtersOpen}
            selectedTourId={props.selectedTourId}
            allFilteredLocationsSelected={props.allFilteredLocationsSelected}
            onOpenCreateRegion={props.onOpenCreateRegion}
            onOpenCreateCity={props.onOpenCreateCity}
            onOpenCreateStreet={props.onOpenCreateStreet}
            onOpenCreateHouseNumber={props.onOpenCreateHouseNumber}
            onOpenCreateLocation={props.onOpenCreateLocation}
            onOpenBulkAssignments={props.onOpenBulkAssignments}
            onTourFilterChange={props.onTourFilterChange}
            onToggleSelectAll={props.onToggleSelectAll}
            onRequestDeleteSelected={() => setBulkDeleteRequested(true)}
            onToggleFiltersOpen={onToggleFiltersOpen}
          />
        </WastePanelTableTopBar>
        <WasteMasterDataActiveTourBanner
          selectedTour={selectedTour}
          onTourFilterChange={props.onTourFilterChange}
        />
        <WasteMasterDataLocationsTableSection
          collectionLocations={sortedCollectionLocations}
          allFilteredLocationsSelected={props.allFilteredLocationsSelected}
          maps={maps}
          selectedLocationIds={props.selectedLocationIds}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field) => {
            if (field === sortField) {
              setSortDirection((current: WasteMasterDataLocationsSortDirection) =>
                current === 'asc' ? 'desc' : 'asc'
              );
              return;
            }
            setSortField(field);
            setSortDirection('asc');
          }}
          onToggleSelectAll={props.onToggleSelectAll}
          onToggleLocation={props.onToggleLocation}
          onCopyLocation={props.onCopyLocation}
          onDeleteLocation={async (location) => {
            setPendingDeleteLocation(location);
          }}
          onOpenEditLocation={props.onOpenEditLocation}
        />
        {props.collectionLocations.length > 0 ? (
          <WastePanelTableBottomBar
            pt={pt}
            page={props.page}
            pageSize={props.pageSize}
            pageCount={props.pageCount}
            totalItems={props.totalItems}
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
          />
        ) : null}
      </section>
      <StudioConfirmDialog
        open={pendingDeleteLocation !== null}
        title={pt('masterData.collectionLocations.actions.delete')}
        description={pendingDeleteLocation ? props.getLocationLabel(pendingDeleteLocation) : ''}
        confirmLabel={pt('masterData.collectionLocations.actions.delete')}
        cancelLabel={pt('masterData.collectionLocations.actions.cancel')}
        onCancel={() => setPendingDeleteLocation(null)}
        onConfirm={() => {
          if (!pendingDeleteLocation) {
            return;
          }
          void props.onDeleteLocation(pendingDeleteLocation);
          setPendingDeleteLocation(null);
        }}
      />
      <StudioConfirmDialog
        open={bulkDeleteRequested}
        title={pt('masterData.collectionLocations.bulk.dialog.deleteTitle')}
        description={pt('masterData.collectionLocations.bulk.dialog.deleteDescription', {
          value: props.selectedCollectionLocationsCount,
        })}
        confirmLabel={pt('masterData.collectionLocations.bulk.actions.deleteSelected')}
        cancelLabel={pt('masterData.collectionLocations.actions.cancel')}
        onCancel={() => setBulkDeleteRequested(false)}
        onConfirm={() => {
          void props.onDeleteLocations(props.selectedLocationIds);
          setBulkDeleteRequested(false);
        }}
      />
    </>
  );
};

export const WasteMasterDataLocationsTable = (props: WasteMasterDataLocationsTableProps) => {
  const { filtersOpen, setFiltersOpen } = useLocationsFiltersOpen(props.selectedTourId);

  return (
    <WasteMasterDataLocationsTableContent
      {...props}
      filtersOpen={filtersOpen}
      onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
    />
  );
};
