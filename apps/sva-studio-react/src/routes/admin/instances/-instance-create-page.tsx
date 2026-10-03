import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Button,
  StudioPageTitle,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
  StudioPersistentFormError,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';

import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Card } from '../../../components/ui/card';
import { CreateAuthStep, CreateBasicsStep, CreateTenantAdminStep } from './-instance-create-fields';
import { buildCreatePayload, CreateReviewStep } from './-instance-create-review';
import { CreateWizardNavigation, readStepStatus } from './-instance-create-navigation';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import {
  asIamError,
  getInstanceDraftReadiness,
  listInstanceRealmCatalog,
  type IamHttpError,
} from '../../../lib/iam-api';
import { useStudioBranding } from '../../../providers/studio-branding-provider';
import {
  CREATE_WIZARD_STEPS,
  createEmptyCreateForm,
  createInstanceFormSchema,
  getCreateStepValidationIssues,
  getCreateStepValidationMessages,
  readSuggestedParentDomain,
} from './-instance-form-models';
import { getErrorMessage } from './-instance-error-messages';
import { WorkflowStatusBadge } from './-instance-status-badges';
import type { CreateFormValues, CreateWizardStepKey } from './-instances-shared-types';

import type { IamInstanceDraftReadiness, IamInstanceRealmCatalogEntry } from '@sva/core';

const stepOrder = CREATE_WIZARD_STEPS.map((step) => step.key);
const getStepIndex = (step: CreateWizardStepKey) => stepOrder.indexOf(step);

export const InstanceCreatePage = () => {
  const instancesApi = useInstances();
  const { branding } = useStudioBranding();
  const navigate = useNavigate();
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');
  const [currentStep, setCurrentStep] = React.useState<CreateWizardStepKey>('basics');
  const [stepErrors, setStepErrors] = React.useState<
    readonly { readonly fieldId: string; readonly message: string }[]
  >([]);
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createInstanceFormSchema()),
    defaultValues: createEmptyCreateForm(),
    shouldUnregister: false,
  });
  const formValues = useWatch({ control: form.control }) as CreateFormValues;
  const [returnToReview, setReturnToReview] = React.useState(false);
  const [realmSearch, setRealmSearch] = React.useState('');
  const [realmCatalog, setRealmCatalog] = React.useState<readonly IamInstanceRealmCatalogEntry[]>(
    []
  );
  const [realmCatalogError, setRealmCatalogError] = React.useState<IamHttpError | null>(null);
  const [draftReadiness, setDraftReadiness] = React.useState<IamInstanceDraftReadiness | null>(
    null
  );
  const [draftReadinessError, setDraftReadinessError] = React.useState<IamHttpError | null>(null);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const readinessRequestRef = React.useRef(0);
  const createInFlight = React.useRef(false);
  const errorSummaryRef = React.useRef<HTMLDivElement | null>(null);
  const saveFeedback = useStudioSaveFeedback();

  React.useEffect(() => {
    const parentDomain = readSuggestedParentDomain();
    setSuggestedParentDomain(parentDomain);
    if (!form.getValues('parentDomain')) form.reset(createEmptyCreateForm(parentDomain));
  }, []);

  const updateForm = (updater: (current: CreateFormValues) => CreateFormValues) => {
    readinessRequestRef.current += 1;
    saveFeedback.markDirty();
    const next = updater(form.getValues());
    for (const key of Object.keys(next) as (keyof CreateFormValues)[]) {
      form.setValue(key, next[key], { shouldDirty: true });
    }
    setReadinessLoading(false);
    setStepErrors([]);
    setDraftReadiness(null);
    setDraftReadinessError(null);
  };

  React.useEffect(() => {
    if (formValues.realmMode !== 'existing') {
      setRealmCatalog([]);
      setRealmCatalogError(null);
      return;
    }
    let current = true;
    const timer = globalThis.setTimeout(() => {
      void listInstanceRealmCatalog({ search: realmSearch.trim() || undefined, pageSize: 100 })
        .then((catalog) => {
          if (current) {
            setRealmCatalog(catalog.data);
            setRealmCatalogError(null);
          }
        })
        .catch((error: unknown) => {
          if (current) setRealmCatalogError(asIamError(error));
        });
    }, 200);
    return () => {
      current = false;
      globalThis.clearTimeout(timer);
    };
  }, [formValues.realmMode, realmSearch]);

  const refreshDraftReadiness = React.useCallback(async () => {
    const requestSequence = ++readinessRequestRef.current;
    const validationMessages = getCreateStepValidationMessages('review', formValues);
    if (validationMessages.length > 0) {
      if (requestSequence === readinessRequestRef.current) setDraftReadiness(null);
      return;
    }
    setReadinessLoading(true);
    setDraftReadinessError(null);
    try {
      const response = await getInstanceDraftReadiness(buildCreatePayload(formValues));
      if (requestSequence === readinessRequestRef.current) setDraftReadiness(response.data);
    } catch (error: unknown) {
      if (requestSequence === readinessRequestRef.current) {
        setDraftReadiness(null);
        setDraftReadinessError(asIamError(error));
      }
    } finally {
      if (requestSequence === readinessRequestRef.current) setReadinessLoading(false);
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
      const firstInvalidStep = stepOrder
        .slice(0, nextIndex)
        .find((candidate) => getCreateStepValidationIssues(candidate, formValues).length > 0);
      if (firstInvalidStep) {
        const validationIssues = getCreateStepValidationIssues(firstInvalidStep, formValues);
        setStepErrors(validationIssues);
        setCurrentStep(firstInvalidStep);
        globalThis.setTimeout(() => errorSummaryRef.current?.focus(), 0);
        return;
      }
    }

    setStepErrors([]);
    setCurrentStep(step);
    if (step === 'review') setReturnToReview(false);
  };

  const moveToNextStep = () => {
    if (returnToReview) {
      moveToStep('review');
      return;
    }
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

    if (createInFlight.current) return;
    createInFlight.current = true;
    const readinessSequence = readinessRequestRef.current;
    try {
      if (!(await form.trigger()) || readinessSequence !== readinessRequestRef.current) return;
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
    } finally {
      createInFlight.current = false;
    }
  };

  const onCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void createCurrentInstance();
  };

  const errorFor = (fieldId: string) => stepErrors.find((issue) => issue.fieldId === fieldId);
  const fieldErrorProps = (fieldId: string) =>
    getStudioFormFieldProps({
      id: fieldId,
      error: errorFor(fieldId)
        ? { type: 'validate', message: errorFor(fieldId)?.message }
        : undefined,
    }).controlProps;
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
  const selectedRealmOption =
    realmOptions.find(({ value }) => value === formValues.authRealm) ??
    (formValues.authRealm ? { value: formValues.authRealm, label: formValues.authRealm } : null);

  return (
    <section className="min-w-0 space-y-5 break-words" aria-busy={instancesApi.isLoading}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64 space-y-2">
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3">
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
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{step.title}</span>
                  <WorkflowStatusBadge status={status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </button>
            );
          })}
        </div>

        <div ref={errorSummaryRef} tabIndex={-1}>
          <StudioFormSummaryErrors
            errors={stepErrors.map(({ fieldId, message }) => ({ field: fieldId, message }))}
            onSelectError={({ field }) => {
              const step = field.startsWith('instance-admin-')
                ? 'tenantAdmin'
                : field === 'instance-auth-realm'
                  ? 'auth'
                  : 'basics';
              setCurrentStep(step);
            }}
          />
        </div>

        <form className="space-y-5" onSubmit={onCreateSubmit} noValidate>
          {currentStep === 'basics' ? (
            <CreateBasicsStep
              formValues={formValues}
              updateForm={updateForm}
              fieldErrorProps={fieldErrorProps}
              renderFieldError={renderFieldError}
              branding={branding}
              suggestedParentDomain={suggestedParentDomain}
            />
          ) : null}

          {currentStep === 'auth' ? (
            <CreateAuthStep
              formValues={formValues}
              updateForm={updateForm}
              fieldErrorProps={fieldErrorProps}
              renderFieldError={renderFieldError}
              realmOptions={realmOptions}
              selectedRealmOption={selectedRealmOption}
              realmSearch={realmSearch}
              setRealmSearch={setRealmSearch}
              realmCatalogError={realmCatalogError}
              errorFor={errorFor}
            />
          ) : null}

          {currentStep === 'tenantAdmin' ? (
            <CreateTenantAdminStep
              formValues={formValues}
              updateForm={updateForm}
              fieldErrorProps={fieldErrorProps}
              renderFieldError={renderFieldError}
            />
          ) : null}

          {currentStep === 'review' ? (
            <CreateReviewStep
              formValues={formValues}
              draftReadiness={draftReadiness}
              draftReadinessError={draftReadinessError}
              readinessLoading={readinessLoading}
              setReturnToReview={setReturnToReview}
              moveToStep={moveToStep}
              refreshDraftReadiness={refreshDraftReadiness}
            />
          ) : null}

          <CreateWizardNavigation
            currentStep={currentStep}
            returnToReview={returnToReview}
            moveToPreviousStep={moveToPreviousStep}
            moveToNextStep={moveToNextStep}
            saveStatus={saveFeedback.status}
            readinessLoading={readinessLoading}
            draftReadiness={draftReadiness}
          />
        </form>
      </Card>
    </section>
  );
};
