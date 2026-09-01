import { normalizeHost } from '@sva/core';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import { DEFAULT_TENANT_ADMIN_CLIENT_ID } from './service-shared.js';

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
    authClientSecret: input.authClientSecret?.trim() || undefined,
    tenantAdminClient: {
      clientId: input.tenantAdminClient?.clientId ?? DEFAULT_TENANT_ADMIN_CLIENT_ID,
      secret: input.tenantAdminClient?.secret?.trim() || undefined,
    },
    tenantAdminBootstrap: input.tenantAdminBootstrap,
    themeKey: input.themeKey,
    mainserverConfigRef: input.mainserverConfigRef,
    featureFlags: input.featureFlags ?? {},
  });
