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
  ChangeInstanceStatusInput,
  ChangeInstanceStatusResult,
  CreateInstanceProvisioningInput,
  CreateInstanceProvisioningResult,
  ExecuteInstanceKeycloakProvisioningInput,
  InstanceRegistryMutationActor,
  ReconcileInstanceKeycloakInput,
  UpdateInstanceInput,
} from './mutation-types.js';
export {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
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
export {
  createAuditDetails,
  createStatusArtifacts,
  getAuditEventType,
  getStatusOperation,
  toListItem,
  buildInstanceDetail,
} from './service-helpers.js';
export { appendRunStep, buildFinalRunSteps } from './service-keycloak-run-steps.js';
export { createProvisioningArtifacts, provisionInstanceAuth } from './service-provisioning.js';
export type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
