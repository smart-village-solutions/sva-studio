import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { buttonVariants } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import {
  WasteSchedulingContent,
  WasteSchedulingEmptyState,
} from './waste-management.scheduling-content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';
import { toWasteTourEditSearch } from './waste-management.cross-link.navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const WasteSchedulingListView = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigation = useWasteSchedulingListNavigation(controller, search);
  const pt = usePluginTranslation('wasteManagement');
  const selectedTour = search.tourId
    ? controller.availableTours.find((tour) => tour.id === search.tourId)
    : undefined;
  const content =
    !controller.allSchedulingEntries.length &&
    !controller.tourAssignments.length &&
    !controller.availableTours.length ? (
      <WasteSchedulingEmptyState onOpenCreateShiftDialog={navigation.openCreate} />
    ) : (
      <WasteSchedulingContent
        message={controller.message}
        schedulingEntries={controller.schedulingEntries}
        tours={controller.availableTours}
        tourAssignments={controller.tourAssignments}
        assignmentLocationOptions={controller.assignmentLocationOptions}
        search={search}
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

  return (
    <div className="space-y-4">
      {search.tourId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-card p-3 text-sm">
          <span className="mr-auto font-medium">
            {pt('scheduling.tourContext.active', { name: selectedTour?.name ?? search.tourId })}
          </span>
          {selectedTour ? (
            <Link
              to="/plugins/waste-management"
              search={toWasteTourEditSearch(search, selectedTour.id)}
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              {pt('scheduling.tourContext.back')}
            </Link>
          ) : null}
          <Link
            to="/plugins/waste-management"
            search={{ ...search, tourId: undefined, shiftContext: 'all', page: 1 }}
            className={buttonVariants({ variant: 'tertiary', size: 'sm' })}
          >
            {pt('scheduling.tourContext.clear')}
          </Link>
        </div>
      ) : null}
      {content}
    </div>
  );
};
