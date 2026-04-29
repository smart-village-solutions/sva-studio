import { createPoolResolver } from '../db.js';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { invalidateInstanceRegistryHost } from '@sva/data-repositories/server';
import { createInstanceRegistryRuntime } from '@sva/instance-registry/runtime-wiring';

import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  getInstanceKeycloakPlanViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner,
  getInstanceKeycloakStatusViaProvisioner,
  provisionInstanceAuthArtifactsViaProvisioner,
} from './provisioning-auth.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';

const getWorkerKeycloakPreflight = async (input: Parameters<typeof getInstanceKeycloakPreflightViaProvisioner>[0]) =>
  getInstanceKeycloakPreflightViaProvisioner(input);

const getWorkerKeycloakPlan = async (input: Parameters<typeof getInstanceKeycloakPlanViaProvisioner>[0]) =>
  getInstanceKeycloakPlanViaProvisioner(input);

const getWorkerKeycloakStatus = async (input: Parameters<typeof getInstanceKeycloakStatusViaProvisioner>[0]) =>
  getInstanceKeycloakStatusViaProvisioner(input);

const probeTenantIamAccess = async (input: { instanceId: string; requestId?: string }) => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });

  if (!identityProvider) {
    throw new Error('tenant_admin_client_not_configured');
  }

  try {
    await identityProvider.provider.listRoles();
    return {
      status: 'ready',
      summary: 'Tenant-Admin-Client kann Realm-Rollen lesen.',
      source: 'access_probe',
      checkedAt: new Date().toISOString(),
      requestId: input.requestId,
    } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode =
      message.includes('403') || message.toLowerCase().includes('forbidden')
        ? 'IDP_FORBIDDEN'
        : 'IDP_UNAVAILABLE';

    return {
      status: errorCode === 'IDP_FORBIDDEN' ? 'blocked' : 'degraded',
      summary:
        errorCode === 'IDP_FORBIDDEN'
          ? 'Tenant-Admin-Client darf Realm-Rollen nicht lesen.'
          : 'Tenant-Admin-Rechteprobe konnte nicht abgeschlossen werden.',
      source: 'access_probe',
      checkedAt: new Date().toISOString(),
      errorCode,
      requestId: input.requestId,
    } as const;
  }
};

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const registryRuntime = createInstanceRegistryRuntime({
  resolvePool,
  createRepository: createInstanceRegistryRepository,
  serviceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
    probeTenantIamAccess,
  },
  provisioningWorkerServiceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
    provisionInstanceAuth: provisionInstanceAuthArtifactsViaProvisioner,
    getKeycloakPreflight: getWorkerKeycloakPreflight,
    planKeycloakProvisioning: getWorkerKeycloakPlan,
    getKeycloakStatus: getWorkerKeycloakStatus,
  },
});

export const {
  withRegistryRepository,
  withRegistryService,
  withRegistryProvisioningWorkerService,
  withRegistryProvisioningWorkerDeps,
} = registryRuntime;
