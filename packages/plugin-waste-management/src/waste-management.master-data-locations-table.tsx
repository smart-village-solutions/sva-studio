import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useMemo, useState } from 'react';
import { StudioConfirmDialog } from '@sva/studio-ui-react';
import {
  WasteMasterDataActiveTourBanner,
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
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

const WasteMasterDataLocationsTableContent = ({
  filtersOpen,
  onToggleFiltersOpen,
  ...props
}: WasteMasterDataLocationsTableContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const maps = createLocationsTableMaps(props);
  const selectedTour = props.selectedTourId ? maps.toursById.get(props.selectedTourId) : undefined;
  const [pendingDeleteLocation, setPendingDeleteLocation] = useState<WasteCollectionLocationRecord | null>(null);
  const [bulkDeleteRequested, setBulkDeleteRequested] = useState(false);
  const [sortField, setSortField] = useState<WasteMasterDataLocationsSortField>('region');
  const [sortDirection, setSortDirection] = useState<WasteMasterDataLocationsSortDirection>('asc');
  const sortedCollectionLocations = useMemo(() => {
    const getSortValue = (location: WasteCollectionLocationRecord, field: WasteMasterDataLocationsSortField): string => {
      switch (field) {
        case 'region':
          return location.regionId ? maps.regionsById.get(location.regionId)?.name ?? '' : '';
        case 'city':
          return maps.citiesById.get(location.cityId)?.name ?? '';
        case 'street':
          return location.streetId ? maps.streetsById.get(location.streetId)?.name ?? '' : '';
        case 'houseNumbers':
          return location.houseNumberId ? maps.houseNumbersById.get(location.houseNumberId)?.number ?? '' : '';
        case 'tours':
          return (maps.locationTourNamesByLocationId.get(location.id) ?? []).join('|');
        case 'status':
          return location.active ? 'active' : 'inactive';
        default:
          return '';
      }
    };

    return [...props.collectionLocations].sort((left, right) => {
      const leftValue = getSortValue(left, sortField);
      const rightValue = getSortValue(right, sortField);
      const comparison = leftValue.localeCompare(rightValue, 'de', { numeric: true, sensitivity: 'base' });
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
        <WasteMasterDataActiveTourBanner selectedTour={selectedTour} onTourFilterChange={props.onTourFilterChange} />
        {props.collectionLocations.length ? (
          <>
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
            <WastePanelTableBottomBar
              pt={pt}
              page={props.page}
              pageSize={props.pageSize}
              pageCount={props.pageCount}
              totalItems={props.totalItems}
              onPageChange={props.onPageChange}
              onPageSizeChange={props.onPageSizeChange}
            />
          </>
        ) : (
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
        )}
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
