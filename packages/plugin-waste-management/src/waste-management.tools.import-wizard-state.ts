export type WasteToolsWizardStepId = 'profile' | 'upload' | 'validation' | 'preview' | 'result';
export type WasteToolsImportWizardFacts = {
  readonly hasSelectedProfile: boolean;
  readonly hasReadyFile: boolean;
  readonly previewRequired: boolean;
  readonly previewReady: boolean;
  readonly hasImportResult: boolean;
};

const steps: readonly WasteToolsWizardStepId[] = [
  'profile',
  'upload',
  'validation',
  'preview',
  'result',
];

export const getReachableStep = ({
  hasSelectedProfile,
  hasReadyFile,
  previewRequired,
  previewReady,
  hasImportResult,
}: WasteToolsImportWizardFacts): WasteToolsWizardStepId => {
  if (hasImportResult) return 'result';
  if ((previewRequired && previewReady) || (!previewRequired && hasReadyFile)) return 'preview';
  if (hasReadyFile) return 'validation';
  return hasSelectedProfile ? 'upload' : 'profile';
};

export const transitionToReachableStep = (
  currentStep: WasteToolsWizardStepId,
  targetStep: WasteToolsWizardStepId,
  reachableStep: WasteToolsWizardStepId
): WasteToolsWizardStepId =>
  steps.indexOf(targetStep) <= steps.indexOf(reachableStep) ? targetStep : currentStep;
