import type {
  WasteCustomRecurrencePresetRecord,
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteHolidayRuleScope,
  WasteHolidayRuleStrategy,
  WasteManagementEmailReminderConfig,
  WasteHolidayStateCode,
  WasteLocationTourPickupDateImportPreview,
  WasteManagementCsvDelimiter,
  WasteManagementDataProfileId,
  WasteManagementExportTargetFormat,
  WasteManagementImportSourceFormat,
  WasteTourDateShiftFollowUpMode,
  WasteTourRecurrence,
  WasteTourValidityBulkUpdateInput,
  WasteAnnualTourTransferCreateInput,
} from '@sva/plugin-sdk';

export type WasteManagementSettingsInput = Readonly<{
  provider: 'postgresql';
  schemaName?: string;
  enabled: boolean;
  selectedInterfaceId?: string;
  calendarWebUrl?: string;
  pdfBrandingAssetUrl?: string;
  pdfContactBlock?: string;
  disruptionLocationEnabled: boolean;
  disruptionAllLocationsEnabled: boolean;
  emailReminderConfig?: WasteManagementEmailReminderConfig;
  holidayStateCode?: WasteHolidayStateCode;
  customRecurrencePresets: readonly Omit<
    WasteCustomRecurrencePresetRecord,
    'createdAt' | 'updatedAt'
  >[];
  deletedPresetFallbacks: Readonly<
    Record<
      string,
      Readonly<{
        kind: 'preset' | 'default';
        value: string;
      }>
    >
  >;
}>;

export type CreateWasteManagementTourInput = Readonly<{
  id: string;
  name: string;
  description?: string;
  wasteFractionIds: readonly string[];
  duplicateFromTourId?: string;
  recurrence?: WasteTourRecurrence | null;
  customRecurrenceId?: string;
  firstDate?: string;
  endDate?: string;
  customDates?: readonly WasteCustomTourDate[];
  active: boolean;
}>;

export type UpdateWasteManagementTourInput = Readonly<{
  name: string;
  description?: string;
  wasteFractionIds: readonly string[];
  recurrence?: WasteTourRecurrence | null;
  customRecurrenceId?: string;
  firstDate?: string;
  endDate?: string;
  customDates?: readonly WasteCustomTourDate[];
  active: boolean;
}>;

export type UpdateWasteManagementTourValidityBulkInput = WasteTourValidityBulkUpdateInput;

export type PreviewWasteAnnualTourTransferInput = Readonly<{
  sourceYear: number;
  selectedTourIds?: readonly string[];
  replacementDates?: WasteAnnualTourTransferCreateInput['replacementDates'];
}>;

export type CreateWasteAnnualTourTransferInput = WasteAnnualTourTransferCreateInput;

export type CreateWasteManagementTourDateShiftInput = Readonly<{
  id: string;
  tourId: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  reasonType?: WasteDateShiftReasonType;
  reasonKey?: string;
  followUpMode?: WasteTourDateShiftFollowUpMode;
  description?: string;
}>;

export type UpdateWasteManagementTourDateShiftInput = Readonly<{
  tourId: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  reasonType?: WasteDateShiftReasonType;
  reasonKey?: string;
  followUpMode?: WasteTourDateShiftFollowUpMode;
  description?: string;
}>;

export type CreateWasteManagementGlobalDateShiftInput = Readonly<{
  id: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  reasonType?: WasteDateShiftReasonType;
  reasonKey?: string;
  description?: string;
  tourIds?: readonly string[];
}>;

export type CreateWasteManagementLocationTourPickupDateInput = Readonly<{
  id: string;
  locationId: string;
  tourId: string;
  pickupDate: string;
  note?: string;
}>;

export type UpdateWasteManagementLocationTourPickupDateInput = Readonly<{
  locationId: string;
  tourId: string;
  pickupDate: string;
  note?: string;
}>;

export type CreateWasteManagementTourAssignmentInput = Readonly<{
  id: string;
  tourId: string;
  pickupDate: string;
  note?: string;
  locationIds: readonly string[];
}>;

export type UpdateWasteManagementTourAssignmentInput = Omit<
  CreateWasteManagementTourAssignmentInput,
  'id'
>;

export type UpdateWasteManagementGlobalDateShiftInput = Readonly<{
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  reasonType?: WasteDateShiftReasonType;
  reasonKey?: string;
  description?: string;
  tourIds?: readonly string[];
}>;

export type UpdateWasteManagementHolidayRuleInput = Readonly<{
  scope?: WasteHolidayRuleScope;
  strategy?: WasteHolidayRuleStrategy;
}>;

export type StartWasteManagementMigrationsInput = Readonly<{
  targetSchema?: string;
  requestedByVersion?: string;
}>;

export type StartWasteManagementImportInput = Readonly<{
  importProfileId: string;
  sourceFormat: WasteManagementImportSourceFormat;
  blobRef: string;
  dryRun?: boolean;
  delimiterOverride?: WasteManagementCsvDelimiter;
}>;

export type StartWasteManagementExportInput = Readonly<{
  profileIds: readonly WasteManagementDataProfileId[];
  targetFormat: WasteManagementExportTargetFormat;
}>;

export type PreviewWasteLocationTourPickupDateImportInput = Readonly<{
  importProfileId: 'waste-management.ortsbezogene-tourtermine';
  sourceFormat: 'text/csv';
  blobRef: string;
  delimiterOverride?: WasteManagementCsvDelimiter;
}>;

export type PreviewWasteLocationTourPickupDateImportResult =
  WasteLocationTourPickupDateImportPreview;

export type StartWasteManagementSeedInput = Readonly<{
  seedKey?: 'baseline';
}>;

export type StartWasteManagementMainserverSyncInput = Readonly<Record<string, never>>;

export type StartWasteManagementSyncWasteTypesInput = Readonly<Record<never, never>>;

export type StartWasteManagementResetInput = Readonly<{
  confirmationToken: string;
}>;
