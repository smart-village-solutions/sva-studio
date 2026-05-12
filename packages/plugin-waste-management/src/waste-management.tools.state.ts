import type { StudioJobResponse } from '@sva/plugin-sdk';
import { useState } from 'react';

import { getWasteManagementImportCatalog, type StartWasteManagementImportInput } from './waste-management.api.js';
import type { StatusMessage } from './waste-management.page.support.js';

export const useWasteImportState = (importCatalog: ReturnType<typeof getWasteManagementImportCatalog>) => {
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

export const useWasteMaintenanceState = () => {
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
