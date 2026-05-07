import { createCreateInstanceHandler, createUpdateInstanceHandler } from './http-instance-write-handlers.js';
import { createGetInstanceHandler, createListInstancesHandler } from './http-instance-read-handlers.js';

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
  updateInstance: createUpdateInstanceHandler(deps),
});
