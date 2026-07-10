import type { StudioJobResponse, WasteManagementImportSourceFormat } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementOperationsContract } from '@sva/plugin-sdk';
import { useEffect, useId, useMemo, useState } from 'react';

import type {
  PreviewWasteLocationTourPickupDateImportResult,
  StartWasteManagementImportInput,
} from './waste-management.api.js';
import {
  downloadImportPreviewErrors,
  downloadImportTemplate,
  readFileAsDataUrl,
} from './waste-management.page.support.js';
import {
  createImportFileChangeHandler,
  isPreviewRequiredImportProfile,
  resolveSelectedImportProfile,
  WasteToolsPreviewStep,
  WasteToolsProfileStep,
  WasteToolsResultStep,
  WasteToolsUploadStep,
  WasteToolsValidationStep,
  WasteToolsWizardLayout,
} from './waste-management.tools.import-section.parts.js';
import {
  getReachableStep,
  transitionToReachableStep,
  type WasteToolsWizardStepId,
} from './waste-management.tools.import-wizard-state.js';

type ImportCatalogEntry = ReturnType<
  typeof import('./waste-management.api.js').getWasteManagementImportCatalog
>[number];
const getStepTitleKey = (step: WasteToolsWizardStepId) =>
  `tools.imports.wizard.steps.${step}.title`;
const getStepDescriptionKey = (step: WasteToolsWizardStepId) =>
  `tools.imports.wizard.steps.${step}.description`;
const isImportResultJob = (
  job: StudioJobResponse['data'] | null
): job is StudioJobResponse['data'] =>
  job?.jobTypeId === wasteManagementOperationsContract.jobTypeIds.importData;

export const WasteToolsImportSection = ({
  importCatalog,
  importProfileId,
  importSourceFormat,
  importBlobRef,
  importDryRun,
  delimiterOverride,
  previewResult,
  previewReady,
  running,
  lastJob,
  onImportProfileIdChange,
  onImportSourceFormatChange,
  onImportBlobRefChange,
  onImportDryRunChange,
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
  readonly lastJob?: StudioJobResponse['data'] | null;
  readonly onImportProfileIdChange: (
    value: StartWasteManagementImportInput['importProfileId']
  ) => void;
  readonly onImportSourceFormatChange: (value: WasteManagementImportSourceFormat) => void;
  readonly onImportBlobRefChange: (value: string) => void;
  readonly onImportDryRunChange: (value: boolean) => void;
  readonly onDelimiterOverrideChange: (
    value: StartWasteManagementImportInput['delimiterOverride']
  ) => void;
  readonly onRunPreview: () => Promise<PreviewWasteLocationTourPickupDateImportResult | null>;
  readonly onStartImport: () => Promise<StudioJobResponse['data'] | null>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const fileInputId = useId();
  const [wizardStep, setWizardStep] = useState<WasteToolsWizardStepId>('profile');
  const [importResultJob, setImportResultJob] = useState<StudioJobResponse['data'] | null>(
    isImportResultJob(lastJob ?? null) ? (lastJob ?? null) : null
  );
  const selectedImportProfile = resolveSelectedImportProfile(importCatalog, importProfileId);
  const previewRequired = isPreviewRequiredImportProfile(selectedImportProfile);
  const reachableStep = getReachableStep({
    hasSelectedProfile: selectedImportProfile !== null,
    hasReadyFile: importBlobRef.startsWith('data:'),
    previewRequired,
    previewReady,
    hasImportResult: Boolean(importResultJob?.id),
  });
  const canContinueFromUpload = importBlobRef.startsWith('data:');
  const previewHasBlockingErrors = previewRequired && (previewResult?.errors.length ?? 0) > 0;
  const canStartImport =
    canContinueFromUpload && (!previewRequired || (previewReady && !previewHasBlockingErrors));

  useEffect(() => {
    if (previewReady) setWizardStep('preview');
  }, [previewReady]);
  useEffect(() => {
    if (isImportResultJob(lastJob ?? null)) setImportResultJob(lastJob ?? null);
  }, [lastJob]);
  const goTo = (step: WasteToolsWizardStepId) =>
    setWizardStep((current) => transitionToReachableStep(current, step, reachableStep));
  const handleProfileSelection = (value: StartWasteManagementImportInput['importProfileId']) => {
    onImportProfileIdChange(value);
    setWizardStep('upload');
  };
  const handleSourceFormatChange = (value: WasteManagementImportSourceFormat) => {
    onImportSourceFormatChange(value);
    setWizardStep('upload');
  };
  const handleDelimiterOverrideChange = (
    value: StartWasteManagementImportInput['delimiterOverride']
  ) => {
    onDelimiterOverrideChange(value);
    if (wizardStep === 'preview' || wizardStep === 'result') setWizardStep('validation');
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
    if (await onRunPreview()) setWizardStep('preview');
  };
  const handleStartImport = async () => {
    const job = await onStartImport();
    if (isImportResultJob(job)) {
      setImportResultJob(job);
      setWizardStep('result');
    }
  };
  const handleStartNewImport = () => {
    setImportResultJob(null);
    onImportBlobRefChange('');
    onDelimiterOverrideChange(undefined);
    setWizardStep('profile');
  };

  const renderStep = () => {
    if (!selectedImportProfile) return null;
    switch (wizardStep) {
      case 'profile':
        return (
          <WasteToolsProfileStep
            importCatalog={importCatalog}
            selectedProfileId={selectedImportProfile.profileId}
            onSelect={handleProfileSelection}
            onContinue={() => setWizardStep('upload')}
          />
        );
      case 'upload':
        return (
          <WasteToolsUploadStep
            profile={selectedImportProfile}
            importSourceFormat={importSourceFormat}
            fileInputId={fileInputId}
            importBlobRef={importBlobRef}
            importDryRun={importDryRun}
            delimiterOverride={delimiterOverride}
            canContinue={canContinueFromUpload}
            onImportSourceFormatChange={handleSourceFormatChange}
            onImportDryRunChange={onImportDryRunChange}
            onDelimiterOverrideChange={handleDelimiterOverrideChange}
            onImportFileChange={handleImportFileChange}
            onDownloadTemplate={() =>
              void downloadImportTemplate(selectedImportProfile, importSourceFormat)
            }
            onBack={() => setWizardStep('profile')}
            onContinue={() => setWizardStep('validation')}
          />
        );
      case 'validation':
        return (
          <WasteToolsValidationStep
            profile={selectedImportProfile}
            previewRequired={previewRequired}
            running={running}
            canContinue={canContinueFromUpload}
            onBack={() => setWizardStep('upload')}
            onPreview={() => void handleRunPreview()}
            onContinue={() => setWizardStep('preview')}
          />
        );
      case 'preview':
        return (
          <WasteToolsPreviewStep
            profile={selectedImportProfile}
            previewRequired={previewRequired}
            previewResult={previewResult}
            running={running}
            canStartImport={canStartImport}
            onBack={() => setWizardStep('validation')}
            onDownloadErrors={() => {
              if (previewResult) downloadImportPreviewErrors(previewResult);
            }}
            onStartImport={() => void handleStartImport()}
          />
        );
      case 'result':
        return (
          <WasteToolsResultStep
            jobId={importResultJob?.id}
            status={importResultJob?.status}
            onStartNewImport={handleStartNewImport}
          />
        );
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
        onStepChange={goTo}
        title={pt(getStepTitleKey(wizardStep))}
        description={pt(getStepDescriptionKey(wizardStep))}
      >
        {renderStep()}
      </WasteToolsWizardLayout>
    </div>
  );
};
