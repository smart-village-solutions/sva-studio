import {
  createInstanceRegistryRepository,
  type InstanceRegistryRepository,
} from '@sva/data-repositories';
import { withInstanceRegistryRepository } from '@sva/instance-registry/runtime-wiring';

import { createPoolResolver } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';

export const resolveInstanceRegistryPool = createPoolResolver(getIamDatabaseUrl);

export const withRegistryRepository = <T>(
  work: (repository: InstanceRegistryRepository) => Promise<T>
): Promise<T> =>
  withInstanceRegistryRepository(
    {
      resolvePool: resolveInstanceRegistryPool,
      createRepository: createInstanceRegistryRepository,
    },
    work
  );

export const closeInstanceRegistryRepositoryPoolForShutdown = async (): Promise<void> => {
  await resolveInstanceRegistryPool()?.end();
};
