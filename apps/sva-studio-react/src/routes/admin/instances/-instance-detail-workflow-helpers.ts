import { t } from '../../../i18n';

import type { IamHttpError } from '../../../lib/iam-api';
import { INSTANCE_STATUS_LABELS, type SetupWorkflowStep } from './-instances-shared-types';
import {
  createWorkflowStep,
  findPreflightCheck,
  readRequirementGroupSatisfied,
  type IamInstanceDetail,
} from './-instance-detail-shared';
import {
  createActivationStep,
  createProvisioningStep,
  createTenantAdminStep,
  createTenantSecretStep,
} from './-instance-detail-workflow-step-builders';

export type WorkflowFacts = {
  readonly instance: IamInstanceDetail;
  readonly keycloakUnavailable: boolean;
  readonly keycloakAccessReady: boolean;
  readonly realmBlocked: boolean;
  readonly provisioningQueued: boolean;
  readonly provisioningSucceeded: boolean;
  readonly provisioningFailed: boolean;
  readonly provisioningRunning: boolean;
  readonly tenantAdminConfigured: boolean;
  readonly tenantAdminClientConfigured: boolean;
  readonly tenantAdminClientSecretConfigured: boolean;
  readonly tenantAdminClientReady: boolean;
};

const collectWorkflowFacts = (instance: IamInstanceDetail, mutationError: IamHttpError | null): WorkflowFacts => {
  const keycloakAccessCheck = findPreflightCheck(instance.keycloakPreflight, 'keycloak_admin_access');
  const realmModeCheck = findPreflightCheck(instance.keycloakPreflight, 'realm_mode');
  const latestKeycloakRun = instance.latestKeycloakProvisioningRun ?? instance.keycloakProvisioningRuns[0];

  return {
    instance,
    keycloakUnavailable: mutationError?.code === 'keycloak_unavailable',
    keycloakAccessReady: keycloakAccessCheck?.status === 'ready',
    realmBlocked: realmModeCheck?.status === 'blocked',
    provisioningQueued: latestKeycloakRun?.overallStatus === 'planned',
    provisioningSucceeded: latestKeycloakRun?.overallStatus === 'succeeded',
    provisioningFailed: latestKeycloakRun?.overallStatus === 'failed',
    provisioningRunning: latestKeycloakRun?.overallStatus === 'running',
    tenantAdminConfigured: Boolean(instance.tenantAdminBootstrap?.username),
    tenantAdminClientConfigured: Boolean(instance.tenantAdminClient?.clientId),
    tenantAdminClientSecretConfigured: instance.tenantAdminClient?.secretConfigured === true,
    tenantAdminClientReady:
      instance.keycloakStatus !== undefined && readRequirementGroupSatisfied(instance.keycloakStatus, 'tenantAdminClient'),
  };
};

const readKeycloakAccessDescription = (facts: WorkflowFacts) => {
  if (facts.keycloakUnavailable) {
    return t('admin.instances.workflow.keycloakAccess.blocked');
  }

  if (facts.keycloakAccessReady) {
    return t('admin.instances.workflow.keycloakAccess.ready');
  }

  if (facts.provisioningQueued || facts.provisioningRunning) {
    return t('admin.instances.workflow.provisioning.running');
  }

  return t('admin.instances.workflow.keycloakAccess.pending');
};

const readKeycloakAccessStatus = (facts: WorkflowFacts): SetupWorkflowStep['status'] => {
  if (facts.keycloakUnavailable) {
    return 'blocked';
  }

  if (facts.keycloakAccessReady) {
    return 'done';
  }

  return facts.provisioningQueued || facts.provisioningRunning ? 'current' : 'pending';
};

const createRegistryStep = ({ instance }: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'registry',
    title: t('admin.instances.workflow.registry.title'),
    description: t('admin.instances.workflow.registry.description', {
      status: t(INSTANCE_STATUS_LABELS[instance.status]),
    }),
    status: 'done',
  });

const createKeycloakAccessStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'keycloakAccess',
    title: t('admin.instances.workflow.keycloakAccess.title'),
    description: readKeycloakAccessDescription(facts),
    status: readKeycloakAccessStatus(facts),
    actionLabel: t('admin.instances.actions.checkPreflight'),
    action: 'check_preflight',
  });

const readRealmDescription = (facts: WorkflowFacts, realmReady: boolean, realmUsesNewMode: boolean) => {
  if (realmUsesNewMode) {
    return t('admin.instances.workflow.realm.newRealm');
  }

  if (realmReady) {
    return t('admin.instances.workflow.realm.ready');
  }

  if (facts.realmBlocked) {
    return t('admin.instances.workflow.realm.blocked');
  }

  return t('admin.instances.workflow.realm.pending');
};

const readRealmStatus = (
  facts: WorkflowFacts,
  realmReady: boolean,
  realmUsesNewMode: boolean
): SetupWorkflowStep['status'] => {
  if (realmUsesNewMode) {
    return facts.provisioningSucceeded ? 'done' : 'current';
  }

  if (realmReady) {
    return 'done';
  }

  if (facts.keycloakUnavailable || facts.realmBlocked) {
    return 'blocked';
  }

  return 'pending';
};

const createRealmStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const realmReady = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'realm');
  const realmUsesNewMode = facts.instance.realmMode === 'new';

  return createWorkflowStep({
    key: 'realm',
    title: t('admin.instances.workflow.realm.title'),
    description: readRealmDescription(facts, realmReady, realmUsesNewMode),
    status: readRealmStatus(facts, realmReady, realmUsesNewMode),
    actionLabel: t('admin.instances.actions.checkKeycloakStatus'),
    action: 'check_keycloak_status',
  });
};

const createRequirementStep = (
  facts: WorkflowFacts,
  input: {
    readonly key: 'client' | 'mapper';
    readonly uiStepKey: 'client' | 'mapper';
    readonly titleKey: string;
    readonly readyKey: string;
    readonly blockedKey: string;
    readonly pendingKey: string;
    readonly actionLabel?: string;
    readonly action?: SetupWorkflowStep['action'];
  }
): SetupWorkflowStep => {
  const ready = readRequirementGroupSatisfied(facts.instance.keycloakStatus, input.uiStepKey);
  const description = ready
    ? t(input.readyKey)
    : facts.keycloakUnavailable
      ? t(input.blockedKey)
      : t(input.pendingKey);
  const status = ready ? 'done' : facts.keycloakUnavailable ? 'blocked' : 'pending';

  return createWorkflowStep({
    key: input.key,
    title: t(input.titleKey),
    description,
    status,
    actionLabel: input.actionLabel,
    action: input.action,
  });
};

const readTenantAdminClientDescription = (facts: WorkflowFacts) => {
  if (!facts.tenantAdminClientConfigured) {
    return t('admin.instances.workflow.tenantAdminClient.notConfigured');
  }

  if (facts.tenantAdminClientReady) {
    return t('admin.instances.workflow.tenantAdminClient.ready');
  }

  if (!facts.tenantAdminClientSecretConfigured) {
    return t('admin.instances.workflow.tenantAdminClient.secretMissing');
  }

  if (facts.keycloakUnavailable) {
    return t('admin.instances.workflow.tenantAdminClient.blocked');
  }

  return t('admin.instances.workflow.tenantAdminClient.pending');
};

const readTenantAdminClientStatus = (facts: WorkflowFacts): SetupWorkflowStep['status'] => {
  if (!facts.tenantAdminClientConfigured) {
    return 'blocked';
  }

  if (facts.tenantAdminClientReady) {
    return 'done';
  }

  if (!facts.tenantAdminClientSecretConfigured || facts.keycloakUnavailable) {
    return 'blocked';
  }

  return 'current';
};

const createTenantAdminClientStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'tenantAdminClient',
    title: t('admin.instances.workflow.tenantAdminClient.title'),
    description: readTenantAdminClientDescription(facts),
    status: readTenantAdminClientStatus(facts),
    actionLabel: t('admin.instances.actions.provisionAdminClient'),
    action: 'provision_admin_client',
  });

export const buildSetupWorkflowSteps = (
  instance: IamInstanceDetail,
  mutationError: IamHttpError | null
): readonly SetupWorkflowStep[] => {
  const facts = collectWorkflowFacts(instance, mutationError);

  return [
    createRegistryStep(facts),
    createKeycloakAccessStep(facts),
    createRealmStep(facts),
    createRequirementStep(facts, {
      key: 'client',
      uiStepKey: 'client',
      titleKey: 'admin.instances.workflow.client.title',
      readyKey: 'admin.instances.workflow.client.ready',
      blockedKey: 'admin.instances.workflow.client.blocked',
      pendingKey: 'admin.instances.workflow.client.pending',
      actionLabel: t('admin.instances.actions.planProvisioning'),
      action: 'plan_provisioning',
    }),
    createTenantAdminClientStep(facts),
    createTenantSecretStep(facts),
    createTenantAdminStep(facts),
    createProvisioningStep(facts),
    createActivationStep(facts),
  ];
};
