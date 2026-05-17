import type { WasteDateShiftReasonType, WasteTourDateShiftFollowUpMode } from './master-data-contract.js';

export type WasteTourDateShiftRecord = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType?: WasteDateShiftReasonType;
  readonly reasonKey?: string;
  readonly followUpMode?: WasteTourDateShiftFollowUpMode;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteTourDateShiftListFilter = {
  readonly tourId?: string;
  readonly hasYear?: boolean;
};

export type WasteLocationTourPickupDateRecord = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly pickupDate: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteLocationTourPickupDateListFilter = {
  readonly locationId?: string;
  readonly tourId?: string;
  readonly pickupDate?: string;
};

export type WasteGlobalDateShiftRecord = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly reasonType?: WasteDateShiftReasonType;
  readonly reasonKey?: string;
  readonly description?: string;
  readonly tourIds?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteGlobalDateShiftListFilter = {
  readonly hasYear?: boolean;
  readonly appliesToTourId?: string;
};

export type WasteManagementSchedulingOverview = {
  readonly locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
};
