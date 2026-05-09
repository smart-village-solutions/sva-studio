import { createPoolResolver } from '../db.js';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { invalidateInstanceRegistryHost } from '@sva/data-repositories/server';
import { createInstanceRegistryRuntime } from '@sva/instance-registry/runtime-wiring';
import { studioModuleIamRegistry } from '@sva/studio-module-iam';

import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { notifyPermissionInvalidation } from '../iam-account-management/shared-activity.js';
import {
  getInstanceKeycloakPlanViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner,
  getInstanceKeycloakStatusViaProvisioner,
  provisionInstanceAuthArtifactsViaProvisioner,
} from './provisioning-auth.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { resolveAuthConfigForInstance } from '../config.js';
import {
  isKeycloakIdentityProvider,
  resolveIdentityProviderForInstance,
} from '../iam-account-management/shared-runtime.js';

const getWorkerKeycloakPreflight = async (input: Parameters<typeof getInstanceKeycloakPreflightViaProvisioner>[0]) =>
  getInstanceKeycloakPreflightViaProvisioner(input);

const getWorkerKeycloakPlan = async (input: Parameters<typeof getInstanceKeycloakPlanViaProvisioner>[0]) =>
  getInstanceKeycloakPlanViaProvisioner(input);

const getWorkerKeycloakStatus = async (input: Parameters<typeof getInstanceKeycloakStatusViaProvisioner>[0]) =>
  getInstanceKeycloakStatusViaProvisioner(input);

const probePasswordSetupEmailCapability = async (input: {
  instanceId: string;
  identityProvider: NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>;
}) => {
  if (!input.identityProvider.provider.executeActionsEmail) {
    return {
      ok: false as const,
      errorCode: 'IDP_UNSUPPORTED_PASSWORD_SETUP_EMAIL',
      summary: 'Tenant-Admin-Client unterstützt den Passwort-Setup-Mailversand nicht.',
    };
  }

  if (!isKeycloakIdentityProvider(input.identityProvider.provider)) {
    return {
      ok: true as const,
      loginClientId: undefined,
    };
  }

  const authConfig = await resolveAuthConfigForInstance(input.instanceId);
  const targetClient = await input.identityProvider.provider.getOidcClientByClientId(authConfig.clientId);
  if (!targetClient) {
    return {
      ok: false as const,
      errorCode: 'AUTH_CLIENT_MISSING',
      summary: `Der referenzierte Login-Client ${authConfig.clientId} fehlt im Tenant-Realm.`,
    };
  }

  return {
    ok: true as const,
    loginClientId: authConfig.clientId,
  };
};

const probeTenantIamAccess = async (input: { instanceId: string; requestId?: string }) => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });

  if (!identityProvider) {
    return {
      status: 'blocked',
      summary: 'Tenant-Admin-Client ist für diese Instanz noch nicht konfiguriert.',
      source: 'access_probe',
      checkedAt: new Date().toISOString(),
      errorCode: 'tenant_admin_client_not_configured',
      requestId: input.requestId,
    } as const;
  }

  try {
    const [rolesResult, usersResult, capabilityResult] = await Promise.allSettled([
      identityProvider.provider.listRoles(),
      identityProvider.provider.listUsers({ max: 1 }),
      probePasswordSetupEmailCapability({
        instanceId: input.instanceId,
        identityProvider,
      }),
    ]);

    const firstAccessFailure =
      rolesResult.status === 'rejected'
        ? rolesResult.reason
        : usersResult.status === 'rejected'
          ? usersResult.reason
          : null;
    if (firstAccessFailure) {
      throw firstAccessFailure;
    }

    if (capabilityResult.status === 'rejected') {
      throw capabilityResult.reason;
    }

    const passwordSetupEmailCapability = capabilityResult.value;

    if (!passwordSetupEmailCapability.ok) {
      return {
        status: 'blocked',
        summary: passwordSetupEmailCapability.summary,
        source: 'access_probe',
        checkedAt: new Date().toISOString(),
        errorCode: passwordSetupEmailCapability.errorCode,
        requestId: input.requestId,
      } as const;
    }

    return {
      status: 'ready',
      summary: passwordSetupEmailCapability.loginClientId
        ? `Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails über den Login-Client ${passwordSetupEmailCapability.loginClientId} anstoßen.`
        : 'Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails anstoßen.',
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
          ? 'Tenant-Admin-Client darf die erforderlichen IAM-Ressourcen nicht lesen.'
          : 'Tenant-Admin-Rechteprobe konnte nicht abgeschlossen werden.',
      source: 'access_probe',
      checkedAt: new Date().toISOString(),
      errorCode,
      requestId: input.requestId,
    } as const;
  }
};

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const invalidateInstancePermissionSnapshots = async (input: { instanceId: string; trigger: string }) => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = await pool.connect();
  try {
    await notifyPermissionInvalidation(client, {
      instanceId: input.instanceId,
      trigger: input.trigger,
    });
  } finally {
    client.release();
  }
};

const registryRuntime = createInstanceRegistryRuntime({
  resolvePool,
  createRepository: createInstanceRegistryRepository,
  serviceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    invalidatePermissionSnapshots: invalidateInstancePermissionSnapshots,
    moduleIamRegistry: studioModuleIamRegistry,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
    probeTenantIamAccess,
  },
  provisioningWorkerServiceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    invalidatePermissionSnapshots: invalidateInstancePermissionSnapshots,
    moduleIamRegistry: studioModuleIamRegistry,
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
