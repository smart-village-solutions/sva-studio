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
import {
  createAssignModuleHandler,
  createBootstrapAdminStructureHandler,
  createRevokeModuleHandler,
  createSeedIamBaselineHandler,
} from './service-module-mutations.js';
import { createProbeTenantIamAccessHandler } from './service-probe.js';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps): InstanceRegistryService => ({
  prepareConfirmationChallenge: createPrepareInstanceConfirmationChallenge(deps.repository),
  consumeConfirmationChallenge: createConsumeInstanceConfirmationChallenge(deps.repository),
  listInstances: createListInstances(deps.repository),
  getInstanceDetail: createGetInstanceDetail(deps),
  createProvisioningRequest: createProvisioningRequestHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  changeStatus: createChangeStatusHandler(deps),
  getKeycloakPreflight: createGetKeycloakPreflightHandler(deps),
  planKeycloakProvisioning: createPlanKeycloakProvisioningHandler(deps),
  executeKeycloakProvisioning: createExecuteKeycloakProvisioningHandler(deps),
  assignModule: createAssignModuleHandler(deps),
  bootstrapAdminStructure: createBootstrapAdminStructureHandler(deps),
  revokeModule: createRevokeModuleHandler(deps),
  seedIamBaseline: createSeedIamBaselineHandler(deps),
  probeTenantIamAccess: createProbeTenantIamAccessHandler(deps),
  getKeycloakProvisioningRun: createGetKeycloakProvisioningRunHandler(deps),
  getKeycloakStatus: createGetKeycloakStatusHandler(deps),
  reconcileKeycloak: createReconcileKeycloakHandler(deps),
  runInstanceAudit: createRunInstanceAuditHandler(deps),
  resolveRuntimeInstance: createRuntimeResolver(deps.repository),
  isTrafficAllowed: isTrafficEnabledInstanceStatus,
});
