import { randomUUID } from 'node:crypto';

import {
  isWorkerEntrypoint,
  processNextTenantProvisioningRun,
  runKeycloakProvisioningWorkerLoop as runTargetKeycloakProvisioningWorkerLoop,
} from '@sva/instance-registry/provisioning-worker';

import { readProvisioningModuleReadiness } from '../plugin-tenant-lifecycle/read-model.js';
import {
  probeKasselTenantEndpoint,
  publishConfiguredKasselTenantIngress,
} from '../kassel-tenant-provisioning.js';
import { withRegistryProvisioningWorkerDeps } from './repository.js';
import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';

const workerId = `kassel-tenant-provisioner:${randomUUID()}`;

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
export { readProvisioningModuleReadiness };
