import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteToursListNavigation } from './waste-management.tours-list-view.navigation.js';

type WasteToursController = ReturnType<typeof useWasteToursController>;

export const WasteToursListView = ({
  controller,
  search,
}: {
  readonly controller: WasteToursController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigation = useWasteToursListNavigation(controller, search);

  if (!controller.tours.length) {
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
      onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
      onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
      onOpenCalendar={controller.openCalendar}
      onToggleTourStatus={controller.onToggleTourStatus}
      onDeleteTour={controller.onDeleteTour}
      onDeleteTours={controller.onDeleteTours}
      saving={controller.saving}
      page={search.page}
      pageSize={search.pageSize}
      query={search.q}
      status={search.status}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
      onQueryChange={navigation.setQuery}
      onStatusChange={navigation.setStatus}
    />
  );
};
