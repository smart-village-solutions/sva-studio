export const createTourAssignmentSelectionSummary = ({
  filteredLocationIds,
  selectedLocationIds,
}: {
  readonly filteredLocationIds: readonly string[];
  readonly selectedLocationIds: readonly string[];
}) => {
  const visibleLocationIdSet = new Set(filteredLocationIds);
  const selectedLocationIdSet = new Set(selectedLocationIds);
  const selectedVisibleCount = filteredLocationIds.filter((locationId) =>
    selectedLocationIdSet.has(locationId)
  ).length;

  return {
    allVisibleSelected:
      filteredLocationIds.length > 0 && selectedVisibleCount === filteredLocationIds.length,
    someVisibleSelected: selectedVisibleCount > 0,
    hiddenSelectedCount: selectedLocationIds.filter(
      (locationId) => !visibleLocationIdSet.has(locationId)
    ).length,
    visibleLocationIdSet,
  };
};

export const orderTourAssignmentLocations = <T extends { readonly id: string }>(
  locations: readonly T[],
  selectedLocationIds: readonly string[]
): readonly T[] => {
  const selectedLocationIdSet = new Set(selectedLocationIds);
  const selectedLocations: T[] = [];
  const unselectedLocations: T[] = [];

  for (const location of locations) {
    if (selectedLocationIdSet.has(location.id)) {
      selectedLocations.push(location);
    } else {
      unselectedLocations.push(location);
    }
  }

  return [...selectedLocations, ...unselectedLocations];
};
import type { WasteTourRecord } from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type {
  WasteToursFilterDate,
  WasteToursFilterFraction,
  WasteToursFilterStatus,
} from './waste-management.tours.filter-state.js';

export type WasteToursDataProps = {
  readonly assignmentContextLoading: boolean;
  readonly message: import('./waste-management.page.support.js').StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
};

export type WasteToursActionsProps = {
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
};

export type WasteToursCapabilitiesProps = {
  readonly canDuplicateTour?: boolean;
  readonly saving?: boolean;
};

export type WasteToursQueryProps = {
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
    endDateTo: WasteToursFilterDate
  ) => void;
};

export type WasteToursContentProps = WasteToursDataProps &
  WasteToursActionsProps &
  WasteToursCapabilitiesProps &
  WasteToursQueryProps;
