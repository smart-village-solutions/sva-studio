import type {
  WasteCollectionLocationListItem,
  WasteCollectionLocationRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconCopy, IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import type { WasteMasterDataLocationsTableMaps } from './waste-management.master-data-locations-table.types.js';
import type { WasteManagementSearchParams } from './search-params.js';
import {
  toWasteCollectionLocationEditSearch,
  toWasteTourEditSearch,
} from './waste-management.cross-link.navigation.js';

const resolveLocationRowProjection = (
  location: WasteCollectionLocationRecord | WasteCollectionLocationListItem,
  maps: WasteMasterDataLocationsTableMaps
) => {
  if ('cityName' in location && 'tours' in location) {
    return {
      regionName: location.regionName,
      cityName: location.cityName,
      streetName: location.streetName,
      houseNumberName: location.houseNumber,
      linkedTours: location.tours,
    };
  }

  return {
    regionName: location.regionId ? maps.regionsById.get(location.regionId)?.name : undefined,
    cityName: maps.citiesById.get(location.cityId)?.name,
    streetName: location.streetId ? maps.streetsById.get(location.streetId)?.name : undefined,
    houseNumberName: location.houseNumberId
      ? maps.houseNumbersById.get(location.houseNumberId)?.number
      : undefined,
    linkedTours: maps.locationToursByLocationId.get(location.id) ?? [],
  };
};

const WasteLocationsRowTours = ({
  linkedTours,
  search,
  onOpenEditTour,
}: {
  readonly linkedTours: readonly { id: string; name: string }[];
  readonly search?: WasteManagementSearchParams;
  readonly onOpenEditTour?: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <td className="px-3 py-3 align-top">
      {linkedTours.length ? (
        <div className="space-y-1">
          {linkedTours.map((tour) =>
            search ? (
              <Button
                key={tour.id}
                asChild
                variant="tertiary"
                size="sm"
                className="block h-auto p-0 text-left text-sm font-medium underline-offset-4 hover:underline"
              >
                <Link
                  to="/plugins/waste-management"
                  search={toWasteTourEditSearch(search, tour.id)}
                >
                  {tour.name}
                </Link>
              </Button>
            ) : onOpenEditTour ? (
              <Button
                key={tour.id}
                type="button"
                variant="tertiary"
                size="sm"
                className="block h-auto p-0 text-left text-sm font-medium underline-offset-4 hover:underline"
                onClick={() => onOpenEditTour(tour.id)}
              >
                {tour.name}
              </Button>
            ) : (
              <p key={tour.id} className="text-sm">
                {tour.name}
              </p>
            )
          )}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">
          {pt('masterData.locationsWorkspace.table.noTours')}
        </span>
      )}
    </td>
  );
};

const WasteLocationsRowActions = ({
  location,
  search,
  onCopyLocation,
  onDeleteLocation,
  onOpenEditLocation,
}: {
  readonly location: WasteCollectionLocationRecord | WasteCollectionLocationListItem;
  readonly search?: WasteManagementSearchParams;
  readonly onCopyLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onDeleteLocation: (location: WasteCollectionLocationRecord) => Promise<void>;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const editLabel = pt('masterData.collectionLocations.actions.edit');
  const copyLabel = pt('masterData.collectionLocations.actions.copy');
  const deleteLabel = pt('masterData.collectionLocations.actions.delete');
  return (
    <td className="px-3 py-3 align-top text-right">
      <div className="flex justify-end gap-1.5">
        <Button
          asChild={Boolean(search)}
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={editLabel}
          tooltip={editLabel}
          {...(!search ? { onClick: () => onOpenEditLocation(location) } : {})}
        >
          {search ? (
            <Link
              to="/plugins/waste-management"
              search={toWasteCollectionLocationEditSearch(search, location.id)}
            >
              <IconEdit aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : (
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={copyLabel}
          tooltip={copyLabel}
          onClick={() => onCopyLocation(location)}
        >
          <IconCopy aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
          aria-label={deleteLabel}
          tooltip={deleteLabel}
          onClick={() => {
            void onDeleteLocation(location);
          }}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </td>
  );
};

export const WasteMasterDataLocationsRow = ({
  location,
  search,
  maps,
  selectedLocationIds,
  onToggleLocation,
  onCopyLocation,
  onDeleteLocation,
  onOpenEditLocation,
  onOpenEditTour,
}: {
  readonly location: WasteCollectionLocationRecord | WasteCollectionLocationListItem;
  readonly search?: WasteManagementSearchParams;
  readonly maps: WasteMasterDataLocationsTableMaps;
  readonly selectedLocationIds: readonly string[];
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onCopyLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onDeleteLocation: (location: WasteCollectionLocationRecord) => Promise<void>;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onOpenEditTour?: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const { regionName, cityName, streetName, houseNumberName, linkedTours } =
    resolveLocationRowProjection(location, maps);

  return (
    <tr className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20">
      <td className="px-3 py-3 align-top">
        <Checkbox
          aria-label={pt('masterData.locationsWorkspace.table.selectRow', { rowId: location.id })}
          checked={selectedLocationIds.includes(location.id)}
          onChange={(event) => onToggleLocation(location.id, event.currentTarget.checked)}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">
          {regionName ?? pt('masterData.locationsWorkspace.table.regionUnavailable')}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">
          {cityName ?? pt('masterData.locationsWorkspace.table.cityUnavailable')}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">
          {streetName ?? pt('masterData.locationsWorkspace.table.streetUnavailable')}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-sm">
          {houseNumberName ?? pt('masterData.locationsWorkspace.table.houseNumbersUnavailable')}
        </span>
      </td>
      <WasteLocationsRowTours
        linkedTours={linkedTours}
        search={search}
        onOpenEditTour={onOpenEditTour}
      />
      <td className="px-3 py-3 align-top">
        <span className="text-sm">
          {location.active ? pt('common.active') : pt('common.inactive')}
        </span>
      </td>
      <WasteLocationsRowActions
        location={location}
        search={search}
        onCopyLocation={onCopyLocation}
        onDeleteLocation={onDeleteLocation}
        onOpenEditLocation={onOpenEditLocation}
      />
    </tr>
  );
};
