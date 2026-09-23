import { isTrafficEnabledInstanceStatus } from '@sva/core';

import {
  createConsumeInstanceConfirmationChallenge,
  createPrepareInstanceConfirmationChallenge,
} from './confirmation-challenges.js';
import { createGetInstanceDetail } from './service-detail.js';
import {
  createChangeStatusHandler,
  createProvisioningRequestHandler,
  createUpdateInstanceHandler,
} from './service-instance-mutations.js';
import { createRunInstanceAuditHandler } from './service-audit.js';
import {
  createExecuteKeycloakProvisioningHandler,
  createGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
  createReconcileKeycloakHandler,
  createRuntimeResolver,
} from './service-keycloak.js';
import { createListInstances } from './service-list.js';
import { createRetryTenantProvisioningHandler } from './service-instance-create.js';
import { createDraftReadinessHandler } from './service-draft-readiness.js';
import { createListRealmCatalogHandler } from './service-realm-catalog.js';
import {
  createAssignModuleHandler,
  createBootstrapAdminStructureHandler,
  createRevokeModuleHandler,
  createSeedIamBaselineHandler,
} from './service-module-mutations.js';
import { createReconcileModuleActivationPoliciesHandler } from './service-module-activation.js';
import { createProbeTenantIamAccessHandler } from './service-probe.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import {
  getServerAccountInvitationTemplate,
  updateServerAccountInvitationTemplate,
} from './service-account-invitation-template.js';

export const createInstanceRegistryService = (
  deps: InstanceRegistryServiceDeps
): InstanceRegistryService => ({
  prepareConfirmationChallenge: createPrepareInstanceConfirmationChallenge(deps.repository),
  consumeConfirmationChallenge: createConsumeInstanceConfirmationChallenge(deps.repository),
  recordConfirmationAttempt: async (input) => {
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType:
        input.outcome === 'accepted'
          ? 'instance_confirmation_accepted'
          : 'instance_confirmation_rejected',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        actionId: input.actionId,
        ...(input.moduleId ? { moduleId: input.moduleId } : {}),
        outcome: input.outcome,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
  },
  listInstances: createListInstances(deps.repository),
  getServerAccountInvitationTemplate: () => getServerAccountInvitationTemplate(deps.repository),
  updateServerAccountInvitationTemplate: (input) =>
    updateServerAccountInvitationTemplate({
      repository: deps.repository,
      expectedRevision: input.expectedRevision,
      template: input.template,
      actorId: input.actorId,
      requestId: input.requestId,
    }),
  getInstanceDetail: createGetInstanceDetail(deps),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  getDraftReadiness: createDraftReadinessHandler(deps),
  listRealmCatalog: createListRealmCatalogHandler(deps),
  retryTenantProvisioning: createRetryTenantProvisioningHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  getKeycloakPreflight: createGetKeycloakPreflightHandler(deps),
  planKeycloakProvisioning: createPlanKeycloakProvisioningHandler(deps),
  executeKeycloakProvisioning: createExecuteKeycloakProvisioningHandler(deps),
  assignModule: createAssignModuleHandler(deps),
  bootstrapAdminStructure: createBootstrapAdminStructureHandler(deps),
  revokeModule: createRevokeModuleHandler(deps),
  reconcileModuleActivationPolicies: createReconcileModuleActivationPoliciesHandler(deps),
  seedIamBaseline: createSeedIamBaselineHandler(deps),
  probeTenantIamAccess: createProbeTenantIamAccessHandler(deps),
  getKeycloakProvisioningRun: createGetKeycloakProvisioningRunHandler(deps),
  hasKeycloakProvisioningRun: (input) => deps.repository.hasKeycloakProvisioningRun(input),
  getKeycloakStatus: createGetKeycloakStatusHandler(deps),
  reconcileKeycloak: createReconcileKeycloakHandler(deps),
  runInstanceAudit: createRunInstanceAuditHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});
