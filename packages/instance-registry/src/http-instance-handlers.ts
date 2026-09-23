import {
  createCreateInstanceHandler,
  createDraftReadinessHandler,
  createRetryTenantProvisioningHandler,
  createUpdateServerAccountInvitationTemplateHandler,
  createUpdateInstanceHandler,
} from './http-instance-write-handlers.js';
import {
  createGetInstanceHandler,
  createGetServerAccountInvitationTemplateHandler,
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
  getServerAccountInvitationTemplate: createGetServerAccountInvitationTemplateHandler(deps),
  createInstance: createCreateInstanceHandler(deps),
  getDraftReadiness: createDraftReadinessHandler(deps),
  listRealmCatalog: createListRealmCatalogHttpHandler(deps),
  retryTenantProvisioning: createRetryTenantProvisioningHandler(deps),
  updateInstance: createUpdateInstanceHandler(deps),
  updateServerAccountInvitationTemplate: createUpdateServerAccountInvitationTemplateHandler(deps),
});
