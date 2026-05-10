import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord, WasteTourRecord } from '@sva/core';

export type WasteManagementToursOverview = Readonly<{
  tours: readonly WasteTourRecord[];
}>;

export type WasteManagementSchedulingOverview = Readonly<{
  tourDateShifts: readonly WasteTourDateShiftRecord[];
  globalDateShifts: readonly WasteGlobalDateShiftRecord[];
}>;
