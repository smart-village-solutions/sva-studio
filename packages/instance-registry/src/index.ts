export const instanceRegistryVersion = '0.0.1';

export type InstanceRegistryPackageRole = 'instances' | 'host-classification' | 'provisioning' | 'platform-admin-client';

export const instanceRegistryPackageRoles = [
  'instances',
  'host-classification',
  'provisioning',
  'platform-admin-client',
] as const satisfies readonly InstanceRegistryPackageRole[];

export type {
  KeycloakTenantPlan,
  KeycloakTenantPreflight,
  KeycloakTenantProvisioningRun,
  KeycloakTenantStatus,
  ResolveRuntimeInstanceResult,
} from './keycloak-types.js';
export type {
  AssignInstanceModuleInput,
  BootstrapAdminStructureInput,
  ChangeInstanceStatusInput,
  ChangeInstanceStatusResult,
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  ExecuteInstanceKeycloakProvisioningInput,
  InstanceModuleMutationResult,
  InstanceRegistryMutationActor,
  RevokeInstanceModuleInput,
  ReconcileInstanceKeycloakInput,
  SeedInstanceIamBaselineInput,
  UpdateInstanceInput,
} from './mutation-types.js';
export {
  buildAssignInstanceModuleInput,
  buildBootstrapAdminStructureInput,
  buildChangeInstanceStatusInput,
  buildCreateInstanceProvisioningInput,
  buildExecuteInstanceKeycloakProvisioningInput,
  buildRevokeInstanceModuleInput,
  buildReconcileInstanceKeycloakInput,
  buildSeedInstanceIamBaselineInput,
  buildUpdateInstanceInput,
  type AssignInstanceModulePayload,
  type BootstrapAdminStructurePayload,
  type CreateInstancePayload,
  type ExecuteKeycloakProvisioningPayload,
  type RevokeInstanceModulePayload,
  type ReconcileKeycloakPayload,
  type UpdateInstancePayload,
} from './mutation-input-builders.js';
export {
  createInstanceRegistryAuditHttpHandlers,
  type InstanceRegistryAuditHttpDeps,
} from './http-audit-handlers.js';
export {
  createInstanceRegistryKeycloakHttpHandlers,
  type InstanceRegistryKeycloakHttpDeps,
} from './http-keycloak-handlers.js';
export {
  createInstanceRegistryHttpGuards,
  INSTANCE_REGISTRY_HTTP_ADMIN_ROLE,
  type InstanceRegistryHttpGuardDeps,
} from './http-guards.js';
export {
  createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers,
  type InstanceRegistryMutationHttpActor,
  type InstanceRegistryMutationHttpDeps,
} from './http-mutation-handlers.js';
export {
  createInstanceRegistryHttpHandlers,
  type InstanceRegistryHttpActor,
  type InstanceRegistryHttpDeps,
  type InstanceRegistryStatusMutation,
} from './http-instance-handlers.js';
export {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
export {
  createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader,
  type ReadKeycloakAccessError,
  type ReadKeycloakState,
} from './provisioning-auth.js';
export {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createProvisionInstanceAuthArtifacts,
  createReadKeycloakState,
  type KeycloakProvisioningClientConfigResolver,
  type KeycloakProvisioningClient,
  type KeycloakProvisioningClientFactory,
} from './provisioning-auth-state.js';
export {
  classifyInstanceMutationError,
  type BlockedDriftErrorCode,
  type InstanceMutationErrorClassification,
  type InstanceMutationErrorCode,
} from './mutation-errors.js';
export {
  isWorkerEntrypoint,
  runKeycloakProvisioningWorkerLoop,
  type KeycloakProvisioningWorkerIteration,
} from './provisioning-worker.js';
export type {
  KeycloakClientRepresentation,
  KeycloakProvisioningInput,
  KeycloakReadState,
  KeycloakRoleRepresentation,
  TenantAdminBootstrap,
  TenantAdminStatus,
} from './provisioning-auth-types.js';
export {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
  equalSets,
  INSTANCE_ID_MAPPER_NAME,
  INSTANCE_REGISTRY_ADMIN_ROLE,
  readPostLogoutUris,
  SYSTEM_ADMIN_ROLE,
  toSortedUnique,
} from './provisioning-auth-utils.js';
export type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
export { createInstanceRegistryService } from './service.js';
export { createRunInstanceAuditHandler } from './service-audit.js';
export { createGetInstanceDetail, loadKeycloakDetailArtifacts } from './service-detail.js';
export {
  createExecuteKeycloakProvisioningHandler,
  createReconcileKeycloakHandler,
  processClaimedKeycloakProvisioningRun,
  processNextQueuedKeycloakProvisioningRun,
} from './service-keycloak-execution.js';
export {
  createGetKeycloakPreflightHandler,
  createGetKeycloakProvisioningRunHandler,
  createGetKeycloakStatusHandler,
  createPlanKeycloakProvisioningHandler,
  createRuntimeResolver,
} from './service-keycloak.js';
export {
  isInstanceTrafficAllowed,
  resolveRuntimeInstanceFromRequest,
  type RuntimeInstanceResolutionDeps,
} from './runtime-resolution.js';
export {
  createInstanceRegistryRuntime,
  type InstanceRegistryPool,
  type InstanceRegistryQueryClient,
  type InstanceRegistryRuntimeDeps,
} from './runtime-wiring.js';
