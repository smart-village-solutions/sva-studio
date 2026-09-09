import { isReservedTenantHostname, normalizeHost } from '@sva/core';

import type { CreateInstanceProvisioningInput, UpdateInstanceInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

export const assertTenantHostnameAvailable = (
  deps: InstanceRegistryServiceDeps,
  hostname: string
): void => {
  const reserved =
    typeof deps.reservedHostnames === 'function'
      ? deps.reservedHostnames()
      : deps.reservedHostnames;
  const normalized = normalizeHost(hostname);
  if (
    isReservedTenantHostname(normalized.split('.')[0] ?? '') ||
    reserved?.some((host) => normalizeHost(host) === normalized)
  ) {
    throw new Error('tenant_hostname_reserved');
  }
};

export const assertOidcClientIdsNotReserved = (
  deps: InstanceRegistryServiceDeps,
  input: Pick<
    CreateInstanceProvisioningInput | UpdateInstanceInput,
    'authClientId' | 'tenantAdminClient'
  >
): void => {
  const reservedClientIds =
    typeof deps.reservedOidcClientIds === 'function'
      ? deps.reservedOidcClientIds()
      : deps.reservedOidcClientIds;
  if (
    reservedClientIds?.includes(input.authClientId) ||
    (input.tenantAdminClient?.clientId &&
      reservedClientIds?.includes(input.tenantAdminClient.clientId))
  ) {
    throw new Error('oidc_client_id_reserved');
  }
};

