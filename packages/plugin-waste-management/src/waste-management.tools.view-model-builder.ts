import type { StudioJobResponse } from '@sva/plugin-sdk';
import type { WasteManagementHistoryOverview } from '@sva/waste-management-contracts';

import {
  getWasteManagementImportCatalog,
  previewWasteLocationTourPickupDateImport,
  type StartWasteManagementImportInput,
} from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';
import type { Action } from './waste-management.tools.job-runners.js';

export const createWasteToolsViewModel = <TActions extends Record<string, unknown>>(input: {
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride: StartWasteManagementImportInput['delimiterOverride'];
  readonly previewResult: Awaited<
    ReturnType<typeof previewWasteLocationTourPickupDateImport>
  > | null;
  readonly previewReady: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly resetConfirmOpen: boolean;
  readonly runningAction: Action | null;
  readonly message: StatusMessage | null;
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly technicalHistory: readonly WasteManagementHistoryOverview['technical']['items'][number][];
  readonly runDeleteHistoryEntry: (jobId: string) => Promise<boolean>;
  readonly selectedImportProfile: ReturnType<typeof getWasteManagementImportCatalog>[number] | null;
  readonly setImportProfileId: (
    value: StartWasteManagementImportInput['importProfileId'] | ''
  ) => void;
  readonly setImportSourceFormat: (value: StartWasteManagementImportInput['sourceFormat']) => void;
  readonly setImportBlobRef: (value: string) => void;
  readonly setImportDryRun: (value: boolean) => void;
  readonly setDelimiterOverride: (
    value: StartWasteManagementImportInput['delimiterOverride']
  ) => void;
  readonly setMigrationSchema: (value: string) => void;
  readonly setMigrationVersion: (value: string) => void;
  readonly setResetToken: (value: string) => void;
  readonly setResetConfirmOpen: (value: boolean) => void;
  readonly actions: TActions;
}) => ({
  importCatalog: input.importCatalog,
  importProfileId: input.importProfileId,
  importSourceFormat: input.importSourceFormat,
  importBlobRef: input.importBlobRef,
  importDryRun: input.importDryRun,
  delimiterOverride: input.delimiterOverride,
  previewResult: input.previewResult,
  previewReady: input.previewReady,
  migrationSchema: input.migrationSchema,
  migrationVersion: input.migrationVersion,
  resetToken: input.resetToken,
  resetConfirmOpen: input.resetConfirmOpen,
  runningAction: input.runningAction,
  message: input.message,
  lastJob: input.lastJob,
  technicalHistory: input.technicalHistory,
  runDeleteHistoryEntry: input.runDeleteHistoryEntry,
  selectedImportProfile: input.selectedImportProfile,
  setImportProfileId: input.setImportProfileId,
  setImportSourceFormat: input.setImportSourceFormat,
  setImportBlobRef: input.setImportBlobRef,
  setImportDryRun: input.setImportDryRun,
  setDelimiterOverride: input.setDelimiterOverride,
  setMigrationSchema: input.setMigrationSchema,
  setMigrationVersion: input.setMigrationVersion,
  setResetToken: input.setResetToken,
  setResetConfirmOpen: input.setResetConfirmOpen,
  ...input.actions,
});
