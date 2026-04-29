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
const pluginModuleIamRegistry = new Map([
  [
    'news',
    {
      moduleId: 'news',
      permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
      systemRoles: [
        { roleName: 'system_admin', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
        { roleName: 'app_manager', permissionIds: ['news.read'] },
        { roleName: 'feature-manager', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
        { roleName: 'interface-manager', permissionIds: ['news.read'] },
        { roleName: 'designer', permissionIds: ['news.read', 'news.update'] },
        { roleName: 'editor', permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'] },
        { roleName: 'moderator', permissionIds: ['news.read'] },
      ],
    },
  ],
  [
    'events',
    {
      moduleId: 'events',
      permissionIds: ['events.read', 'events.create', 'events.update', 'events.delete'],
      systemRoles: [
        { roleName: 'system_admin', permissionIds: ['events.read', 'events.create', 'events.update', 'events.delete'] },
        { roleName: 'app_manager', permissionIds: ['events.read'] },
        { roleName: 'feature-manager', permissionIds: ['events.read', 'events.create', 'events.update', 'events.delete'] },
        { roleName: 'interface-manager', permissionIds: ['events.read'] },
        { roleName: 'designer', permissionIds: ['events.read', 'events.update'] },
        { roleName: 'editor', permissionIds: ['events.read', 'events.create', 'events.update', 'events.delete'] },
        { roleName: 'moderator', permissionIds: ['events.read'] },
      ],
    },
  ],
  [
    'poi',
    {
      moduleId: 'poi',
      permissionIds: ['poi.read', 'poi.create', 'poi.update', 'poi.delete'],
      systemRoles: [
        { roleName: 'system_admin', permissionIds: ['poi.read', 'poi.create', 'poi.update', 'poi.delete'] },
        { roleName: 'app_manager', permissionIds: ['poi.read'] },
        { roleName: 'feature-manager', permissionIds: ['poi.read', 'poi.create', 'poi.update', 'poi.delete'] },
        { roleName: 'interface-manager', permissionIds: ['poi.read'] },
        { roleName: 'designer', permissionIds: ['poi.read', 'poi.update'] },
        { roleName: 'editor', permissionIds: ['poi.read', 'poi.create', 'poi.update', 'poi.delete'] },
        { roleName: 'moderator', permissionIds: ['poi.read'] },
      ],
    },
  ],
  [
    'media',
    {
      moduleId: 'media',
      permissionIds: [
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
        'media.delete',
        'media.deliver.protected',
      ],
      systemRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'media.read',
            'media.create',
            'media.update',
            'media.reference.manage',
            'media.delete',
            'media.deliver.protected',
          ],
        },
        { roleName: 'app_manager', permissionIds: ['media.read'] },
        {
          roleName: 'feature-manager',
          permissionIds: ['media.read', 'media.create', 'media.update', 'media.reference.manage', 'media.delete'],
        },
        { roleName: 'interface-manager', permissionIds: ['media.read'] },
        { roleName: 'designer', permissionIds: ['media.read', 'media.update'] },
        {
          roleName: 'editor',
          permissionIds: ['media.read', 'media.create', 'media.update', 'media.reference.manage'],
        },
        { roleName: 'moderator', permissionIds: ['media.read'] },
      ],
    },
  ],
]);

const registryRuntime = createInstanceRegistryRuntime({
  resolvePool,
  createRepository: createInstanceRegistryRepository,
  serviceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    moduleIamRegistry: pluginModuleIamRegistry,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
    probeTenantIamAccess,
  },
  provisioningWorkerServiceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    moduleIamRegistry: pluginModuleIamRegistry,
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
