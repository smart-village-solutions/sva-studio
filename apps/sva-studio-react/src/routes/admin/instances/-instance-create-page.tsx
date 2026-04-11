import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { FieldHelp } from './-field-help';
import {
  CREATE_WIZARD_STEPS,
  createEmptyCreateForm,
  getCreateReadinessChecks,
  getCreateStepValidationMessages,
  getErrorMessage,
  getPostCreateGuidance,
  INSTANCE_FIELD_HELP,
  isTenantSecretUserInputRequired,
  readSuggestedParentDomain,
  WorkflowStatusBadge,
} from './-instances-shared';

import type { CreateFormValues, CreateWizardStepKey } from './-instances-shared';
import type { IamInstanceListItem } from '@sva/core';

const stepOrder = CREATE_WIZARD_STEPS.map((step) => step.key);

const FormLabelWithHelp = ({
  htmlFor,
  label,
  helpKey,
}: {
  htmlFor: string;
  label: string;
  helpKey: keyof typeof INSTANCE_FIELD_HELP;
}) => {
  const help = INSTANCE_FIELD_HELP[helpKey];
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <FieldHelp {...help} />
    </div>
  );
};

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm text-foreground">{value}</div>
  </div>
);

const getStepIndex = (step: CreateWizardStepKey) => stepOrder.indexOf(step);
const getRealmModeLabel = (realmMode: 'new' | 'existing') =>
  realmMode === 'new' ? t('admin.instances.flow.realmModeNewLabel') : t('admin.instances.flow.realmModeExistingLabel');

export const InstanceCreatePage = () => {
  const instancesApi = useInstances();
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');
  const [currentStep, setCurrentStep] = React.useState<CreateWizardStepKey>('basics');
  const [stepErrors, setStepErrors] = React.useState<string[]>([]);
  const [createdInstance, setCreatedInstance] = React.useState<IamInstanceListItem | null>(null);
  const [formValues, setFormValues] = React.useState(createEmptyCreateForm());

  React.useEffect(() => {
    const parentDomain = readSuggestedParentDomain();
    setSuggestedParentDomain(parentDomain);
    setFormValues((current) => (current.parentDomain ? current : createEmptyCreateForm(parentDomain)));
  }, []);

  const updateForm = (updater: (current: CreateFormValues) => CreateFormValues) => {
    setFormValues((current) => updater(current));
    setStepErrors([]);
    if (createdInstance) {
      setCreatedInstance(null);
    }
  };

  const moveToStep = (step: CreateWizardStepKey) => {
    const nextIndex = getStepIndex(step);
    const currentIndex = getStepIndex(currentStep);
    if (nextIndex > currentIndex) {
      const validationMessages = getCreateStepValidationMessages(currentStep, formValues);
      if (validationMessages.length > 0) {
        setStepErrors(validationMessages);
        return;
      }
    }

    setStepErrors([]);
    setCurrentStep(step);
  };

  const moveToNextStep = () => {
    const currentIndex = getStepIndex(currentStep);
    const nextStep = stepOrder[currentIndex + 1];
    if (!nextStep) {
      return;
    }
    moveToStep(nextStep);
  };

  const moveToPreviousStep = () => {
    const currentIndex = getStepIndex(currentStep);
    const previousStep = stepOrder[currentIndex - 1];
    if (!previousStep) {
      return;
    }
    setStepErrors([]);
    setCurrentStep(previousStep);
  };

  const onCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessages = getCreateStepValidationMessages('review', formValues);
    if (validationMessages.length > 0) {
      setStepErrors(validationMessages);
      return;
    }

    const instanceId = formValues.instanceId.trim();
    const created = await instancesApi.createInstance({
      instanceId,
      displayName: formValues.displayName.trim(),
      parentDomain: formValues.parentDomain.trim(),
      realmMode: formValues.realmMode,
      authRealm: formValues.authRealm.trim() || instanceId,
      authClientId: formValues.authClientId.trim() || 'sva-studio',
      authIssuerUrl: formValues.authIssuerUrl.trim() || undefined,
      authClientSecret: formValues.authClientSecret.trim() || undefined,
      tenantAdminBootstrap: formValues.tenantAdminBootstrap.username.trim()
        ? {
            username: formValues.tenantAdminBootstrap.username.trim(),
            email: formValues.tenantAdminBootstrap.email.trim() || undefined,
            firstName: formValues.tenantAdminBootstrap.firstName.trim() || undefined,
            lastName: formValues.tenantAdminBootstrap.lastName.trim() || undefined,
          }
        : undefined,
    });

    if (!created) {
      return;
    }

    setCreatedInstance(created);
  };

  const readinessChecks = getCreateReadinessChecks(formValues);
  const successGuidance = createdInstance ? getPostCreateGuidance(createdInstance) : null;
  const tenantSecretUserInputRequired = isTenantSecretUserInputRequired(formValues.realmMode);

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.form.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.form.subtitle')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </header>

      {createdInstance && successGuidance ? (
        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{successGuidance.title}</div>
            <p className="text-sm text-muted-foreground">{successGuidance.summary}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {successGuidance.nextSteps.map((item, index) => (
              <div key={item} className="rounded-lg border border-border p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{index + 1}</div>
                <div className="mt-1 text-foreground">{item}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/admin/instances/$instanceId" params={{ instanceId: createdInstance.instanceId }}>
                {t('admin.instances.success.actions.openDetail')}
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/admin/instances">{t('admin.instances.success.actions.backToOverview')}</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {instancesApi.mutationError && !createdInstance ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="space-y-5 p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          {CREATE_WIZARD_STEPS.map((step, index) => {
            const isCurrent = step.key === currentStep;
            const isCompleted = getStepIndex(currentStep) > index;
            return (
              <button
                key={step.key}
                type="button"
                className={`rounded-xl border p-3 text-left transition ${
                  isCurrent ? 'border-foreground bg-accent/40' : 'border-border bg-background'
                }`}
                onClick={() => moveToStep(step.key)}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{index + 1}</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{step.title}</span>
                  <WorkflowStatusBadge status={isCompleted ? 'done' : isCurrent ? 'current' : 'pending'} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </button>
            );
          })}
        </div>

        {stepErrors.length > 0 ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertDescription>{stepErrors.join(' ')}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-5" onSubmit={onCreateSubmit}>
          {currentStep === 'basics' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-foreground">{t('admin.instances.flow.realmModeTitle')}</h2>
                  <FieldHelp {...INSTANCE_FIELD_HELP.realmMode} />
                </div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.flow.realmModeSubtitle')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="instance-realm-mode"
                    checked={formValues.realmMode === 'new'}
                    onChange={() => updateForm((current) => ({ ...current, realmMode: 'new' }))}
                  />
                  <span>{t('admin.instances.flow.realmModeNew')}</span>
                </label>
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="instance-realm-mode"
                    checked={formValues.realmMode === 'existing'}
                    onChange={() => updateForm((current) => ({ ...current, realmMode: 'existing' }))}
                  />
                  <span>{t('admin.instances.flow.realmModeExisting')}</span>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <FormLabelWithHelp htmlFor="instance-id" label={t('admin.instances.form.instanceId')} helpKey="instanceId" />
                  <Input
                    id="instance-id"
                    value={formValues.instanceId}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        instanceId: event.target.value,
                        authRealm: current.authRealm ? current.authRealm : event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-display-name"
                    label={t('admin.instances.form.displayName')}
                    helpKey="displayName"
                  />
                  <Input
                    id="instance-display-name"
                    value={formValues.displayName}
                    onChange={(event) => updateForm((current) => ({ ...current, displayName: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <FormLabelWithHelp
                  htmlFor="instance-parent-domain"
                  label={t('admin.instances.form.parentDomain')}
                  helpKey="parentDomain"
                />
                <Input
                  id="instance-parent-domain"
                  value={formValues.parentDomain}
                  placeholder={suggestedParentDomain || undefined}
                  onChange={(event) => updateForm((current) => ({ ...current, parentDomain: event.target.value }))}
                />
              </div>
            </div>
          ) : null}

          {currentStep === 'auth' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <FormLabelWithHelp htmlFor="instance-auth-realm" label={t('admin.instances.form.authRealm')} helpKey="authRealm" />
                  <Input
                    id="instance-auth-realm"
                    value={formValues.authRealm}
                    onChange={(event) => updateForm((current) => ({ ...current, authRealm: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-auth-client-id"
                    label={t('admin.instances.form.authClientId')}
                    helpKey="authClientId"
                  />
                  <Input
                    id="instance-auth-client-id"
                    value={formValues.authClientId}
                    onChange={(event) => updateForm((current) => ({ ...current, authClientId: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <FormLabelWithHelp
                  htmlFor="instance-auth-issuer-url"
                  label={t('admin.instances.form.authIssuerUrl')}
                  helpKey="authIssuerUrl"
                />
                <Input
                  id="instance-auth-issuer-url"
                  value={formValues.authIssuerUrl}
                  onChange={(event) => updateForm((current) => ({ ...current, authIssuerUrl: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <FormLabelWithHelp
                  htmlFor="instance-auth-client-secret"
                  label={t('admin.instances.form.authClientSecret')}
                  helpKey="authClientSecret"
                />
                <Input
                  id="instance-auth-client-secret"
                  type="password"
                  disabled={!tenantSecretUserInputRequired}
                  placeholder={
                    tenantSecretUserInputRequired
                      ? undefined
                      : t('admin.instances.form.authClientSecretGeneratedDuringProvisioning')
                  }
                  value={formValues.authClientSecret}
                  onChange={(event) => updateForm((current) => ({ ...current, authClientSecret: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {tenantSecretUserInputRequired
                    ? t('admin.instances.wizard.authHint')
                    : t('admin.instances.wizard.authSecretGeneratedHint')}
                </p>
              </div>
            </div>
          ) : null}

          {currentStep === 'tenantAdmin' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminSubtitle')}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-username"
                    label={t('admin.instances.form.tenantAdminUsername')}
                    helpKey="tenantAdminUsername"
                  />
                  <Input
                    id="instance-admin-username"
                    value={formValues.tenantAdminBootstrap.username}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: { ...current.tenantAdminBootstrap, username: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-email"
                    label={t('admin.instances.form.tenantAdminEmail')}
                    helpKey="tenantAdminEmail"
                  />
                  <Input
                    id="instance-admin-email"
                    value={formValues.tenantAdminBootstrap.email}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: { ...current.tenantAdminBootstrap, email: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-first-name"
                    label={t('admin.instances.form.tenantAdminFirstName')}
                    helpKey="tenantAdminFirstName"
                  />
                  <Input
                    id="instance-admin-first-name"
                    value={formValues.tenantAdminBootstrap.firstName}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: { ...current.tenantAdminBootstrap, firstName: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-last-name"
                    label={t('admin.instances.form.tenantAdminLastName')}
                    helpKey="tenantAdminLastName"
                  />
                  <Input
                    id="instance-admin-last-name"
                    value={formValues.tenantAdminBootstrap.lastName}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: { ...current.tenantAdminBootstrap, lastName: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.instances.wizard.tenantAdminOptional')}</p>
            </div>
          ) : null}

          {currentStep === 'review' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">{t('admin.instances.wizard.reviewTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('admin.instances.wizard.reviewSubtitle')}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewRow label={t('admin.instances.form.instanceId')} value={formValues.instanceId || '—'} />
                <ReviewRow label={t('admin.instances.form.displayName')} value={formValues.displayName || '—'} />
                <ReviewRow label={t('admin.instances.flow.realmModeTitle')} value={getRealmModeLabel(formValues.realmMode)} />
                <ReviewRow label={t('admin.instances.form.parentDomain')} value={formValues.parentDomain || '—'} />
                <ReviewRow label={t('admin.instances.form.authRealm')} value={formValues.authRealm || '—'} />
                <ReviewRow label={t('admin.instances.form.authClientId')} value={formValues.authClientId || '—'} />
                <ReviewRow
                  label={t('admin.instances.form.authIssuerUrl')}
                  value={formValues.authIssuerUrl || t('admin.instances.wizard.reviewDefaultIssuer')}
                />
                <ReviewRow
                  label={t('admin.instances.form.tenantAdminUsername')}
                  value={formValues.tenantAdminBootstrap.username || t('admin.instances.wizard.reviewNotConfigured')}
                />
              </div>
              <div className="grid gap-2">
                {readinessChecks.map((check) => (
                  <div key={check.key} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <div className="font-medium text-foreground">{check.title}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{check.summary}</p>
                    </div>
                    <WorkflowStatusBadge status={check.ready ? 'done' : 'blocked'} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.instances.flow.createHint')}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={moveToPreviousStep} disabled={currentStep === 'basics'}>
                {t('admin.instances.wizard.actions.back')}
              </Button>
              {currentStep !== 'review' ? (
                <Button type="button" onClick={moveToNextStep}>
                  {t('admin.instances.wizard.actions.next')}
                </Button>
              ) : null}
            </div>
            {currentStep === 'review' ? <Button type="submit">{t('admin.instances.actions.create')}</Button> : null}
          </div>
        </form>
      </Card>
    </section>
  );
};
