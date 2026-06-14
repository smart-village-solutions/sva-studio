import { getWasteManagementImportCatalog } from './waste-management.api.js';
import {
  createWasteToolsViewModel,
  useWasteToolsViewModelHelpers,
} from './waste-management.tools.actions.js';
import { useWasteTechnicalHistory } from './waste-management.tools.history-state.js';
import { useWasteTrackedJob } from './waste-management.tools.job-state.js';
import { useWasteImportState, useWasteMaintenanceState } from './use-waste-tools-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const useWasteToolStateBundles = () => {
  const importCatalog = getWasteManagementImportCatalog();
  const importState = useWasteImportState(importCatalog);
  const maintenanceState = useWasteMaintenanceState();
  const technicalHistoryState = useWasteTechnicalHistory();

  return {
    importCatalog,
    importState,
    maintenanceState,
    technicalHistoryState,
  };
};

const createWasteToolsViewModelFromState = (input: {
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importState: ReturnType<typeof useWasteImportState>;
  readonly maintenanceState: ReturnType<typeof useWasteMaintenanceState>;
  readonly technicalHistory: ReturnType<typeof useWasteTechnicalHistory>['technicalHistory'];
  readonly selectedImportProfile: ReturnType<typeof useWasteToolsViewModelHelpers>['selectedImportProfile'];
  readonly actions: ReturnType<typeof useWasteToolsViewModelHelpers>['actions'];
  readonly runDeleteHistoryEntry: ReturnType<typeof useWasteToolsViewModelHelpers>['runDeleteHistoryEntry'];
}) => {
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
  } = input.importState;
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
  } = input.maintenanceState;

  return createWasteToolsViewModel({
    importCatalog: input.importCatalog,
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
    technicalHistory: input.technicalHistory,
    runDeleteHistoryEntry: input.runDeleteHistoryEntry,
    selectedImportProfile: input.selectedImportProfile,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
    setDelimiterOverride,
    setMigrationSchema,
    setMigrationVersion,
    setResetToken,
    setResetConfirmOpen,
    actions: input.actions,
  });
};

export const useWasteToolsViewModel = (pt: Translate) => {
  const { importCatalog, importState, maintenanceState, technicalHistoryState } = useWasteToolStateBundles();
  const { setImportSourceFormat, setPreviewResult, setPreviewReady } = importState;
  const {
    migrationSchema,
    migrationVersion,
    resetToken,
    setResetToken,
    setResetConfirmOpen,
    setRunningAction,
    setMessage,
    lastJob,
    setLastJob,
  } = maintenanceState;
  const { technicalHistory, refreshTechnicalHistory } = technicalHistoryState;
  const { selectedImportProfile, actions, runDeleteHistoryEntry } = useWasteToolsViewModelHelpers({
    pt,
    importCatalog,
    importProfileId: importState.importProfileId,
    importSourceFormat: importState.importSourceFormat,
    importBlobRef: importState.importBlobRef,
    importDryRun: importState.importDryRun,
    delimiterOverride: importState.delimiterOverride,
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

  return createWasteToolsViewModelFromState({
    importCatalog,
    importState,
    maintenanceState,
    technicalHistory,
    selectedImportProfile,
    actions,
    runDeleteHistoryEntry,
  });
};
