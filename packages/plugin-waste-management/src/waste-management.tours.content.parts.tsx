import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import {
  type WasteToursFilterDate,
  type WasteToursFilterFraction,
  type WasteToursFilterStatus,
  type WasteToursFilterValidityPeriod,
  useWasteToursDraftFiltersState,
} from './waste-management.tours.filter-state.js';

export type { WasteToursContentProps } from './waste-management.tours.view-model.js';
export { WasteToursDeleteDialogs } from './waste-management.tours-delete-dialogs.js';

type UseWasteToursSelectionStateArgs = {
  readonly tours: readonly WasteTourRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: WasteToursFilterStatus;
  readonly tourValidityPeriod: WasteToursFilterValidityPeriod;
  readonly tourWasteFractionId: WasteToursFilterFraction;
  readonly firstDateFrom: WasteToursFilterDate;
  readonly firstDateTo: WasteToursFilterDate;
  readonly endDateFrom: WasteToursFilterDate;
  readonly endDateTo: WasteToursFilterDate;
};

const useWasteToursVisibleSelectionState = ({
  tours,
  page,
  pageSize,
}: Pick<UseWasteToursSelectionStateArgs, 'tours' | 'page' | 'pageSize'>) => {
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const visibleTourIds = useMemo(
    () => tours.slice((page - 1) * pageSize, page * pageSize).map((tour) => tour.id),
    [page, pageSize, tours]
  );
  const allVisibleSelected =
    visibleTourIds.length > 0 && visibleTourIds.every((tourId) => selectedTourIds.includes(tourId));
  const someVisibleSelected = visibleTourIds.some((tourId) => selectedTourIds.includes(tourId));

  useEffect(() => {
    const availableIds = new Set(tours.map((tour) => tour.id));
    setSelectedTourIds((current) => current.filter((tourId) => availableIds.has(tourId)));
  }, [tours]);

  return {
    selectedTourIds,
    setSelectedTourIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAllVisible: (checked: boolean) =>
      setSelectedTourIds((current) => {
        if (checked) {
          return Array.from(new Set([...current, ...visibleTourIds]));
        }
        const visibleSet = new Set(visibleTourIds);
        return current.filter((tourId) => !visibleSet.has(tourId));
      }),
    toggleSelectedTour: (tourId: string, checked: boolean) =>
      setSelectedTourIds((current) =>
        checked
          ? current.includes(tourId)
            ? current
            : [...current, tourId]
          : current.filter((value) => value !== tourId)
      ),
  };
};

export const useWasteToursSelectionState = ({
  tours,
  page,
  pageSize,
  query,
  status,
  tourValidityPeriod,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
}: UseWasteToursSelectionStateArgs) => {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [tourPendingDelete, setTourPendingDelete] = useState<WasteTourRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkValidityOpen, setBulkValidityOpen] = useState(false);
  const visibleSelectionState = useWasteToursVisibleSelectionState({ tours, page, pageSize });
  const {
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
    draftTourValidityPeriod,
    setDraftTourValidityPeriod,
    draftTourWasteFractionId,
    setDraftTourWasteFractionId,
    draftFirstDateFrom,
    setDraftFirstDateFrom,
    draftFirstDateTo,
    setDraftFirstDateTo,
    draftEndDateFrom,
    setDraftEndDateFrom,
    draftEndDateTo,
    setDraftEndDateTo,
    hasActiveFilters,
    syncDraftFilters,
  } = useWasteToursDraftFiltersState({
    filterDialogOpen,
    query,
    status,
    tourValidityPeriod,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
  });

  return {
    filterDialogOpen,
    setFilterDialogOpen,
    ...visibleSelectionState,
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
    draftTourValidityPeriod,
    setDraftTourValidityPeriod,
    draftTourWasteFractionId,
    setDraftTourWasteFractionId,
    draftFirstDateFrom,
    setDraftFirstDateFrom,
    draftFirstDateTo,
    setDraftFirstDateTo,
    draftEndDateFrom,
    setDraftEndDateFrom,
    draftEndDateTo,
    setDraftEndDateTo,
    hasActiveFilters,
    syncDraftFilters,
    tourPendingDelete,
    setTourPendingDelete,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkValidityOpen,
    setBulkValidityOpen,
  };
};
