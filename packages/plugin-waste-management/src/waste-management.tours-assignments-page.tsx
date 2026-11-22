import { useEffect, useMemo, useRef, useState } from 'react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useBlocker } from '@tanstack/react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  StudioErrorState,
} from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import { defaultWastePageSize } from './pagination-search-params.js';
import { normalizeWasteManagementSearchParams } from './search-params.js';
import { formatTourDateRange } from './waste-management.tours.presentation.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import { TourAssignmentsPageFilters } from './waste-management.tours-assignments-page.filters.js';
import { TourAssignmentsPageSelection } from './waste-management.tours-assignments-page.selection.js';
import {
  getTourAssignmentFilterOptions,
  matchesTourAssignmentScope,
} from './waste-management.tours-assignments-page.options.js';
import {
  createTourAssignmentSelectionSummary,
  orderTourAssignmentLocations,
  type TourAssignmentSortField,
  type TourAssignmentSortOptions,
} from './waste-management.tours.view-model.js';
import { createPagedItems } from './waste-management.table-frame.js';

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query);

type TourAssignmentsPageProps = {
  readonly tour: WasteTourRecord;
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly saving: boolean;
  readonly loading?: boolean;
  readonly unavailable?: boolean;
  readonly message: StatusMessage | null;
  readonly onBack: () => void;
  readonly onSubmit: (changes: ReadonlyMap<string, boolean>) => void;
};

export const TourAssignmentsPage = ({
  tour,
  locations,
  saving,
  loading = false,
  unavailable = false,
  message,
  onBack,
  onSubmit,
}: TourAssignmentsPageProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [selectionChanges, setSelectionChanges] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  );
  const [sort, setSort] = useState<Required<TourAssignmentSortOptions>>({
    field: 'cityName',
    direction: 'asc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(defaultWastePageSize);

  const assignedLocationIds = useMemo(
    () =>
      new Set(
        locations.filter((location) => location.assignedLinkId).map((location) => location.id)
      ),
    [locations]
  );
  const selectedLocationIds = useMemo(
    () =>
      locations
        .map((location) => location.id)
        .filter((id) => selectionChanges.get(id) ?? assignedLocationIds.has(id)),
    [assignedLocationIds, locations, selectionChanges]
  );

  const { regionOptions, cityOptions, streetOptions } = useMemo(
    () => getTourAssignmentFilterOptions(locations, regionFilter, cityFilter),
    [locations, regionFilter, cityFilter]
  );

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return locations.filter(
      (location) =>
        matchesTourAssignmentScope(location, regionFilter, cityFilter, streetFilter) &&
        (!query ||
          matchesSearch(location.cityName, query) ||
          (location.streetId && matchesSearch(location.streetName, query)))
    );
  }, [cityFilter, locations, regionFilter, searchQuery, streetFilter]);

  const orderedFilteredLocations = useMemo(
    () => orderTourAssignmentLocations(filteredLocations, selectedLocationIds, sort),
    [filteredLocations, selectedLocationIds, sort]
  );
  const pagedLocations = createPagedItems({ items: orderedFilteredLocations, page, pageSize });

  const filteredLocationIds = filteredLocations.map((location) => location.id);
  const { allVisibleSelected, someVisibleSelected, hiddenSelectedCount } =
    createTourAssignmentSelectionSummary({
      filteredLocationIds,
      selectedLocationIds,
    });

  const changeScope = (region: string, city: string) => {
    const nextCity = locations.some((location) => matchesTourAssignmentScope(location, region, city))
      ? city
      : '';
    const nextStreet = locations.some((location) =>
      matchesTourAssignmentScope(location, region, nextCity, streetFilter)
    )
      ? streetFilter
      : '';
    setRegionFilter(region);
    setCityFilter(nextCity);
    setStreetFilter(nextStreet);
    setPage(1);
  };

  const changeSort = (field: TourAssignmentSortField) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const changeSelection = (locationIds: readonly string[], checked: boolean) => {
    setSelectionChanges((current) => {
      const changes = new Map(current);
      for (const id of locationIds) {
        if (checked === assignedLocationIds.has(id)) {
          changes.delete(id);
        } else {
          changes.set(id, checked);
        }
      }
      return changes;
    });
  };
  const firstFocus = useRef<HTMLButtonElement>(null);
  const focusBeforeDiscard = useRef<HTMLElement | null>(null);
  const focusedOnEntry = useRef(false);
  useEffect(() => {
    if (!focusedOnEntry.current) {
      firstFocus.current?.focus();
      focusedOnEntry.current = true;
    }
  }, []);
  const hasChanges =
    loading || unavailable
      ? selectionChanges.size > 0
      : [...selectionChanges].some(([id, checked]) => checked !== assignedLocationIds.has(id));
  const submitDisabled = loading || unavailable || !hasChanges;
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!hasChanges) return false;
      const nextSearch = normalizeWasteManagementSearchParams(
        next.search as Record<string, unknown>
      );
      return (
        current.pathname !== next.pathname ||
        nextSearch.tab !== 'tours' ||
        nextSearch.toursView !== 'assignments' ||
        nextSearch.tourId !== tour.id
      );
    },
    enableBeforeUnload: hasChanges,
    withResolver: true,
  });

  const period = formatTourDateRange(pt, tour);
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="break-words text-base font-semibold">{tour.name}</h2>
          {period ? (
            <p className="text-sm text-muted-foreground">{period}</p>
          ) : null}
        </div>
        <Button
          ref={firstFocus}
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={saving}
        >
          {pt('tours.assignments.actions.backToList')}
        </Button>
      </header>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!submitDisabled && !saving) onSubmit(selectionChanges);
        }}
      >
        <StatusNotice message={message} />
        {unavailable && !loading ? (
          <StudioErrorState>{pt('tours.messages.loadError')}</StudioErrorState>
        ) : null}
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <TourAssignmentsPageFilters
            searchQuery={searchQuery}
            regionFilter={regionFilter}
            cityFilter={cityFilter}
            streetFilter={streetFilter}
            regionOptions={regionOptions}
            cityOptions={cityOptions}
            streetOptions={streetOptions}
            onSearchQueryChange={(value) => {
              setSearchQuery(value);
              setPage(1);
            }}
            onRegionFilterChange={(value) => changeScope(value, cityFilter)}
            onCityFilterChange={(value) => changeScope(regionFilter, value)}
            onStreetFilterChange={(value) => {
              setStreetFilter(value);
              setPage(1);
            }}
            onResetFilters={() => {
              setSearchQuery('');
              setRegionFilter('');
              setCityFilter('');
              setStreetFilter('');
              setPage(1);
            }}
          />
          <TourAssignmentsPageSelection
            loading={loading}
            selectedLocationIds={selectedLocationIds}
            filteredLocationsCount={filteredLocations.length}
            hiddenSelectedCount={hiddenSelectedCount}
            locations={pagedLocations.items}
            page={pagedLocations.safePage}
            pageSize={pageSize}
            pageCount={pagedLocations.pageCount}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            sortField={sort.field}
            sortDirection={sort.direction}
            onSortChange={changeSort}
            onToggleSelectAll={(checked) => changeSelection(filteredLocationIds, checked)}
            onToggleLocation={(id, checked) => changeSelection([id], checked)}
          />
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="secondary" onClick={onBack} disabled={saving}>
            {pt('tours.assignments.actions.cancel')}
          </Button>
          <WastePendingSaveButton
            type="submit"
            saving={saving}
            disabled={submitDisabled}
            label={pt(
              saving ? 'tours.assignments.actions.saving' : 'tours.assignments.actions.save'
            )}
          />
        </div>
      </form>
      <AlertDialog open={blocker.status === 'blocked'}>
        <AlertDialogContent
          onEscapeKeyDown={() => blocker.reset?.()}
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            focusBeforeDiscard.current = active instanceof HTMLElement ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            if (focusBeforeDiscard.current?.isConnected) {
              event.preventDefault();
              focusBeforeDiscard.current.focus();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{pt('tours.assignments.discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pt('tours.assignments.discard.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {pt('tours.assignments.discard.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => blocker.proceed?.()}>
              {pt('tours.assignments.discard.discardAndReturn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
