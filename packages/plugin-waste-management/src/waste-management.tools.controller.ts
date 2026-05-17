import { getWasteManagementImportCatalog } from './waste-management.api.js';
import {
  createWasteToolsControllerViewModel,
  useWasteToolsControllerHelpers,
} from './waste-management.tools.actions.js';
import { useWasteTechnicalHistory } from './waste-management.tools.history-state.js';
import { useWasteTrackedJob } from './waste-management.tools.job-state.js';
import { useWasteImportState, useWasteMaintenanceState } from './waste-management.tools.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToolsController = (pt: Translate) => {
  const importCatalog = getWasteManagementImportCatalog();
  const {
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    delimiterOverride,
    previewResult,
    previewReady,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
    setDelimiterOverride,
    setPreviewResult,
    setPreviewReady,
  } = useWasteImportState(importCatalog);
  const {
    migrationSchema,
    migrationVersion,
    resetToken,
    resetConfirmOpen,
    runningAction,
    message,
    lastJob,
    setMigrationSchema,
    setMigrationVersion,
    setResetToken,
    setResetConfirmOpen,
    setRunningAction,
    setMessage,
    setLastJob,
  } = useWasteMaintenanceState();
  const { technicalHistory, refreshTechnicalHistory } = useWasteTechnicalHistory();
  const { selectedImportProfile, actions, runDeleteHistoryEntry } = useWasteToolsControllerHelpers({
    pt,
    importCatalog,
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    delimiterOverride,
    migrationSchema,
    migrationVersion,
    resetToken,
    refreshTechnicalHistory,
    setImportSourceFormat,
    setPreviewResult,
    setPreviewReady,
    setResetConfirmOpen,
    setResetToken,
    setRunningAction,
    setMessage,
    setLastJob,
    lastJob,
  });
  useWasteTrackedJob({
    lastJob,
    refreshTechnicalHistory,
    setLastJob,
  });

  return createWasteToolsControllerViewModel({
    importCatalog,
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    delimiterOverride,
    previewResult,
    previewReady,
    migrationSchema,
    migrationVersion,
    resetToken,
    resetConfirmOpen,
    runningAction,
    message,
    lastJob,
    technicalHistory,
    runDeleteHistoryEntry,
    selectedImportProfile,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
    setDelimiterOverride,
    setMigrationSchema,
    setMigrationVersion,
    setResetToken,
    setResetConfirmOpen,
    actions,
  });
};
