import type {
  WasteDateShiftReasonType,
  WasteHolidayRuleScope,
  WasteHolidayRuleStrategy,
  WasteHolidayStateCode,
  WasteTourDateShiftFollowUpMode,
} from './master-data-contract.js';
import type {
  WasteHolidayRuleConfigurationStatus,
  WasteHolidayRuleConflictStatus,
  WasteHolidayRuleSourceStatus,
} from './master-data-holiday-rule-status.js';

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
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteLocationTourPickupDateListFilter = {
  readonly locationId?: string;
  readonly tourId?: string;
  readonly pickupDate?: string;
};

export type WasteTourAssignmentRecord = {
  readonly id: string;
  readonly tourId: string;
  readonly pickupDate: string;
  readonly note: string | null;
  readonly locationIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteTourAssignmentListFilter = {
  readonly tourId?: string;
  readonly pickupDate?: string;
  readonly locationIds?: readonly string[];
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

export type WasteHolidayRuleRecord = {
  readonly id: string;
  readonly holidayDate: string;
  readonly holidayName: string;
  readonly year: number;
  readonly stateCode: WasteHolidayStateCode;
  readonly sourceStatus: WasteHolidayRuleSourceStatus;
  readonly configurationStatus: WasteHolidayRuleConfigurationStatus;
  readonly conflictStatus: WasteHolidayRuleConflictStatus;
  readonly scope?: WasteHolidayRuleScope;
  readonly strategy?: WasteHolidayRuleStrategy;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteHolidayRuleListFilter = {
  readonly stateCode?: WasteHolidayStateCode;
  readonly year?: number;
  readonly sourceStatus?: WasteHolidayRuleSourceStatus;
  readonly configurationStatus?: WasteHolidayRuleConfigurationStatus;
  readonly conflictStatus?: WasteHolidayRuleConflictStatus;
};

export type WasteManagementSchedulingOverview = {
  readonly tourAssignments?: readonly WasteTourAssignmentRecord[];
  readonly locationTourPickupDates: readonly WasteLocationTourPickupDateRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly holidayRules?: readonly WasteHolidayRuleRecord[];
};
