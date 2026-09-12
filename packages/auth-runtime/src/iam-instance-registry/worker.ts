import { randomUUID } from 'node:crypto';

import {
  isWorkerEntrypoint,
  processNextTenantProvisioningRun,
  runKeycloakProvisioningWorkerLoop as runTargetKeycloakProvisioningWorkerLoop,
} from '@sva/instance-registry/provisioning-worker';

import { readConfiguredPluginTenantReadiness } from '../plugin-tenant-lifecycle/read-model.js';
import {
  probeKasselTenantEndpoint,
  publishConfiguredKasselTenantIngress,
} from '../kassel-tenant-provisioning.js';
import {
  runConfiguredPluginTenantProvisioningSchedule,
  withRegistryProvisioningWorkerDeps,
} from './repository.js';
import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';

const workerId = `kassel-tenant-provisioner:${randomUUID()}`;

export const readProvisioningModuleReadiness = async (instanceId: string) => {
  const models = await readConfiguredPluginTenantReadiness(instanceId);
  const evidence = {
    modules: models.map((model) => ({
      pluginId: model.pluginId,
      status: model.status,
      evidenceState: model.evidenceState,
      revision: model.revision,
      errorCode: model.error?.code,
    })),
  };
  if (
    models.some(
      (model) =>
        model.error?.retryKind === 'terminal' ||
        (model.status === 'blocked' && model.error?.retryKind !== 'retryable')
    )
  ) {
    return { status: 'blocked' as const, evidence };
  }
  if (models.some((model) => model.status !== 'ready' || model.evidenceState !== 'valid')) {
    return { status: 'pending' as const, evidence };
  }
  return { status: 'ready' as const, evidence };
};

export const runKeycloakProvisioningWorkerIteration = async () =>
  withRegistryProvisioningWorkerDeps(async (deps) => {
    const keycloakRun = await processNextQueuedKeycloakProvisioningRun(deps);
    if (process.env.SVA_TENANT_INGRESS_MODE !== 'kassel-traefik-file') {
      return keycloakRun;
    }
    const tenantRun = await processNextTenantProvisioningRun(
      {
        ...deps,
        publishTenantIngress: publishConfiguredKasselTenantIngress,
        probeTenantEndpoint: probeKasselTenantEndpoint,
        scheduleProvisioningModuleReconcile: runConfiguredPluginTenantProvisioningSchedule,
        readProvisioningModuleReadiness,
      },
      { workerId }
    );
    return keycloakRun ?? tenantRun;
  });

export const runKeycloakProvisioningWorkerLoop = async (input?: { pollIntervalMs?: number }) =>
  runTargetKeycloakProvisioningWorkerLoop(runKeycloakProvisioningWorkerIteration, input);

if (isWorkerEntrypoint(import.meta.url, process.argv[1])) {
  await runKeycloakProvisioningWorkerLoop();
}

export { isWorkerEntrypoint };
