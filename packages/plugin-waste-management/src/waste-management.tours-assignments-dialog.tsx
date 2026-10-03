import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import type { LocationTourLinkFormState } from './waste-management.tours.types.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import { TourAssignmentsDialogFilters } from './waste-management.tours-assignments-dialog.filters.js';
import { TourAssignmentsDialogSelection } from './waste-management.tours-assignments-dialog.selection.js';
import { useTourAssignmentFilterOptions } from './waste-management.tours-assignments-dialog.options.js';
import {
  createTourAssignmentSelectionSummary,
  orderTourAssignmentLocations,
  type TourAssignmentSortDirection,
} from './waste-management.tours.view-model.js';

const matchesSearch = (value: string, query: string) =>
  value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

export const TourAssignmentsDialog = ({
  open,
  mode,
  form,
  tour,
  locations,
  saving,
  loading = false,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: LocationTourLinkFormState;
  readonly tour: WasteTourRecord | null;
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly saving: boolean;
  readonly loading?: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkFormState>) => void;
  readonly onSubmit: (
    event: FormEvent<HTMLFormElement>,
    selectedLocationIds: readonly string[]
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<readonly string[]>([]);
  const [includeRegionInSorting, setIncludeRegionInSorting] = useState(false);
  const [sortDirection, setSortDirection] = useState<TourAssignmentSortDirection>('asc');

  const effectiveTourId = tour?.id ?? form.tourId;
  const assignedLocationIds = useMemo(
    () => locations.filter((location) => location.assignedLinkId).map((location) => location.id),
    [locations]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchQuery('');
    setRegionFilter('');
    setCityFilter('');
    setStreetFilter('');
    setSelectedLocationIds(assignedLocationIds);
    setIncludeRegionInSorting(false);
    setSortDirection('asc');
  }, [assignedLocationIds, effectiveTourId, open]);

  useEffect(() => {
    const availableLocationIds = new Set(locations.map((location) => location.id));
    setSelectedLocationIds((current) =>
      current.filter((locationId) => availableLocationIds.has(locationId))
    );
  }, [locations]);

  const { regionOptions, cityOptions, streetOptions } = useTourAssignmentFilterOptions(
    locations,
    regionFilter,
    cityFilter
  );

  const filteredLocations = useMemo(
    () =>
      locations.filter((location) => {
        if (regionFilter && location.regionId !== regionFilter) {
          return false;
        }
        if (cityFilter && location.cityId !== cityFilter) {
          return false;
        }
        if (streetFilter && location.streetId !== streetFilter) {
          return false;
        }
        if (!searchQuery.trim()) {
          return true;
        }
        return [
          location.label,
          location.regionName,
          location.cityName,
          location.streetName,
          location.houseNumberName,
        ]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .some((value) => matchesSearch(value, searchQuery.trim()));
      }),
    [cityFilter, locations, regionFilter, searchQuery, streetFilter]
  );

  const orderedFilteredLocations = useMemo(
    () =>
      orderTourAssignmentLocations(filteredLocations, selectedLocationIds, {
        includeRegion: includeRegionInSorting,
        direction: sortDirection,
      }),
    [filteredLocations, includeRegionInSorting, selectedLocationIds, sortDirection]
  );

  const visibleLocationIds = orderedFilteredLocations.map((location) => location.id);
  const { allVisibleSelected, someVisibleSelected, hiddenSelectedCount, visibleLocationIdSet } =
    createTourAssignmentSelectionSummary({
      filteredLocationIds: visibleLocationIds,
      selectedLocationIds,
    });

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedLocationIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleLocationIds]));
      }
      return current.filter((locationId) => !visibleLocationIdSet.has(locationId));
    });
  };

  const toggleSelectedLocation = (locationId: string, checked: boolean) => {
    setSelectedLocationIds((current) =>
      checked
        ? current.includes(locationId)
          ? current
          : [...current, locationId]
        : current.filter((value) => value !== locationId)
    );
  };
  const title =
    mode === 'create'
      ? pt('tours.assignments.dialog.createTitle')
      : pt('tours.assignments.dialog.editTitle');
  const description = tour
    ? pt('tours.assignments.dialog.description', { value: tour.name })
    : pt('tours.assignments.dialog.descriptionFallback');
  let submitLabel = pt('tours.assignments.actions.save');
  if (saving) {
    submitLabel = pt('tours.assignments.actions.saving');
  } else if (mode === 'create') {
    submitLabel = pt('tours.assignments.actions.create');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-0">
        <div className="border-b border-border/60 bg-background px-6 py-5">
          <DialogHeader className="space-y-2">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => onSubmit(event, selectedLocationIds)}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 rounded-2xl border border-border/70 bg-card/60">
            <StatusNotice message={message} />

            <TourAssignmentsDialogFilters
              searchQuery={searchQuery}
              regionFilter={regionFilter}
              cityFilter={cityFilter}
              streetFilter={streetFilter}
              regionOptions={regionOptions}
              cityOptions={cityOptions}
              streetOptions={streetOptions}
              onSearchQueryChange={setSearchQuery}
              onRegionFilterChange={(value) => {
                setRegionFilter(value);
                setCityFilter('');
                setStreetFilter('');
              }}
              onCityFilterChange={(value) => {
                setCityFilter(value);
                setStreetFilter('');
              }}
              onStreetFilterChange={setStreetFilter}
            />
            <TourAssignmentsDialogSelection
              loading={loading}
              selectedLocationIds={selectedLocationIds}
              filteredLocationsCount={filteredLocations.length}
              hiddenSelectedCount={hiddenSelectedCount}
              orderedFilteredLocations={orderedFilteredLocations}
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              includeRegionInSorting={includeRegionInSorting}
              sortDirection={sortDirection}
              onResetFilters={() => {
                setSearchQuery('');
                setRegionFilter('');
                setCityFilter('');
                setStreetFilter('');
              }}
              onIncludeRegionInSortingChange={setIncludeRegionInSorting}
              onSortDirectionChange={setSortDirection}
              onToggleSelectAll={toggleSelectAllVisible}
              onToggleLocation={toggleSelectedLocation}
            />
          </div>

          <DialogFooter className="border-t border-border/60 px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {pt('tours.assignments.actions.cancel')}
            </Button>
            <WastePendingSaveButton
              type="submit"
              saving={saving}
              disabled={!selectedLocationIds.length && assignedLocationIds.length === 0}
              label={submitLabel}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
