import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useId } from 'react';
import { Checkbox, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import type { StartWasteManagementImportInput } from './waste-management.api.js';
import { readFileAsDataUrl } from './waste-management.page.support.js';
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
  const selectedImportProfile =
    importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;
  const fileAccept =
    importSourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : '.csv,text/csv';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('tools.imports.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('tools.imports.description')}</p>
      </div>
      <StudioFieldGroup>
        <StudioField id="waste-tools-import-profile" label={pt('tools.imports.profileLabel')}>
          <Select value={importProfileId} onChange={(event) => onImportProfileIdChange(event.target.value)}>
            {importCatalog.map((profile) => (
              <option key={profile.profileId} value={profile.profileId}>
                {profile.displayName}
              </option>
            ))}
          </Select>
        </StudioField>
        <StudioField id="waste-tools-import-blob-ref" label={pt('tools.imports.blobRefLabel')}>
          <Input
            id={fileInputId}
            type="file"
            accept={fileAccept}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) {
                onImportBlobRefChange('');
                return;
              }

              void readFileAsDataUrl(file).then(onImportBlobRefChange, () => onImportBlobRefChange(''));
            }}
          />
        </StudioField>
        <StudioField id="waste-tools-import-source-format" label={pt('tools.imports.sourceFormatLabel')}>
          <Select
            aria-label={pt('tools.imports.sourceFormatLabel')}
            value={importSourceFormat}
            onChange={(event) => onImportSourceFormatChange(event.target.value as WasteManagementImportSourceFormat)}
          >
            {(selectedImportProfile?.sourceFormats ?? []).map((sourceFormat) => (
              <option key={sourceFormat} value={sourceFormat}>
                {sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  ? pt('tools.imports.sourceFormats.xlsx')
                  : pt('tools.imports.sourceFormats.csv')}
              </option>
            ))}
          </Select>
        </StudioField>
      </StudioFieldGroup>
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
