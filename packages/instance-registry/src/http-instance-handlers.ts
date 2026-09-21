import {
  createCreateInstanceHandler,
  createDraftReadinessHandler,
  createRetryTenantProvisioningHandler,
  createUpdateInstanceHandler,
} from './http-instance-write-handlers.js';
import {
  createGetInstanceHandler,
  createListInstancesHandler,
  createListRealmCatalogHttpHandler,
} from './http-instance-read-handlers.js';

export {
  type InstanceRegistryHttpActor,
  type InstanceRegistryHttpDeps,
  type InstanceRegistryStatusMutation,
} from './http-instance-shared.js';

import type { InstanceRegistryHttpDeps } from './http-instance-shared.js';

export const createInstanceRegistryHttpHandlers = <TContext>(
  deps: InstanceRegistryHttpDeps<TContext>
) => ({
  listInstances: createListInstancesHandler(deps),
  getInstance: createGetInstanceHandler(deps),
  createInstance: createCreateInstanceHandler(deps),
  getDraftReadiness: createDraftReadinessHandler(deps),
  listRealmCatalog: createListRealmCatalogHttpHandler(deps),
  retryTenantProvisioning: createRetryTenantProvisioningHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
});
