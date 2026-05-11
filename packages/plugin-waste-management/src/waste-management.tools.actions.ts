import type { StudioJobResponse, WasteManagementHistoryOverview } from '@sva/plugin-sdk';

import {
  getWasteManagementImportCatalog,
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
  } catch (error) {
    setMessage({
      kind: 'error',
      text: createWasteToolErrorMessage({ action, error, pt }),
    });
  } finally {
    setRunningAction(null);
  }
};

export const createWasteToolsActions = ({
  runJob,
  importProfileId,
  importSourceFormat,
  importBlobRef,
  importDryRun,
  migrationSchema,
  migrationVersion,
  resetToken,
  setResetConfirmOpen,
  setResetToken,
}: {
  readonly runJob: (action: Action, callback: () => Promise<StudioJobResponse['data']>) => Promise<void>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly setResetConfirmOpen: (open: boolean) => void;
  readonly setResetToken: (value: string) => void;
}) => ({
  runImport: () =>
    runJob('import', () =>
      startWasteManagementImport({
        importProfileId,
        sourceFormat: importSourceFormat,
        blobRef: importBlobRef.trim(),
        dryRun: importDryRun,
      } satisfies StartWasteManagementImportInput)
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
}: {
  readonly pt: Translate;
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly refreshTechnicalHistory: (active?: boolean) => Promise<void>;
  readonly setImportSourceFormat: (sourceFormat: StartWasteManagementImportInput['sourceFormat']) => void;
  readonly setResetConfirmOpen: (open: boolean) => void;
  readonly setResetToken: (value: string) => void;
  readonly setRunningAction: (action: Action | null) => void;
  readonly setMessage: (message: StatusMessage | null) => void;
  readonly setLastJob: (job: StudioJobResponse['data'] | null) => void;
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

  return {
    selectedImportProfile,
    actions: createWasteToolsActions({
      runJob,
      importProfileId,
      importSourceFormat,
      importBlobRef,
      importDryRun,
      migrationSchema,
      migrationVersion,
      resetToken,
      setResetConfirmOpen,
      setResetToken,
    }),
  };
};

export const createWasteToolsControllerViewModel = <TActions extends Record<string, unknown>>(input: {
  readonly importCatalog: ReturnType<typeof getWasteManagementImportCatalog>;
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly migrationSchema: string;
  readonly migrationVersion: string;
  readonly resetToken: string;
  readonly resetConfirmOpen: boolean;
  readonly runningAction: Action | null;
  readonly message: StatusMessage | null;
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly technicalHistory: readonly WasteManagementHistoryOverview['technical']['items'][number][];
  readonly selectedImportProfile: ReturnType<typeof getWasteManagementImportCatalog>[number] | null;
  readonly setImportProfileId: (value: StartWasteManagementImportInput['importProfileId'] | '') => void;
  readonly setImportSourceFormat: (value: StartWasteManagementImportInput['sourceFormat']) => void;
  readonly setImportBlobRef: (value: string) => void;
  readonly setImportDryRun: (value: boolean) => void;
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
  migrationSchema: input.migrationSchema,
  migrationVersion: input.migrationVersion,
  resetToken: input.resetToken,
  resetConfirmOpen: input.resetConfirmOpen,
  runningAction: input.runningAction,
  message: input.message,
  lastJob: input.lastJob,
  technicalHistory: input.technicalHistory,
  selectedImportProfile: input.selectedImportProfile,
  setImportProfileId: input.setImportProfileId,
  setImportSourceFormat: input.setImportSourceFormat,
  setImportBlobRef: input.setImportBlobRef,
  setImportDryRun: input.setImportDryRun,
  setMigrationSchema: input.setMigrationSchema,
  setMigrationVersion: input.setMigrationVersion,
  setResetToken: input.setResetToken,
  setResetConfirmOpen: input.setResetConfirmOpen,
  ...input.actions,
});
