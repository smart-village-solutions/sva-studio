import { useEffect, useState } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';

export type WasteToursFilterStatus = WasteManagementSearchParams['tourStatus'];
export type WasteToursFilterValidityPeriod = WasteManagementSearchParams['tourValidityPeriod'];
export type WasteToursFilterReview = WasteManagementSearchParams['tourReview'];
export type WasteToursFilterDate = WasteManagementSearchParams['firstDateFrom'];
export type WasteToursFilterFraction = WasteManagementSearchParams['tourWasteFractionId'];

type WasteToursDraftFiltersArgs = {
  readonly filterDialogOpen: boolean;
  readonly query: string;
  readonly status: WasteToursFilterStatus;
  readonly tourValidityPeriod: WasteToursFilterValidityPeriod;
  readonly tourReview: WasteToursFilterReview;
  readonly tourWasteFractionId: WasteToursFilterFraction;
  readonly firstDateFrom: WasteToursFilterDate;
  readonly firstDateTo: WasteToursFilterDate;
  readonly endDateFrom: WasteToursFilterDate;
  readonly endDateTo: WasteToursFilterDate;
};

const hasActiveWasteToursFilters = ({
  query,
  status,
  tourValidityPeriod,
  tourReview,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
}: Omit<WasteToursDraftFiltersArgs, 'filterDialogOpen'>) =>
  query.trim().length > 0 ||
  status !== 'all' ||
  tourValidityPeriod !== 'all' ||
  tourReview !== undefined ||
  tourWasteFractionId !== undefined ||
  firstDateFrom !== undefined ||
  firstDateTo !== undefined ||
  endDateFrom !== undefined ||
  endDateTo !== undefined;

export const useWasteToursDraftFiltersState = (args: WasteToursDraftFiltersArgs) => {
  const {
    filterDialogOpen,
    query,
    status,
    tourValidityPeriod,
    tourReview,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
  } = args;
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftTourValidityPeriod, setDraftTourValidityPeriod] = useState(tourValidityPeriod);
  const [draftTourReview, setDraftTourReview] = useState(tourReview);
  const [draftTourWasteFractionId, setDraftTourWasteFractionId] =
    useState<WasteToursFilterFraction>(tourWasteFractionId);
  const [draftFirstDateFrom, setDraftFirstDateFrom] = useState<WasteToursFilterDate>(firstDateFrom);
  const [draftFirstDateTo, setDraftFirstDateTo] = useState<WasteToursFilterDate>(firstDateTo);
  const [draftEndDateFrom, setDraftEndDateFrom] = useState<WasteToursFilterDate>(endDateFrom);
  const [draftEndDateTo, setDraftEndDateTo] = useState<WasteToursFilterDate>(endDateTo);

  const syncDraftFilters = () => {
    setDraftQuery(query);
    setDraftStatus(status);
    setDraftTourValidityPeriod(tourValidityPeriod);
    setDraftTourReview(tourReview);
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
  }, [
    endDateFrom,
    endDateTo,
    filterDialogOpen,
    firstDateFrom,
    firstDateTo,
    query,
    status,
    tourValidityPeriod,
    tourReview,
    tourWasteFractionId,
  ]);

  return {
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
    draftTourValidityPeriod,
    draftTourReview,
    setDraftTourValidityPeriod,
    setDraftTourReview,
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
    hasActiveFilters: hasActiveWasteToursFilters(args),
    syncDraftFilters,
  };
};
