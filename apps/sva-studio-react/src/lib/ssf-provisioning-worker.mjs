import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { configureInstanceRegistryPluginRuntimeSnapshot } from '@sva/auth-runtime/server';
import { pluginSdkVersion, resolvePluginCatalog } from '@sva/plugin-sdk';
import { studioHostModuleIamContracts } from '@sva/studio-module-iam';

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
  const customManifest =
    process.env.SVA_STUDIO_DISTRIBUTION === 'custom'
      ? JSON.parse(
          readFileSync(
            new URL('./.output/server/generated/studio-distribution.json', import.meta.url),
            'utf8'
          )
        )
      : undefined;
  if (customManifest) {
    const snapshot = customManifest.provisioningSnapshot;
    const selected = customManifest.includedPluginIds;
    const moduleIds = snapshot?.activationPolicies?.modules?.map(({ moduleId }) => moduleId);
    if (
      customManifest.distribution !== 'custom' ||
      !Array.isArray(selected) ||
      !Array.isArray(moduleIds) ||
      JSON.stringify([...selected].sort((left, right) => left.localeCompare(right))) !==
        JSON.stringify([...moduleIds].sort((left, right) => left.localeCompare(right)))
    ) {
      throw new Error('custom_provisioning_snapshot_mismatch');
    }
    let pluginOidcClientRequirements = [];
    if (selected.includes('ssf')) {
      const { SSF_TENANT_OIDC_CLIENT_REQUIREMENT, readSsfLoginClientRequirement } =
        await import('@sva/plugin-ssf/provisioning');
      pluginOidcClientRequirements = [
        SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
        ...[readSsfLoginClientRequirement()].filter((entry) => entry !== null),
      ];
    }
    configureInstanceRegistryPluginRuntimeSnapshot({ ...snapshot, pluginOidcClientRequirements });
    await startWorker();
    return;
  }
  const { ssfPlugin } = await import('@sva/plugin-ssf/descriptor');
  const { default: ssfManifest } = await import('@sva/plugin-ssf/plugin.manifest.json', {
    with: { type: 'json' },
  });
  const { SSF_TENANT_OIDC_CLIENT_REQUIREMENT, readSsfLoginClientRequirement } =
    await import('@sva/plugin-ssf/provisioning');
  const catalogEntry = {
    pluginId: 'ssf',
    sourceType: 'workspace',
    sourceRef: 'packages/plugin-ssf',
    enabled: true,
    manifest: ssfManifest,
  };
  const resolved = resolvePluginCatalog({
    catalog: [catalogEntry],
    host: {
      studioVersion: '0.0.1',
      sdkVersion: pluginSdkVersion,
      capabilities: [
        'routing',
        'navigation',
        'iam',
        'audit',
        'jobs',
        'imports',
        'exports',
        'server',
      ],
    },
    resolvePlugin: () => ({
      ...ssfPlugin,
      routes: ssfPlugin.routes.map((route) => ({ ...route, component: () => null })),
    }),
  });
  if (resolved.activeCatalog.length !== 1) {
    throw new Error(
      `ssf_plugin_catalog_rejected:${resolved.issues.map((issue) => issue.code).join(',')}`
    );
  }
  const { snapshot } = resolved;
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
