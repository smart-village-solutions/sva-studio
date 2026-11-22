import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, buttonVariants } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import {
  WasteSchedulingContent,
  WasteSchedulingEmptyState,
  WasteTourAssignmentsContent,
} from './waste-management.scheduling-content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';
import { toWasteTourEditSearch } from './waste-management.cross-link.navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const WasteSchedulingListView = ({
  controller,
  search,
  canManageAssignments = false,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
  readonly canManageAssignments?: boolean;
}) => {
  const navigation = useWasteSchedulingListNavigation(controller, search);
  const pt = usePluginTranslation('wasteManagement');
  const selectedTour = search.tourId
    ? controller.availableTours.find((tour) => tour.id === search.tourId)
    : undefined;
  const assignmentsTab = search.tab === 'tourAssignments';
  const content = assignmentsTab ? (
    <WasteTourAssignmentsContent
      message={controller.message}
      tours={controller.availableTours}
      tourAssignments={controller.tourAssignments}
      assignmentLocationOptions={controller.assignmentLocationOptions}
      search={search}
      canManage={canManageAssignments}
      onSaveTourAssignment={controller.onSaveTourAssignment}
      onDeleteTourAssignment={controller.onDeleteTourAssignment}
      saving={controller.saving}
    />
  ) : !controller.allSchedulingEntries.length && !controller.availableTours.length ? (
    <WasteSchedulingEmptyState onOpenCreateShiftDialog={navigation.openCreate} />
  ) : (
    <WasteSchedulingContent
      message={controller.message}
      schedulingEntries={controller.schedulingEntries}
      search={search}
      onOpenCreateShiftDialog={navigation.openCreate}
      onEditHolidayRule={navigation.openEditHoliday}
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          type="button"
          variant="tertiary"
          disabled={!search.tourId && (assignmentsTab || (!search.q && search.shiftContext === 'all'))}
          onClick={navigation.resetFilters}
        >
          {pt('filters.reset')}
        </Button>
        {!assignmentsTab && search.q ? <span>{pt('filters.searchLabel')} · {search.q}</span> : null}
        {!assignmentsTab && search.shiftContext !== 'all' ? (
          <span>{pt(`filters.shiftContext.${search.shiftContext}`)}</span>
        ) : null}
        {search.tourId ? (
          <span className="mr-auto font-medium">
            {pt('scheduling.tourContext.active', { name: selectedTour?.name ?? search.tourId })}
          </span>
        ) : null}
        {selectedTour ? (
          <Link
            to="/plugins/waste-management"
            search={toWasteTourEditSearch(search, selectedTour.id)}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {pt('scheduling.tourContext.back')}
          </Link>
        ) : null}
      </div>
      {content}
    </div>
  );
};
