import type {
  WasteCustomRecurrencePresetRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteLocationTourPickupDateRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

export type WasteManagementToursOverview = Readonly<{
  tours: readonly WasteTourRecord[];
  customRecurrencePresets?: readonly WasteCustomRecurrencePresetRecord[];
}>;

export type WasteManagementSchedulingOverview = Readonly<{
  locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  tourDateShifts: readonly WasteTourDateShiftRecord[];
  globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  holidayRules: readonly WasteHolidayRuleRecord[];
}>;
