import { usePluginTranslation } from '@sva/plugin-sdk';

import {
  WasteMasterDataLocationsEmptyState,
  WasteMasterDataLocationsHeader,
  WasteMasterDataLocationsRow,
  type WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.parts.js';

export const WasteMasterDataLocationsTableSection = ({
  collectionLocations,
  maps,
  selectedLocationIds,
  onToggleLocation,
  onOpenEditLocation,
  getLocationLabel,
}: {
  readonly collectionLocations: WasteMasterDataLocationsTableProps['collectionLocations'];
  readonly maps: Parameters<typeof WasteMasterDataLocationsRow>[0]['maps'];
  readonly selectedLocationIds: readonly string[];
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onOpenEditLocation: WasteMasterDataLocationsTableProps['onOpenEditLocation'];
  readonly getLocationLabel: WasteMasterDataLocationsTableProps['getLocationLabel'];
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!collectionLocations.length) {
    return <WasteMasterDataLocationsEmptyState />;
  }

  return (
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
  );
};
