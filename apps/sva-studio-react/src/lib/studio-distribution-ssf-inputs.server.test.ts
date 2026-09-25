import { describe, expect, it, vi } from 'vitest';

const registerPluginOperationExecutionHandlersMock = vi.fn();
const registerStudioJobExecutionHandlersMock = vi.fn();
const createPluginJobExecutionHandlersMock = vi.fn(() => ({
  'ssf.reconcile-authorization': vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  dsrExportStudioJobRegistration: { jobTypeId: 'studio.dsr-export' },
  mediaContentSaveRecoveryStudioJobRegistration: {
    jobTypeId: 'media.content-save-recovery',
  },
  registerPluginOperationExecutionHandlers: registerPluginOperationExecutionHandlersMock,
  registerStudioJobExecutionHandlers: registerStudioJobExecutionHandlersMock,
}));

vi.mock('../../../../packages/plugin-ssf/src/server.js', () => ({
  createPluginJobExecutionHandlers: createPluginJobExecutionHandlersMock,
}));

vi.mock('./ssf-authorization-projection-runtime.server.js', () => ({
  createStudioSsfAuthorizationProjectionRuntime: vi.fn(() => ({})),
}));

describe('SSF Studio distribution inputs', () => {
  it('discovers SSF browser and server modules only from the workspace package', async () => {
    const clientInputs = await import('./plugin-client-inputs.ssf');
    const serverInputs = await import('./plugin-server-inputs.ssf.server');

    expect(Object.keys(clientInputs.workspaceManifestModules)).toEqual([
      expect.stringContaining('packages/plugin-ssf/plugin.manifest.json'),
    ]);
    expect(Object.keys(clientInputs.workspacePluginModuleLoaders)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('packages/plugin-ssf/src/browser.ts'),
        expect.stringContaining('packages/plugin-ssf/src/index.ts'),
      ])
    );
    expect(Object.keys(serverInputs.workspaceManifestModules)).toEqual([
      expect.stringContaining('packages/plugin-ssf/plugin.manifest.json'),
    ]);
    expect(Object.keys(serverInputs.workspaceServerModuleLoaders)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('packages/plugin-ssf/src/server.ts'),
        expect.stringContaining('packages/plugin-ssf/src/server/index.ts'),
      ])
    );
    expect(clientInputs.nodeManifestModules).toEqual({});
    expect(clientInputs.nodePluginModuleLoaders).toEqual({});
    expect(serverInputs.nodeManifestModules).toEqual({});
    expect(serverInputs.nodeServerModuleLoaders).toEqual({});
  });

  it('uses the SSF catalog and IAM contract while leaving generic ownership empty', async () => {
    const catalogInputs = await import('./plugin-catalog-inputs.ssf');
    const iamInputs = await import('./module-iam-inputs.ssf');
    const ownershipInputs = await import('./mainserver-generic-type-inputs.ssf.server');

    expect(catalogInputs.pluginCatalogConfig).toEqual([
      { pluginId: 'ssf', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-ssf' },
    ]);
    expect(iamInputs.studioPluginModuleContracts).toHaveLength(1);
    expect(ownershipInputs.workspaceOwnershipModules).toEqual({});
    expect(ownershipInputs.nodeOwnershipModules).toEqual({});
  });

  it('excludes the SSF admin login directory from the regular Studio server', async () => {
    const { dispatchStudioSsfAdminLoginDirectoryRequest } =
      await import('./ssf-admin-login-directory.excluded.server');

    await expect(dispatchStudioSsfAdminLoginDirectoryRequest()).resolves.toMatchObject({
      status: 404,
    });
  });

  it('registers SSF plugin operation handlers with the regular Studio host jobs', async () => {
    const { registerStudioPluginOperationHandlers } =
      await import('./plugin-operation-runtime.ssf.server');

    await expect(registerStudioPluginOperationHandlers()).resolves.toEqual({
      'ssf.reconcile-authorization': expect.objectContaining({
        queueName: 'plugin-operations',
        executionLane: 'default',
        supportsCancellation: false,
      }),
    });
    expect(registerStudioJobExecutionHandlersMock).toHaveBeenCalledWith([
      { jobTypeId: 'studio.dsr-export' },
      { jobTypeId: 'media.content-save-recovery' },
    ]);
    expect(registerPluginOperationExecutionHandlersMock).toHaveBeenCalledOnce();
  });
});
