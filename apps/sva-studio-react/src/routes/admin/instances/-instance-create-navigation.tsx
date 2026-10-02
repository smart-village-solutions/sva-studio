import { Button, StudioSaveButton } from '@sva/studio-ui-react';
import type { IamInstanceDraftReadiness } from '@sva/core';
import { t } from '../../../i18n';
import type { CreateWizardStepKey } from './-instances-shared-types';

export const readStepStatus = (isCompleted: boolean, isCurrent: boolean) => {
  if (isCompleted) {
    return 'done' as const;
  }

  if (isCurrent) {
    return 'current' as const;
  }

  return 'pending' as const;
};

export const CreateWizardNavigation = ({
  currentStep,
  returnToReview,
  moveToPreviousStep,
  moveToNextStep,
  saveStatus,
  readinessLoading,
  draftReadiness,
}: {
  currentStep: CreateWizardStepKey;
  returnToReview: boolean;
  moveToPreviousStep: () => void;
  moveToNextStep: () => void;
  saveStatus: React.ComponentProps<typeof StudioSaveButton>['status'];
  readinessLoading: boolean;
  draftReadiness: IamInstanceDraftReadiness | null;
}) => (
  <div className="flex flex-wrap justify-between gap-2">
    <div className="flex gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={moveToPreviousStep}
        disabled={currentStep === 'basics'}
      >
        {t('admin.instances.wizard.actions.back')}
      </Button>
      {currentStep !== 'review' ? (
        <Button type="button" onClick={moveToNextStep}>
          {t(
            returnToReview
              ? 'admin.instances.wizard.returnToReview'
              : 'admin.instances.wizard.actions.next'
          )}
        </Button>
      ) : null}
    </div>
    {currentStep === 'review' ? (
      <StudioSaveButton
        type="submit"
        status={saveStatus}
        disabled={readinessLoading || !draftReadiness || draftReadiness.createBlockers.length > 0}
        labels={{
          idle: t('admin.instances.actions.create'),
          saving: t('account.actions.saving'),
          saved: t('account.actions.saved'),
        }}
      />
    ) : null}
  </div>
);
