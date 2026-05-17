import type { StudioJobResponse, WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '@sva/studio-ui-react';

import type { PreviewWasteLocationTourPickupDateImportResult, StartWasteManagementImportInput } from './waste-management.api.js';
import { downloadImportPreviewErrors, downloadImportTemplate, readFileAsDataUrl } from './waste-management.page.support.js';
import {
  createImportFileChangeHandler,
  isPreviewRequiredImportProfile,
  resolveSelectedImportProfile,
  WasteToolsImportColumns,
  WasteToolsImportProfileChooser,
  WasteToolsImportRuleBox,
  WasteToolsPreviewSummary,
  WasteToolsResultSummary,
  WasteToolsUploadFields,
  WasteToolsWizardFooter,
  WasteToolsWizardLayout,
  type WasteToolsWizardStepId,
} from './waste-management.tools.import-section.parts.js';

type ImportCatalogEntry = ReturnType<typeof import('./waste-management.api.js').getWasteManagementImportCatalog>[number];

const getReachableStep = ({
  selectedImportProfile,
  importBlobRef,
  previewReady,
  hasImportResult,
}: {
  readonly selectedImportProfile: ImportCatalogEntry | null;
  readonly importBlobRef: string;
  readonly previewReady: boolean;
  readonly hasImportResult: boolean;
}): WasteToolsWizardStepId => {
  if (hasImportResult) {
    return 'result';
  }
  if (isPreviewRequiredImportProfile(selectedImportProfile) && previewReady) {
    return 'preview';
  }
  if (!isPreviewRequiredImportProfile(selectedImportProfile) && importBlobRef.startsWith('data:')) {
    return 'preview';
  }
  if (importBlobRef.startsWith('data:')) {
    return 'validation';
  }
  if (selectedImportProfile) {
    return 'upload';
  }
  return 'profile';
};

const getStepTitleKey = (step: WasteToolsWizardStepId) => `tools.imports.wizard.steps.${step}.title`;
const getStepDescriptionKey = (step: WasteToolsWizardStepId) => `tools.imports.wizard.steps.${step}.description`;

export const WasteToolsImportSection = ({
  importCatalog,
  importProfileId,
  importSourceFormat,
  importBlobRef,
  importDryRun: _importDryRun,
  delimiterOverride,
  previewResult,
  previewReady,
  running,
  lastJob,
  onImportProfileIdChange,
  onImportSourceFormatChange,
  onImportBlobRefChange,
  onImportDryRunChange: _onImportDryRunChange,
  onDelimiterOverrideChange,
  onRunPreview,
  onStartImport,
}: {
  readonly importCatalog: readonly ImportCatalogEntry[];
  readonly importProfileId: StartWasteManagementImportInput['importProfileId'] | '';
  readonly importSourceFormat: StartWasteManagementImportInput['sourceFormat'];
  readonly importBlobRef: string;
  readonly importDryRun: boolean;
  readonly delimiterOverride: StartWasteManagementImportInput['delimiterOverride'];
  readonly previewResult: PreviewWasteLocationTourPickupDateImportResult | null;
  readonly previewReady: boolean;
  readonly running: boolean;
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly onImportProfileIdChange: (value: StartWasteManagementImportInput['importProfileId']) => void;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportBlobRefChange: (value: string) => void;
  readonly onImportDryRunChange: (value: boolean) => void;
  readonly onDelimiterOverrideChange: (value: StartWasteManagementImportInput['delimiterOverride']) => void;
  readonly onRunPreview: () => Promise<PreviewWasteLocationTourPickupDateImportResult | null>;
  readonly onStartImport: () => Promise<StudioJobResponse['data'] | null>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const fileInputId = useId();
  const [wizardStep, setWizardStep] = useState<WasteToolsWizardStepId>('profile');
  const selectedImportProfile = resolveSelectedImportProfile(importCatalog, importProfileId);
  const previewRequired = isPreviewRequiredImportProfile(selectedImportProfile);
  const reachableStep = getReachableStep({
    selectedImportProfile,
    importBlobRef,
    previewReady,
    hasImportResult: Boolean(lastJob?.id),
  });
  const canContinueFromUpload = importBlobRef.startsWith('data:');
  const canStartImport = importBlobRef.startsWith('data:') && (!previewRequired || previewReady);

  useEffect(() => {
    if (previewReady) {
      setWizardStep('preview');
    }
  }, [previewReady]);

  const handleProfileSelection = (nextProfileId: StartWasteManagementImportInput['importProfileId']) => {
    onImportProfileIdChange(nextProfileId);
    setWizardStep('upload');
  };

  const handleSourceFormatChange = (nextSourceFormat: WasteManagementImportSourceFormat) => {
    onImportSourceFormatChange(nextSourceFormat);
    setWizardStep('upload');
  };

  const handleDelimiterOverrideChange = (value: StartWasteManagementImportInput['delimiterOverride']) => {
    onDelimiterOverrideChange(value);
    if (wizardStep === 'preview' || wizardStep === 'result') {
      setWizardStep('validation');
    }
  };

  const handleImportFileChange = useMemo(
    () =>
      createImportFileChangeHandler({
        onImportBlobRefChange,
        readFileAsDataUrl,
        onAfterChange: () => setWizardStep('validation'),
      }),
    [onImportBlobRefChange]
  );

  const handleRunPreview = async () => {
    const preview = await onRunPreview();
    if (preview) {
      setWizardStep('preview');
    }
  };

  const handleStartImport = async () => {
    const job = await onStartImport();
    if (job) {
      setWizardStep('result');
    }
  };

  const handleStartNewImport = () => {
    onImportBlobRefChange('');
    onDelimiterOverrideChange(undefined);
    setWizardStep('profile');
  };

  const renderStepContent = () => {
    if (!selectedImportProfile) {
      return null;
    }

    switch (wizardStep) {
      case 'profile':
        return (
          <div className="space-y-5">
            <WasteToolsImportProfileChooser
              importCatalog={importCatalog}
              selectedProfileId={selectedImportProfile.profileId}
              onSelect={handleProfileSelection}
            />
            <WasteToolsWizardFooter
              primaryAction={
                <Button type="button" onClick={() => setWizardStep('upload')}>
                  {pt('tools.imports.wizard.actions.continue')}
                </Button>
              }
            />
          </div>
        );
      case 'upload':
        return (
          <div className="space-y-5">
            <WasteToolsUploadFields
              selectedImportProfile={selectedImportProfile}
              importSourceFormat={importSourceFormat}
              fileInputId={fileInputId}
              importBlobRef={importBlobRef}
              delimiterOverride={delimiterOverride}
              onImportSourceFormatChange={handleSourceFormatChange}
              onDelimiterOverrideChange={handleDelimiterOverrideChange}
              onImportFileChange={handleImportFileChange}
            />
            <WasteToolsImportColumns profile={selectedImportProfile} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => downloadImportTemplate(selectedImportProfile, importSourceFormat)}>
                {pt('tools.actions.downloadTemplate')}
              </Button>
            </div>
            <WasteToolsWizardFooter
              onBack={() => setWizardStep('profile')}
              primaryAction={
                <Button type="button" disabled={!canContinueFromUpload} onClick={() => setWizardStep('validation')}>
                  {pt('tools.imports.wizard.actions.continue')}
                </Button>
              }
            />
          </div>
        );
      case 'validation':
        return (
          <div className="space-y-5">
            {previewRequired ? <WasteToolsImportRuleBox /> : null}
            <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
              <p className="text-sm font-medium text-foreground">{selectedImportProfile.displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedImportProfile.description}</p>
            </div>
            <WasteToolsWizardFooter
              onBack={() => setWizardStep('upload')}
              primaryAction={
                previewRequired ? (
                  <Button type="button" variant="outline" disabled={running || !canContinueFromUpload} onClick={() => void handleRunPreview()}>
                    {pt('tools.actions.previewImport')}
                  </Button>
                ) : (
                  <Button type="button" disabled={!canContinueFromUpload} onClick={() => setWizardStep('preview')}>
                    {pt('tools.imports.wizard.actions.continueToConfirmation')}
                  </Button>
                )
              }
            />
          </div>
        );
      case 'preview':
        return (
          <div className="space-y-5">
            {previewRequired && previewResult ? (
              <WasteToolsPreviewSummary previewResult={previewResult} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-sm font-semibold">{pt('tools.imports.wizard.confirmTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedImportProfile.description}</p>
                </div>
                <WasteToolsImportColumns profile={selectedImportProfile} />
              </div>
            )}
            <WasteToolsWizardFooter
              onBack={() => setWizardStep('validation')}
              primaryAction={
                <>
                  {previewRequired && previewResult && previewResult.errors.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => downloadImportPreviewErrors(previewResult)}
                    >
                      {pt('tools.actions.downloadErrorFile')}
                    </Button>
                  ) : null}
                  <Button type="button" disabled={running || !canStartImport} onClick={() => void handleStartImport()}>
                    {running ? pt('tools.actions.starting') : pt('tools.actions.startImport')}
                  </Button>
                </>
              }
            />
          </div>
        );
      case 'result':
        return (
          <WasteToolsResultSummary
            jobId={lastJob?.id}
            status={lastJob?.status}
            onStartNewImport={handleStartNewImport}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{pt('tools.imports.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('tools.imports.description')}</p>
      </div>
      <WasteToolsWizardLayout
        activeStep={wizardStep}
        reachableStep={reachableStep}
        onStepChange={setWizardStep}
        title={pt(getStepTitleKey(wizardStep))}
        description={pt(getStepDescriptionKey(wizardStep))}
      >
        {renderStepContent()}
      </WasteToolsWizardLayout>
    </div>
  );
};
