import type { StudioJobResponse, WasteManagementHistoryOverview } from '@sva/plugin-sdk';

import {
  deleteWasteManagementHistoryJob,
  getWasteManagementImportCatalog,
  previewWasteLocationTourPickupDateImport,
  startWasteManagementInitialize,
  startWasteManagementImport,
  startWasteManagementMigrations,
  startWasteManagementReset,
  startWasteManagementSeed,
  type StartWasteManagementImportInput,
} from './waste-management.api.js';
import { compactOptionalString, type StatusMessage } from './waste-management.page.support.js';
import { createWasteToolErrorMessage } from './waste-management.tools.messages.js';
import { useWasteSelectedImportProfile } from './waste-management.tools.profile.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;
type Action = 'import' | 'migration' | 'seed' | 'reset';

export const createWasteToolsJobRunner = ({
  pt,
  refreshTechnicalHistory,
  setRunningAction,
  setMessage,
  setLastJob,
}: {
  readonly pt: Translate;
  readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
  readonly setRunningAction: (action: Action | null) => void;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => async (action: Action, callback: () => Promise<StudioJobResponse['data']>) => {
  setRunningAction(action);
  setMessage(null);
  try {
    const job = await callback();
    setLastJob(job);
    await refreshTechnicalHistory(true);
    setMessage({ kind: 'success', text: pt('tools.messages.jobStarted', { jobId: job.id }) });
    return job;
  } catch (error) {
    setMessage({
      kind: 'error',
      text: createWasteToolErrorMessage({ action, error, pt }),
    });
    return null;
  } finally {
    setRunningAction(null);
  }
};

export const createWasteToolsHistoryDeletionRunner = ({
  pt,
  refreshTechnicalHistory,
  setMessage,
  setLastJob,
}: {
  readonly pt: Translate;
  readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
}) => async (jobId: string, currentLastJobId?: string) => {
  setMessage(null);
  try {
    await deleteWasteManagementHistoryJob(jobId);
    if (currentLastJobId === jobId) {
      setLastJob(null);
    }
    await refreshTechnicalHistory(true);
    setMessage({ kind: 'success', text: pt('tools.messages.historyDeleteSuccess') });
    return true;
  } catch (error) {
    setMessage({
      kind: 'error',
      text: createWasteToolErrorMessage({ action: 'import', error, pt }),
    });
    return false;
  }
};

export const createWasteToolsActions = ({
  pt,
  runJob,
  importProfileId,
  importSourceFormat,
  importBlobRef,
  importDryRun,
  delimiterOverride,
  setPreviewResult,
  setPreviewReady,
  setMessage,
  migrationSchema,
  migrationVersion,
  resetToken,
  setResetConfirmOpen,
  setResetToken,
}: {
  readonly pt: Translate;
  readonly runJob: (
    action: Action,
    callback: () => Promise<StudioJobResponse['data']>
  ) => Promise<StudioJobResponse['data'] | null>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride: StartWasteManagementImportInput['delimiterOverride'];
  readonly setPreviewResult: (value: Awaited<ReturnType<typeof previewWasteLocationTourPickupDateImport>> | null) => void;
  readonly setPreviewReady: (value: boolean) => void;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly setResetConfirmOpen: (open: boolean) => void;
  readonly setResetToken: (value: string) => void;
}) => ({
  runPreview: async () => {
    if (importProfileId !== 'waste-management.ortsbezogene-tourtermine' || importSourceFormat !== 'text/csv') {
      return null;
    }
    try {
      setMessage(null);
      const preview = await previewWasteLocationTourPickupDateImport({
        importProfileId: 'waste-management.ortsbezogene-tourtermine',
        sourceFormat: 'text/csv',
        blobRef: importBlobRef.trim(),
        delimiterOverride,
      });
      setPreviewResult(preview);
      setPreviewReady(true);
      setMessage({ kind: 'success', text: pt('tools.messages.previewReady') });
      return preview;
    } catch (error) {
      setPreviewResult(null);
      setPreviewReady(false);
      setMessage({
        kind: 'error',
        text: createWasteToolErrorMessage({ action: 'import', error, pt }),
      });
      return null;
    }
  },
  runImport: () =>
    runJob('import', () =>
      startWasteManagementImport({
        importProfileId,
        sourceFormat: importSourceFormat,
        blobRef: importBlobRef.trim(),
        dryRun: importDryRun,
        delimiterOverride,
      } satisfies StartWasteManagementImportInput)
    ),
  runInitialize: () =>
    runJob('migration', () =>
      startWasteManagementInitialize({
        targetSchema: compactOptionalString(migrationSchema),
      })
    ),
  runMigrations: () =>
    runJob('migration', () =>
      startWasteManagementMigrations({
        targetSchema: compactOptionalString(migrationSchema),
        requestedByVersion: compactOptionalString(migrationVersion),
      })
    ),
  runSeed: () => runJob('seed', () => startWasteManagementSeed()),
  runReset: () =>
    runJob('reset', async () => {
      const job = await startWasteManagementReset({
        confirmationToken: resetToken.trim(),
      });
      setResetConfirmOpen(false);
      setResetToken('');
      return job;
    }),
});

export const useWasteToolsControllerHelpers = ({
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
}: {
  readonly pt: Translate;
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride: StartWasteManagementImportInput['delimiterOverride'];
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
  readonly setImportSourceFormat: (sourceFormat: StartWasteManagementImportInput['sourceFormat']) => void;
  readonly setPreviewResult: (value: Awaited<ReturnType<typeof previewWasteLocationTourPickupDateImport>> | null) => void;
  readonly setPreviewReady: (value: boolean) => void;
  readonly setResetConfirmOpen: (open: boolean) => void;
  readonly setResetToken: (value: string) => void;
  readonly setRunningAction: (action: Action | null) => void;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
  readonly lastJob: StudioJobResponse['data'] | null;
}) => {
  const selectedImportProfile = useWasteSelectedImportProfile({
    importCatalog,
    importProfileId,
    importSourceFormat,
    setImportSourceFormat,
  });
  const runJob = createWasteToolsJobRunner({
    pt,
    refreshTechnicalHistory,
    setRunningAction,
    setMessage,
    setLastJob,
  });
  const runDeleteHistoryEntry = createWasteToolsHistoryDeletionRunner({
    pt,
    refreshTechnicalHistory,
    setMessage,
    setLastJob,
  });

  return {
    selectedImportProfile,
    actions: createWasteToolsActions({
      pt,
      runJob,
      importProfileId,
      importSourceFormat,
      importBlobRef,
      importDryRun,
      delimiterOverride,
      setPreviewResult,
      setPreviewReady,
      setMessage,
      migrationSchema,
      migrationVersion,
      resetToken,
      setResetConfirmOpen,
      setResetToken,
    }),
    runDeleteHistoryEntry: (jobId: string) => runDeleteHistoryEntry(jobId, lastJob?.id),
  };
};

export const createWasteToolsControllerViewModel = <TActions extends Record<string, unknown>>(input: {
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride: StartWasteManagementImportInput['delimiterOverride'];
  readonly previewResult: Awaited<ReturnType<typeof previewWasteLocationTourPickupDateImport>> | null;
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
  readonly setImportProfileId: (value: StartWasteManagementImportInput['importProfileId'] | '') => void;
  readonly setImportSourceFormat: (value: StartWasteManagementImportInput['sourceFormat']) => void;
  readonly setImportBlobRef: (value: string) => void;
  readonly setImportDryRun: (value: boolean) => void;
  readonly setDelimiterOverride: (value: StartWasteManagementImportInput['delimiterOverride']) => void;
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
