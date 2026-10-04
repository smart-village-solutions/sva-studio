import type { StudioJobResponse } from '@sva/plugin-sdk';

import {
  getWasteManagementImportCatalog,
  previewWasteLocationTourPickupDateImport,
  startWasteManagementInitialize,
  startWasteManagementImport,
  startWasteManagementExport,
  startWasteManagementMigrations,
  startWasteManagementPostalCodeEnrichment,
  startWasteManagementReset,
  startWasteManagementSeed,
  type StartWasteManagementImportInput,
  type StartWasteManagementExportInput,
} from './waste-management.api.js';
import { compactOptionalString, type StatusMessage } from './waste-management.page.support.js';
import { createWasteToolErrorMessage } from './waste-management.tools.messages.js';
import { useWasteSelectedImportProfile } from './waste-management.tools.profile.js';

import {
  createWasteToolsJobRunner,
  createWasteToolsHistoryDeletionRunner,
} from './waste-management.tools.job-runners.js';
import type { Action, Translate } from './waste-management.tools.job-runners.js';

export {
  createWasteToolsJobRunner,
  createWasteToolsHistoryDeletionRunner,
} from './waste-management.tools.job-runners.js';

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
  readonly setPreviewResult: (
    value: Awaited<ReturnType<typeof previewWasteLocationTourPickupDateImport>> | null
  ) => void;
  readonly setPreviewReady: (value: boolean) => void;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly setResetConfirmOpen: (open: boolean) => void;
  readonly setResetToken: (value: string) => void;
}) => ({
  runExport: (input: StartWasteManagementExportInput) =>
    runJob('export', () => startWasteManagementExport(input)),
  runPreview: async () => {
    if (
      importProfileId !== 'waste-management.ortsbezogene-tourtermine' ||
      importSourceFormat !== 'text/csv'
    ) {
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
  runPostalCodeEnrichment: () =>
    runJob('postalCode', () => startWasteManagementPostalCodeEnrichment()),
  runReset: async () => {
    const job = await runJob('reset', () =>
      startWasteManagementReset({
        confirmationToken: resetToken.trim(),
      })
    );
    setResetConfirmOpen(false);
    if (job) {
      setResetToken('');
    }
    return job;
  },
});

export const useWasteToolsViewModelHelpers = ({
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
  readonly setImportSourceFormat: (
    sourceFormat: StartWasteManagementImportInput['sourceFormat']
  ) => void;
  readonly setPreviewResult: (
    value: Awaited<ReturnType<typeof previewWasteLocationTourPickupDateImport>> | null
  ) => void;
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

export { createWasteToolsViewModel } from './waste-management.tools.view-model-builder.js';
