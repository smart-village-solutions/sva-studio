import { usePluginTranslation } from '@sva/plugin-sdk';

import {
  WasteMasterDataLocationsEmptyState,
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';

export const WasteMasterDataLocationsTableSection = ({
  collectionLocations,
  allFilteredLocationsSelected,
  selectedLocationIds,
  maps,
  onToggleSelectAll,
  onToggleLocation,
  onCopyLocation,
  onDeleteLocation,
  onOpenEditLocation,
  onOpenEditTour,
}: {
  readonly collectionLocations: WasteMasterDataLocationsTableProps['collectionLocations'];
  readonly allFilteredLocationsSelected: WasteMasterDataLocationsTableProps['allFilteredLocationsSelected'];
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
    selectedLocationIds.length > 0 && !allFilteredLocationsSelected;

  if (!collectionLocations.length) {
    return <WasteMasterDataLocationsEmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full border-collapse"
        aria-label={pt('masterData.collectionLocations.title')}
      >
        <caption className="sr-only">{pt('masterData.locationsWorkspace.table.caption')}</caption>
        <WasteMasterDataLocationsHeader
          allFilteredLocationsSelected={allFilteredLocationsSelected}
          someFilteredLocationsSelected={someFilteredLocationsSelected}
          onToggleSelectAll={onToggleSelectAll}
        />
        <tbody>
          {collectionLocations.map((location) => (
            <WasteMasterDataLocationsRow
              key={location.id}
              location={location}
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
