import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

import { downloadImportPreviewErrors, downloadImportTemplate } from './waste-management.page.support.js';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

export const WasteToolsImportProfileCard = ({
  profile,
  sourceFormat,
  running,
  importBlobRef,
  previewResult,
  previewReady,
  fileInputId,
  onRunPreview,
  onStartImport,
}: {
  readonly profile: ImportCatalogEntry | null;
  readonly sourceFormat: WasteManagementImportSourceFormat;
  readonly running: boolean;
  readonly importBlobRef: string;
  readonly previewResult: Awaited<ReturnType<typeof import('./waste-management.api.js').previewWasteLocationTourPickupDateImport>> | null;
  readonly previewReady: boolean;
  readonly fileInputId: string;
  readonly onRunPreview: () => void;
  readonly onStartImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!profile) {
    return null;
  }

  const requiresPreview = profile.profileId === 'waste-management.ortsbezogene-tourtermine';

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{profile.description}</p>
      {requiresPreview ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>{pt('tools.imports.previewHintStreet')}</p>
          <p>{pt('tools.imports.previewHintHouseNumbers')}</p>
          <p>{pt('tools.imports.previewHintDates')}</p>
        </div>
      ) : null}
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{pt('tools.imports.templateColumns')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {profile.requiredColumns.map((column) => (
          <Badge key={column.key} variant="secondary">
            {column.key}
          </Badge>
        ))}
        {profile.optionalColumns.map((column) => (
          <Badge key={column.key} variant="outline">
            {column.key}
          </Badge>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void downloadImportTemplate(profile, sourceFormat)}>
          {pt('tools.actions.downloadTemplate')}
        </Button>
        <Button type="button" variant="outline" onClick={() => document.getElementById(fileInputId)?.click()}>
          {pt('tools.imports.blobRefLabel')}
        </Button>
        {requiresPreview ? (
          <Button type="button" variant="outline" disabled={running || !importBlobRef.startsWith('data:')} onClick={onRunPreview}>
            {pt('tools.actions.previewImport')}
          </Button>
        ) : null}
        {requiresPreview && previewResult && previewResult.errors.length > 0 ? (
          <Button type="button" variant="outline" onClick={() => downloadImportPreviewErrors(previewResult)}>
            {pt('tools.actions.downloadErrorFile')}
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={running || !importBlobRef.startsWith('data:') || (requiresPreview && !previewReady)}
          onClick={onStartImport}
        >
          {running ? pt('tools.actions.starting') : pt('tools.actions.startImport')}
        </Button>
      </div>
      {requiresPreview && previewResult ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-background/80 p-3 text-sm">
          <p className="font-medium">{pt('tools.imports.previewTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {pt('tools.imports.previewSummary', {
              validRows: previewResult.validRowCount,
              invalidRows: previewResult.invalidRowCount,
              createdTours: previewResult.newTours.length,
              createdLocations: previewResult.summary.locations.created,
              createdAssignments: previewResult.summary.assignments.created,
            })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pt('tools.imports.previewDelimiter', {
              detected: previewResult.detectedDelimiter === '\t' ? 'Tab' : previewResult.detectedDelimiter,
              active: previewResult.delimiter === '\t' ? 'Tab' : previewResult.delimiter,
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
};
