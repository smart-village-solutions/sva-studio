import { Link, useNavigate } from '@tanstack/react-router';
import {
  Button,
  StudioPageTitle,
  StudioPersistentFormError,
  StudioSaveButton,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';

import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import {
  getInstanceDraftReadiness,
  listInstanceRealmCatalog,
  type CreateInstancePayload,
} from '../../../lib/iam-api';
import { useStudioBranding } from '../../../providers/studio-branding-provider';
import { FieldHelp } from './-field-help';
import {
  CREATE_WIZARD_STEPS,
  createEmptyCreateForm,
  getCreateStepValidationIssues,
  getCreateStepValidationMessages,
  INSTANCE_FIELD_HELP,
  readSuggestedParentDomain,
} from './-instance-form-models';
import { getErrorMessage } from './-instance-error-messages';
import { WorkflowStatusBadge } from './-instance-status-badges';
import type { CreateFormValues, CreateWizardStepKey } from './-instances-shared-types';

import type { IamInstanceDraftReadiness, IamInstanceRealmCatalogEntry } from '@sva/core';

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
  realmMode === 'new'
    ? t('admin.instances.flow.realmModeNewLabel')
    : t('admin.instances.flow.realmModeExistingLabel');
const readStepStatus = (isCompleted: boolean, isCurrent: boolean) => {
  if (isCompleted) {
    return 'done' as const;
  }

  if (isCurrent) {
    return 'current' as const;
  }

  return 'pending' as const;
};
const buildCreatePayload = (formValues: CreateFormValues): CreateInstancePayload => {
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

export const InstanceCreatePage = () => {
  const instancesApi = useInstances();
  const { branding } = useStudioBranding();
  const navigate = useNavigate();
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');
  const [currentStep, setCurrentStep] = React.useState<CreateWizardStepKey>('basics');
  const [stepErrors, setStepErrors] = React.useState<
    readonly { readonly fieldId: string; readonly message: string }[]
  >([]);
  const [formValues, setFormValues] = React.useState(createEmptyCreateForm());
  const [realmSearch, setRealmSearch] = React.useState('');
  const [realmCatalog, setRealmCatalog] = React.useState<readonly IamInstanceRealmCatalogEntry[]>(
    []
  );
  const [draftReadiness, setDraftReadiness] = React.useState<IamInstanceDraftReadiness | null>(
    null
  );
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const errorSummaryRef = React.useRef<HTMLDivElement | null>(null);
  const saveFeedback = useStudioSaveFeedback();

  React.useEffect(() => {
    const parentDomain = readSuggestedParentDomain();
    setSuggestedParentDomain(parentDomain);
    setFormValues((current) =>
      current.parentDomain ? current : createEmptyCreateForm(parentDomain)
    );
  }, []);

  const updateForm = (updater: (current: CreateFormValues) => CreateFormValues) => {
    saveFeedback.markDirty();
    setFormValues((current) => updater(current));
    setStepErrors([]);
    setDraftReadiness(null);
  };

  React.useEffect(() => {
    if (formValues.realmMode !== 'existing') {
      setRealmCatalog([]);
      return;
    }
    let current = true;
    const timer = globalThis.setTimeout(() => {
      void listInstanceRealmCatalog({ search: realmSearch.trim() || undefined, pageSize: 100 })
        .then((catalog) => {
          if (current) setRealmCatalog(catalog.data);
        })
        .catch(() => {
          if (current) setRealmCatalog([]);
        });
    }, 200);
    return () => {
      current = false;
      globalThis.clearTimeout(timer);
    };
  }, [formValues.realmMode, realmSearch]);

  const refreshDraftReadiness = React.useCallback(async () => {
    const validationMessages = getCreateStepValidationMessages('review', formValues);
    if (validationMessages.length > 0) {
      setDraftReadiness(null);
      return;
    }
    setReadinessLoading(true);
    try {
      const response = await getInstanceDraftReadiness(buildCreatePayload(formValues));
      setDraftReadiness(response.data);
    } catch {
      setDraftReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, [formValues]);

  React.useEffect(() => {
    if (currentStep !== 'review') return;
    void refreshDraftReadiness();
  }, [currentStep, refreshDraftReadiness]);

  const moveToStep = (step: CreateWizardStepKey) => {
    const nextIndex = getStepIndex(step);
    const currentIndex = getStepIndex(currentStep);
    if (nextIndex > currentIndex) {
      const validationIssues = getCreateStepValidationIssues(currentStep, formValues);
      if (validationIssues.length > 0) {
        setStepErrors(validationIssues);
        globalThis.setTimeout(() => errorSummaryRef.current?.focus(), 0);
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

  const createCurrentInstance = async () => {
    const validationIssues = getCreateStepValidationIssues('review', formValues);
    if (validationIssues.length > 0) {
      setStepErrors(validationIssues);
      const firstInvalidStep = stepOrder.find(
        (step) => getCreateStepValidationMessages(step, formValues).length > 0
      );
      if (firstInvalidStep) setCurrentStep(firstInvalidStep);
      globalThis.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }
    if (!draftReadiness || draftReadiness.createBlockers.length > 0) {
      await refreshDraftReadiness();
      return;
    }

    const operationId = saveFeedback.beginSaving();
    const created = await instancesApi.createInstance(buildCreatePayload(formValues));

    if (!created) {
      saveFeedback.markFailed(operationId);
      return;
    }

    saveFeedback.markSaved(operationId);
    await navigate({
      to: '/admin/instances/$instanceId',
      params: { instanceId: created.instanceId },
    });
  };

  const onCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void createCurrentInstance();
  };

  const errorFor = (fieldId: string) => stepErrors.find((issue) => issue.fieldId === fieldId);
  const fieldErrorProps = (fieldId: string) => ({
    'aria-invalid': Boolean(errorFor(fieldId)) || undefined,
    'aria-describedby': errorFor(fieldId) ? `${fieldId}-error` : undefined,
  });
  const renderFieldError = (fieldId: string) => {
    const issue = errorFor(fieldId);
    return issue ? (
      <p id={`${fieldId}-error`} className="text-xs text-destructive">
        {issue.message}
      </p>
    ) : null;
  };
  const realmOptions = realmCatalog.map((entry) => ({
    value: entry.realm,
    label: entry.realm,
    disabled: entry.status === 'disabled',
    description: entry.reasonCode
      ? t(`admin.instances.wizard.realmCatalog.${entry.reasonCode}`)
      : undefined,
  }));

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <StudioPageTitle withAccessory>{t('admin.instances.form.title')}</StudioPageTitle>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('admin.instances.form.subtitle')}
          </p>
        </div>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </header>

      {instancesApi.mutationError ? (
        <StudioPersistentFormError
          message={getErrorMessage(instancesApi.mutationError)}
          details={<IamRuntimeDiagnosticDetails error={instancesApi.mutationError} />}
          retryLabel={t('account.actions.retry')}
          retryDisabled={saveFeedback.status === 'saving'}
          onRetry={() => void createCurrentInstance()}
        />
      ) : null}

      <Card className="space-y-5 p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          {CREATE_WIZARD_STEPS.map((step, index) => {
            const isCurrent = step.key === currentStep;
            const isCompleted = getStepIndex(currentStep) > index;
            const status = readStepStatus(isCompleted, isCurrent);
            return (
              <button
                key={step.key}
                type="button"
                className={`rounded-xl border p-3 text-left transition ${
                  isCurrent ? 'border-foreground bg-accent/40' : 'border-border bg-background'
                }`}
                onClick={() => moveToStep(step.key)}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {index + 1}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{step.title}</span>
                  <WorkflowStatusBadge status={status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </button>
            );
          })}
        </div>

        {stepErrors.length > 0 ? (
          <Alert
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive"
          >
            <AlertDescription>
              <ul className="space-y-1">
                {stepErrors.map((issue) => (
                  <li key={`${issue.fieldId}-${issue.message}`}>
                    <a className="underline" href={`#${issue.fieldId}`}>
                      {issue.message}
                    </a>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-5" onSubmit={onCreateSubmit}>
          {currentStep === 'basics' ? (
            <div className="space-y-4">
              <ReviewRow
                label={t('admin.instances.wizard.studioInstanceLabel')}
                value={
                  branding === 'kassel-dialog'
                    ? t('admin.instances.wizard.studioInstanceKassel')
                    : t('admin.instances.wizard.studioInstanceSva')
                }
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-foreground">
                    {t('admin.instances.flow.realmModeTitle')}
                  </h2>
                  <FieldHelp {...INSTANCE_FIELD_HELP.realmMode} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.flow.realmModeSubtitle')}
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="instance-realm-mode"
                    checked={formValues.realmMode === 'new'}
                    onChange={() =>
                      updateForm((current) => ({
                        ...current,
                        realmMode: 'new',
                        authRealm: current.instanceId,
                        authClientId: 'sva-studio-login',
                        authIssuerUrl: '',
                        authClientSecret: '',
                        tenantAdminClient: {
                          clientId: 'sva-studio-realm-admin',
                          secret: '',
                        },
                      }))
                    }
                  />
                  <span>{t('admin.instances.flow.realmModeNew')}</span>
                </label>
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="radio"
                    name="instance-realm-mode"
                    checked={formValues.realmMode === 'existing'}
                    onChange={() =>
                      updateForm((current) => ({ ...current, realmMode: 'existing' }))
                    }
                  />
                  <span>{t('admin.instances.flow.realmModeExisting')}</span>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-id"
                    label={t('admin.instances.form.instanceId')}
                    helpKey="instanceId"
                  />
                  <Input
                    id="instance-id"
                    {...fieldErrorProps('instance-id')}
                    value={formValues.instanceId}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        instanceId: event.target.value,
                        authRealm:
                          current.realmMode === 'new' ? event.target.value : current.authRealm,
                      }))
                    }
                  />
                  {renderFieldError('instance-id')}
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-display-name"
                    label={t('admin.instances.form.displayName')}
                    helpKey="displayName"
                  />
                  <Input
                    id="instance-display-name"
                    {...fieldErrorProps('instance-display-name')}
                    value={formValues.displayName}
                    onChange={(event) =>
                      updateForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                  />
                  {renderFieldError('instance-display-name')}
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
                  {...fieldErrorProps('instance-parent-domain')}
                  value={formValues.parentDomain}
                  placeholder={suggestedParentDomain || undefined}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, parentDomain: event.target.value }))
                  }
                />
                {renderFieldError('instance-parent-domain')}
              </div>
            </div>
          ) : null}

          {currentStep === 'auth' ? (
            <div className="space-y-4">
              {formValues.realmMode === 'new' ? (
                <>
                  <Alert>
                    <AlertDescription>
                      {t('admin.instances.wizard.newRealmBaselineSummary')}
                    </AlertDescription>
                  </Alert>
                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      {t('admin.instances.wizard.technicalDetails')}
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('admin.instances.wizard.existingRealmTechnicalDetails', {
                        loginClient: 'sva-studio-login',
                        adminClient: 'sva-studio-realm-admin',
                      })}
                    </p>
                  </details>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="instance-auth-realm">
                        {t('admin.instances.form.authRealm')}
                      </Label>
                      <FieldHelp {...INSTANCE_FIELD_HELP.authRealm} />
                    </div>
                    <SearchableSelect
                      id="instance-auth-realm"
                      label={t('admin.instances.form.authRealm')}
                      value={formValues.authRealm}
                      placeholder={t('admin.instances.wizard.realmCatalog.placeholder')}
                      searchPlaceholder={t('admin.instances.wizard.realmCatalog.search')}
                      emptyText={t('admin.instances.wizard.realmCatalog.empty')}
                      options={realmOptions}
                      searchValue={realmSearch}
                      onSearchValueChange={setRealmSearch}
                      onValueChange={(value) =>
                        updateForm((current) => ({ ...current, authRealm: value }))
                      }
                      ariaInvalid={Boolean(errorFor('instance-auth-realm')) || undefined}
                      describedBy={
                        errorFor('instance-auth-realm') ? 'instance-auth-realm-error' : undefined
                      }
                    />
                    {renderFieldError('instance-auth-realm')}
                  </div>
                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      {t('admin.instances.wizard.technicalDetails')}
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('admin.instances.wizard.existingRealmTechnicalDetails', {
                        loginClient: 'sva-studio-login',
                        adminClient: 'sva-studio-realm-admin',
                      })}
                    </p>
                  </details>
                </>
              )}
            </div>
          ) : null}

          {currentStep === 'tenantAdmin' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">
                  {t('admin.instances.form.tenantAdminTitle')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.form.tenantAdminSubtitle')}
                </p>
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
                    {...fieldErrorProps('instance-admin-username')}
                    value={formValues.tenantAdminBootstrap.username}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: {
                          ...current.tenantAdminBootstrap,
                          username: event.target.value,
                        },
                      }))
                    }
                  />
                  {renderFieldError('instance-admin-username')}
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-email"
                    label={t('admin.instances.form.tenantAdminEmail')}
                    helpKey="tenantAdminEmail"
                  />
                  <Input
                    id="instance-admin-email"
                    type="email"
                    {...fieldErrorProps('instance-admin-email')}
                    value={formValues.tenantAdminBootstrap.email}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: {
                          ...current.tenantAdminBootstrap,
                          email: event.target.value,
                        },
                      }))
                    }
                  />
                  {renderFieldError('instance-admin-email')}
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
                    {...fieldErrorProps('instance-admin-first-name')}
                    value={formValues.tenantAdminBootstrap.firstName}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: {
                          ...current.tenantAdminBootstrap,
                          firstName: event.target.value,
                        },
                      }))
                    }
                  />
                  {renderFieldError('instance-admin-first-name')}
                </div>
                <div className="space-y-1">
                  <FormLabelWithHelp
                    htmlFor="instance-admin-last-name"
                    label={t('admin.instances.form.tenantAdminLastName')}
                    helpKey="tenantAdminLastName"
                  />
                  <Input
                    id="instance-admin-last-name"
                    {...fieldErrorProps('instance-admin-last-name')}
                    value={formValues.tenantAdminBootstrap.lastName}
                    onChange={(event) =>
                      updateForm((current) => ({
                        ...current,
                        tenantAdminBootstrap: {
                          ...current.tenantAdminBootstrap,
                          lastName: event.target.value,
                        },
                      }))
                    }
                  />
                  {renderFieldError('instance-admin-last-name')}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('admin.instances.wizard.tenantAdminOptional')}
              </p>
            </div>
          ) : null}

          {currentStep === 'review' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">
                  {t('admin.instances.wizard.reviewTitle')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t('admin.instances.wizard.reviewSubtitle')}
                </p>
              </div>
              {formValues.realmMode === 'new' ? (
                <Alert>
                  <AlertDescription>
                    {t('admin.instances.wizard.newRealmBaselineSummary')}
                  </AlertDescription>
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
                <ReviewRow
                  label={t('admin.instances.form.authRealm')}
                  value={formValues.authRealm || '—'}
                />
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
                  value={
                    formValues.authIssuerUrl || t('admin.instances.wizard.reviewDefaultIssuer')
                  }
                />
                <ReviewRow
                  label={t('admin.instances.form.tenantAdminUsername')}
                  value={
                    formValues.tenantAdminBootstrap.username ||
                    t('admin.instances.wizard.reviewNotConfigured')
                  }
                />
              </div>
              {readinessLoading ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {t('admin.instances.wizard.readiness.serverChecking')}
                </p>
              ) : draftReadiness ? (
                <div className="space-y-4">
                  {[
                    {
                      key: 'create',
                      title: t('admin.instances.wizard.readiness.createGroup'),
                      findings: draftReadiness.createBlockers,
                    },
                    {
                      key: 'provisioning',
                      title: t('admin.instances.wizard.readiness.provisioningGroup'),
                      findings: [
                        ...draftReadiness.provisioningBlockers,
                        ...draftReadiness.backgroundCapabilities
                          .filter(
                            (capability) =>
                              capability.status !== 'ready' && capability.status !== 'not_required'
                          )
                          .map((capability) => ({
                            checkKey: capability.capability,
                            title: t(
                              `admin.instances.wizard.capabilities.${capability.capability}`
                            ),
                            status:
                              capability.status === 'blocked'
                                ? ('blocked' as const)
                                : ('warning' as const),
                            summary: `${capability.summary} ${capability.remediation}`,
                            details: { reasonCode: capability.reasonCode },
                          })),
                      ],
                    },
                    {
                      key: 'activation',
                      title: t('admin.instances.wizard.readiness.activationGroup'),
                      findings: draftReadiness.activationBlockers,
                    },
                  ].map((group) => (
                    <section
                      key={group.key}
                      className="space-y-2"
                      aria-labelledby={`readiness-${group.key}`}
                    >
                      <h3
                        id={`readiness-${group.key}`}
                        className="text-sm font-medium text-foreground"
                      >
                        {group.title}
                      </h3>
                      {group.findings.length > 0 ? (
                        group.findings.map((finding) => (
                          <div
                            key={`${group.key}-${finding.checkKey}`}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                          >
                            <div>
                              <div className="font-medium text-foreground">{finding.title}</div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {finding.summary}
                              </p>
                            </div>
                            <WorkflowStatusBadge
                              status={finding.status === 'blocked' ? 'blocked' : 'pending'}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('admin.instances.wizard.readiness.noBlockers')}
                        </p>
                      )}
                    </section>
                  ))}
                  {draftReadiness.realmSuitability ? (
                    <Alert>
                      <AlertDescription>
                        {t(
                          `admin.instances.wizard.realmSuitability.${draftReadiness.realmSuitability.classification}`
                        )}{' '}
                        {draftReadiness.realmSuitability.remediation}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : (
                <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                  <AlertDescription>
                    {t('admin.instances.wizard.readiness.serverUnavailable')}
                  </AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={readinessLoading}
                onClick={() => void refreshDraftReadiness()}
              >
                {t('admin.instances.wizard.readiness.recheck')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('admin.instances.flow.createHint')}
              </p>
            </div>
          ) : null}

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
                  {t('admin.instances.wizard.actions.next')}
                </Button>
              ) : null}
            </div>
            {currentStep === 'review' ? (
              <StudioSaveButton
                type="submit"
                status={saveFeedback.status}
                disabled={
                  readinessLoading || !draftReadiness || draftReadiness.createBlockers.length > 0
                }
                labels={{
                  idle: t('admin.instances.actions.create'),
                  saving: t('account.actions.saving'),
                  saved: t('account.actions.saved'),
                }}
              />
            ) : null}
          </div>
        </form>
      </Card>
    </section>
  );
};
