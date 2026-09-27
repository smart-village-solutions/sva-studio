import type {
  WasteCustomRecurrencePresetRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteLocationTourPickupDateRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteTourAssignmentRecord,
} from '@sva/waste-management-contracts';

export type WasteManagementToursOverview = Readonly<{
  tours: readonly WasteTourRecord[];
  customRecurrencePresets?: readonly WasteCustomRecurrencePresetRecord[];
}>;

export type WasteManagementSchedulingOverview = Readonly<{
  tourAssignments?: readonly WasteTourAssignmentRecord[];
  locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  tourDateShifts: readonly WasteTourDateShiftRecord[];
  globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  holidayRules: readonly WasteHolidayRuleRecord[];
}>;
