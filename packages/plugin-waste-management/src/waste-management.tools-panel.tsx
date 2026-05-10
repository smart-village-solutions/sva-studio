import type { StudioJobResponse, WasteManagementHistoryOverview, WasteManagementImportSourceFormat } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ResetConfirmationDialog,
  StatusNotice,
} from './waste-management.page.support.js';
import { useWasteToolsController } from './waste-management.tools.controller.js';
import { WasteToolsActionsSection } from './waste-management.tools.actions-section.js';
import { WasteToolsHistory } from './waste-management.tools.history.js';
import { WasteToolsImportSection } from './waste-management.tools.import-section.js';

export const WasteToolsPanel = () => {
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
    runImport,
    runMigrations,
    runSeed,
    runReset,
  } = useWasteToolsController(pt);

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={message} />
        <WasteToolsImportSection
          importCatalog={importCatalog}
          importProfileId={importProfileId}
          importSourceFormat={importSourceFormat}
          importBlobRef={importBlobRef}
          importDryRun={importDryRun}
          running={runningAction !== null}
          onImportProfileIdChange={(nextProfileId) => {
            const matchingProfile = importCatalog.find((profile) => profile.profileId === nextProfileId);
            if (matchingProfile) {
              setImportProfileId(matchingProfile.profileId);
            }
          }}
          onImportSourceFormatChange={(nextSourceFormat) => {
            if (selectedImportProfile?.sourceFormats.includes(nextSourceFormat)) {
              setImportSourceFormat(nextSourceFormat);
            }
          }}
          onImportBlobRefChange={setImportBlobRef}
          onImportDryRunChange={setImportDryRun}
          onStartImport={() => void runImport()}
        />
        <WasteToolsActionsSection
          migrationSchema={migrationSchema}
          migrationVersion={migrationVersion}
          runningAction={runningAction}
          onMigrationSchemaChange={setMigrationSchema}
          onMigrationVersionChange={setMigrationVersion}
          onStartMigrations={() => void runMigrations()}
          onStartSeed={() => void runSeed()}
          onOpenReset={() => setResetConfirmOpen(true)}
        />
        <WasteToolsHistory lastJob={lastJob} technicalHistory={technicalHistory} />
      </div>
      <ResetConfirmationDialog
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
