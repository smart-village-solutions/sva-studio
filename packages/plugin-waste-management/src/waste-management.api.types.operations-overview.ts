import type {
  WasteGlobalDateShiftRecord,
  WasteLocationTourPickupDateRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

export type WasteManagementToursOverview = Readonly<{
  tours: readonly WasteTourRecord[];
}>;

export type WasteManagementSchedulingOverview = Readonly<{
  locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  tourDateShifts: readonly WasteTourDateShiftRecord[];
  globalDateShifts: readonly WasteGlobalDateShiftRecord[];
}>;
