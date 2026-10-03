import type { ChangeEvent } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type {
  WasteManagementCsvDelimiter,
  WasteManagementImportSourceFormat,
} from '@sva/waste-management-contracts';
import {
  Button,
  Checkbox,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import {
  isPreviewRequiredImportProfile,
  resolveImportFileAccept,
  sourceFormatTranslationKey,
  WasteToolsImportColumns,
  WasteToolsImportRuleBox,
  WasteToolsWizardFooter,
  type ImportCatalogEntry,
} from './waste-management.tools.import-section.parts.support.js';

const WasteToolsDelimiterField = ({
  value,
  onChange,
}: {
  readonly value?: WasteManagementCsvDelimiter;
  readonly onChange: (value: WasteManagementCsvDelimiter | undefined) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioField id="waste-tools-import-delimiter" label={pt('tools.imports.delimiterLabel')}>
      <Select
        aria-label={pt('tools.imports.delimiterLabel')}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === ''
              ? undefined
              : (event.target.value as WasteManagementCsvDelimiter)
          )
        }
      >
        <option value="">{pt('tools.imports.delimiterAuto')}</option>
        <option value=";">Semikolon (;)</option>
        <option value=",">Komma (,)</option>
        <option value={'\t'}>Tab</option>
        <option value="|">Pipe (|)</option>
      </Select>
    </StudioField>
  );
};

const WasteToolsUploadFields = ({
  selectedImportProfile,
  importSourceFormat,
  fileInputId,
  importBlobRef,
  importDryRun,
  delimiterOverride,
  onImportSourceFormatChange,
  onImportDryRunChange,
  onDelimiterOverrideChange,
  onImportFileChange,
}: {
  readonly selectedImportProfile: ImportCatalogEntry;
  readonly importSourceFormat: WasteManagementImportSourceFormat;
  readonly fileInputId: string;
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportDryRunChange: (value: boolean) => void;
  readonly onDelimiterOverrideChange: (value: WasteManagementCsvDelimiter | undefined) => void;
  readonly onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const fileAccept = resolveImportFileAccept(importSourceFormat);
  const showSourceFormatField = selectedImportProfile.sourceFormats.length > 1;

  return (
    <StudioFieldGroup columns={showSourceFormatField ? 2 : 1}>
      {showSourceFormatField ? (
        <StudioField
          id="waste-tools-import-source-format"
          label={pt('tools.imports.sourceFormatLabel')}
        >
          <Select
            aria-label={pt('tools.imports.sourceFormatLabel')}
            value={importSourceFormat}
            onChange={(event) =>
              onImportSourceFormatChange(event.target.value as WasteManagementImportSourceFormat)
            }
          >
            {selectedImportProfile.sourceFormats.map((sourceFormat) => (
              <option key={sourceFormat} value={sourceFormat}>
                {pt(`tools.imports.sourceFormats.${sourceFormatTranslationKey(sourceFormat)}`)}
              </option>
            ))}
          </Select>
        </StudioField>
      ) : null}
      <StudioField
        id="waste-tools-import-blob-ref"
        label={pt('tools.imports.blobRefLabel')}
        description={
          importBlobRef.startsWith('plugin-operation-input:')
            ? pt('tools.imports.wizard.fileReady')
            : undefined
        }
      >
        <Input id={fileInputId} type="file" accept={fileAccept} onChange={onImportFileChange} />
      </StudioField>
      <StudioField id="waste-tools-import-dry-run" label={pt('tools.imports.dryRunLabel')}>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <Checkbox
            aria-label={pt('tools.imports.dryRunLabel')}
            checked={importDryRun}
            onChange={(event) => onImportDryRunChange(event.currentTarget.checked)}
          />
          <span>{pt('tools.imports.dryRunLabel')}</span>
        </label>
      </StudioField>
      {isPreviewRequiredImportProfile(selectedImportProfile) &&
      importSourceFormat === 'text/csv' ? (
        <WasteToolsDelimiterField value={delimiterOverride} onChange={onDelimiterOverrideChange} />
      ) : null}
    </StudioFieldGroup>
  );
};
export const WasteToolsUploadStep = ({
  profile,
  importSourceFormat,
  fileInputId,
  importBlobRef,
  importDryRun,
  delimiterOverride,
  canContinue,
  onImportSourceFormatChange,
  onImportDryRunChange,
  onDelimiterOverrideChange,
  onImportFileChange,
  onDownloadTemplate,
  onBack,
  onContinue,
}: {
  readonly profile: ImportCatalogEntry;
  readonly importSourceFormat: WasteManagementImportSourceFormat;
  readonly fileInputId: string;
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
  readonly canContinue: boolean;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportDryRunChange: (value: boolean) => void;
  readonly onDelimiterOverrideChange: (value: WasteManagementCsvDelimiter | undefined) => void;
  readonly onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDownloadTemplate: () => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-5">
      <WasteToolsUploadFields
        selectedImportProfile={profile}
        importSourceFormat={importSourceFormat}
        fileInputId={fileInputId}
        importBlobRef={importBlobRef}
        importDryRun={importDryRun}
        delimiterOverride={delimiterOverride}
        onImportSourceFormatChange={onImportSourceFormatChange}
        onImportDryRunChange={onImportDryRunChange}
        onDelimiterOverrideChange={onDelimiterOverrideChange}
        onImportFileChange={onImportFileChange}
      />
      <WasteToolsImportColumns profile={profile} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onDownloadTemplate}>
          {pt('tools.actions.downloadTemplate')}
        </Button>
      </div>
      <WasteToolsWizardFooter
        onBack={onBack}
        primaryAction={
          <Button type="button" disabled={!canContinue} onClick={onContinue}>
            {pt('tools.imports.wizard.actions.continue')}
          </Button>
        }
      />
    </div>
  );
};

export const WasteToolsValidationStep = ({
  profile,
  previewRequired,
  running,
  canContinue,
  onBack,
  onPreview,
  onContinue,
}: {
  readonly profile: ImportCatalogEntry;
  readonly previewRequired: boolean;
  readonly running: boolean;
  readonly canContinue: boolean;
  readonly onBack: () => void;
  readonly onPreview: () => void;
  readonly onContinue: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const action = previewRequired ? (
    <Button
      type="button"
      variant="secondary"
      disabled={running || !canContinue}
      onClick={onPreview}
    >
      {pt('tools.actions.previewImport')}
    </Button>
  ) : (
    <Button type="button" disabled={!canContinue} onClick={onContinue}>
      {pt('tools.imports.wizard.actions.continueToConfirmation')}
    </Button>
  );
  return (
    <div className="space-y-5">
      {previewRequired ? <WasteToolsImportRuleBox /> : null}
      <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <p className="text-sm font-medium text-foreground">{profile.displayName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
      </div>
      <WasteToolsWizardFooter onBack={onBack} primaryAction={action} />
    </div>
  );
};
