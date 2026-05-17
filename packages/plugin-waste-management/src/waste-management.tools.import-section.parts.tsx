import type { ChangeEvent } from 'react';
import type { WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

export const resolveSelectedImportProfile = (
  importCatalog: readonly ImportCatalogEntry[],
  importProfileId: string
) => importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;

export const resolveImportFileAccept = (importSourceFormat: WasteManagementImportSourceFormat) =>
  importSourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : '.csv,text/csv';

export const createImportFileChangeHandler = ({
  onImportBlobRefChange,
  readFileAsDataUrl,
}: {
  readonly onImportBlobRefChange: (value: string) => void;
  readonly readFileAsDataUrl: (file: File) => Promise<string>;
}) => (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;
  if (!file) {
    onImportBlobRefChange('');
    return;
  }

  void readFileAsDataUrl(file).then(onImportBlobRefChange, () => onImportBlobRefChange(''));
};

export const WasteToolsImportFields = ({
  importCatalog,
  importProfileId,
  importSourceFormat,
  fileInputId,
  fileAccept,
  selectedImportProfile,
  onImportProfileIdChange,
  onImportSourceFormatChange,
  onImportFileChange,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly importProfileId: string;
  readonly importSourceFormat: WasteManagementImportSourceFormat;
  readonly fileInputId: string;
  readonly fileAccept: string;
  readonly selectedImportProfile: ImportCatalogEntry | null;
  readonly onImportProfileIdChange: (value: string) => void;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
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
        <Input id={fileInputId} type="file" accept={fileAccept} onChange={onImportFileChange} />
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
  );
};
