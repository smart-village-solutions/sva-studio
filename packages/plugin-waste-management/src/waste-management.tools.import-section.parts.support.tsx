import type { ChangeEvent, ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import type { WasteManagementImportSourceFormat } from '@sva/waste-management-contracts';
import { Badge, Button } from '@sva/studio-ui-react';

export type ImportCatalogEntry = ReturnType<
  typeof import('./waste-management.api.js').getWasteManagementImportCatalog
>[number];

export const locationTourPickupDateProfileId = 'waste-management.ortsbezogene-tourtermine';

export const resolveSelectedImportProfile = (
  importCatalog: readonly ImportCatalogEntry[],
  importProfileId: string
) =>
  importCatalog.find((profile) => profile.profileId === importProfileId) ??
  importCatalog[0] ??
  null;

export const resolveImportFileAccept = (importSourceFormat: WasteManagementImportSourceFormat) =>
  importSourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : importSourceFormat === 'application/json'
      ? '.json,application/json'
      : importSourceFormat === 'application/zip'
        ? '.zip,application/zip'
        : '.csv,text/csv';

export const sourceFormatTranslationKey = (sourceFormat: WasteManagementImportSourceFormat) =>
  sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ? 'xlsx'
    : sourceFormat === 'application/json'
      ? 'json'
      : sourceFormat === 'application/zip'
        ? 'zip'
        : 'csv';

export const isPreviewRequiredImportProfile = (profile: ImportCatalogEntry | null) =>
  profile?.profileId === locationTourPickupDateProfileId;

export const createImportFileChangeHandler =
  ({
    onImportBlobRefChange,
    uploadFile,
    onAfterChange,
  }: {
    readonly onImportBlobRefChange: (value: string) => void;
    readonly uploadFile: (file: File) => Promise<string>;
    readonly onAfterChange?: () => void;
  }) =>
  (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      onImportBlobRefChange('');
      onAfterChange?.();
      return;
    }

    void uploadFile(file).then(
      (value) => {
        onImportBlobRefChange(value);
        onAfterChange?.();
      },
      () => {
        onImportBlobRefChange('');
        onAfterChange?.();
      }
    );
  };

export const formatDelimiterLabel = (delimiter: string) => (delimiter === '\t' ? 'Tab' : delimiter);
export const WasteToolsImportRuleBox = () => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {pt('tools.imports.wizard.rulesTitle')}
      </p>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>{pt('tools.imports.previewHintStreet')}</p>
        <p>{pt('tools.imports.previewHintHouseNumbers')}</p>
        <p>{pt('tools.imports.previewHintDates')}</p>
      </div>
    </div>
  );
};

export const WasteToolsImportColumns = ({ profile }: { readonly profile: ImportCatalogEntry }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {pt('tools.imports.templateColumns')}
      </p>
      <div className="flex flex-wrap gap-2">
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
    </div>
  );
};
export const WasteToolsWizardFooter = ({
  backDisabled = false,
  onBack,
  primaryAction,
}: {
  readonly backDisabled?: boolean;
  readonly onBack?: () => void;
  readonly primaryAction: ReactNode;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
      <div>
        {onBack ? (
          <Button type="button" variant="tertiary" disabled={backDisabled} onClick={onBack}>
            {pt('tools.imports.wizard.actions.back')}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{primaryAction}</div>
    </div>
  );
};
