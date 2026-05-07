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
    description: facts.keycloakUnavailable
      ? t('admin.instances.workflow.keycloakAccess.blocked')
      : facts.keycloakAccessReady
        ? t('admin.instances.workflow.keycloakAccess.ready')
        : isProvisioningActive(facts)
          ? t('admin.instances.workflow.provisioning.running')
          : t('admin.instances.workflow.keycloakAccess.pending'),
    status: facts.keycloakUnavailable ? 'blocked' : facts.keycloakAccessReady ? 'done' : 'current',
    actionLabel: t('admin.instances.actions.checkPreflight'),
    action: 'check_preflight',
  });

const createRealmStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const realmReady = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'realm');
  const realmUsesNewMode = facts.instance.realmMode === 'new';

  return createWorkflowStep({
    key: 'realm',
    title: t('admin.instances.workflow.realm.title'),
    description: realmUsesNewMode
      ? t('admin.instances.workflow.realm.newRealm')
      : realmReady
        ? t('admin.instances.workflow.realm.ready')
        : facts.realmBlocked
          ? t('admin.instances.workflow.realm.blocked')
          : t('admin.instances.workflow.realm.pending'),
    status: realmUsesNewMode
      ? facts.provisioningSucceeded
        ? 'done'
        : 'current'
      : realmReady
        ? 'done'
        : facts.keycloakUnavailable || facts.realmBlocked
          ? 'blocked'
          : 'pending',
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
  return createWorkflowStep({
    key: input.key,
    title: t(input.titleKey),
    description: ready
      ? t(input.readyKey)
      : facts.keycloakUnavailable
        ? t(input.blockedKey)
        : t(input.pendingKey),
    status: ready ? 'done' : facts.keycloakUnavailable ? 'blocked' : 'pending',
    actionLabel: input.actionLabel,
    action: input.action,
  });
};

const createTenantAdminClientStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'tenantAdminClient',
    title: t('admin.instances.workflow.tenantAdminClient.title'),
    description: !facts.tenantAdminClientConfigured
      ? t('admin.instances.workflow.tenantAdminClient.notConfigured')
      : facts.tenantAdminClientReady
        ? t('admin.instances.workflow.tenantAdminClient.ready')
        : !facts.tenantAdminClientSecretConfigured
          ? t('admin.instances.workflow.tenantAdminClient.secretMissing')
          : facts.keycloakUnavailable
            ? t('admin.instances.workflow.tenantAdminClient.blocked')
            : t('admin.instances.workflow.tenantAdminClient.pending'),
    status: !facts.tenantAdminClientConfigured
      ? 'blocked'
      : facts.tenantAdminClientReady
        ? 'done'
        : !facts.tenantAdminClientSecretConfigured || facts.keycloakUnavailable
          ? 'blocked'
          : 'current',
    actionLabel: t('admin.instances.actions.provisionAdminClient'),
    action: 'provision_admin_client',
  });

const createTenantSecretStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const ready = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'tenantSecret');
  const secretMissing = !facts.instance.authClientSecretConfigured;
  const generatedDuringProvisioning = secretMissing && facts.instance.realmMode === 'new';

  return createWorkflowStep({
    key: 'tenantSecret',
    title: t('admin.instances.workflow.tenantSecret.title'),
    description: generatedDuringProvisioning
      ? t('admin.instances.workflow.tenantSecret.generatedDuringProvisioning')
      : secretMissing
        ? t('admin.instances.workflow.tenantSecret.missing')
        : ready
          ? t('admin.instances.workflow.tenantSecret.ready')
          : facts.keycloakUnavailable
            ? t('admin.instances.workflow.tenantSecret.blocked')
            : t('admin.instances.workflow.tenantSecret.pending'),
    status: secretMissing
      ? generatedDuringProvisioning
        ? 'pending'
        : 'blocked'
      : ready
        ? 'done'
        : facts.keycloakUnavailable
          ? 'blocked'
          : 'current',
    actionLabel: t('admin.instances.actions.rotateClientSecret'),
    action: 'rotate_client_secret',
  });
};

const createTenantAdminStep = (facts: WorkflowFacts): SetupWorkflowStep => {
  const ready = readRequirementGroupSatisfied(facts.instance.keycloakStatus, 'tenantAdmin');
  return createWorkflowStep({
    key: 'tenantAdmin',
    title: t('admin.instances.workflow.tenantAdmin.title'),
    description: !facts.tenantAdminConfigured
      ? t('admin.instances.workflow.tenantAdmin.missing')
      : ready
        ? t('admin.instances.workflow.tenantAdmin.ready')
        : facts.keycloakUnavailable
          ? t('admin.instances.workflow.tenantAdmin.blocked')
          : t('admin.instances.workflow.tenantAdmin.pending'),
    status: !facts.tenantAdminConfigured ? 'blocked' : ready ? 'done' : facts.keycloakUnavailable ? 'blocked' : 'current',
    actionLabel: t('admin.instances.actions.resetTenantAdmin'),
    action: 'reset_tenant_admin',
  });
};

const createProvisioningStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'provisioning',
    title: t('admin.instances.workflow.provisioning.title'),
    description: facts.provisioningSucceeded
      ? t('admin.instances.workflow.provisioning.ready')
      : facts.provisioningFailed
        ? t('admin.instances.workflow.provisioning.failed')
        : isProvisioningActive(facts)
          ? t('admin.instances.workflow.provisioning.running')
          : t('admin.instances.workflow.provisioning.pending'),
    status: facts.provisioningSucceeded ? 'done' : facts.provisioningFailed ? 'blocked' : 'current',
    actionLabel: isProvisioningActive(facts)
      ? t('admin.instances.actions.executeProvisioning')
      : t('admin.instances.actions.planProvisioning'),
    action: isProvisioningActive(facts) ? 'execute_provisioning' : 'plan_provisioning',
  });

const createActivationStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'activation',
    title: t('admin.instances.workflow.activation.title'),
    description:
      facts.instance.status === 'active'
        ? t('admin.instances.workflow.activation.ready')
        : facts.provisioningSucceeded
          ? t('admin.instances.workflow.activation.current')
          : t('admin.instances.workflow.activation.pending'),
    status: facts.instance.status === 'active' ? 'done' : facts.provisioningSucceeded ? 'current' : 'pending',
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
