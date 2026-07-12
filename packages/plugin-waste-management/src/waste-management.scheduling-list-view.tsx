import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import {
  WasteSchedulingContent,
  WasteSchedulingEmptyState,
} from './waste-management.scheduling-content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const WasteSchedulingListView = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigation = useWasteSchedulingListNavigation(controller, search);
  if (
    !controller.allSchedulingEntries.length &&
    !controller.tourAssignments.length &&
    !controller.availableTours.length
  ) {
    return <WasteSchedulingEmptyState onOpenCreateShiftDialog={navigation.openCreate} />;
  }

  return (
    <WasteSchedulingContent
      message={controller.message}
      schedulingEntries={controller.schedulingEntries}
      tours={controller.availableTours}
      tourAssignments={controller.tourAssignments}
      assignmentLocationOptions={controller.assignmentLocationOptions}
      onOpenCreateShiftDialog={navigation.openCreate}
      onEditHolidayRule={navigation.openEditHoliday}
      onEditGlobalShiftDialog={navigation.openEditGlobal}
      onEditTourShiftDialog={navigation.openEditTour}
      onDeleteSchedulingRows={controller.onDeleteSchedulingRows}
      onSaveTourAssignment={controller.onSaveTourAssignment}
      onDeleteTourAssignment={controller.onDeleteTourAssignment}
      saving={controller.saving}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
    />
  );
};
