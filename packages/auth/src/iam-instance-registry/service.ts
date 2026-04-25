import {
  createInstanceRegistryService as createTargetInstanceRegistryService,
} from '@sva/instance-registry/service';
import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export const createInstanceRegistryService = (deps: InstanceRegistryServiceDeps) =>
  createTargetInstanceRegistryService(withAuthInstanceRegistryDeps(deps));
