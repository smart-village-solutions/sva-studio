import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import {
  type WasteToursFilterDate,
  type WasteToursFilterFraction,
  type WasteToursFilterStatus,
  type WasteToursFilterValidityPeriod,
  useWasteToursDraftFiltersState,
} from './waste-management.tours.filter-state.js';
import { createWasteToursSelectionSummary } from './waste-management.tours.view-model.js';

export type { WasteToursContentProps } from './waste-management.tours.view-model.js';
export { WasteToursDeleteDialogs } from './waste-management.tours-delete-dialogs.js';

type UseWasteToursSelectionStateArgs = {
  readonly tours: readonly WasteTourRecord[];
  readonly availableTourIds: readonly string[];
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
  availableTourIds,
  page,
  pageSize,
}: Pick<UseWasteToursSelectionStateArgs, 'tours' | 'availableTourIds' | 'page' | 'pageSize'>) => {
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const selectedTourIdSet = useMemo(() => new Set(selectedTourIds), [selectedTourIds]);
  const filteredTourIds = useMemo(() => tours.map((tour) => tour.id), [tours]);
  const visibleTourIds = useMemo(
    () => tours.slice((page - 1) * pageSize, page * pageSize).map((tour) => tour.id),
    [page, pageSize, tours]
  );
  const allVisibleSelected =
    visibleTourIds.length > 0 && visibleTourIds.every((tourId) => selectedTourIdSet.has(tourId));
  const someVisibleSelected = visibleTourIds.some((tourId) => selectedTourIdSet.has(tourId));
  const filteredSelection = createWasteToursSelectionSummary({
    filteredTourIds,
    selectedTourIds,
  });

  useEffect(() => {
    const availableIds = new Set(availableTourIds);
    setSelectedTourIds((current) => current.filter((tourId) => availableIds.has(tourId)));
  }, [availableTourIds]);

  return {
    selectedTourIds,
    setSelectedTourIds,
    allVisibleSelected,
    someVisibleSelected,
    ...filteredSelection,
    toggleSelectAllVisible: (checked: boolean) =>
      setSelectedTourIds((current) => {
        if (checked) {
          return Array.from(new Set([...current, ...visibleTourIds]));
        }
        const visibleSet = new Set(visibleTourIds);
        return current.filter((tourId) => !visibleSet.has(tourId));
      }),
    toggleSelectAllFiltered: (checked: boolean) =>
      setSelectedTourIds((current) => {
        if (checked) {
          return Array.from(new Set([...current, ...filteredTourIds]));
        }
        const filteredSet = new Set(filteredTourIds);
        return current.filter((tourId) => !filteredSet.has(tourId));
      }),
    clearSelection: () => setSelectedTourIds([]),
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

const useWasteToursDialogState = () => {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [tourPendingDelete, setTourPendingDelete] = useState<WasteTourRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkValidityOpen, setBulkValidityOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  return {
    filterDialogOpen,
    setFilterDialogOpen,
    tourPendingDelete,
    setTourPendingDelete,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkValidityOpen,
    setBulkValidityOpen,
    bulkStatusOpen,
    setBulkStatusOpen,
  };
};

export const useWasteToursSelectionState = ({
  tours,
  availableTourIds,
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
  const dialogState = useWasteToursDialogState();
  const visibleSelectionState = useWasteToursVisibleSelectionState({
    tours,
    availableTourIds,
    page,
    pageSize,
  });
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
    filterDialogOpen: dialogState.filterDialogOpen,
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
    ...dialogState,
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
  };
};
