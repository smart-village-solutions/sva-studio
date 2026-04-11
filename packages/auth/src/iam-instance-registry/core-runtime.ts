import { createApiError } from '../iam-account-management/api-helpers.js';
import { getWorkspaceContext } from '@sva/sdk/server';
import { isTrafficEnabledInstanceStatus, type InstanceStatus } from '@sva/core';

import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { withRegistryService } from './repository.js';

import type { ResolveRuntimeInstanceResult } from './keycloak-types.js';

export const resolveRuntimeInstanceFromRequest = async (request: Request): Promise<ResolveRuntimeInstanceResult> => {
  const host = resolveEffectiveRequestHost(request);
  const resolved = await withRegistryService((service) => service.resolveRuntimeInstance(host));
  return {
    hostClassification: resolved.hostClassification,
    instance: resolved.instance,
  };
};

export const createTenantForbiddenResponse = (): Response =>
  createApiError(403, 'forbidden', 'Host ist für diese Operation nicht erlaubt.', getWorkspaceContext().requestId);

export const isInstanceTrafficAllowed = (status: InstanceStatus): boolean =>
  isTrafficEnabledInstanceStatus(status);
