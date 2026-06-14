import type { ReactNode } from 'react';

import { StatusNotice } from './waste-management.page.support.js';
import { WasteToolsAdvancedSection } from './waste-management.tools.advanced-section.js';
import { WasteToolsActionsSection } from './waste-management.tools.actions-section.js';
import { WasteToolsHistory } from './waste-management.tools.history.js';
import { WasteToolsImportSection } from './waste-management.tools.import-section.js';
import { createImportSelectionHandlers, WasteToolsInitializeSection } from './waste-management.tools-panel.parts.js';
import type { useWasteToolsViewModel } from './use-waste-tools-view-model.js';
import type { WasteManagementUiAccess } from './waste-management.ui-access.js';

type WasteToolsPanelBodyProps = {
  readonly access: WasteManagementUiAccess;
  readonly overview?: ReactNode;
  readonly runningAction: ReturnType<typeof useWasteToolsViewModel>['runningAction'];
  readonly message: ReturnType<typeof useWasteToolsViewModel>['message'];
  readonly lastJob: ReturnType<typeof useWasteToolsViewModel>['lastJob'];
  readonly technicalHistory: ReturnType<typeof useWasteToolsViewModel>['technicalHistory'];
  readonly runDeleteHistoryEntry: ReturnType<typeof useWasteToolsViewModel>['runDeleteHistoryEntry'];
  readonly importCatalog: ReturnType<typeof useWasteToolsViewModel>['importCatalog'];
  readonly importProfileId: ReturnType<typeof useWasteToolsViewModel>['importProfileId'];
  readonly importSourceFormat: ReturnType<typeof useWasteToolsViewModel>['importSourceFormat'];
  readonly importBlobRef: ReturnType<typeof useWasteToolsViewModel>['importBlobRef'];
  readonly importDryRun: ReturnType<typeof useWasteToolsViewModel>['importDryRun'];
  readonly delimiterOverride: ReturnType<typeof useWasteToolsViewModel>['delimiterOverride'];
  readonly previewResult: ReturnType<typeof useWasteToolsViewModel>['previewResult'];
  readonly previewReady: ReturnType<typeof useWasteToolsViewModel>['previewReady'];
  readonly importSelectionHandlers: ReturnType<typeof createImportSelectionHandlers>;
  readonly setImportBlobRef: ReturnType<typeof useWasteToolsViewModel>['setImportBlobRef'];
  readonly setImportDryRun: ReturnType<typeof useWasteToolsViewModel>['setImportDryRun'];
  readonly setDelimiterOverride: ReturnType<typeof useWasteToolsViewModel>['setDelimiterOverride'];
  readonly runPreview: ReturnType<typeof useWasteToolsViewModel>['runPreview'];
  readonly runImport: ReturnType<typeof useWasteToolsViewModel>['runImport'];
  readonly runInitialize: ReturnType<typeof useWasteToolsViewModel>['runInitialize'];
  readonly migrationSchema: ReturnType<typeof useWasteToolsViewModel>['migrationSchema'];
  readonly migrationVersion: ReturnType<typeof useWasteToolsViewModel>['migrationVersion'];
  readonly setMigrationSchema: ReturnType<typeof useWasteToolsViewModel>['setMigrationSchema'];
  readonly setMigrationVersion: ReturnType<typeof useWasteToolsViewModel>['setMigrationVersion'];
  readonly runMigrations: ReturnType<typeof useWasteToolsViewModel>['runMigrations'];
  readonly runSeed: ReturnType<typeof useWasteToolsViewModel>['runSeed'];
  readonly setResetConfirmOpen: ReturnType<typeof useWasteToolsViewModel>['setResetConfirmOpen'];
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
