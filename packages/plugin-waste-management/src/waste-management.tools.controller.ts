import type { WasteManagementHistoryOverview } from '@sva/plugin-sdk';

import { getWasteManagementImportCatalog } from './waste-management.api.js';
import {
  createWasteToolsControllerViewModel,
  useWasteToolsControllerHelpers,
} from './waste-management.tools.actions.js';
import { useWasteTechnicalHistory } from './waste-management.tools.history-state.js';
import { useWasteImportState, useWasteMaintenanceState } from './waste-management.tools.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteToolsController = (pt: Translate) => {
  const importCatalog = getWasteManagementImportCatalog();
  const {
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
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
  const { selectedImportProfile, actions } = useWasteToolsControllerHelpers({
    pt,
    importCatalog,
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    migrationSchema,
    migrationVersion,
    resetToken,
    refreshTechnicalHistory,
    setImportSourceFormat,
    setResetConfirmOpen,
    setResetToken,
    setRunningAction,
    setMessage,
    setLastJob,
  });

  return createWasteToolsControllerViewModel({
    importCatalog,
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    migrationSchema,
    migrationVersion,
    resetToken,
    resetConfirmOpen,
    runningAction,
    message,
    lastJob,
    technicalHistory,
    selectedImportProfile,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
    setMigrationSchema,
    setMigrationVersion,
    setResetToken,
    setResetConfirmOpen,
    actions,
  });
};
