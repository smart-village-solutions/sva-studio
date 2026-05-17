import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { WasteToolsPanelBody } from './waste-management.tools-panel.body.js';
import { useWasteToolsController } from './waste-management.tools.controller.js';
import {
  createImportSelectionHandlers,
  WasteToolsResetDialog,
} from './waste-management.tools-panel.parts.js';
import type { WasteManagementUiAccess } from './waste-management.ui-access.js';

export const WasteToolsPanel = (props: {
  readonly access: WasteManagementUiAccess;
  readonly overview?: ReactNode;
}) => {
  const { access, overview } = props;
  const pt = usePluginTranslation('wasteManagement');
  const {
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
    runInitialize,
    runImport,
    runMigrations,
    runSeed,
    runReset,
  } = useWasteToolsController(pt);
  const importSelectionHandlers = createImportSelectionHandlers({
    importCatalog,
    selectedImportProfile,
    setImportProfileId,
    setImportSourceFormat,
    setImportBlobRef,
  });

  return (
    <>
      <WasteToolsPanelBody
        access={access}
        overview={overview}
        runningAction={runningAction}
        message={message}
        lastJob={lastJob}
        technicalHistory={technicalHistory}
        importCatalog={importCatalog}
        importProfileId={importProfileId}
        importSourceFormat={importSourceFormat}
        importBlobRef={importBlobRef}
        importDryRun={importDryRun}
        importSelectionHandlers={importSelectionHandlers}
        setImportBlobRef={setImportBlobRef}
        setImportDryRun={setImportDryRun}
        runImport={runImport}
        runInitialize={runInitialize}
        migrationSchema={migrationSchema}
        migrationVersion={migrationVersion}
        setMigrationSchema={setMigrationSchema}
        setMigrationVersion={setMigrationVersion}
        runMigrations={runMigrations}
        runSeed={runSeed}
        setResetConfirmOpen={setResetConfirmOpen}
      />
      <WasteToolsResetDialog
        open={resetConfirmOpen}
        token={resetToken}
        running={runningAction === 'reset'}
        onOpenChange={setResetConfirmOpen}
        onTokenChange={setResetToken}
        onConfirm={() => void runReset()}
      />
    </>
  );
};
