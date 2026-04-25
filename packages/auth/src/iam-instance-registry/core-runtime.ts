import { createApiError } from '../iam-account-management/api-helpers.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import {
  isInstanceTrafficAllowed,
  resolveRuntimeInstanceFromRequest as resolveInstanceRegistryRuntimeInstanceFromRequest,
  type ResolveRuntimeInstanceResult,
  type RuntimeInstanceResolutionDeps,
} from '@sva/instance-registry';

import { resolveEffectiveRequestHost } from '../request-hosts.js';
import { withRegistryService } from './repository.js';

const runtimeInstanceResolutionDeps: RuntimeInstanceResolutionDeps = {
  resolveEffectiveRequestHost,
  withRegistryService,
};

export const resolveRuntimeInstanceFromRequest = async (
  request: Request
): Promise<ResolveRuntimeInstanceResult> =>
  resolveInstanceRegistryRuntimeInstanceFromRequest(request, runtimeInstanceResolutionDeps);

export const createTenantForbiddenResponse = (): Response =>
  createApiError(403, 'forbidden', 'Host ist für diese Operation nicht erlaubt.', getWorkspaceContext().requestId);

export { isInstanceTrafficAllowed };
