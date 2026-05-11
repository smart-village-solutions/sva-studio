import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

import { downloadImportTemplate } from './waste-management.page.support.js';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

export const WasteToolsImportProfileCard = ({
  profile,
  sourceFormat,
  running,
  importBlobRef,
  fileInputId,
  onStartImport,
}: {
  readonly profile: ImportCatalogEntry | null;
  readonly sourceFormat: WasteManagementImportSourceFormat;
  readonly running: boolean;
  readonly importBlobRef: string;
  readonly fileInputId: string;
  readonly onStartImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!profile) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{profile.description}</p>
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
        <Button type="button" variant="outline" onClick={() => downloadImportTemplate(profile, sourceFormat)}>
          {pt('tools.actions.downloadTemplate')}
        </Button>
        <Button type="button" variant="outline" onClick={() => document.getElementById(fileInputId)?.click()}>
          {pt('tools.imports.blobRefLabel')}
        </Button>
        <Button type="button" disabled={running || !importBlobRef.startsWith('data:')} onClick={onStartImport}>
          {running ? pt('tools.actions.starting') : pt('tools.actions.startImport')}
        </Button>
      </div>
    </div>
  );
};
