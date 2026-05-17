import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  WasteMasterDataActiveTourBanner,
  WasteMasterDataLocationsTableToolbar,
  createLocationsTableMaps,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';
import { useLocationsFiltersOpen } from './waste-management.master-data-locations-table.helpers2.js';
import { WasteMasterDataLocationsTableSection } from './waste-management.master-data-locations-table.section.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

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

  return (
    <section className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
      <WasteMasterDataLocationsTableToolbar
        selectedCollectionLocationsCount={props.selectedCollectionLocationsCount}
        availableTours={props.availableTours}
        filtersOpen={filtersOpen}
        selectedTourId={props.selectedTourId}
        allFilteredLocationsSelected={props.allFilteredLocationsSelected}
        onOpenBulkAssignments={props.onOpenBulkAssignments}
        onTourFilterChange={props.onTourFilterChange}
        onToggleSelectAll={props.onToggleSelectAll}
        onToggleFiltersOpen={onToggleFiltersOpen}
      />
      <WasteMasterDataActiveTourBanner selectedTour={selectedTour} onTourFilterChange={props.onTourFilterChange} />
      {props.collectionLocations.length ? (
        <>
          <WasteMasterDataLocationsTableSection
            collectionLocations={props.collectionLocations}
            maps={maps}
            selectedLocationIds={props.selectedLocationIds}
            onToggleLocation={props.onToggleLocation}
            onOpenEditLocation={props.onOpenEditLocation}
            getLocationLabel={props.getLocationLabel}
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
          collectionLocations={props.collectionLocations}
          maps={maps}
          selectedLocationIds={props.selectedLocationIds}
          onToggleLocation={props.onToggleLocation}
          onOpenEditLocation={props.onOpenEditLocation}
          getLocationLabel={props.getLocationLabel}
        />
      )}
    </section>
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
