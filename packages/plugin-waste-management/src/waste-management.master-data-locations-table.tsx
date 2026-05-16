import { usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, useState } from 'react';
import {
  WasteMasterDataActiveTourBanner,
  WasteMasterDataLocationsEmptyState,
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

export const WasteMasterDataLocationsTable = ({
  regions,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  locationTourLinks,
  selectedLocationIds,
  allFilteredLocationsSelected,
  selectedCollectionLocationsCount,
  availableTours,
  page,
  pageSize,
  pageCount,
  totalItems,
  selectedTourId,
  onPageChange,
  onPageSizeChange,
  onTourFilterChange,
  onToggleSelectAll,
  onToggleLocation,
  onOpenBulkAssignments,
  onOpenEditLocation,
  getLocationLabel,
}: WasteMasterDataLocationsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const maps = createLocationsTableMaps({ regions, cities, streets, houseNumbers, availableTours, locationTourLinks });
  const selectedTour = selectedTourId ? maps.toursById.get(selectedTourId) : undefined;
  const [filtersOpen, setFiltersOpen] = useState(Boolean(selectedTourId));

  useEffect(() => {
    if (selectedTourId) {
      setFiltersOpen(true);
    }
  }, [selectedTourId]);

  return (
    <section className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
      <WasteMasterDataLocationsTableToolbar
        selectedCollectionLocationsCount={selectedCollectionLocationsCount}
        availableTours={availableTours}
        filtersOpen={filtersOpen}
        selectedTourId={selectedTourId}
        allFilteredLocationsSelected={allFilteredLocationsSelected}
        onOpenBulkAssignments={onOpenBulkAssignments}
        onTourFilterChange={onTourFilterChange}
        onToggleSelectAll={onToggleSelectAll}
        onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
      />
      <WasteMasterDataActiveTourBanner selectedTour={selectedTour} onTourFilterChange={onTourFilterChange} />
      {collectionLocations.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse" aria-label={pt('masterData.collectionLocations.title')}>
              <caption className="sr-only">{pt('masterData.locationsWorkspace.table.caption')}</caption>
              <WasteMasterDataLocationsHeader />
              <tbody>
                {collectionLocations.map((location) => (
                  <WasteMasterDataLocationsRow
                    key={location.id}
                    location={location}
                    maps={maps}
                    selectedLocationIds={selectedLocationIds}
                    onToggleLocation={onToggleLocation}
                    onOpenEditLocation={onOpenEditLocation}
                    getLocationLabel={getLocationLabel}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <WastePanelTableBottomBar
            pt={pt}
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      ) : (
        <WasteMasterDataLocationsEmptyState />
      )}
    </section>
  );
};
