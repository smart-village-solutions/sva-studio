import { fileURLToPath } from 'node:url';

import { configureInstanceRegistryPluginRuntimeSnapshot } from '@sva/auth-runtime/server';
import { createPluginSnapshot } from '@sva/plugin-sdk';
import { ssfPlugin } from '@sva/plugin-ssf';
import {
  SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
  readSsfLoginClientRequirement,
} from '@sva/plugin-ssf/provisioning';
import ssfManifest from '@sva/plugin-ssf/plugin.manifest.json' with { type: 'json' };
import { studioHostModuleIamContracts } from '@sva/studio-module-iam';

const catalogEntry = {
  pluginId: 'ssf',
  sourceType: 'workspace',
  sourceRef: 'packages/plugin-ssf',
  enabled: true,
  manifest: ssfManifest,
};

export const runSsfProvisioningWorker = async (
  startWorker = async () => {
    const workerUrl = new URL(
      './node_modules/@sva/auth-runtime/dist/iam-instance-registry/worker.js',
      import.meta.url
    );
    const { runKeycloakProvisioningWorkerLoop } = await import(workerUrl.href);
    await runKeycloakProvisioningWorkerLoop();
  }
) => {
  const snapshot = createPluginSnapshot({
    catalog: [catalogEntry],
    loadedPlugins: [{ catalogEntry, plugin: ssfPlugin }],
  });
  configureInstanceRegistryPluginRuntimeSnapshot({
    activationPolicies: snapshot.tenantActivationPolicySnapshot,
    moduleIamContracts: [
      ...snapshot.registry.pluginModuleIamContracts,
      ...studioHostModuleIamContracts,
    ],
    tenantLifecycles: snapshot.registry.tenantLifecycles,
    pluginOidcClientRequirements: [
      SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
      ...[readSsfLoginClientRequirement()].filter((entry) => entry !== null),
    ],
  });
  await startWorker();
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runSsfProvisioningWorker();
}
