import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { ResetConfirmationDialog, StatusNotice } from './waste-management.page.support.js';
import { useWasteToolsController } from './waste-management.tools.controller.js';
import { WasteToolsActionsSection } from './waste-management.tools.actions-section.js';
import { WasteToolsHistory } from './waste-management.tools.history.js';
import { WasteToolsImportSection } from './waste-management.tools.import-section.js';
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

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={message} />
        {access.canRunImport ? (
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
                setImportSourceFormat(matchingProfile.sourceFormats[0] ?? 'text/csv');
                setImportBlobRef('');
              }
            }}
            onImportSourceFormatChange={(nextSourceFormat) => {
              if (selectedImportProfile?.sourceFormats.includes(nextSourceFormat)) {
                setImportSourceFormat(nextSourceFormat);
                setImportBlobRef('');
              }
            }}
            onImportBlobRefChange={setImportBlobRef}
            onImportDryRunChange={setImportDryRun}
            onStartImport={() => void runImport()}
          />
        ) : null}
        {access.canRunInitialize ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{pt('audit.dataSourceInitialized')}</h3>
            </div>
            <Button type="button" variant="outline" disabled={runningAction !== null} onClick={() => void runInitialize()}>
              {runningAction === 'migration' ? pt('tools.actions.starting') : pt('audit.dataSourceInitialized')}
            </Button>
          </div>
        ) : null}
        <WasteToolsActionsSection
          canRunMigrations={access.canRunMigrations}
          canRunSeed={access.canRunSeed}
          canRunReset={access.canRunReset}
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
        {overview ?? null}
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
