import { WasteListFilterChips } from './waste-management.list-filter-dialog.js';
import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { formatCalendarDate, usePluginTranslation } from '@sva/plugin-sdk';
import { buttonVariants } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import {
  WasteSchedulingContent,
  WasteSchedulingEmptyState,
  WasteTourAssignmentsContent,
} from './waste-management.scheduling-content.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteSchedulingListNavigation } from './waste-management.scheduling-list-view.navigation.js';
import { toWasteTourEditSearch } from './waste-management.cross-link.navigation.js';
import {
  WastePanelTableTopBar,
  type WastePanelTableTopBarProps,
} from './waste-management.table-frame.js';

import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

import {
  SchedulingFiltersToolbar,
  schedulingFilterDefaults,
  type SchedulingFilters,
} from './waste-management.scheduling-filter-dialog.js';

const getSchedulingFilterLabels = (
  search: WasteManagementSearchParams,
  selectedTour: WasteViewModel['availableTours'][number] | undefined,
  pt: ReturnType<typeof usePluginTranslation>
) => {
  const assignmentsTab = search.tab === 'tourAssignments';
  return {
    q: assignmentsTab ? undefined : search.q,
    shiftContext:
      assignmentsTab || search.shiftContext === 'all'
        ? undefined
        : pt(`filters.shiftContext.${search.shiftContext}`),
    shiftDateFrom:
      assignmentsTab || !search.shiftDateFrom
        ? undefined
        : `${pt('filters.dateFrom')} · ${formatCalendarDate(search.shiftDateFrom)}`,
    shiftDateTo:
      assignmentsTab || !search.shiftDateTo
        ? undefined
        : `${pt('filters.dateTo')} · ${formatCalendarDate(search.shiftDateTo)}`,
    tourId:
      search.tourId &&
      pt('scheduling.tourContext.active', {
        name: selectedTour ? formatTourSelectionLabel(pt, selectedTour) : search.tourId,
      }),
  };
};

const useSchedulingToolbar = (
  search: WasteManagementSearchParams,
  tours: WasteViewModel['availableTours'],
  navigation: ReturnType<typeof useWasteSchedulingListNavigation>
): WastePanelTableTopBarProps => {
  const pt = usePluginTranslation('wasteManagement');
  const assignmentsTab = search.tab === 'tourAssignments';
  const selectedTour = tours.find((tour) => tour.id === search.tourId);
  const labels = getSchedulingFilterLabels(search, selectedTour, pt);
  return {
    activeFilters: (
      <WasteListFilterChips
        chips={Object.entries(labels).flatMap(([id, label]) =>
          label
            ? [
                {
                  id,
                  label,
                  clear: () =>
                    navigation.applyFilters({
                      [id]: schedulingFilterDefaults[id as keyof SchedulingFilters],
                    }),
                },
              ]
            : []
        )}
        onReset={() =>
          assignmentsTab
            ? navigation.applyFilters({ tourId: undefined })
            : navigation.resetFilters()
        }
      />
    ),
    children: (
      <SchedulingFiltersToolbar
        key={search.tab}
        search={search}
        tours={tours}
        navigation={navigation}
      />
    ),
    actions: selectedTour ? (
      <Link
        to="/plugins/waste-management"
        search={toWasteTourEditSearch(search, selectedTour.id)}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        {pt('scheduling.tourContext.back')}
      </Link>
    ) : null,
  };
};

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
  const assignmentsTab = search.tab === 'tourAssignments';
  const toolbar = useSchedulingToolbar(search, controller.availableTours, navigation);
  const content = assignmentsTab ? (
    <WasteTourAssignmentsContent
      message={controller.message}
      tours={controller.availableTours}
      tourAssignments={controller.tourAssignments}
      assignmentLocationOptions={controller.assignmentLocationOptions}
      search={search}
      canManage={canManageAssignments}
      toolbar={toolbar}
      onSaveTourAssignment={controller.onSaveTourAssignment}
      onDeleteTourAssignment={controller.onDeleteTourAssignment}
      saving={controller.saving}
    />
  ) : !controller.allSchedulingEntries.length && !controller.availableTours.length ? (
    <>
      <WastePanelTableTopBar {...toolbar} />
      <WasteSchedulingEmptyState onOpenCreateShiftDialog={navigation.openCreate} />
    </>
  ) : (
    <WasteSchedulingContent
      message={controller.message}
      schedulingEntries={controller.schedulingEntries}
      toolbar={toolbar}
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

  return content;
};
