import type {
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourPickupDateListFilter,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkRecord,
  WastePdfStaticSettingsWriteInput,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityBulkUpdateResult,
} from '@sva/waste-management-contracts';
import type { SaveWasteCustomRecurrencePresetsInput } from './custom-recurrence-deps.js';
import type { WasteTourDateShiftWriter } from './tour-date-shift-deps.js';

export type WasteManagementHandlerMasterDataDeps = {
  readonly saveWasteFraction?: (
    instanceId: string,
    input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteFractionById?: (
    instanceId: string,
    fractionId: string
  ) => Promise<WasteFractionRecord | null>;
  readonly deleteWasteFraction?: (instanceId: string, fractionId: string) => Promise<void>;
  readonly saveWasteRegion?: (
    instanceId: string,
    input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteRegionById?: (
    instanceId: string,
    regionId: string
  ) => Promise<WasteRegionRecord | null>;
  readonly saveWasteStreet?: (
    instanceId: string,
    input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteStreetById?: (
    instanceId: string,
    streetId: string
  ) => Promise<WasteStreetRecord | null>;
  readonly saveWasteHouseNumber?: (
    instanceId: string,
    input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteHouseNumberById?: (
    instanceId: string,
    houseNumberId: string
  ) => Promise<WasteHouseNumberRecord | null>;
  readonly saveWasteCollectionLocation?: (
    instanceId: string,
    input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteCollectionLocationById?: (
    instanceId: string,
    locationId: string
  ) => Promise<WasteCollectionLocationRecord | null>;
  readonly deleteWasteCollectionLocation?: (
    instanceId: string,
    locationId: string
  ) => Promise<void>;
  readonly saveWasteLocationTourLink?: (
    instanceId: string,
    input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly saveWasteLocationTourLinksBulk?: (
    instanceId: string,
    input: WasteLocationTourLinkBulkCreateInput
  ) => Promise<readonly WasteLocationTourLinkRecord[]>;
  readonly loadWasteLocationTourLinkById?: (
    instanceId: string,
    linkId: string
  ) => Promise<WasteLocationTourLinkRecord | null>;
  readonly listWasteLocationTourLinksByTourId?: (
    instanceId: string,
    tourId: string
  ) => Promise<readonly WasteLocationTourLinkRecord[]>;
  readonly deleteWasteLocationTourLink?: (instanceId: string, linkId: string) => Promise<void>;
  readonly saveWasteLocationTourPickupDate?: (
    instanceId: string,
    input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteLocationTourPickupDateById?: (
    instanceId: string,
    pickupDateId: string
  ) => Promise<WasteLocationTourPickupDateRecord | null>;
  readonly listWasteLocationTourPickupDates?: (
    instanceId: string,
    filter?: WasteLocationTourPickupDateListFilter
  ) => Promise<readonly WasteLocationTourPickupDateRecord[]>;
  readonly deleteWasteLocationTourPickupDate?: (
    instanceId: string,
    pickupDateId: string
  ) => Promise<void>;
  readonly saveWasteTourAssignment?: (
    instanceId: string,
    input: Omit<
      import('@sva/waste-management-contracts').WasteTourAssignmentRecord,
      'createdAt' | 'updatedAt'
    >
  ) => Promise<void>;
  readonly loadWasteTourAssignmentById?: (
    instanceId: string,
    assignmentId: string
  ) => Promise<import('@sva/waste-management-contracts').WasteTourAssignmentRecord | null>;
  readonly listWasteTourAssignments?: (
    instanceId: string,
    filter?: import('@sva/waste-management-contracts').WasteTourAssignmentListFilter
  ) => Promise<readonly import('@sva/waste-management-contracts').WasteTourAssignmentRecord[]>;
  readonly deleteWasteTourAssignment?: (instanceId: string, assignmentId: string) => Promise<void>;
  readonly saveWasteTour?: (
    instanceId: string,
    input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly updateWasteTourValidityBulk?: (
    instanceId: string,
    input: WasteTourValidityBulkUpdateInput
  ) => Promise<WasteTourValidityBulkUpdateResult>;
  readonly loadWasteTourById?: (
    instanceId: string,
    tourId: string
  ) => Promise<WasteTourRecord | null>;
  readonly deleteWasteTour?: (instanceId: string, tourId: string) => Promise<void>;
  readonly saveWasteCustomRecurrencePresets?: (
    instanceId: string,
    input: SaveWasteCustomRecurrencePresetsInput
  ) => Promise<void>;
  readonly saveWastePdfStaticSettings?: (
    instanceId: string,
    input: WastePdfStaticSettingsWriteInput
  ) => Promise<void>;
  readonly saveWasteTourDateShift?: WasteTourDateShiftWriter;
  readonly createWasteTourDateShift?: WasteTourDateShiftWriter;
  readonly loadWasteTourDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteTourDateShiftRecord | null>;
  readonly listWasteTourDateShiftsByTourId?: (
    instanceId: string,
    tourId: string
  ) => Promise<readonly WasteTourDateShiftRecord[]>;
  readonly deleteWasteTourDateShift?: (instanceId: string, shiftId: string) => Promise<void>;
  readonly saveWasteGlobalDateShift?: (
    instanceId: string,
    input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly saveWasteHolidayRule?: (
    instanceId: string,
    input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly deleteWasteHolidayRule?: (instanceId: string, ruleId: string) => Promise<void>;
  readonly loadWasteGlobalDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteGlobalDateShiftRecord | null>;
  readonly loadWasteHolidayRuleById?: (
    instanceId: string,
    ruleId: string
  ) => Promise<WasteHolidayRuleRecord | null>;
  readonly deleteWasteGlobalDateShift?: (instanceId: string, shiftId: string) => Promise<void>;
};
