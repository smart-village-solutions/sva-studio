import { useEffect, useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import {
  type WasteToursFilterDate,
  type WasteToursFilterFraction,
  type WasteToursFilterStatus,
  useWasteToursDraftFiltersState,
} from './waste-management.tours.filter-state.js';

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

const useWasteToursVisibleSelectionState = ({
  tours,
  page,
  pageSize,
}: Pick<UseWasteToursSelectionStateArgs, 'tours' | 'page' | 'pageSize'>) => {
  const [selectedTourIds, setSelectedTourIds] = useState<readonly string[]>([]);
  const visibleTourIds = useMemo(
    () => tours.slice((page - 1) * pageSize, page * pageSize).map((tour) => tour.id),
    [page, pageSize, tours],
  );
  const allVisibleSelected = visibleTourIds.length > 0 && visibleTourIds.every((tourId) => selectedTourIds.includes(tourId));
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
        checked ? (current.includes(tourId) ? current : [...current, tourId]) : current.filter((value) => value !== tourId),
      ),
  };
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
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [tourPendingDelete, setTourPendingDelete] = useState<WasteTourRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const visibleSelectionState = useWasteToursVisibleSelectionState({ tours, page, pageSize });
  const {
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
    syncDraftFilters,
  } = useWasteToursDraftFiltersState({
    filterDialogOpen,
    query,
    status,
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
  };
};

type WasteToursDeleteDialogsProps = {
  readonly tourPendingDelete: WasteTourRecord | null;
  readonly tourPendingStatusChange: {
    readonly tour: WasteTourRecord;
    readonly nextActive: boolean;
  } | null;
  readonly bulkDeleteOpen: boolean;
  readonly selectedTourIds: readonly string[];
  readonly onCancelSingle: () => void;
  readonly onCancelStatusChange: () => void;
  readonly onCancelBulk: () => void;
  readonly onConfirmStatusChange: () => Promise<void>;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
  readonly onAfterBulkDelete: () => void;
};

export const WasteToursDeleteDialogs = ({
  tourPendingDelete,
  tourPendingStatusChange,
  bulkDeleteOpen,
  selectedTourIds,
  onCancelSingle,
  onCancelStatusChange,
  onCancelBulk,
  onConfirmStatusChange,
  onDeleteTour,
  onDeleteTours,
  onAfterBulkDelete,
}: WasteToursDeleteDialogsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const nextActive = tourPendingStatusChange?.nextActive ?? false;
  const statusDialogTranslationPrefix = nextActive ? 'activate' : 'deactivate';

  return (
    <>
      <StudioConfirmDialog
        open={tourPendingStatusChange !== null}
        title={pt(`tours.statusDialog.${statusDialogTranslationPrefix}Title`)}
        description={pt(`tours.statusDialog.${statusDialogTranslationPrefix}Description`, {
          value: tourPendingStatusChange?.tour.name ?? '',
        })}
        confirmLabel={pt('tours.statusDialog.confirm')}
        cancelLabel={pt('tours.statusDialog.cancel')}
        onCancel={onCancelStatusChange}
        onConfirm={() => {
          void onConfirmStatusChange();
        }}
      />
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
