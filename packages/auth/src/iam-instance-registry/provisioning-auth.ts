import { createSdkLogger } from '@sva/sdk/server';

import type { KeycloakTenantPlan, KeycloakTenantPreflight, KeycloakTenantStatus } from './keycloak-types.js';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
import {
  provisionInstanceAuthArtifacts,
  provisionInstanceAuthArtifactsViaProvisioner,
  readKeycloakAccessError,
  readKeycloakState,
  readKeycloakStateViaProvisioner,
} from './provisioning-auth-state.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

export { provisionInstanceAuthArtifacts };

const createInstanceKeycloakPreflightReader =
  (readState: typeof readKeycloakState) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantPreflight> => {
    try {
      const state = await readState(input);
      const checks = buildPreflightChecks({
        realmMode: input.realmMode,
        authClientSecretConfigured: input.authClientSecretConfigured,
        authClientSecret: input.authClientSecret,
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        state,
      });
      return {
        overallStatus: toOverallPreflightStatus(checks),
        checkedAt: new Date().toISOString(),
        checks,
      };
    } catch (error) {
      const checks = buildPreflightChecks({
        realmMode: input.realmMode,
        authClientSecretConfigured: input.authClientSecretConfigured,
        authClientSecret: input.authClientSecret,
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        accessError: readKeycloakAccessError(error),
      });
      return {
        overallStatus: toOverallPreflightStatus(checks),
        checkedAt: new Date().toISOString(),
        checks,
      };
    }
  };

export const getInstanceKeycloakPreflight = createInstanceKeycloakPreflightReader(readKeycloakState);
export const getInstanceKeycloakPreflightViaProvisioner = createInstanceKeycloakPreflightReader(readKeycloakStateViaProvisioner);

const createInstanceKeycloakPlanReader =
  (readState: typeof readKeycloakState, getPreflight: typeof getInstanceKeycloakPreflight) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantPlan> => {
    try {
      const state = await readState(input);
      const preflight = await getPreflight(input);
      return buildPlan({
        realmMode: input.realmMode,
        authClientSecret: input.authClientSecret,
        preflight,
        state,
      });
    } catch {
      const preflight = await getPreflight(input);
      return buildPlan({
        realmMode: input.realmMode,
        authClientSecret: input.authClientSecret,
        preflight,
      });
    }
  };

export const getInstanceKeycloakPlan = createInstanceKeycloakPlanReader(readKeycloakState, getInstanceKeycloakPreflight);
export const getInstanceKeycloakPlanViaProvisioner = createInstanceKeycloakPlanReader(
  readKeycloakStateViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner
);

const createInstanceKeycloakStatusReader =
  (readState: typeof readKeycloakState) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantStatus> => {
    const state = await readState(input);
  if (!state.realm) {
    return buildMissingRealmStatus(input.authClientSecretConfigured, input.authClientSecret);
  }

  const status = buildKeycloakStatus({ ...input, state });

  logger.info('keycloak_reconcile_summary', {
    operation: 'keycloak_tenant_status',
    instance_id: input.instanceId,
    auth_realm: input.authRealm,
    client_id: input.authClientId,
    realm_mode: input.realmMode,
    realm_exists: status.realmExists,
    client_exists: status.clientExists,
    mapper_exists: status.instanceIdMapperExists,
    admin_exists: status.tenantAdminExists,
    roles_ok: status.tenantAdminHasSystemAdmin && !status.tenantAdminHasInstanceRegistryAdmin,
    secret_aligned: status.clientSecretAligned,
    runtime_secret_source: status.runtimeSecretSource,
  });

  return status;
};

export const getInstanceKeycloakStatus = createInstanceKeycloakStatusReader(readKeycloakState);
export const getInstanceKeycloakStatusViaProvisioner = createInstanceKeycloakStatusReader(readKeycloakStateViaProvisioner);

export { provisionInstanceAuthArtifactsViaProvisioner };
