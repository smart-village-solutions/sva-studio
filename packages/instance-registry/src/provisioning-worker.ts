import { createSdkLogger } from '@sva/server-runtime';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const logger = createSdkLogger({ component: 'iam-instance-registry-provisioner-worker', level: 'info' });

export type KeycloakProvisioningWorkerIteration = () => Promise<unknown | null>;

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

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

export const runKeycloakProvisioningWorkerLoop = async (
  runIteration: KeycloakProvisioningWorkerIteration,
  input?: {
    pollIntervalMs?: number;
  }
) => {
  const rawInterval =
    input?.pollIntervalMs ?? Number.parseInt(process.env.SVA_KEYCLOAK_PROVISIONER_POLL_INTERVAL_MS ?? '', 10);
  const pollIntervalMs = Number.isNaN(rawInterval) || rawInterval <= 0 ? 5000 : rawInterval;

  const abortController = new AbortController();
  let shutdownRequested = false;

  const handleShutdownSignal = () => {
    if (!shutdownRequested) {
      shutdownRequested = true;
      logger.info('keycloak_provisioner_worker_shutdown_requested', {
        operation: 'keycloak_provisioner_worker_loop',
      });
      abortController.abort();
    }
  };

  process.on('SIGTERM', handleShutdownSignal);
  process.on('SIGINT', handleShutdownSignal);

  logger.info('keycloak_provisioner_worker_started', {
    operation: 'keycloak_provisioner_worker_loop',
    poll_interval_ms: pollIntervalMs,
  });

  try {
    for (;;) {
      if (abortController.signal.aborted) {
        logger.info('keycloak_provisioner_worker_shutdown_completed', {
          operation: 'keycloak_provisioner_worker_loop',
        });
        break;
      }

      try {
        const run = await runIteration();
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
  } finally {
    process.removeListener('SIGTERM', handleShutdownSignal);
    process.removeListener('SIGINT', handleShutdownSignal);
  }
};
