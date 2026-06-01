import type { Dispatch, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import type { usePluginTranslation } from '@sva/plugin-sdk';

import { formatTourRecurrence } from './waste-management.tours.presentation.js';
import type { WasteToursContentProps } from './waste-management.tours.content.parts.js';
import type { WasteToursSortDirection, WasteToursSortField } from './waste-management.tours.table.parts.js';

export const createLocationCountByTourId = (locationTourLinks: readonly { readonly tourId: string }[] | undefined) => {
  const counts = new Map<string, number>();
  for (const link of locationTourLinks ?? []) {
    counts.set(link.tourId, (counts.get(link.tourId) ?? 0) + 1);
  }
  return counts;
};

const resolveTourSortValue = ({
  tour,
  sortField,
  locationCountByTourId,
  pt,
}: {
  readonly tour: WasteTourRecord;
  readonly sortField: WasteToursSortField;
  readonly locationCountByTourId: ReadonlyMap<string, number>;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => {
  switch (sortField) {
    case 'name':
      return tour.name;
    case 'recurrence': {
      const recurrenceValue = formatTourRecurrence(
        pt,
        tour.recurrence,
        tour.customRecurrenceName,
        tour.customRecurrenceIntervalDays,
      );
      return recurrenceValue === '—' ? '' : recurrenceValue;
    }
    case 'locations':
      return String(locationCountByTourId.get(tour.id) ?? 0).padStart(6, '0');
    case 'status':
      return tour.active ? 'active' : 'inactive';
  }
};

export const sortWasteTours = ({
  tours,
  sortField,
  sortDirection,
  locationCountByTourId,
  pt,
}: {
  readonly tours: readonly WasteTourRecord[];
  readonly sortField: WasteToursSortField | null;
  readonly sortDirection: WasteToursSortDirection;
  readonly locationCountByTourId: ReadonlyMap<string, number>;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => {
  if (!sortField) {
    return tours;
  }

  return [...tours].sort((left, right) => {
    const comparison = resolveTourSortValue({ tour: left, sortField, locationCountByTourId, pt }).localeCompare(
      resolveTourSortValue({ tour: right, sortField, locationCountByTourId, pt }),
      'de',
      {
        numeric: true,
        sensitivity: 'base',
      },
    );
    return sortDirection === 'asc' ? comparison : comparison * -1;
  });
};

export const applyWasteToursFilters = ({
  onFiltersChange,
  onQueryChange,
  onStatusChange,
  setFilterDialogOpen,
  draftQuery,
  draftStatus,
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
      draftTourWasteFractionId,
      draftFirstDateFrom,
      draftFirstDateTo,
      draftEndDateFrom,
      draftEndDateTo,
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
    onFiltersChange('', 'all', undefined, undefined, undefined, undefined, undefined);
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
