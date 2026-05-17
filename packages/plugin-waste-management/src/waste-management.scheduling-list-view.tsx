import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingContent, WasteSchedulingEmptyState } from './waste-management.scheduling-content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const WasteSchedulingListView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigation = useWasteSchedulingListNavigation(controller, search);

  if (!controller.tourDateShifts.length && !controller.globalDateShifts.length) {
    return (
      <WasteSchedulingEmptyState
        onOpenCreateShiftDialog={navigation.openCreate}
      />
    );
  }

  return (
    <WasteSchedulingContent
      message={controller.message}
      globalDateShifts={controller.globalDateShifts}
      tourDateShifts={controller.tourDateShifts}
      availableTours={controller.availableTours}
      onOpenCreateShiftDialog={navigation.openCreate}
      onEditGlobalShiftDialog={navigation.openEditGlobal}
      onEditTourShiftDialog={navigation.openEditTour}
      onDeleteSchedulingRows={controller.onDeleteSchedulingRows}
      saving={controller.saving}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
    />
  );
};
