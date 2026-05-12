import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  WasteMasterDataActiveTourBanner,
  WasteMasterDataLocationsEmptyState,
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';

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
  selectedTourId,
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

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-[rgba(255,255,255,0.32)] shadow-shell">
      <WasteMasterDataLocationsTableToolbar
        selectedCollectionLocationsCount={selectedCollectionLocationsCount}
        availableTours={availableTours}
        allFilteredLocationsSelected={allFilteredLocationsSelected}
        selectedTourId={selectedTourId}
        onOpenBulkAssignments={onOpenBulkAssignments}
        onToggleSelectAll={onToggleSelectAll}
        onTourFilterChange={onTourFilterChange}
      />
      <WasteMasterDataActiveTourBanner selectedTour={selectedTour} onTourFilterChange={onTourFilterChange} />
      {collectionLocations.length ? (
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
      ) : (
        <WasteMasterDataLocationsEmptyState />
      )}
    </section>
  );
};
