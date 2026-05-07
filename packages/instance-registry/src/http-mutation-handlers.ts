import type { InstanceStatus } from '@sva/core';

import {
  createExecuteInstanceKeycloakProvisioningHandler,
  createProbeTenantIamAccessHandler,
  createReconcileInstanceKeycloakHandler,
} from './http-mutation-actions.js';
import {
  createAssignModuleHandler,
  createMutateInstanceStatusHandler,
  createRevokeModuleHandler,
  createSeedIamBaselineHandler,
} from './http-mutation-module-actions.js';
import {
  createInstanceMutationErrorMapper,
  type InstanceRegistryMutationHttpActor,
  type InstanceRegistryMutationHttpDeps,
} from './http-mutation-shared.js';

export type { InstanceRegistryMutationHttpActor, InstanceRegistryMutationHttpDeps } from './http-mutation-shared.js';
export { createInstanceMutationErrorMapper } from './http-mutation-shared.js';

export const createInstanceRegistryMutationHttpHandlers = <TContext>(
  deps: InstanceRegistryMutationHttpDeps<TContext>
) => {
  const mapMutationError = createInstanceMutationErrorMapper(deps);
  const mutateInstanceStatus = createMutateInstanceStatusHandler(deps);

  return {
    reconcileInstanceKeycloak: createReconcileInstanceKeycloakHandler(deps, mapMutationError),
    executeInstanceKeycloakProvisioning: createExecuteInstanceKeycloakProvisioningHandler(deps, mapMutationError),
    probeTenantIamAccess: createProbeTenantIamAccessHandler(deps, mapMutationError),
    assignModule: createAssignModuleHandler(deps),
    revokeModule: createRevokeModuleHandler(deps),
    seedIamBaseline: createSeedIamBaselineHandler(deps),
    mutateInstanceStatus: (
      request: Request,
      ctx: TContext,
      nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
    ): Promise<Response> => mutateInstanceStatus(request, ctx, nextStatus),
  };
};
