import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteToursFilterStatus = WasteManagementSearchParams['status'];
type WasteToursFilterDate = WasteManagementSearchParams['firstDateFrom'];
type WasteToursFilterFraction = WasteManagementSearchParams['tourWasteFractionId'];

export type WasteToursContentProps = {
  readonly assignmentContextLoading: boolean;
  readonly message: import('./waste-management.page.support.js').StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
  readonly canDuplicateTour?: boolean;
  readonly saving?: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: WasteToursFilterStatus;
  readonly tourWasteFractionId: WasteToursFilterFraction;
  readonly firstDateFrom: WasteToursFilterDate;
  readonly firstDateTo: WasteToursFilterDate;
  readonly endDateFrom: WasteToursFilterDate;
  readonly endDateTo: WasteToursFilterDate;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: WasteToursFilterStatus) => void;
  readonly onFiltersChange?: (
    query: string,
    status: WasteToursFilterStatus,
    tourWasteFractionId: WasteToursFilterFraction,
    firstDateFrom: WasteToursFilterDate,
    firstDateTo: WasteToursFilterDate,
    endDateFrom: WasteToursFilterDate,
    endDateTo: WasteToursFilterDate,
  ) => void;
};

type UseWasteToursSelectionStateArgs = {
  readonly tours: readonly WasteTourRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: WasteToursFilterStatus;
  readonly tourWasteFractionId: WasteToursFilterFraction;
  readonly firstDateFrom: WasteToursFilterDate;
  readonly firstDateTo: WasteToursFilterDate;
  readonly endDateFrom: WasteToursFilterDate;
  readonly endDateTo: WasteToursFilterDate;
};

export const useWasteToursSelectionState = ({
  tours,
  page,
  pageSize,
  query,
  status,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
}: UseWasteToursSelectionStateArgs) => {
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftTourWasteFractionId, setDraftTourWasteFractionId] = useState<WasteToursFilterFraction>(tourWasteFractionId);
  const [draftFirstDateFrom, setDraftFirstDateFrom] = useState<WasteToursFilterDate>(firstDateFrom);
  const [draftFirstDateTo, setDraftFirstDateTo] = useState<WasteToursFilterDate>(firstDateTo);
  const [draftEndDateFrom, setDraftEndDateFrom] = useState<WasteToursFilterDate>(endDateFrom);
  const [draftEndDateTo, setDraftEndDateTo] = useState<WasteToursFilterDate>(endDateTo);
  const [tourPendingDelete, setTourPendingDelete] = useState<WasteTourRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const visibleTourIds = useMemo(() => tours.slice((page - 1) * pageSize, page * pageSize).map((tour) => tour.id), [page, pageSize, tours]);
  const allVisibleSelected = visibleTourIds.length > 0 && visibleTourIds.every((tourId) => selectedTourIds.includes(tourId));
  const someVisibleSelected = visibleTourIds.some((tourId) => selectedTourIds.includes(tourId));
  const hasActiveFilters =
    query.trim().length > 0 ||
    status !== 'all' ||
    tourWasteFractionId !== undefined ||
    firstDateFrom !== undefined ||
    firstDateTo !== undefined ||
    endDateFrom !== undefined ||
    endDateTo !== undefined;

  useEffect(() => {
    const availableIds = new Set(tours.map((tour) => tour.id));
    setSelectedTourIds((current) => current.filter((tourId) => availableIds.has(tourId)));
  }, [tours]);

  useEffect(() => {
    if (!filterDialogOpen) {
      setDraftQuery(query);
      setDraftStatus(status);
      setDraftTourWasteFractionId(tourWasteFractionId);
      setDraftFirstDateFrom(firstDateFrom);
      setDraftFirstDateTo(firstDateTo);
      setDraftEndDateFrom(endDateFrom);
      setDraftEndDateTo(endDateTo);
    }
  }, [endDateFrom, endDateTo, filterDialogOpen, firstDateFrom, firstDateTo, query, status, tourWasteFractionId]);

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedTourIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleTourIds]));
      }
      const visibleSet = new Set(visibleTourIds);
      return current.filter((tourId) => !visibleSet.has(tourId));
    });
  };

  const toggleSelectedTour = (tourId: string, checked: boolean) => {
    setSelectedTourIds((current) =>
      checked ? (current.includes(tourId) ? current : [...current, tourId]) : current.filter((value) => value !== tourId)
    );
  };

  return {
    selectedTourIds,
    setSelectedTourIds,
    filterDialogOpen,
    setFilterDialogOpen,
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
    hasActiveFilters,
    tourPendingDelete,
    setTourPendingDelete,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAllVisible,
    toggleSelectedTour,
  };
};

type WasteToursDeleteDialogsProps = {
  readonly tourPendingDelete: WasteTourRecord | null;
  readonly bulkDeleteOpen: boolean;
  readonly selectedTourIds: readonly string[];
  readonly onCancelSingle: () => void;
  readonly onCancelBulk: () => void;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
  readonly onAfterBulkDelete: () => void;
};

export const WasteToursDeleteDialogs = ({
  tourPendingDelete,
  bulkDeleteOpen,
  selectedTourIds,
  onCancelSingle,
  onCancelBulk,
  onDeleteTour,
  onDeleteTours,
  onAfterBulkDelete,
}: WasteToursDeleteDialogsProps) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <StudioConfirmDialog
        open={tourPendingDelete !== null}
        title={pt('tours.deleteDialog.title')}
        description={pt('tours.deleteDialog.description', {
          value: tourPendingDelete?.name ?? '',
        })}
        confirmLabel={pt('tours.deleteDialog.confirm')}
        cancelLabel={pt('tours.deleteDialog.cancel')}
        onCancel={onCancelSingle}
        onConfirm={() => {
          if (!tourPendingDelete) {
            return;
          }
          void Promise.resolve(onDeleteTour(tourPendingDelete)).finally(onCancelSingle);
        }}
      />
      <StudioConfirmDialog
        open={bulkDeleteOpen}
        title={pt('tours.bulkDeleteDialog.title')}
        description={pt('tours.bulkDeleteDialog.description', {
          value: selectedTourIds.length,
        })}
        confirmLabel={pt('tours.bulkDeleteDialog.confirm')}
        cancelLabel={pt('tours.bulkDeleteDialog.cancel')}
        onCancel={onCancelBulk}
        onConfirm={() => {
          void Promise.resolve(onDeleteTours(selectedTourIds)).finally(onAfterBulkDelete);
        }}
      />
    </>
  );
};
