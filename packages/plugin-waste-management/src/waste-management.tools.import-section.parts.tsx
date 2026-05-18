import type { ChangeEvent, ReactNode } from 'react';
import type { WasteManagementCsvDelimiter, WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  StudioEditSurface,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

export type WasteToolsWizardStepId = 'profile' | 'upload' | 'validation' | 'preview' | 'result';

export const locationTourPickupDateProfileId = 'waste-management.ortsbezogene-tourtermine';

export const resolveSelectedImportProfile = (
  importCatalog: readonly ImportCatalogEntry[],
  importProfileId: string
) => importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;

export const resolveImportFileAccept = (importSourceFormat: WasteManagementImportSourceFormat) =>
  importSourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : '.csv,text/csv';

export const isPreviewRequiredImportProfile = (profile: ImportCatalogEntry | null) =>
  profile?.profileId === locationTourPickupDateProfileId;

export const createImportFileChangeHandler = ({
  onImportBlobRefChange,
  readFileAsDataUrl,
  onAfterChange,
}: {
  readonly onImportBlobRefChange: (value: string) => void;
  readonly readFileAsDataUrl: (file: File) => Promise<string>;
  readonly onAfterChange?: () => void;
}) => (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;
  if (!file) {
    onImportBlobRefChange('');
    onAfterChange?.();
    return;
  }

  void readFileAsDataUrl(file).then(
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

const formatDelimiterLabel = (delimiter: string) => (delimiter === '\t' ? 'Tab' : delimiter);

export const WasteToolsWizardStepList = ({
  activeStep,
  reachableStep,
  onStepChange,
}: {
  readonly activeStep: WasteToolsWizardStepId;
  readonly reachableStep: WasteToolsWizardStepId;
  readonly onStepChange: (step: WasteToolsWizardStepId) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const steps: readonly WasteToolsWizardStepId[] = ['profile', 'upload', 'validation', 'preview', 'result'];
  const reachableIndex = steps.indexOf(reachableStep);
  const activeIndex = steps.indexOf(activeStep);

  return (
    <nav aria-label={pt('tools.imports.wizard.navigationLabel')} className="space-y-2">
      {steps.map((step, index) => {
        const isActive = step === activeStep;
        const isDone = index < activeIndex;
        const isReachable = index <= reachableIndex;
        return (
          <button
            key={step}
            type="button"
            disabled={!isReachable}
            aria-current={isActive ? 'step' : undefined}
            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
              isActive
                ? 'border-primary bg-primary/10 text-foreground'
                : isDone
                  ? 'border-border/70 bg-background text-foreground'
                  : 'border-border/60 bg-muted/20 text-muted-foreground'
            } disabled:cursor-not-allowed disabled:opacity-70`}
            onClick={() => onStepChange(step)}
          >
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-foreground text-background' : 'bg-muted'
              }`}
            >
              {index + 1}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{pt(`tools.imports.wizard.steps.${step}.title`)}</span>
              <span className="block text-xs text-muted-foreground">
                {pt(`tools.imports.wizard.steps.${step}.description`)}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export const WasteToolsWizardLayout = ({
  activeStep,
  reachableStep,
  onStepChange,
  title,
  description,
  children,
}: {
  readonly activeStep: WasteToolsWizardStepId;
  readonly reachableStep: WasteToolsWizardStepId;
  readonly onStepChange: (step: WasteToolsWizardStepId) => void;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) => (
  <StudioEditSurface className="rounded-2xl border-border/70 bg-background/80">
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <WasteToolsWizardStepList activeStep={activeStep} reachableStep={reachableStep} onStepChange={onStepChange} />
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  </StudioEditSurface>
);

export const WasteToolsImportProfileChooser = ({
  importCatalog,
  selectedProfileId,
  onSelect,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly selectedProfileId: string;
  readonly onSelect: (profileId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const orderedProfiles = [...importCatalog].sort((left, right) => {
    if (left.profileId === locationTourPickupDateProfileId) {
      return -1;
    }
    if (right.profileId === locationTourPickupDateProfileId) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName, 'de');
  });

  return (
    <div className="space-y-3">
      {orderedProfiles.map((profile) => {
        const isPrimary = profile.profileId === locationTourPickupDateProfileId;
        const isSelected = profile.profileId === selectedProfileId;
        return (
          <button
            key={profile.profileId}
            type="button"
            aria-pressed={isSelected}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isSelected
                ? 'border-primary bg-primary/10'
                : isPrimary
                  ? 'border-border/70 bg-muted/10 hover:border-primary/50'
                  : 'border-border/60 bg-background hover:border-border'
            }`}
            onClick={() => onSelect(profile.profileId)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`text-sm font-semibold ${isPrimary ? 'text-base' : ''}`}>{profile.displayName}</h4>
              {isPrimary ? <Badge variant="secondary">{pt('tools.imports.wizard.preferredBadge')}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
          </button>
        );
      })}
    </div>
  );
};

export const WasteToolsUploadFields = ({
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
        <StudioField id="waste-tools-import-source-format" label={pt('tools.imports.sourceFormatLabel')}>
          <Select
            aria-label={pt('tools.imports.sourceFormatLabel')}
            value={importSourceFormat}
            onChange={(event) => onImportSourceFormatChange(event.target.value as WasteManagementImportSourceFormat)}
          >
            {selectedImportProfile.sourceFormats.map((sourceFormat) => (
              <option key={sourceFormat} value={sourceFormat}>
                {sourceFormat === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  ? pt('tools.imports.sourceFormats.xlsx')
                  : pt('tools.imports.sourceFormats.csv')}
              </option>
            ))}
          </Select>
        </StudioField>
      ) : null}
      <StudioField
        id="waste-tools-import-blob-ref"
        label={pt('tools.imports.blobRefLabel')}
        description={importBlobRef.startsWith('data:') ? pt('tools.imports.wizard.fileReady') : undefined}
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
      {isPreviewRequiredImportProfile(selectedImportProfile) && importSourceFormat === 'text/csv' ? (
        <StudioField id="waste-tools-import-delimiter" label={pt('tools.imports.delimiterLabel')}>
          <Select
            aria-label={pt('tools.imports.delimiterLabel')}
            value={delimiterOverride ?? ''}
            onChange={(event) =>
              onDelimiterOverrideChange(
                event.target.value === '' ? undefined : (event.target.value as WasteManagementCsvDelimiter)
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
      ) : null}
    </StudioFieldGroup>
  );
};

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

export const WasteToolsImportColumns = ({
  profile,
}: {
  readonly profile: ImportCatalogEntry;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pt('tools.imports.templateColumns')}</p>
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

export const WasteToolsPreviewSummary = ({
  previewResult,
}: {
  readonly previewResult: NonNullable<
    Awaited<ReturnType<typeof import('./waste-management.api.js').previewWasteLocationTourPickupDateImport>>
  >;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{pt('tools.imports.wizard.metrics.validRows')}</p>
          <p className="mt-1 text-2xl font-semibold">{previewResult.validRowCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{pt('tools.imports.wizard.metrics.invalidRows')}</p>
          <p className="mt-1 text-2xl font-semibold">{previewResult.invalidRowCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{pt('tools.imports.wizard.metrics.createdTours')}</p>
          <p className="mt-1 text-2xl font-semibold">{previewResult.newTours.length}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {pt('tools.imports.wizard.metrics.createdAssignments')}
          </p>
          <p className="mt-1 text-2xl font-semibold">{previewResult.summary.assignments.created}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-background/80 p-4">
        <p className="text-sm font-semibold">{pt('tools.imports.previewTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
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
            detected: formatDelimiterLabel(previewResult.detectedDelimiter),
            active: formatDelimiterLabel(previewResult.delimiter),
          })}
        </p>
      </div>
      {previewResult.newFractions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{pt('tools.imports.wizard.newFractionsTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {previewResult.newFractions.map((fraction) => (
              <Badge key={fraction} variant="outline">
                {fraction}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {previewResult.newTours.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{pt('tools.imports.wizard.newToursTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {previewResult.newTours.map((tour) => (
              <Badge key={tour} variant="outline">
                {tour}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{pt('tools.imports.wizard.newLocationsTitle')}</p>
        <p className="text-sm text-muted-foreground">
          {pt('tools.imports.wizard.newLocationsSummary', {
            created: previewResult.summary.locations.created,
            reused: previewResult.summary.locations.existing,
          })}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{pt('tools.imports.wizard.errorTitle')}</p>
        {previewResult.errors.length > 0 ? (
          <div className="space-y-2">
            {previewResult.errors.map((error, index) => (
              <div key={`${error.rowNumber}-${error.column}-${index}`} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">
                  {pt('tools.imports.wizard.errorLine', {
                    rowNumber: error.rowNumber,
                    column: error.column,
                  })}
                </p>
                <p className="text-muted-foreground">{error.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{pt('tools.imports.wizard.noErrors')}</p>
        )}
      </div>
    </div>
  );
};

export const WasteToolsResultSummary = ({
  jobId,
  status,
  onStartNewImport,
}: {
  readonly jobId?: string;
  readonly status?: string;
  readonly onStartNewImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
        <p className="text-sm font-semibold">{pt('tools.imports.wizard.resultTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{pt('tools.imports.wizard.resultDescription')}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{pt('tools.meta.jobStatusLabel')}</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{status ?? pt('tools.meta.noJobStatus')}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{pt('tools.meta.jobIdLabel')}</dt>
            <dd className="mt-1 break-all text-sm font-medium text-foreground">{jobId ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onStartNewImport}>
          {pt('tools.imports.wizard.actions.startNew')}
        </Button>
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
          <Button type="button" variant="ghost" disabled={backDisabled} onClick={onBack}>
            {pt('tools.imports.wizard.actions.back')}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{primaryAction}</div>
    </div>
  );
};
