import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useId } from 'react';
import { Checkbox } from '@sva/studio-ui-react';

import type { StartWasteManagementImportInput } from './waste-management.api.js';
import { readFileAsDataUrl } from './waste-management.page.support.js';
import {
  createImportFileChangeHandler,
  resolveImportFileAccept,
  resolveSelectedImportProfile,
  WasteToolsImportFields,
} from './waste-management.tools.import-section.parts.js';
import { WasteToolsImportProfileCard } from './waste-management.tools.import-profile-card.js';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

export const WasteToolsImportSection = ({
  importCatalog,
  importProfileId,
  importSourceFormat,
  importBlobRef,
  importDryRun,
  running,
  onImportProfileIdChange,
  onImportSourceFormatChange,
  onImportBlobRefChange,
  onImportDryRunChange,
  onStartImport,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly running: boolean;
  readonly onImportProfileIdChange: (value: StartWasteManagementImportInput['importProfileId']) => void;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportBlobRefChange: (value: string) => void;
  readonly onImportDryRunChange: (value: boolean) => void;
  readonly onStartImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const fileInputId = useId();
  const selectedImportProfile = resolveSelectedImportProfile(importCatalog, importProfileId);
  const fileAccept = resolveImportFileAccept(importSourceFormat);
  const handleImportFileChange = createImportFileChangeHandler({ onImportBlobRefChange, readFileAsDataUrl });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('tools.imports.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('tools.imports.description')}</p>
      </div>
      <WasteToolsImportFields
        importCatalog={importCatalog}
        importProfileId={importProfileId}
        importSourceFormat={importSourceFormat}
        fileInputId={fileInputId}
        fileAccept={fileAccept}
        selectedImportProfile={selectedImportProfile}
        onImportProfileIdChange={onImportProfileIdChange}
        onImportSourceFormatChange={onImportSourceFormatChange}
        onImportFileChange={handleImportFileChange}
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={importDryRun} onChange={(event) => onImportDryRunChange(event.currentTarget.checked)} />
        <span>{pt('tools.imports.dryRunLabel')}</span>
      </label>
      <WasteToolsImportProfileCard
        profile={selectedImportProfile}
        sourceFormat={importSourceFormat}
        running={running}
        importBlobRef={importBlobRef}
        fileInputId={fileInputId}
        onStartImport={onStartImport}
      />
    </div>
  );
};
