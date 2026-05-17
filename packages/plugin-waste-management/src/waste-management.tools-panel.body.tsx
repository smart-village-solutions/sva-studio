import type { ReactNode } from 'react';

import { StatusNotice } from './waste-management.page.support.js';
import { WasteToolsActionsSection } from './waste-management.tools.actions-section.js';
import { WasteToolsHistory } from './waste-management.tools.history.js';
import { WasteToolsImportSection } from './waste-management.tools.import-section.js';
import { createImportSelectionHandlers, WasteToolsInitializeSection } from './waste-management.tools-panel.parts.js';
import type { useWasteToolsController } from './waste-management.tools.controller.js';
import type { WasteManagementUiAccess } from './waste-management.ui-access.js';

type WasteToolsPanelBodyProps = {
  readonly access: WasteManagementUiAccess;
  readonly overview?: ReactNode;
  readonly runningAction: ReturnType<typeof useWasteToolsController>['runningAction'];
  readonly message: ReturnType<typeof useWasteToolsController>['message'];
  readonly lastJob: ReturnType<typeof useWasteToolsController>['lastJob'];
  readonly technicalHistory: ReturnType<typeof useWasteToolsController>['technicalHistory'];
  readonly importCatalog: ReturnType<typeof useWasteToolsController>['importCatalog'];
  readonly importProfileId: ReturnType<typeof useWasteToolsController>['importProfileId'];
  readonly importSourceFormat: ReturnType<typeof useWasteToolsController>['importSourceFormat'];
  readonly importBlobRef: ReturnType<typeof useWasteToolsController>['importBlobRef'];
  readonly importDryRun: ReturnType<typeof useWasteToolsController>['importDryRun'];
  readonly importSelectionHandlers: ReturnType<typeof createImportSelectionHandlers>;
  readonly setImportBlobRef: ReturnType<typeof useWasteToolsController>['setImportBlobRef'];
  readonly setImportDryRun: ReturnType<typeof useWasteToolsController>['setImportDryRun'];
  readonly runImport: ReturnType<typeof useWasteToolsController>['runImport'];
  readonly runInitialize: ReturnType<typeof useWasteToolsController>['runInitialize'];
  readonly migrationSchema: ReturnType<typeof useWasteToolsController>['migrationSchema'];
  readonly migrationVersion: ReturnType<typeof useWasteToolsController>['migrationVersion'];
  readonly setMigrationSchema: ReturnType<typeof useWasteToolsController>['setMigrationSchema'];
  readonly setMigrationVersion: ReturnType<typeof useWasteToolsController>['setMigrationVersion'];
  readonly runMigrations: ReturnType<typeof useWasteToolsController>['runMigrations'];
  readonly runSeed: ReturnType<typeof useWasteToolsController>['runSeed'];
  readonly setResetConfirmOpen: ReturnType<typeof useWasteToolsController>['setResetConfirmOpen'];
};

export const WasteToolsPanelBody = (props: WasteToolsPanelBodyProps) => (
  <div className="space-y-4">
    <StatusNotice message={props.message} />
    {props.access.canRunImport ? (
      <WasteToolsImportSection
        importCatalog={props.importCatalog}
        importProfileId={props.importProfileId}
        importSourceFormat={props.importSourceFormat}
        importBlobRef={props.importBlobRef}
        importDryRun={props.importDryRun}
        running={props.runningAction !== null}
        onImportProfileIdChange={props.importSelectionHandlers.onImportProfileIdChange}
        onImportSourceFormatChange={props.importSelectionHandlers.onImportSourceFormatChange}
        onImportBlobRefChange={props.setImportBlobRef}
        onImportDryRunChange={props.setImportDryRun}
        onStartImport={() => void props.runImport()}
      />
    ) : null}
    <WasteToolsInitializeSection
      canRunInitialize={props.access.canRunInitialize}
      running={props.runningAction !== null}
      onStart={() => void props.runInitialize()}
    />
    <WasteToolsActionsSection
      canRunMigrations={props.access.canRunMigrations}
      canRunSeed={props.access.canRunSeed}
      canRunReset={props.access.canRunReset}
      migrationSchema={props.migrationSchema}
      migrationVersion={props.migrationVersion}
      runningAction={props.runningAction}
      onMigrationSchemaChange={props.setMigrationSchema}
      onMigrationVersionChange={props.setMigrationVersion}
      onStartMigrations={() => void props.runMigrations()}
      onStartSeed={() => void props.runSeed()}
      onOpenReset={() => props.setResetConfirmOpen(true)}
    />
    <WasteToolsHistory lastJob={props.lastJob} technicalHistory={props.technicalHistory} />
    {props.overview ?? null}
  </div>
);
