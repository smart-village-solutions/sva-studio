import { timingSafeEqual } from 'node:crypto';

import { normalizeHost } from '@sva/core';
import type { InstanceRegistryRecord } from '@sva/core';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import { DEFAULT_TENANT_ADMIN_CLIENT_ID } from './service-shared.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  loadRepositoryAuthClientSecret,
  loadRepositoryTenantAdminClientSecret,
} from './service-keycloak-secrets.js';

export const buildCreateInstancePayloadFingerprint = (
  input: CreateInstanceProvisioningInput
): string =>
  buildPayloadFingerprint({
    instanceId: input.instanceId,
    displayName: input.displayName,
    parentDomain: normalizeHost(input.parentDomain),
    realmMode: input.realmMode,
    authRealm: input.authRealm,
    authClientId: input.authClientId,
    authIssuerUrl: input.authIssuerUrl,
    authClientSecretProvided: Boolean(input.authClientSecret?.trim()),
    tenantAdminClient: {
      clientId: input.tenantAdminClient?.clientId ?? DEFAULT_TENANT_ADMIN_CLIENT_ID,
      secretProvided: Boolean(input.tenantAdminClient?.secret?.trim()),
    },
    tenantAdminBootstrap: input.tenantAdminBootstrap,
    themeKey: input.themeKey,
    mainserverConfigRef: input.mainserverConfigRef,
    featureFlags: input.featureFlags ?? {},
  });

const secretsEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const matchesPersistedSecret = async (input: {
  readonly configured: boolean;
  readonly submitted: string | undefined;
  readonly load: () => Promise<string | undefined>;
}): Promise<boolean> => {
  const submitted = input.submitted?.trim() || undefined;
  if (!submitted) return true;
  if (!input.configured) return false;
  const persisted = await input.load();
  return persisted !== undefined && secretsEqual(persisted, submitted);
};

export const matchesPersistedCreateSecrets = async (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput,
  instance: InstanceRegistryRecord
): Promise<boolean> => {
  const authClientSecretMatches = await matchesPersistedSecret({
    configured: instance.authClientSecretConfigured,
    submitted: input.authClientSecret,
    load: () => loadRepositoryAuthClientSecret(deps, deps.repository, instance.instanceId),
  });
  if (!authClientSecretMatches) return false;
  return matchesPersistedSecret({
    configured: instance.tenantAdminClient?.secretConfigured === true,
    submitted: input.tenantAdminClient?.secret,
    load: () => loadRepositoryTenantAdminClientSecret(deps, deps.repository, instance.instanceId),
  });
};
