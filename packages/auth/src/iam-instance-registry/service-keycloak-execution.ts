import {
  createExecuteKeycloakProvisioningHandler as createTargetExecuteKeycloakProvisioningHandler,
  createReconcileKeycloakHandler as createTargetReconcileKeycloakHandler,
  processClaimedKeycloakProvisioningRun as processTargetClaimedKeycloakProvisioningRun,
  processNextQueuedKeycloakProvisioningRun as processTargetNextQueuedKeycloakProvisioningRun,
} from '@sva/instance-registry/service-keycloak-execution';
import type { InstanceKeycloakProvisioningRun } from '@sva/core';
import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import { withAuthInstanceRegistryDeps } from './instance-registry-deps.js';

export const createExecuteKeycloakProvisioningHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetExecuteKeycloakProvisioningHandler(withAuthInstanceRegistryDeps(deps));

export const createReconcileKeycloakHandler = (deps: InstanceRegistryServiceDeps) =>
  createTargetReconcileKeycloakHandler(withAuthInstanceRegistryDeps(deps));

export const processClaimedKeycloakProvisioningRun = (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun | null
) => processTargetClaimedKeycloakProvisioningRun(withAuthInstanceRegistryDeps(deps), run);

export const processNextQueuedKeycloakProvisioningRun = (deps: InstanceRegistryServiceDeps) =>
  processTargetNextQueuedKeycloakProvisioningRun(withAuthInstanceRegistryDeps(deps));
