import {
  createInstanceRegistryService as createTargetInstanceRegistryService,
  type InstanceRegistryServiceDeps,
} from '@sva/instance-registry';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps) =>
  createTargetInstanceRegistryService(withAuthInstanceRegistryDeps(deps));
