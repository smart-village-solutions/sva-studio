import type { Dispatch, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import type { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import {
  formatTourRecurrence,
  resolveTourShiftDetails,
} from './waste-management.tours.presentation.js';
import type { WasteToursContentProps } from './waste-management.tours.content.parts.js';
import type {
  WasteToursSortDirection,
  WasteToursSortField,
} from './waste-management.tours.table.parts.js';

export const createLocationCountByTourId = (
  data: {
    readonly collectionLocations: readonly { id: string }[];
    readonly locationTourLinks: readonly { locationId: string; tourId: string }[];
  } | null
) => {
  const counts = new Map<string, number>();
  const knownLocations = new Set(data?.collectionLocations?.map(({ id }) => id));
  for (const link of data?.locationTourLinks ?? []) {
    if (knownLocations.has(link.locationId)) {
      counts.set(link.tourId, (counts.get(link.tourId) ?? 0) + 1);
    }
  }
  return counts;
};

type TourSortData = {
  readonly fractionsById?: ReadonlyMap<string, string>;
  readonly schedulingOverview?: WasteManagementSchedulingOverview | null;
  readonly locationCountByTourId: ReadonlyMap<string, number>;
  readonly pt: ReturnType<typeof usePluginTranslation>;
};

export const getTourFractionNames = (
  tour: WasteTourRecord,
  fractionsById: ReadonlyMap<string, string>
) =>
  tour.wasteFractionIds
    .flatMap((id) => {
      const name = fractionsById.get(id);
      return name ? [{ id, name }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));

const resolveTourSortValue = ({
  tour,
  sortField,
  locationCountByTourId,
  fractionsById,
  schedulingOverview,
  pt,
}: TourSortData & {
  readonly tour: WasteTourRecord;
  readonly sortField: WasteToursSortField;
}) => {
  switch (sortField) {
    case 'name':
      return tour.name;
    case 'fractions':
      return fractionsById ? (getTourFractionNames(tour, fractionsById)[0]?.name ?? '') : '';
    case 'shifts':
      return String(resolveTourShiftDetails(tour, schedulingOverview ?? null).length);
    case 'recurrence': {
      const recurrenceValue = formatTourRecurrence(
        pt,
        tour.recurrence,
        tour.customRecurrenceName,
        tour.customRecurrenceIntervalDays
      );
      return recurrenceValue === '—' ? '' : recurrenceValue;
    }
    case 'dateRange':
      return tour.firstDate ?? '';
    case 'locations':
      return String(locationCountByTourId.get(tour.id) ?? 0).padStart(6, '0');
    case 'status':
      return pt(`tours.status.${tour.status}`);
  }
};

export const sortWasteTours = ({
  tours,
  sortField,
  sortDirection,
  ...sortData
}: TourSortData & {
  readonly tours: readonly WasteTourRecord[];
  readonly sortField: WasteToursSortField | null;
  readonly sortDirection: WasteToursSortDirection;
}) => {
  if (!sortField) return tours;
  return tours
    .map((tour) => ({ tour, value: resolveTourSortValue({ tour, sortField, ...sortData }) }))
    .sort((left, right) => {
      if (Boolean(left.value) !== Boolean(right.value)) return left.value ? -1 : 1;
      const comparison = left.value.localeCompare(right.value, 'de', {
        numeric: true,
        sensitivity: 'base',
      });
      return (
        (sortDirection === 'asc' ? comparison : -comparison) ||
        left.tour.id.localeCompare(right.tour.id)
      );
    })
    .map(({ tour }) => tour);
};

export const applyWasteToursFilters = ({
  onFiltersChange,
  onQueryChange,
  onStatusChange,
  setFilterDialogOpen,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
}: {
  readonly onFiltersChange: WasteToursContentProps['onFiltersChange'];
  readonly onQueryChange: WasteToursContentProps['onQueryChange'];
  readonly onStatusChange: WasteToursContentProps['onStatusChange'];
  readonly setFilterDialogOpen: (open: boolean) => void;
  readonly draftQuery: string;
  readonly draftStatus: WasteToursContentProps['status'];
  readonly draftTourValidityPeriod: WasteToursContentProps['tourValidityPeriod'];
  readonly draftTourWasteFractionId: WasteToursContentProps['tourWasteFractionId'];
  readonly draftFirstDateFrom: WasteToursContentProps['firstDateFrom'];
  readonly draftFirstDateTo: WasteToursContentProps['firstDateTo'];
  readonly draftEndDateFrom: WasteToursContentProps['endDateFrom'];
  readonly draftEndDateTo: WasteToursContentProps['endDateTo'];
}) => {
  if (onFiltersChange) {
    onFiltersChange(
      draftQuery,
      draftStatus,
      draftTourValidityPeriod,
      draftTourWasteFractionId,
      draftFirstDateFrom,
      draftFirstDateTo,
      draftEndDateFrom,
      draftEndDateTo
    );
    setFilterDialogOpen(false);
    return;
  }

  onQueryChange(draftQuery);
  onStatusChange(draftStatus);
  setFilterDialogOpen(false);
};

export const resetWasteToursFilters = ({
  onFiltersChange,
  onQueryChange,
  onStatusChange,
}: {
  readonly onFiltersChange: WasteToursContentProps['onFiltersChange'];
  readonly onQueryChange: WasteToursContentProps['onQueryChange'];
  readonly onStatusChange: WasteToursContentProps['onStatusChange'];
}) => {
  if (onFiltersChange) {
    onFiltersChange('', 'all', 'all', undefined, undefined, undefined, undefined, undefined);
    return;
  }

  onQueryChange('');
  onStatusChange('all');
};

export const updateWasteToursSorting = ({
  field,
  sortField,
  setSortField,
  setSortDirection,
}: {
  readonly field: WasteToursSortField;
  readonly sortField: WasteToursSortField | null;
  readonly setSortField: Dispatch<SetStateAction<WasteToursSortField | null>>;
  readonly setSortDirection: Dispatch<SetStateAction<WasteToursSortDirection>>;
}) => {
  if (field === sortField) {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    return;
  }

  setSortField(field);
  setSortDirection('asc');
};

export const setWasteTourFilterCriterion = (
  current: Pick<
    import('./search-params.js').WasteManagementSearchParams,
    | 'q'
    | 'tourStatus'
    | 'tourValidityPeriod'
    | 'tourWasteFractionId'
    | 'firstDateFrom'
    | 'firstDateTo'
    | 'endDateFrom'
    | 'endDateTo'
  >,
  patch: Partial<typeof current>,
  {
    onFiltersChange,
    onQueryChange,
    onStatusChange,
  }: Pick<WasteToursContentProps, 'onFiltersChange' | 'onQueryChange' | 'onStatusChange'>
) => {
  if (!onFiltersChange) {
    if (patch.q !== undefined) onQueryChange(patch.q);
    if (patch.tourStatus !== undefined) onStatusChange(patch.tourStatus);
    return;
  }
  const next = { ...current, ...patch };
  onFiltersChange(
    next.q,
    next.tourStatus,
    next.tourValidityPeriod,
    next.tourWasteFractionId,
    next.firstDateFrom,
    next.firstDateTo,
    next.endDateFrom,
    next.endDateTo
  );
};
