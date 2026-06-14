import { useWasteToursViewModel } from './use-waste-tours-view-model.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteToursListNavigation } from './waste-management.tours-list-view.navigation.js';

type WasteViewModel = ReturnType<typeof useWasteToursViewModel>;

export const WasteToursListView = ({
  controller,
  search,
  canDuplicateTour = false,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
  readonly canDuplicateTour?: boolean;
}) => {
  const navigation = useWasteToursListNavigation(controller, search);
  const hasAnyTours = (controller.overview?.tours?.length ?? 0) > 0;
  const effectiveTourWasteFractionId =
    search.tourWasteFractionId && controller.availableFractions.some((fraction) => fraction.id === search.tourWasteFractionId)
      ? search.tourWasteFractionId
      : undefined;

  if (!controller.tours.length && !hasAnyTours) {
    return <WasteToursEmptyState onOpenCreateDialog={navigation.openCreate} />;
  }

  return (
    <WasteToursContent
      assignmentContextLoading={controller.assignmentContextLoading}
      message={controller.message}
      tours={controller.tours}
      fractions={controller.availableFractions}
      masterDataOverview={controller.masterDataOverview}
      schedulingOverview={controller.schedulingOverview}
      onOpenCreateDialog={navigation.openCreate}
      onOpenEditDialog={navigation.openEdit}
      onOpenDuplicateDialog={navigation.toDuplicate}
      onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
      onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
      onOpenCalendar={controller.openCalendar}
      onToggleTourStatus={controller.onToggleTourStatus}
      onDeleteTour={controller.onDeleteTour}
      onDeleteTours={controller.onDeleteTours}
      canDuplicateTour={canDuplicateTour}
      saving={controller.saving}
      page={search.page}
      pageSize={search.pageSize}
      query={search.q}
      status={search.status}
      tourWasteFractionId={effectiveTourWasteFractionId}
      firstDateFrom={search.firstDateFrom}
      firstDateTo={search.firstDateTo}
      endDateFrom={search.endDateFrom}
      endDateTo={search.endDateTo}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
      onQueryChange={navigation.setQuery}
      onStatusChange={navigation.setStatus}
      onFiltersChange={navigation.setFilters}
    />
  );
};
