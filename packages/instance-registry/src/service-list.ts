import type { InstanceRegistryRepository } from '@sva/data-repositories';

import { toListItem } from './service-helpers.js';
import type { InstanceRegistryService } from './service-types.js';

export const createListInstances =
  (repository: InstanceRegistryRepository): InstanceRegistryService['listInstances'] =>
  async (input = {}) => {
    const instances = await repository.listInstances(input);
    const latestProvisioningRuns = await repository.listLatestProvisioningRuns(
      instances.map((instance) => instance.instanceId)
    );

    return instances.map((instance) => toListItem(instance, latestProvisioningRuns[instance.instanceId]));
  };
