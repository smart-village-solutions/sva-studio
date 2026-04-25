import {
  isWorkerEntrypoint,
  runKeycloakProvisioningWorkerLoop as runTargetKeycloakProvisioningWorkerLoop,
} from '@sva/instance-registry/provisioning-worker';
import { withRegistryProvisioningWorkerDeps } from './repository.js';
import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';

export const runKeycloakProvisioningWorkerIteration = async () =>
  withRegistryProvisioningWorkerDeps((deps) => processNextQueuedKeycloakProvisioningRun(deps));

export const runKeycloakProvisioningWorkerLoop = async (input?: {
  pollIntervalMs?: number;
}) => runTargetKeycloakProvisioningWorkerLoop(runKeycloakProvisioningWorkerIteration, input);

if (isWorkerEntrypoint(import.meta.url, process.argv[1])) {
  await runKeycloakProvisioningWorkerLoop();
}

export { isWorkerEntrypoint };
