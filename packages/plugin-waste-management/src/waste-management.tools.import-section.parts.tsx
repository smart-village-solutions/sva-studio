import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioEditSurface } from '@sva/studio-ui-react';
import type { WasteToolsWizardStepId } from './waste-management.tools.import-wizard-state.js';

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
  const steps: readonly WasteToolsWizardStepId[] = [
    'profile',
    'upload',
    'validation',
    'preview',
    'result',
  ];
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
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-foreground text-background'
                    : 'bg-muted'
              }`}
            >
              {index + 1}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">
                {pt(`tools.imports.wizard.steps.${step}.title`)}
              </span>
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
      <WasteToolsWizardStepList
        activeStep={activeStep}
        reachableStep={reachableStep}
        onStepChange={onStepChange}
      />
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

export {
  locationTourPickupDateProfileId,
  resolveSelectedImportProfile,
  resolveImportFileAccept,
  isPreviewRequiredImportProfile,
  createImportFileChangeHandler,
} from './waste-management.tools.import-section.parts.support.js';
export { WasteToolsProfileStep } from './waste-management.tools.import-section.parts.profile.js';
export {
  WasteToolsUploadStep,
  WasteToolsValidationStep,
} from './waste-management.tools.import-section.parts.upload.js';
export {
  WasteToolsPreviewStep,
  WasteToolsResultStep,
} from './waste-management.tools.import-section.parts.preview.js';
