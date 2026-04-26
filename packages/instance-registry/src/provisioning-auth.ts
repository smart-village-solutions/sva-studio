import { createSdkLogger } from '@sva/server-runtime';

import type { KeycloakTenantPlan, KeycloakTenantPreflight, KeycloakTenantStatus } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import {
  buildKeycloakStatus,
  buildMissingRealmStatus,
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

export type ReadKeycloakState = (input: KeycloakProvisioningInput) => Promise<KeycloakReadState>;
export type ReadKeycloakAccessError = (error: unknown) => string;

const readDefaultAccessError = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const createInstanceKeycloakPreflightReader =
  (readState: ReadKeycloakState, readAccessError: ReadKeycloakAccessError = readDefaultAccessError) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantPreflight> => {
    try {
      const state = await readState(input);
      const checks = buildPreflightChecks({
        realmMode: input.realmMode,
        authClientSecretConfigured: input.authClientSecretConfigured,
        authClientSecret: input.authClientSecret,
        tenantAdminClient: input.tenantAdminClient,
        tenantAdminClientSecret: input.tenantAdminClientSecret,
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
        tenantAdminClient: input.tenantAdminClient,
        tenantAdminClientSecret: input.tenantAdminClientSecret,
        tenantAdminBootstrap: input.tenantAdminBootstrap,
        accessError: readAccessError(error),
      });
      return {
        overallStatus: toOverallPreflightStatus(checks),
        checkedAt: new Date().toISOString(),
        checks,
      };
    }
  };

export const createInstanceKeycloakPlanReader =
  (readState: ReadKeycloakState, getPreflight: (input: KeycloakProvisioningInput) => Promise<KeycloakTenantPreflight>) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantPlan> => {
    try {
      const state = await readState(input);
      const preflight = await getPreflight(input);
      return buildPlan({
        realmMode: input.realmMode,
        authClientSecret: input.authClientSecret,
        tenantAdminClient: input.tenantAdminClient,
        tenantAdminClientSecret: input.tenantAdminClientSecret,
        preflight,
        state,
      });
    } catch {
      const preflight = await getPreflight(input);
      return buildPlan({
        realmMode: input.realmMode,
        authClientSecret: input.authClientSecret,
        tenantAdminClient: input.tenantAdminClient,
        tenantAdminClientSecret: input.tenantAdminClientSecret,
        preflight,
      });
    }
  };

export const createInstanceKeycloakStatusReader =
  (readState: ReadKeycloakState) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakTenantStatus> => {
    const state = await readState(input);
    if (!state.realm) {
      return buildMissingRealmStatus(
        input.authClientSecretConfigured,
        input.authClientSecret,
        input.tenantAdminClient,
        input.tenantAdminClientSecret
      );
    }

    const status = buildKeycloakStatus({ ...input, state });

    logger.info('keycloak_reconcile_summary', {
      operation: 'keycloak_tenant_status',
      instance_id: input.instanceId,
      auth_realm: input.authRealm,
      client_id: input.authClientId,
      tenant_admin_client_id: input.tenantAdminClient?.clientId,
      realm_mode: input.realmMode,
      realm_exists: status.realmExists,
      client_exists: status.clientExists,
      tenant_admin_client_exists: status.tenantAdminClientExists,
      mapper_exists: status.instanceIdMapperExists,
      admin_exists: status.tenantAdminExists,
      roles_ok:
        status.tenantAdminHasSystemAdmin
        && !status.tenantAdminHasInstanceRegistryAdmin
        && status.tenantAdminInstanceIdMatches,
      tenant_admin_instance_id_matches: status.tenantAdminInstanceIdMatches,
      secret_aligned: status.clientSecretAligned,
      tenant_admin_client_secret_aligned: status.tenantAdminClientSecretAligned,
      runtime_secret_source: status.runtimeSecretSource,
    });

    return status;
  };
