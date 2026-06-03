import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioActionMenu } from '@sva/studio-ui-react';

export const WasteMasterDataLocationsOverview = (props: {
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
  const { onOpenCreateRegion, onOpenCreateCity, onOpenCreateStreet, onOpenCreateHouseNumber, onOpenCreateLocation } =
    props;
  const pt = usePluginTranslation('wasteManagement');
  const metrics = [
    pt('masterData.meta.collectionLocationCount', { value: props.collectionLocationCount }),
    pt('masterData.meta.regionCount', { value: props.regionCount }),
    pt('masterData.meta.cityCount', { value: props.cityCount }),
    pt('masterData.meta.streetCount', { value: props.streetCount }),
    pt('masterData.meta.houseNumberCount', { value: props.houseNumberCount }),
  ];

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
      <div className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <div
            key={metric}
            className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-sm text-muted-foreground"
          >
            {metric}
          </div>
        ))}
      </div>
    </>
  );
};
