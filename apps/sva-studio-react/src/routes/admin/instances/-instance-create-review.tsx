import { Button } from '@sva/studio-ui-react';
import type { IamInstanceDraftReadiness } from '@sva/core';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { t } from '../../../i18n';
import type { CreateInstancePayload, IamHttpError } from '../../../lib/iam-api';
import { CREATE_WIZARD_STEPS } from './-instance-form-models';
import { CreateReadinessFindings } from './-instance-create-readiness';
import type { CreateFormValues, CreateWizardStepKey } from './-instances-shared-types';

export const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 break-all text-sm text-foreground">{value}</div>
  </div>
);

const getRealmModeLabel = (realmMode: 'new' | 'existing') =>
  realmMode === 'new'
    ? t('admin.instances.flow.realmModeNewLabel')
    : t('admin.instances.flow.realmModeExistingLabel');

export const buildCreatePayload = (formValues: CreateFormValues): CreateInstancePayload => {
  const instanceId = formValues.instanceId.trim();
  return {
    instanceId,
    displayName: formValues.displayName.trim(),
    parentDomain: formValues.parentDomain.trim(),
    realmMode: formValues.realmMode,
    authRealm: formValues.realmMode === 'new' ? instanceId : formValues.authRealm.trim(),
    authClientId: 'sva-studio-login',
    authIssuerUrl: undefined,
    authClientSecret: undefined,
    tenantAdminClient: {
      clientId: 'sva-studio-realm-admin',
      secret: undefined,
    },
    tenantAdminBootstrap: {
      username: formValues.tenantAdminBootstrap.username.trim(),
      email: formValues.tenantAdminBootstrap.email.trim(),
      firstName: formValues.tenantAdminBootstrap.firstName.trim(),
      lastName: formValues.tenantAdminBootstrap.lastName.trim(),
    },
  };
};

export const CreateReviewStep = ({
  formValues,
  draftReadiness,
  draftReadinessError,
  readinessLoading,
  setReturnToReview,
  moveToStep,
  refreshDraftReadiness,
}: {
  formValues: CreateFormValues;
  draftReadiness: IamInstanceDraftReadiness | null;
  draftReadinessError: IamHttpError | null;
  readinessLoading: boolean;
  setReturnToReview: (value: boolean) => void;
  moveToStep: (step: CreateWizardStepKey) => void;
  refreshDraftReadiness: () => Promise<void>;
}) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-foreground">
        {t('admin.instances.wizard.reviewTitle')}
      </h2>
      <p className="text-xs text-muted-foreground">{t('admin.instances.wizard.reviewSubtitle')}</p>
    </div>
    {formValues.realmMode === 'new' ? (
      <Alert>
        <AlertDescription>{t('admin.instances.wizard.newRealmBaselineSummary')}</AlertDescription>
      </Alert>
    ) : null}
    <div className="grid gap-3 md:grid-cols-2">
      <ReviewRow
        label={t('admin.instances.form.instanceId')}
        value={formValues.instanceId || '—'}
      />
      <ReviewRow
        label={t('admin.instances.form.displayName')}
        value={formValues.displayName || '—'}
      />
      <ReviewRow
        label={t('admin.instances.flow.realmModeTitle')}
        value={getRealmModeLabel(formValues.realmMode)}
      />
      <ReviewRow
        label={t('admin.instances.form.parentDomain')}
        value={formValues.parentDomain || '—'}
      />
      <ReviewRow label={t('admin.instances.form.authRealm')} value={formValues.authRealm || '—'} />
      <ReviewRow
        label={t('admin.instances.form.authClientId')}
        value={formValues.authClientId || '—'}
      />
      <ReviewRow
        label={t('admin.instances.form.tenantAdminClientId')}
        value={formValues.tenantAdminClient.clientId || '—'}
      />
      <ReviewRow
        label={t('admin.instances.form.authIssuerUrl')}
        value={formValues.authIssuerUrl || t('admin.instances.wizard.reviewDefaultIssuer')}
      />
      <ReviewRow
        label={t('admin.instances.form.tenantAdminUsername')}
        value={
          formValues.tenantAdminBootstrap.username ||
          t('admin.instances.wizard.reviewNotConfigured')
        }
      />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <ReviewRow
        label={t('admin.instances.form.tenantAdminEmail')}
        value={formValues.tenantAdminBootstrap.email}
      />
      <ReviewRow
        label={t('admin.instances.form.tenantAdminFirstName')}
        value={formValues.tenantAdminBootstrap.firstName}
      />
      <ReviewRow
        label={t('admin.instances.form.tenantAdminLastName')}
        value={formValues.tenantAdminBootstrap.lastName}
      />
      {draftReadiness ? (
        <ReviewRow
          label={t('admin.instances.table.headerHost')}
          value={draftReadiness.normalizedDraft.primaryHostname}
        />
      ) : null}
    </div>
    <div className="flex flex-wrap gap-2">
      {CREATE_WIZARD_STEPS.filter(({ key }) => key !== 'review').map((step) => (
        <Button
          className="max-w-full whitespace-normal"
          key={step.key}
          type="button"
          variant="secondary"
          onClick={() => {
            setReturnToReview(true);
            moveToStep(step.key);
          }}
        >
          {t('admin.instances.wizard.editGroup', { group: step.title })}
        </Button>
      ))}
    </div>
    <CreateReadinessFindings
      draftReadiness={draftReadiness}
      draftReadinessError={draftReadinessError}
      readinessLoading={readinessLoading}
      setReturnToReview={setReturnToReview}
      moveToStep={moveToStep}
    />
    <Button
      type="button"
      variant="secondary"
      disabled={readinessLoading}
      onClick={() => void refreshDraftReadiness()}
    >
      {t('admin.instances.wizard.readiness.recheck')}
    </Button>
    <p className="text-xs text-muted-foreground">{t('admin.instances.flow.createHint')}</p>
  </div>
);
