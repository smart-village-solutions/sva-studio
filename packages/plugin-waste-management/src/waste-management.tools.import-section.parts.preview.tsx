import { Link } from '@tanstack/react-router';
import type { StudioJobResponse } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, StudioJobSummaryCard } from '@sva/studio-ui-react';
import type { PreviewWasteLocationTourPickupDateImportResult } from './waste-management.api.js';
import { toJobStatusTone } from './waste-management.page.support.js';
import {
  formatDelimiterLabel,
  WasteToolsImportColumns,
  WasteToolsWizardFooter,
  type ImportCatalogEntry,
} from './waste-management.tools.import-section.parts.support.js';

type PreviewResult = NonNullable<
  Awaited<
    ReturnType<typeof import('./waste-management.api.js').previewWasteLocationTourPickupDateImport>
  >
>;

const WasteToolsPreviewMetrics = ({ previewResult }: { readonly previewResult: PreviewResult }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {pt('tools.imports.wizard.metrics.validRows')}
        </p>
        <p className="mt-1 text-2xl font-semibold">{previewResult.validRowCount}</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {pt('tools.imports.wizard.metrics.invalidRows')}
        </p>
        <p className="mt-1 text-2xl font-semibold">{previewResult.invalidRowCount}</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {pt('tools.imports.wizard.metrics.createdTours')}
        </p>
        <p className="mt-1 text-2xl font-semibold">{previewResult.newTours.length}</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-muted/10 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {pt('tools.imports.wizard.metrics.createdAssignments')}
        </p>
        <p className="mt-1 text-2xl font-semibold">{previewResult.summary.assignments.created}</p>
      </div>
    </div>
  );
};

const WasteToolsPreviewErrors = ({ previewResult }: { readonly previewResult: PreviewResult }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{pt('tools.imports.wizard.errorTitle')}</p>
      {previewResult.errors.length > 0 ? (
        <div className="space-y-2">
          {previewResult.errors.map((error, index) => (
            <div
              key={`${error.rowNumber}-${error.column}-${index}`}
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
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
  );
};

const WasteToolsPreviewSummary = ({ previewResult }: { readonly previewResult: PreviewResult }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-4">
      <WasteToolsPreviewMetrics previewResult={previewResult} />
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
      <WasteToolsPreviewErrors previewResult={previewResult} />
    </div>
  );
};

const WasteToolsResultSummary = ({
  jobId,
  status,
  canOpenJobDetails,
  onStartNewImport,
}: {
  readonly jobId?: string;
  readonly status?: StudioJobResponse['data']['status'];
  readonly canOpenJobDetails: boolean;
  readonly onStartNewImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const statusLabel = status
    ? pt(`tools.progress.statuses.${status}`)
    : pt('tools.meta.noJobStatus');

  return (
    <div className="space-y-4">
      <StudioJobSummaryCard
        title={pt('tools.imports.wizard.resultTitle')}
        description={pt('tools.imports.wizard.resultDescription')}
        statusLabel={statusLabel}
        statusTone={toJobStatusTone(status)}
        announcement={pt('tools.meta.statusAnnouncement', {
          status: statusLabel,
          phase: '',
        })}
        metadata={
          jobId ? [{ id: 'jobId', label: pt('tools.meta.jobIdLabel'), value: jobId }] : undefined
        }
        actions={
          jobId && canOpenJobDetails ? (
            <Button asChild variant="secondary">
              <Link to="/monitoring/jobs/$jobId" params={{ jobId }}>
                {pt('tools.actions.openJobDetails')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onStartNewImport}>
          {pt('tools.imports.wizard.actions.startNew')}
        </Button>
      </div>
    </div>
  );
};
export const WasteToolsPreviewStep = ({
  profile,
  previewRequired,
  previewResult,
  running,
  canStartImport,
  onBack,
  onDownloadErrors,
  onStartImport,
}: {
  readonly profile: ImportCatalogEntry;
  readonly previewRequired: boolean;
  readonly previewResult: PreviewWasteLocationTourPickupDateImportResult | null;
  readonly running: boolean;
  readonly canStartImport: boolean;
  readonly onBack: () => void;
  readonly onDownloadErrors: () => void;
  readonly onStartImport: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-5">
      {previewRequired && previewResult ? (
        <WasteToolsPreviewSummary previewResult={previewResult} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
            <p className="text-sm font-semibold">{pt('tools.imports.wizard.confirmTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
          </div>
          <WasteToolsImportColumns profile={profile} />
        </div>
      )}
      <WasteToolsWizardFooter
        onBack={onBack}
        primaryAction={
          <>
            {previewRequired && previewResult && previewResult.errors.length > 0 ? (
              <Button type="button" variant="secondary" onClick={onDownloadErrors}>
                {pt('tools.actions.downloadErrorFile')}
              </Button>
            ) : null}
            <Button type="button" disabled={running || !canStartImport} onClick={onStartImport}>
              {running ? pt('tools.actions.starting') : pt('tools.actions.startImport')}
            </Button>
          </>
        }
      />
    </div>
  );
};

export const WasteToolsResultStep = WasteToolsResultSummary;
