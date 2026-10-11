import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  readManifest: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  configureInstanceRegistryPluginRuntimeSnapshot: mocks.configure,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: mocks.readManifest,
    default: { ...actual, readFileSync: mocks.readManifest },
  };
});

describe('SSF provisioning worker composition', () => {
  beforeEach(() => {
    mocks.configure.mockReset();
    mocks.readManifest.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([{ selectedPluginIds: ['categories', 'news', 'ssf'] }, { selectedPluginIds: ['news'] }])(
    'uses the exact build snapshot for custom selection %j',
    async ({ selectedPluginIds }) => {
      vi.stubEnv('SVA_STUDIO_DISTRIBUTION', 'custom');
      const provisioningSnapshot = {
        activationPolicies: {
          revision: 'custom-test',
          modules: selectedPluginIds.map((moduleId) => ({
            moduleId,
            activationPolicy: 'optional',
          })),
        },
        moduleIamContracts: selectedPluginIds.map((moduleId) => ({ moduleId })),
        tenantLifecycles: [],
      };
      mocks.readManifest.mockReturnValue(
        JSON.stringify({
          schemaVersion: 1,
          distribution: 'custom',
          includedPluginIds: selectedPluginIds,
          provisioningSnapshot,
        })
      );
      const workerModulePath: string = './ssf-provisioning-worker.mjs';
      const { runSsfProvisioningWorker } = await import(workerModulePath);
      const startWorker = vi.fn(async () => {
        expect(mocks.configure).toHaveBeenCalledWith(expect.objectContaining(provisioningSnapshot));
        const oidc = mocks.configure.mock.calls[0]?.[0].pluginOidcClientRequirements;
        if (selectedPluginIds.includes('ssf'))
          expect(oidc).toEqual(
            expect.arrayContaining([expect.objectContaining({ pluginId: 'ssf' })])
          );
        else expect(oidc).toEqual([]);
      });
      await runSsfProvisioningWorker(startWorker);
      expect(startWorker).toHaveBeenCalledOnce();
    }
  );

  it('configures the SSF contract before processing a provisioning run', async () => {
    const workerModulePath: string = './ssf-provisioning-worker.mjs';
    const { runSsfProvisioningWorker } = (await import(workerModulePath)) as {
      runSsfProvisioningWorker: (startWorker: () => Promise<void>) => Promise<void>;
    };
    const startWorker = vi.fn(async () => {
      const snapshot = mocks.configure.mock.calls[0]?.[0];
      expect(snapshot).toBeDefined();
      expect(snapshot.activationPolicies.modules).toEqual([
        expect.objectContaining({ moduleId: 'ssf', activationPolicy: 'optional' }),
      ]);
      expect(snapshot.moduleIamContracts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            moduleId: 'ssf',
            permissionIds: expect.arrayContaining([
              'ssf.configuration.tenant.manage',
              'ssf.configuration.tenant.read',
            ]),
            systemRoles: [
              {
                roleName: 'system_admin',
                permissionIds: expect.arrayContaining([
                  'ssf.configuration.tenant.manage',
                  'ssf.configuration.tenant.read',
                ]),
              },
            ],
          }),
        ])
      );
      expect(snapshot.tenantLifecycles).toEqual([
        expect.objectContaining({ pluginId: 'ssf', contractVersion: 1 }),
      ]);
      expect(snapshot.pluginOidcClientRequirements).toEqual(
        expect.arrayContaining([expect.objectContaining({ pluginId: 'ssf' })])
      );
    });

    await runSsfProvisioningWorker(startWorker);

    expect(mocks.configure).toHaveBeenCalledOnce();
    expect(startWorker).toHaveBeenCalledOnce();
  }, 30_000);
});
