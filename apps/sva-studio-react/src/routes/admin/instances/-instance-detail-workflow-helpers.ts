import { t } from '../../../i18n';

import type { IamHttpError } from '../../../lib/iam-api';
import { INSTANCE_STATUS_LABELS, type SetupWorkflowStep } from './-instances-shared-types';
import {
  createWorkflowStep,
  findPreflightCheck,
  readRequirementGroupSatisfied,
  type IamInstanceDetail,
} from './-instance-detail-shared';

type WorkflowFacts = {
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

const isProvisioningActive = (facts: WorkflowFacts) => facts.provisioningQueued || facts.provisioningRunning;

const readKeycloakAccessDescription = (facts: WorkflowFacts) => {
  if (facts.keycloakUnavailable) {
    return t('admin.instances.workflow.keycloakAccess.blocked');
  }

  if (facts.keycloakAccessReady) {
    return t('admin.instances.workflow.keycloakAccess.ready');
  }

  if (isProvisioningActive(facts)) {
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

  return 'current';
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

const readTenantSecretDescription = (
  facts: WorkflowFacts,
  ready: boolean,
  secretMissing: boolean,
  generatedDuringProvisioning: boolean
) => {
  if (generatedDuringProvisioning) {
    return t('admin.instances.workflow.tenantSecret.generatedDuringProvisioning');
  }

  if (secretMissing) {
    return t('admin.instances.workflow.tenantSecret.missing');
  }

  if (ready) {
    return t('admin.instances.workflow.tenantSecret.ready');
  }

  if (facts.keycloakUnavailable) {
    return t('admin.instances.workflow.tenantSecret.blocked');
  }

  return t('admin.instances.workflow.tenantSecret.pending');
};

const readTenantSecretStatus = (
  facts: WorkflowFacts,
  ready: boolean,
  secretMissing: boolean,
  generatedDuringProvisioning: boolean
): SetupWorkflowStep['status'] => {
  if (secretMissing) {
    return generatedDuringProvisioning ? 'pending' : 'blocked';
  }

  if (ready) {
    return 'done';
  }

  if (facts.keycloakUnavailable) {
    return 'blocked';
  }

  return 'current';
};

const createTenantSecretStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const ready = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'tenantSecret');
  const secretMissing = !facts.instance.authClientSecretConfigured;
  const generatedDuringProvisioning = secretMissing && facts.instance.realmMode === 'new';

  return createWorkflowStep({
    key: 'tenantSecret',
    title: t('admin.instances.workflow.tenantSecret.title'),
    description: readTenantSecretDescription(facts, ready, secretMissing, generatedDuringProvisioning),
    status: readTenantSecretStatus(facts, ready, secretMissing, generatedDuringProvisioning),
    actionLabel: t('admin.instances.actions.rotateClientSecret'),
    action: 'rotate_client_secret',
  });
};

const readTenantAdminDescription = (facts: WorkflowFacts, ready: boolean) => {
  if (!facts.tenantAdminConfigured) {
    return t('admin.instances.workflow.tenantAdmin.missing');
  }

  if (ready) {
    return t('admin.instances.workflow.tenantAdmin.ready');
  }

  if (facts.keycloakUnavailable) {
    return t('admin.instances.workflow.tenantAdmin.blocked');
  }

  return t('admin.instances.workflow.tenantAdmin.pending');
};

const readTenantAdminStatus = (facts: WorkflowFacts, ready: boolean): SetupWorkflowStep['status'] => {
  if (!facts.tenantAdminConfigured) {
    return 'blocked';
  }

  if (ready) {
    return 'done';
  }

  if (facts.keycloakUnavailable) {
    return 'blocked';
  }

  return 'current';
};

const createTenantAdminStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const ready = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'tenantAdmin');
  return createWorkflowStep({
    key: 'tenantAdmin',
    title: t('admin.instances.workflow.tenantAdmin.title'),
    description: readTenantAdminDescription(facts, ready),
    status: readTenantAdminStatus(facts, ready),
    actionLabel: t('admin.instances.actions.resetTenantAdmin'),
    action: 'reset_tenant_admin',
  });
};

const readProvisioningDescription = (facts: WorkflowFacts) => {
  if (facts.provisioningSucceeded) {
    return t('admin.instances.workflow.provisioning.ready');
  }

  if (facts.provisioningFailed) {
    return t('admin.instances.workflow.provisioning.failed');
  }

  if (isProvisioningActive(facts)) {
    return t('admin.instances.workflow.provisioning.running');
  }

  return t('admin.instances.workflow.provisioning.pending');
};

const readProvisioningStatus = (facts: WorkflowFacts): SetupWorkflowStep['status'] => {
  if (facts.provisioningSucceeded) {
    return 'done';
  }

  if (facts.provisioningFailed) {
    return 'blocked';
  }

  return 'current';
};

const readProvisioningAction = (facts: WorkflowFacts): SetupWorkflowStep['action'] =>
  isProvisioningActive(facts) ? 'execute_provisioning' : 'plan_provisioning';

const createProvisioningStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'provisioning',
    title: t('admin.instances.workflow.provisioning.title'),
    description: readProvisioningDescription(facts),
    status: readProvisioningStatus(facts),
    actionLabel: isProvisioningActive(facts)
      ? t('admin.instances.actions.executeProvisioning')
      : t('admin.instances.actions.planProvisioning'),
    action: readProvisioningAction(facts),
  });

const readActivationDescription = (facts: WorkflowFacts) => {
  if (facts.instance.status === 'active') {
    return t('admin.instances.workflow.activation.ready');
  }

  if (facts.provisioningSucceeded) {
    return t('admin.instances.workflow.activation.current');
  }

  return t('admin.instances.workflow.activation.pending');
};

const readActivationStatus = (facts: WorkflowFacts): SetupWorkflowStep['status'] => {
  if (facts.instance.status === 'active') {
    return 'done';
  }

  if (facts.provisioningSucceeded) {
    return 'current';
  }

  return 'pending';
};

const createActivationStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'activation',
    title: t('admin.instances.workflow.activation.title'),
    description: readActivationDescription(facts),
    status: readActivationStatus(facts),
    actionLabel: facts.provisioningSucceeded ? t('admin.instances.actions.activate') : undefined,
    action: facts.provisioningSucceeded ? 'activate_instance' : undefined,
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
    createRequirementStep(facts, {
      key: 'mapper',
      uiStepKey: 'mapper',
      titleKey: 'admin.instances.workflow.mapper.title',
      readyKey: 'admin.instances.workflow.mapper.ready',
      blockedKey: 'admin.instances.workflow.mapper.blocked',
      pendingKey: 'admin.instances.workflow.mapper.pending',
    }),
    createTenantSecretStep(facts),
    createTenantAdminStep(facts),
    createProvisioningStep(facts),
    createActivationStep(facts),
  ];
};
