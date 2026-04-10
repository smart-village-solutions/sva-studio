import { createSdkLogger } from '@sva/sdk/server';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withRegistryProvisioningWorkerDeps } from './repository.js';
import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-provisioner-worker', level: 'info' });

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const runKeycloakProvisioningWorkerIteration = async () =>
  withRegistryProvisioningWorkerDeps((deps) => processNextQueuedKeycloakProvisioningRun(deps));

export const isWorkerEntrypoint = (moduleUrl: string, argvEntry?: string) => {
  if (!argvEntry) {
    return false;
  }

  const resolvedEntry = resolve(argvEntry);
  const normalizedEntry = (() => {
    try {
      return realpathSync(resolvedEntry);
    } catch {
      return resolvedEntry;
    }
  })();

  return moduleUrl === pathToFileURL(normalizedEntry).href;
};

export const runKeycloakProvisioningWorkerLoop = async (input?: {
  pollIntervalMs?: number;
}) => {
  const pollIntervalMs = input?.pollIntervalMs ?? Number.parseInt(process.env.SVA_KEYCLOAK_PROVISIONER_POLL_INTERVAL_MS ?? '5000', 10);

  logger.info('keycloak_provisioner_worker_started', {
    operation: 'keycloak_provisioner_worker_loop',
    poll_interval_ms: pollIntervalMs,
  });

  for (;;) {
    try {
      const run = await runKeycloakProvisioningWorkerIteration();
      if (!run) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      logger.error('keycloak_provisioner_worker_iteration_failed', {
        operation: 'keycloak_provisioner_worker_loop',
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(pollIntervalMs);
    }
  }
};

if (isWorkerEntrypoint(import.meta.url, process.argv[1])) {
  await runKeycloakProvisioningWorkerLoop();
}
