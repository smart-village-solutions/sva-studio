import { t } from '../../../i18n';

import type { SetupWorkflowStep } from './-instances-shared-types';
import { createWorkflowStep, readRequirementGroupSatisfied } from './-instance-detail-shared';
import type { WorkflowFacts } from './-instance-detail-workflow-helpers';

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

export const createTenantSecretStep = (facts: WorkflowFacts): SetupWorkflowStep => {
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

export const createTenantAdminStep = (facts: WorkflowFacts): SetupWorkflowStep => {
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

const isProvisioningActive = (facts: WorkflowFacts) => facts.provisioningQueued || facts.provisioningRunning;

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

export const createProvisioningStep = (facts: WorkflowFacts): SetupWorkflowStep =>
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

export const createActivationStep = (facts: WorkflowFacts): SetupWorkflowStep =>
  createWorkflowStep({
    key: 'activation',
    title: t('admin.instances.workflow.activation.title'),
    description: readActivationDescription(facts),
    status: readActivationStatus(facts),
    actionLabel: facts.provisioningSucceeded ? t('admin.instances.actions.activate') : undefined,
    action: facts.provisioningSucceeded ? 'activate_instance' : undefined,
  });
