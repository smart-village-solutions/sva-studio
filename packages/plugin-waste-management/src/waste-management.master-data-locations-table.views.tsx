import type { WasteCollectionLocationRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  IconArrowsSort,
  IconBuildingCommunity,
  IconChevronDown,
  IconCopy,
  IconEdit,
  IconFilter,
  IconHome,
  IconMapPin,
  IconPlus,
  IconRoute,
  IconSortAZ,
  IconSortZA,
  IconTrash,
} from '@tabler/icons-react';
import { Button, Checkbox, Select, StudioEmptyState, cn } from '@sva/studio-ui-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import type {
  WasteMasterDataLocationsSortDirection,
  WasteMasterDataLocationsSortField,
  WasteMasterDataLocationsTableMaps,
  WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.types.js';

type WasteLocationsCreateMenuProps = Readonly<{
  onOpenCreateRegion: () => void;
  onOpenCreateCity: () => void;
  onOpenCreateStreet: () => void;
  onOpenCreateHouseNumber: () => void;
  onOpenCreateLocation: () => void;
}>;

const WasteLocationsCreateMenu = ({
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
}: WasteLocationsCreateMenuProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const items: ReadonlyArray<{
    id: string;
    title: string;
    description: string;
    icon: ReactNode;
    onSelect: () => void;
  }> = [
    {
      id: 'create-region',
      title: pt('masterData.locationsWorkspace.actions.createRegion'),
      description: pt('masterData.locationsWorkspace.actions.createRegionHint'),
      icon: <IconBuildingCommunity aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateRegion,
    },
    {
      id: 'create-city',
      title: pt('masterData.locationsWorkspace.actions.createCity'),
      description: pt('masterData.locationsWorkspace.actions.createCityHint'),
      icon: <IconHome aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateCity,
    },
    {
      id: 'create-street',
      title: pt('masterData.locationsWorkspace.actions.createStreet'),
      description: pt('masterData.locationsWorkspace.actions.createStreetHint'),
      icon: <IconRoute aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateStreet,
    },
    {
      id: 'create-house-number',
      title: pt('masterData.locationsWorkspace.actions.createHouseNumber'),
      description: pt('masterData.houseNumbers.description'),
      icon: <IconHome aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateHouseNumber,
    },
    {
      id: 'create-location',
      title: pt('masterData.locationsWorkspace.actions.createLocation'),
      description: pt('masterData.locationsWorkspace.actions.createLocationHint'),
      icon: <IconMapPin aria-hidden="true" className="h-4 w-4" />,
      onSelect: onOpenCreateLocation,
    },
  ];

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="h-10 rounded-lg px-3"
        onClick={() => setOpen((current) => !current)}
      >
        <IconPlus aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.actions.createMenu')}
        <IconChevronDown aria-hidden="true" className="h-4 w-4 opacity-80" />
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full z-50 mt-2 min-w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className="mt-0.5 text-muted-foreground">{item.icon}</span>
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const WasteMasterDataLocationsTableToolbar = ({
  selectedCollectionLocationsCount,
  availableTours,
  filtersOpen,
  selectedTourId,
  allFilteredLocationsSelected,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
  onOpenBulkAssignments,
  onTourFilterChange,
  onToggleSelectAll,
  onRequestDeleteSelected,
  onToggleFiltersOpen,
}: Pick<
  WasteMasterDataLocationsTableProps,
  | 'onOpenCreateRegion'
  | 'onOpenCreateCity'
  | 'onOpenCreateStreet'
  | 'onOpenCreateHouseNumber'
  | 'onOpenCreateLocation'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'selectedTourId'
  | 'allFilteredLocationsSelected'
  | 'onOpenBulkAssignments'
  | 'onTourFilterChange'
  | 'onToggleSelectAll'
> & {
  readonly onRequestDeleteSelected: () => void;
  readonly filtersOpen: boolean;
  readonly onToggleFiltersOpen: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg border-border/70 px-3"
            disabled={selectedCollectionLocationsCount === 0}
            onClick={onOpenBulkAssignments}
          >
            <IconRoute aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.collectionLocations.bulk.actions.openAssign', {
              value: selectedCollectionLocationsCount,
            })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'h-10 rounded-lg border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
              selectedCollectionLocationsCount === 0 && 'text-destructive/50'
            )}
            disabled={selectedCollectionLocationsCount === 0}
            onClick={onRequestDeleteSelected}
          >
            <IconTrash aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.collectionLocations.bulk.actions.deleteSelected')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg border-border/70 px-3"
            aria-expanded={filtersOpen}
            aria-controls="waste-locations-filters"
            onClick={onToggleFiltersOpen}
          >
            <IconFilter aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.filters.filtersTitle')}
          </Button>
        </div>
        {filtersOpen ? (
        <div id="waste-locations-filters" className="rounded-lg border border-border/60 bg-muted/[0.08] px-3 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm">
              <span className="text-muted-foreground">{pt('masterData.locationsWorkspace.filters.tour')}</span>
              <Select
                aria-label={pt('masterData.locationsWorkspace.filters.tour')}
                className="h-10 rounded-lg"
                value={selectedTourId ?? ''}
                onChange={(event) => onTourFilterChange(event.target.value)}
              >
                <option value="">{pt('masterData.locationsWorkspace.filters.allTours')}</option>
                {availableTours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allFilteredLocationsSelected} onChange={(event) => onToggleSelectAll(event.currentTarget.checked)} />
              <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
            </label>
          </div>
        </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <WasteLocationsCreateMenu
          onOpenCreateRegion={onOpenCreateRegion}
          onOpenCreateCity={onOpenCreateCity}
          onOpenCreateStreet={onOpenCreateStreet}
          onOpenCreateHouseNumber={onOpenCreateHouseNumber}
          onOpenCreateLocation={onOpenCreateLocation}
        />
      </div>
    </div>
  );
};

export const WasteMasterDataActiveTourBanner = ({
  selectedTour,
  onTourFilterChange,
}: {
  readonly selectedTour?: WasteTourRecord;
  readonly onTourFilterChange: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!selectedTour) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.filters.activeTour')}</span>
      <span className="text-sm font-medium">{selectedTour.name}</span>
      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => onTourFilterChange('')}>
        {pt('masterData.locationsWorkspace.filters.clearTour')}
      </Button>
    </div>
  );
};

export const WasteMasterDataLocationsHeader = ({
  allFilteredLocationsSelected,
  someFilteredLocationsSelected,
  onToggleSelectAll,
  sortField,
  sortDirection,
  onSortChange,
}: {
  readonly allFilteredLocationsSelected: boolean;
  readonly someFilteredLocationsSelected: boolean;
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly sortField: WasteMasterDataLocationsSortField;
  readonly sortDirection: WasteMasterDataLocationsSortDirection;
  readonly onSortChange: (field: WasteMasterDataLocationsSortField) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const renderSortIcon = (active: boolean, direction: WasteMasterDataLocationsSortDirection) => {
    if (!active) {
      return <IconArrowsSort aria-hidden="true" className="h-4 w-4 text-muted-foreground" />;
    }
    if (direction === 'asc') {
      return <IconSortAZ aria-hidden="true" className="h-4 w-4 text-foreground" />;
    }
    return <IconSortZA aria-hidden="true" className="h-4 w-4 text-foreground" />;
  };

  const renderSortableHeader = (field: WasteMasterDataLocationsSortField, label: string) => (
    <Button
      type="button"
      variant="ghost"
      className="h-auto px-0 py-0 font-semibold text-foreground hover:bg-transparent hover:animate-none"
      onClick={() => onSortChange(field)}
    >
      {label}
      {renderSortIcon(sortField === field, sortDirection)}
      <span className="sr-only">{sortField === field ? sortDirection : 'none'}</span>
    </Button>
  );

  return (
    <thead className="bg-muted/20 text-left text-[13px] text-foreground">
      <tr className="border-b border-border/70">
        <th scope="col" className="w-12 px-3 py-3">
          <Checkbox
            aria-label={pt('masterData.locationsWorkspace.table.selectAllRows', {
              label: pt('masterData.locationsWorkspace.table.label'),
            })}
            checked={allFilteredLocationsSelected}
            indeterminate={!allFilteredLocationsSelected && someFilteredLocationsSelected}
            onChange={(event) => onToggleSelectAll(event.currentTarget.checked)}
          />
        </th>
        <th scope="col" className="w-[150px] px-3 py-3">{renderSortableHeader('region', pt('masterData.locationsWorkspace.table.region'))}</th>
        <th scope="col" className="w-[150px] px-3 py-3">{renderSortableHeader('city', pt('masterData.locationsWorkspace.table.city'))}</th>
        <th scope="col" className="w-[220px] px-3 py-3">{renderSortableHeader('street', pt('masterData.locationsWorkspace.table.street'))}</th>
        <th scope="col" className="w-[128px] px-3 py-3">{renderSortableHeader('houseNumbers', pt('masterData.locationsWorkspace.table.houseNumbers'))}</th>
        <th scope="col" className="w-[220px] px-3 py-3">{renderSortableHeader('tours', pt('masterData.locationsWorkspace.table.tours'))}</th>
        <th scope="col" className="w-[92px] px-3 py-3">{renderSortableHeader('status', pt('masterData.locationsWorkspace.table.status'))}</th>
        <th scope="col" className="w-[160px] px-3 py-3">{pt('masterData.locationsWorkspace.table.outputs')}</th>
        <th scope="col" className="w-[144px] px-3 py-3 text-right">{pt('masterData.locationsWorkspace.table.actions')}</th>
      </tr>
    </thead>
  );
};

export const WasteMasterDataLocationsRow = ({
  location,
  maps,
  selectedLocationIds,
  onToggleLocation,
  onCopyLocation,
  onDeleteLocation,
  onOpenEditLocation,
}: {
  readonly location: WasteCollectionLocationRecord;
  readonly maps: WasteMasterDataLocationsTableMaps;
  readonly selectedLocationIds: readonly string[];
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onCopyLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onDeleteLocation: (location: WasteCollectionLocationRecord) => Promise<void>;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const region = location.regionId ? maps.regionsById.get(location.regionId) : undefined;
  const city = maps.citiesById.get(location.cityId);
  const street = location.streetId ? maps.streetsById.get(location.streetId) : undefined;
  const houseNumber = location.houseNumberId ? maps.houseNumbersById.get(location.houseNumberId) : undefined;
  const linkedTourNames = maps.locationTourNamesByLocationId.get(location.id) ?? [];
  const outputPdfs = maps.outputPdfsByLocationId.get(location.id) ?? [];

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
        <p className="font-medium">{region?.name ?? pt('masterData.locationsWorkspace.table.regionUnavailable')}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">{city?.name ?? pt('masterData.locationsWorkspace.table.cityUnavailable')}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">{street?.name ?? pt('masterData.locationsWorkspace.table.streetUnavailable')}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-sm">{houseNumber?.number ?? pt('masterData.locationsWorkspace.table.houseNumbersUnavailable')}</span>
      </td>
      <td className="px-3 py-3 align-top">
        {linkedTourNames.length ? (
          <div className="space-y-1">
            {linkedTourNames.map((tourName) => (
              <p key={`${location.id}-${tourName}`} className="text-sm">
                {tourName}
              </p>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.table.noTours')}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-sm">{location.active ? pt('common.active') : pt('common.inactive')}</span>
      </td>
      <td className="px-3 py-3 align-top">
        {outputPdfs.length ? (
          <div className="space-y-1">
            {outputPdfs.map((pdf: (typeof outputPdfs)[number]) => (
              <a
                key={`${location.id}-${pdf.year}`}
                href={pdf.deliveryUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-sm font-medium text-primary underline-offset-2 hover:underline"
                aria-label={pt('masterData.locationsWorkspace.table.openOutput', { value: pdf.year })}
              >
                {pdf.year}
              </a>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.table.noOutputs')}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
            aria-label={pt('masterData.collectionLocations.actions.edit')}
            onClick={() => onOpenEditLocation(location)}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
            aria-label={pt('masterData.collectionLocations.actions.copy')}
            onClick={() => onCopyLocation(location)}
          >
            <IconCopy aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
            aria-label={pt('masterData.collectionLocations.actions.delete')}
            onClick={() => {
              void onDeleteLocation(location);
            }}
          >
            <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export const WasteMasterDataLocationsEmptyState = () => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="p-6">
      <StudioEmptyState>
        <div className="space-y-2 text-left">
          <p className="font-medium">{pt('masterData.locationsWorkspace.emptyTitle')}</p>
          <p>{pt('masterData.locationsWorkspace.emptyBody')}</p>
        </div>
      </StudioEmptyState>
    </div>
  );
};
