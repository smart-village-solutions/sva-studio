import type { StudioJobResponse, WasteManagementHistoryOverview } from '@sva/core';
import { useEffect, useState } from 'react';

import {
  getWasteManagementImportCatalog,
  startWasteManagementImport,
  startWasteManagementMigrations,
  startWasteManagementReset,
  startWasteManagementSeed,
  type StartWasteManagementImportInput,
} from './waste-management.api.js';
import { compactOptionalString, type StatusMessage } from './waste-management.page.support.js';
import { useWasteTechnicalHistory } from './waste-management.tools.history-state.js';
import { createWasteToolErrorMessage } from './waste-management.tools.messages.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const useWasteImportState = (importCatalog: ReturnType<typeof getWasteManagementImportCatalog>) => {
  const [importProfileId, setImportProfileId] = useState<StartWasteManagementImportInput['importProfileId'] | ''>(
    importCatalog[0]?.profileId ?? ''
  );
  const [importSourceFormat, setImportSourceFormat] = useState<StartWasteManagementImportInput['sourceFormat']>(
    importCatalog[0]?.sourceFormats[0] ?? 'text/csv'
  );
  const [importBlobRef, setImportBlobRef] = useState('');
  const [importDryRun, setImportDryRun] = useState(true);

  return {
    importProfileId,
    importSourceFormat,
    importBlobRef,
    importDryRun,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
    setImportDryRun,
  };
};

const useWasteMaintenanceState = () => {
  const [migrationSchema, setMigrationSchema] = useState('public');
  const [migrationVersion, setMigrationVersion] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [runningAction, setRunningAction] = useState<'import' | 'migration' | 'seed' | 'reset' | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [lastJob, setLastJob] = useState<StudioJobResponse['data'] | null>(null);

  return {
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
  };
};

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

  const selectedImportProfile =
    importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;

  useEffect(() => {
    if (!selectedImportProfile) {
      return;
    }
    if (!selectedImportProfile.sourceFormats.includes(importSourceFormat)) {
      setImportSourceFormat(selectedImportProfile.sourceFormats[0] ?? 'text/csv');
    }
  }, [importSourceFormat, selectedImportProfile]);

  const runJob = async (
    action: 'import' | 'migration' | 'seed' | 'reset',
    callback: () => Promise<StudioJobResponse['data']>
  ) => {
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

  return {
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
  };
};
