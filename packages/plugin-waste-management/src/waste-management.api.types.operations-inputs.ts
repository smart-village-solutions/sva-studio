import type {
  WasteCustomRecurrencePresetRecord,
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteHolidayRuleScope,
  WasteHolidayRuleStrategy,
  WasteHolidayStateCode,
  WasteLocationTourPickupDateImportPreview,
  WasteManagementCsvDelimiter,
  WasteManagementImportSourceFormat,
  WasteTourDateShiftFollowUpMode,
  WasteTourRecurrence,
} from '@sva/plugin-sdk';

export type WasteManagementSettingsInput = Readonly<{
  provider: 'supabase';
  projectUrl: string;
  schemaName?: string;
  enabled: boolean;
  holidayStateCode?: WasteHolidayStateCode;
  databaseUrl?: string;
  serviceRoleKey?: string;
  customRecurrencePresets: readonly Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>[];
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

export type PreviewWasteLocationTourPickupDateImportInput = Readonly<{
  importProfileId: 'waste-management.ortsbezogene-tourtermine';
  sourceFormat: 'text/csv';
  blobRef: string;
  delimiterOverride?: WasteManagementCsvDelimiter;
}>;

export type PreviewWasteLocationTourPickupDateImportResult = WasteLocationTourPickupDateImportPreview;

export type StartWasteManagementSeedInput = Readonly<{
  seedKey?: 'baseline';
}>;

export type StartWasteManagementResetInput = Readonly<{
  confirmationToken: string;
}>;
