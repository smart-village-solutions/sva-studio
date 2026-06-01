import { useEffect, useState } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';

export type WasteToursFilterStatus = WasteManagementSearchParams['status'];
export type WasteToursFilterDate = WasteManagementSearchParams['firstDateFrom'];
export type WasteToursFilterFraction = WasteManagementSearchParams['tourWasteFractionId'];

type WasteToursDraftFiltersArgs = {
  readonly filterDialogOpen: boolean;
  readonly query: string;
  readonly status: WasteToursFilterStatus;
  readonly tourWasteFractionId: WasteToursFilterFraction;
  readonly firstDateFrom: WasteToursFilterDate;
  readonly firstDateTo: WasteToursFilterDate;
  readonly endDateFrom: WasteToursFilterDate;
  readonly endDateTo: WasteToursFilterDate;
};

const hasActiveWasteToursFilters = ({
  query,
  status,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
}: Omit<WasteToursDraftFiltersArgs, 'filterDialogOpen'>) =>
  query.trim().length > 0 ||
  status !== 'all' ||
  tourWasteFractionId !== undefined ||
  firstDateFrom !== undefined ||
  firstDateTo !== undefined ||
  endDateFrom !== undefined ||
  endDateTo !== undefined;

export const useWasteToursDraftFiltersState = ({
  filterDialogOpen,
  query,
  status,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
}: WasteToursDraftFiltersArgs) => {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftTourWasteFractionId, setDraftTourWasteFractionId] = useState<WasteToursFilterFraction>(tourWasteFractionId);
  const [draftFirstDateFrom, setDraftFirstDateFrom] = useState<WasteToursFilterDate>(firstDateFrom);
  const [draftFirstDateTo, setDraftFirstDateTo] = useState<WasteToursFilterDate>(firstDateTo);
  const [draftEndDateFrom, setDraftEndDateFrom] = useState<WasteToursFilterDate>(endDateFrom);
  const [draftEndDateTo, setDraftEndDateTo] = useState<WasteToursFilterDate>(endDateTo);

  const syncDraftFilters = () => {
    setDraftQuery(query);
    setDraftStatus(status);
    setDraftTourWasteFractionId(tourWasteFractionId);
    setDraftFirstDateFrom(firstDateFrom);
    setDraftFirstDateTo(firstDateTo);
    setDraftEndDateFrom(endDateFrom);
    setDraftEndDateTo(endDateTo);
  };

  useEffect(() => {
    if (!filterDialogOpen) {
      syncDraftFilters();
    }
  }, [endDateFrom, endDateTo, filterDialogOpen, firstDateFrom, firstDateTo, query, status, tourWasteFractionId]);

  return {
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
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
    hasActiveFilters: hasActiveWasteToursFilters({
      query,
      status,
      tourWasteFractionId,
      firstDateFrom,
      firstDateTo,
      endDateFrom,
      endDateTo,
    }),
    syncDraftFilters,
  };
};
