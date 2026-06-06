import type { IamInstanceDetail } from '@sva/core';

import { t } from '../../../i18n';
import type {
  CreateFormValues,
  CreateWizardStepKey,
  DetailFormValues,
  InstanceFieldHelpKey,
  SelectedInstance,
} from './-instances-shared-types';
import { INSTANCE_STATUS_LABELS } from './-instances-shared-types';

export const isTenantSecretUserInputRequired = (realmMode: 'new' | 'existing') => realmMode === 'existing';

export const readSuggestedParentDomain = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
};

export const createEmptyTenantAdminBootstrap = () => ({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
});

export const createEmptyTenantAdminClient = () => ({
  clientId: 'sva-studio-realm-admin',
  secret: '',
});

export const createEmptyCreateForm = (parentDomain = ''): CreateFormValues => ({
  instanceId: '',
  displayName: '',
  parentDomain,
  realmMode: 'new',
  authRealm: '',
  authClientId: 'sva-studio-login',
  authIssuerUrl: '',
  authClientSecret: '',
  tenantAdminClient: createEmptyTenantAdminClient(),
  tenantAdminBootstrap: createEmptyTenantAdminBootstrap(),
});

export const createDetailForm = (instance: SelectedInstance): DetailFormValues => ({
  displayName: instance.displayName,
  parentDomain: instance.parentDomain,
  realmMode: instance.realmMode,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl ?? '',
  authClientSecret: '',
  tenantAdminClient: {
    clientId: instance.tenantAdminClient?.clientId ?? '',
    secret: '',
  },
  tenantAdminBootstrap: {
    username: instance.tenantAdminBootstrap?.username ?? '',
    email: instance.tenantAdminBootstrap?.email ?? '',
    firstName: instance.tenantAdminBootstrap?.firstName ?? '',
    lastName: instance.tenantAdminBootstrap?.lastName ?? '',
  },
  tenantAdminTemporaryPassword: '',
});

export const CREATE_WIZARD_STEPS: readonly { key: CreateWizardStepKey; title: string; description: string }[] = [
  {
    key: 'basics',
    title: t('admin.instances.wizard.steps.basics.title'),
    description: t('admin.instances.wizard.steps.basics.description'),
  },
  {
    key: 'auth',
    title: t('admin.instances.wizard.steps.auth.title'),
    description: t('admin.instances.wizard.steps.auth.description'),
  },
  {
    key: 'tenantAdmin',
    title: t('admin.instances.wizard.steps.tenantAdmin.title'),
    description: t('admin.instances.wizard.steps.tenantAdmin.description'),
  },
  {
    key: 'review',
    title: t('admin.instances.wizard.steps.review.title'),
    description: t('admin.instances.wizard.steps.review.description'),
  },
] as const;

export const INSTANCE_FIELD_HELP: Record<
  InstanceFieldHelpKey,
  {
    readonly title: string;
    readonly what: string;
    readonly value: string;
    readonly source: string;
    readonly impact: string;
    readonly defaultHint?: string;
  }
> = {
  realmMode: {
    title: t('admin.instances.help.realmMode.title'),
    what: t('admin.instances.help.realmMode.what'),
    value: t('admin.instances.help.realmMode.value'),
    source: t('admin.instances.help.realmMode.source'),
    impact: t('admin.instances.help.realmMode.impact'),
    defaultHint: t('admin.instances.help.realmMode.defaultHint'),
  },
  instanceId: {
    title: t('admin.instances.help.instanceId.title'),
    what: t('admin.instances.help.instanceId.what'),
    value: t('admin.instances.help.instanceId.value'),
    source: t('admin.instances.help.instanceId.source'),
    impact: t('admin.instances.help.instanceId.impact'),
  },
  displayName: {
    title: t('admin.instances.help.displayName.title'),
    what: t('admin.instances.help.displayName.what'),
    value: t('admin.instances.help.displayName.value'),
    source: t('admin.instances.help.displayName.source'),
    impact: t('admin.instances.help.displayName.impact'),
  },
  parentDomain: {
    title: t('admin.instances.help.parentDomain.title'),
    what: t('admin.instances.help.parentDomain.what'),
    value: t('admin.instances.help.parentDomain.value'),
    source: t('admin.instances.help.parentDomain.source'),
    impact: t('admin.instances.help.parentDomain.impact'),
    defaultHint: t('admin.instances.help.parentDomain.defaultHint'),
  },
  authRealm: {
    title: t('admin.instances.help.authRealm.title'),
    what: t('admin.instances.help.authRealm.what'),
    value: t('admin.instances.help.authRealm.value'),
    source: t('admin.instances.help.authRealm.source'),
    impact: t('admin.instances.help.authRealm.impact'),
  },
  authClientId: {
    title: t('admin.instances.help.authClientId.title'),
    what: t('admin.instances.help.authClientId.what'),
    value: t('admin.instances.help.authClientId.value'),
    source: t('admin.instances.help.authClientId.source'),
    impact: t('admin.instances.help.authClientId.impact'),
    defaultHint: t('admin.instances.help.authClientId.defaultHint'),
  },
  authIssuerUrl: {
    title: t('admin.instances.help.authIssuerUrl.title'),
    what: t('admin.instances.help.authIssuerUrl.what'),
    value: t('admin.instances.help.authIssuerUrl.value'),
    source: t('admin.instances.help.authIssuerUrl.source'),
    impact: t('admin.instances.help.authIssuerUrl.impact'),
    defaultHint: t('admin.instances.help.authIssuerUrl.defaultHint'),
  },
  authClientSecret: {
    title: t('admin.instances.help.authClientSecret.title'),
    what: t('admin.instances.help.authClientSecret.what'),
    value: t('admin.instances.help.authClientSecret.value'),
    source: t('admin.instances.help.authClientSecret.source'),
    impact: t('admin.instances.help.authClientSecret.impact'),
  },
  tenantAdminClientId: {
    title: t('admin.instances.help.tenantAdminClientId.title'),
    what: t('admin.instances.help.tenantAdminClientId.what'),
    value: t('admin.instances.help.tenantAdminClientId.value'),
    source: t('admin.instances.help.tenantAdminClientId.source'),
    impact: t('admin.instances.help.tenantAdminClientId.impact'),
    defaultHint: t('admin.instances.help.tenantAdminClientId.defaultHint'),
  },
  tenantAdminClientSecret: {
    title: t('admin.instances.help.tenantAdminClientSecret.title'),
    what: t('admin.instances.help.tenantAdminClientSecret.what'),
    value: t('admin.instances.help.tenantAdminClientSecret.value'),
    source: t('admin.instances.help.tenantAdminClientSecret.source'),
    impact: t('admin.instances.help.tenantAdminClientSecret.impact'),
  },
  tenantAdminUsername: {
    title: t('admin.instances.help.tenantAdminUsername.title'),
    what: t('admin.instances.help.tenantAdminUsername.what'),
    value: t('admin.instances.help.tenantAdminUsername.value'),
    source: t('admin.instances.help.tenantAdminUsername.source'),
    impact: t('admin.instances.help.tenantAdminUsername.impact'),
  },
  tenantAdminEmail: {
    title: t('admin.instances.help.tenantAdminEmail.title'),
    what: t('admin.instances.help.tenantAdminEmail.what'),
    value: t('admin.instances.help.tenantAdminEmail.value'),
    source: t('admin.instances.help.tenantAdminEmail.source'),
    impact: t('admin.instances.help.tenantAdminEmail.impact'),
  },
  tenantAdminFirstName: {
    title: t('admin.instances.help.tenantAdminFirstName.title'),
    what: t('admin.instances.help.tenantAdminFirstName.what'),
    value: t('admin.instances.help.tenantAdminFirstName.value'),
    source: t('admin.instances.help.tenantAdminFirstName.source'),
    impact: t('admin.instances.help.tenantAdminFirstName.impact'),
  },
  tenantAdminLastName: {
    title: t('admin.instances.help.tenantAdminLastName.title'),
    what: t('admin.instances.help.tenantAdminLastName.what'),
    value: t('admin.instances.help.tenantAdminLastName.value'),
    source: t('admin.instances.help.tenantAdminLastName.source'),
    impact: t('admin.instances.help.tenantAdminLastName.impact'),
  },
};

const trimValue = (value: string) => value.trim();
const AUTH_REALM_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const isValidAuthRealmValue = (value: string) => AUTH_REALM_REGEX.test(trimValue(value));

export const getCreateStepValidationMessages = (step: CreateWizardStepKey, formValues: CreateFormValues): string[] => {
  if (step === 'basics') {
    return [
      !trimValue(formValues.instanceId) ? t('admin.instances.wizard.validation.instanceId') : null,
      !trimValue(formValues.displayName) ? t('admin.instances.wizard.validation.displayName') : null,
      !trimValue(formValues.parentDomain) ? t('admin.instances.wizard.validation.parentDomain') : null,
    ].filter((value): value is string => Boolean(value));
  }

  if (step === 'auth') {
    return [
      !trimValue(formValues.authRealm) ? t('admin.instances.wizard.validation.authRealm') : null,
      trimValue(formValues.authRealm) && !isValidAuthRealmValue(formValues.authRealm)
        ? t('admin.instances.wizard.validation.authRealmFormat')
        : null,
      !trimValue(formValues.authClientId) ? t('admin.instances.wizard.validation.authClientId') : null,
      isTenantSecretUserInputRequired(formValues.realmMode) && !trimValue(formValues.authClientSecret)
        ? t('admin.instances.wizard.validation.authClientSecret')
        : null,
      !trimValue(formValues.tenantAdminClient.clientId) ? t('admin.instances.wizard.validation.tenantAdminClientId') : null,
      isTenantSecretUserInputRequired(formValues.realmMode) && !trimValue(formValues.tenantAdminClient.secret)
        ? t('admin.instances.wizard.validation.tenantAdminClientSecret')
        : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [];
};

export const getCreateReadinessChecks = (formValues: CreateFormValues) => [
  {
    key: 'secret',
    title: t('admin.instances.wizard.readiness.secretTitle'),
    ready: isTenantSecretUserInputRequired(formValues.realmMode) ? Boolean(trimValue(formValues.authClientSecret)) : true,
    summary: isTenantSecretUserInputRequired(formValues.realmMode)
      ? trimValue(formValues.authClientSecret)
        ? t('admin.instances.wizard.readiness.secretReady')
        : t('admin.instances.wizard.readiness.secretMissing')
      : t('admin.instances.wizard.readiness.secretGenerated'),
  },
  {
    key: 'tenantAdmin',
    title: t('admin.instances.wizard.readiness.tenantAdminTitle'),
    ready: Boolean(trimValue(formValues.tenantAdminBootstrap.username)),
    summary: trimValue(formValues.tenantAdminBootstrap.username)
      ? t('admin.instances.wizard.readiness.tenantAdminReady')
      : t('admin.instances.wizard.readiness.tenantAdminMissing'),
  },
  {
    key: 'followUp',
    title: t('admin.instances.wizard.readiness.followUpTitle'),
    ready: false,
    summary: t('admin.instances.wizard.readiness.followUpSummary'),
  },
];

export const getPostCreateGuidance = (instance: {
  instanceId: string;
  status: IamInstanceDetail['status'];
  primaryHostname: string;
  authRealm: string;
}) => ({
  title: t('admin.instances.success.title'),
  summary: t('admin.instances.success.summary', {
    instanceId: instance.instanceId,
    status: t(INSTANCE_STATUS_LABELS[instance.status]),
  }),
  nextSteps: [
    t('admin.instances.success.nextSteps.openSetup'),
    t('admin.instances.success.nextSteps.runProvisioning', { realm: instance.authRealm }),
    t('admin.instances.success.nextSteps.activate', { hostname: instance.primaryHostname }),
  ],
});
