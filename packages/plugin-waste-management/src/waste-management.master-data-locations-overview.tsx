import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioActionMenu } from '@sva/studio-ui-react';

export const WasteMasterDataLocationsOverview = ({
  collectionLocationCount,
  regionCount,
  cityCount,
  streetCount,
  houseNumberCount,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
}: {
  readonly collectionLocationCount: number;
  readonly regionCount: number;
  readonly cityCount: number;
  readonly streetCount: number;
  readonly houseNumberCount: number;
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenCreateLocation: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('masterData.locationsWorkspace.title')}</h3>
          <p className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.description')}</p>
        </div>
        <StudioActionMenu
          items={[
            { id: 'create-region', label: pt('masterData.locationsWorkspace.actions.createRegion'), onSelect: onOpenCreateRegion },
            { id: 'create-city', label: pt('masterData.locationsWorkspace.actions.createCity'), onSelect: onOpenCreateCity },
            { id: 'create-street', label: pt('masterData.locationsWorkspace.actions.createStreet'), onSelect: onOpenCreateStreet },
            {
              id: 'create-house-number',
              label: pt('masterData.locationsWorkspace.actions.createHouseNumber'),
              onSelect: onOpenCreateHouseNumber,
            },
            {
              id: 'create-location',
              label: pt('masterData.locationsWorkspace.actions.createLocation'),
              onSelect: onOpenCreateLocation,
            },
          ]}
        />
      </div>
    </>
  );
};
