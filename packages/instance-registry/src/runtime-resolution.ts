import { isTrafficEnabledInstanceStatus, type InstanceStatus } from '@sva/core';

import type { InstanceRegistryService } from './service-types.js';
import type { ResolveRuntimeInstanceResult } from './keycloak-types.js';

export type RuntimeInstanceResolutionDeps = {
  readonly resolveEffectiveRequestHost: (request: Request) => string;
  readonly withRegistryService: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
};

export const resolveRuntimeInstanceFromRequest = async (
  request: Request,
  deps: RuntimeInstanceResolutionDeps
): Promise<ResolveRuntimeInstanceResult> => {
  const host = deps.resolveEffectiveRequestHost(request);
  const resolved = await deps.withRegistryService((service) => service.resolveRuntimeInstance(host));
  return {
    hostClassification: resolved.hostClassification,
    instance: resolved.instance,
  };
};

export const isInstanceTrafficAllowed = (status: InstanceStatus): boolean =>
  isTrafficEnabledInstanceStatus(status);
