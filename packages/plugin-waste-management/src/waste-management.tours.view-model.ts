import type { WasteTourRecord, WasteTourValidityBulkUpdateInput } from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type {
  WasteToursFilterDate,
  WasteToursFilterFraction,
  WasteToursFilterStatus,
  WasteToursFilterValidityPeriod,
} from './waste-management.tours.filter-state.js';

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

type TourAssignmentSortValue = Readonly<{
  id: string;
  label?: string;
  regionName?: string;
  cityName?: string;
  streetName?: string;
}>;

const tourAssignmentCollator = new Intl.Collator('de', {
  numeric: true,
  sensitivity: 'base',
});

const compareOptionalTourAssignmentValue = (
  left: string | undefined,
  right: string | undefined
): number => {
  const normalizedLeft = left?.trim() ?? '';
  const normalizedRight = right?.trim() ?? '';
  if (!normalizedLeft) return normalizedRight ? 1 : 0;
  if (!normalizedRight) return -1;
  return tourAssignmentCollator.compare(normalizedLeft, normalizedRight);
};

const compareTourAssignmentLocations = <T extends TourAssignmentSortValue>(
  left: T,
  right: T
): number => {
  for (const key of ['regionName', 'cityName', 'streetName', 'label', 'id'] as const) {
    const comparison = compareOptionalTourAssignmentValue(left[key], right[key]);
    if (comparison !== 0) return comparison;
  }
  return 0;
};

export const orderTourAssignmentLocations = <T extends TourAssignmentSortValue>(
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

  return [
    ...selectedLocations.sort(compareTourAssignmentLocations),
    ...unselectedLocations.sort(compareTourAssignmentLocations),
  ];
};

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
  readonly onUpdateTourValidityBulk: (input: WasteTourValidityBulkUpdateInput) => Promise<boolean>;
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
  readonly tourValidityPeriod: WasteToursFilterValidityPeriod;
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
    tourValidityPeriod: WasteToursFilterValidityPeriod,
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
