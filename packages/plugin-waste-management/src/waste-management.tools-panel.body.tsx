import type { ReactNode } from 'react';

import { StatusNotice } from './waste-management.page.support.js';
import { WasteToolsAdvancedSection } from './waste-management.tools.advanced-section.js';
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
  readonly runDeleteHistoryEntry: ReturnType<typeof useWasteToolsController>['runDeleteHistoryEntry'];
  readonly importCatalog: ReturnType<typeof useWasteToolsController>['importCatalog'];
  readonly importProfileId: ReturnType<typeof useWasteToolsController>['importProfileId'];
  readonly importSourceFormat: ReturnType<typeof useWasteToolsController>['importSourceFormat'];
  readonly importBlobRef: ReturnType<typeof useWasteToolsController>['importBlobRef'];
  readonly importDryRun: ReturnType<typeof useWasteToolsController>['importDryRun'];
  readonly delimiterOverride: ReturnType<typeof useWasteToolsController>['delimiterOverride'];
  readonly previewResult: ReturnType<typeof useWasteToolsController>['previewResult'];
  readonly previewReady: ReturnType<typeof useWasteToolsController>['previewReady'];
  readonly importSelectionHandlers: ReturnType<typeof createImportSelectionHandlers>;
  readonly setImportBlobRef: ReturnType<typeof useWasteToolsController>['setImportBlobRef'];
  readonly setImportDryRun: ReturnType<typeof useWasteToolsController>['setImportDryRun'];
  readonly setDelimiterOverride: ReturnType<typeof useWasteToolsController>['setDelimiterOverride'];
  readonly runPreview: ReturnType<typeof useWasteToolsController>['runPreview'];
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
        delimiterOverride={props.delimiterOverride}
        previewResult={props.previewResult}
        previewReady={props.previewReady}
        running={props.runningAction !== null}
        lastJob={props.lastJob}
        onImportProfileIdChange={props.importSelectionHandlers.onImportProfileIdChange}
        onImportSourceFormatChange={props.importSelectionHandlers.onImportSourceFormatChange}
        onImportBlobRefChange={props.setImportBlobRef}
        onImportDryRunChange={props.setImportDryRun}
        onDelimiterOverrideChange={props.setDelimiterOverride}
        onRunPreview={props.runPreview}
        onStartImport={props.runImport}
      />
    ) : null}
    <WasteToolsHistory
      lastJob={props.lastJob}
      technicalHistory={props.technicalHistory}
      canDeleteHistoryEntries={props.access.canDeleteHistoryEntries}
      onDeleteEntry={(jobId) => void props.runDeleteHistoryEntry(jobId)}
    />
    <WasteToolsAdvancedSection
      canRunInitialize={props.access.canRunInitialize}
      canRunMigrations={props.access.canRunMigrations}
      canRunSeed={props.access.canRunSeed}
      canRunReset={props.access.canRunReset}
      initializeSection={
        <WasteToolsInitializeSection
          canRunInitialize={props.access.canRunInitialize}
          running={props.runningAction !== null}
          onStart={() => void props.runInitialize()}
        />
      }
      actionsSection={
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
      }
      technicalDetails={props.overview ?? null}
    />
  </div>
);
