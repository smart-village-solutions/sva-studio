import type {
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteManagementImportSourceFormat,
  WasteTourDateShiftFollowUpMode,
  WasteTourRecurrence,
} from '@sva/plugin-sdk';

export type WasteManagementSettingsInput = Readonly<{
  provider: 'supabase';
  projectUrl: string;
  schemaName?: string;
  enabled: boolean;
  databaseUrl?: string;
  serviceRoleKey?: string;
}>;

export type CreateWasteManagementTourInput = Readonly<{
  id: string;
  name: string;
  description?: string;
  wasteFractionIds: readonly string[];
  recurrence?: WasteTourRecurrence | null;
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

export type StartWasteManagementMigrationsInput = Readonly<{
  targetSchema?: string;
  requestedByVersion?: string;
}>;

export type StartWasteManagementImportInput = Readonly<{
  importProfileId: string;
  sourceFormat: WasteManagementImportSourceFormat;
  blobRef: string;
  dryRun?: boolean;
}>;

export type StartWasteManagementSeedInput = Readonly<{
  seedKey?: 'baseline';
}>;

export type StartWasteManagementResetInput = Readonly<{
  confirmationToken: string;
}>;
