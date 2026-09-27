import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  configureInstanceRegistryPluginRuntimeSnapshot: mocks.configure,
}));

describe('SSF provisioning worker composition', () => {
  beforeEach(() => {
    mocks.configure.mockReset();
  });

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
