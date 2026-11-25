import type {
  WasteCollectionLocationListItem,
  WasteCollectionLocationRecord,
  WasteTourRecord,
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
import { formatTourDateRange } from './waste-management.tours.presentation.js';

type LinkedTour = Pick<
  WasteTourRecord,
  'id' | 'name' | 'firstDate' | 'endDate' | 'recurrence' | 'customDates'
>;

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
      linkedTours: location.tours
        .filter(
          (tour) => (!maps.locationYear && !maps.locationTourStatus) || maps.toursById.has(tour.id)
        )
        .map((tour) => maps.toursById.get(tour.id) ?? tour),
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
  locationYear,
  locationTourStatus,
  search,
  onOpenEditTour,
}: {
  readonly linkedTours: readonly LinkedTour[];
  readonly locationYear?: number;
  readonly locationTourStatus?: WasteMasterDataLocationsTableMaps['locationTourStatus'];
  readonly search?: WasteManagementSearchParams;
  readonly onOpenEditTour?: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const emptyKey = locationYear || locationTourStatus ? 'noToursForFilters' : 'noTours';
  const tourList = (
    <div className={linkedTours.length > 3 ? 'mt-2 space-y-1' : 'space-y-1'}>
      {linkedTours.map((tour) => {
        const period = formatTourDateRange(pt, tour);
        const label = (
          <>
            <span>{tour.name}</span>
            {period ? <span className="block text-xs text-muted-foreground">{period}</span> : null}
          </>
        );
        if (!search && !onOpenEditTour) {
          return (
            <p key={tour.id} className="text-sm">
              {label}
            </p>
          );
        }
        return (
          <Button
            key={tour.id}
            asChild={Boolean(search)}
            type={search ? undefined : 'button'}
            variant="tertiary"
            size="sm"
            className="block h-auto p-0 text-left text-sm font-medium underline-offset-4 hover:underline"
            onClick={search ? undefined : () => onOpenEditTour?.(tour.id)}
          >
            {search ? (
              <Link to="/plugins/waste-management" search={toWasteTourEditSearch(search, tour.id)}>
                {label}
              </Link>
            ) : (
              label
            )}
          </Button>
        );
      })}
    </div>
  );
  return (
    <td className="px-3 py-3 align-top">
      {linkedTours.length > 3 ? (
        <details>
          <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
            {pt('masterData.locationsWorkspace.table.showTours', { count: linkedTours.length })}
          </summary>
          {tourList}
        </details>
      ) : linkedTours.length ? (
        tourList
      ) : (
        <span className="text-sm text-muted-foreground">
          {pt(`masterData.locationsWorkspace.table.${emptyKey}`)}
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
  const actionLabel = (action: 'edit' | 'copy' | 'delete') => {
    const label = pt(`masterData.collectionLocations.actions.${action}`);
    return { 'aria-label': label, tooltip: label };
  };
  return (
    <td className="px-3 py-3 align-top text-right">
      <div className="flex justify-end gap-1.5">
        <Button
          asChild={Boolean(search)}
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          {...actionLabel('edit')}
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
          {...actionLabel('copy')}
          onClick={() => onCopyLocation(location)}
        >
          <IconCopy aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
          {...actionLabel('delete')}
          onClick={() => void onDeleteLocation(location)}
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

  const addressColumns = {
    regionUnavailable: regionName,
    cityUnavailable: cityName,
    streetUnavailable: streetName,
    houseNumbersUnavailable: houseNumberName,
  };
  return (
    <tr className="animate-row-hover border-b border-border-subtle align-top text-[14px] text-foreground hover:bg-surface-inset">
      <td className="px-3 py-3 align-top">
        <Checkbox
          aria-label={pt('masterData.locationsWorkspace.table.selectRow', { rowId: location.id })}
          checked={selectedLocationIds.includes(location.id)}
          onChange={(event) => onToggleLocation(location.id, event.currentTarget.checked)}
        />
      </td>
      {Object.entries(addressColumns).map(([fallback, name]) => (
        <td key={fallback} className="px-3 py-3 align-top">
          <span className={fallback === 'houseNumbersUnavailable' ? 'text-sm' : 'font-medium'}>
            {name ?? pt(`masterData.locationsWorkspace.table.${fallback}`)}
          </span>
        </td>
      ))}
      <WasteLocationsRowTours
        linkedTours={linkedTours}
        locationYear={maps.locationYear}
        locationTourStatus={maps.locationTourStatus}
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
