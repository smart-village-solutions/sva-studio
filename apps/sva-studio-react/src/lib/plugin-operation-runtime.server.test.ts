import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerPluginOperationExecutionHandlersMock = vi.fn();

vi.mock('@sva/auth-runtime/server', () => ({
  registerPluginOperationExecutionHandlers: registerPluginOperationExecutionHandlersMock,
}));

describe('plugin operation runtime registration', () => {
  beforeEach(() => {
    registerPluginOperationExecutionHandlersMock.mockReset();
    vi.resetModules();
  });

  it('registers the current studio plugin operation handlers after coverage validation', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = mod.registerStudioPluginOperationHandlers();

    expect(Object.keys(handlers).sort()).toEqual([
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.initialize-data-source',
      'waste-management.reset-data',
      'waste-management.seed-data',
    ]);
    expect(registerPluginOperationExecutionHandlersMock).toHaveBeenCalledWith(handlers);
  });

  it('rejects declared job types without a registered runtime handler', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() =>
      mod.assertPluginOperationExecutionHandlerCoverage({
        declaredJobTypeIds: ['news.import-articles'],
        handlers: {},
      })
    ).toThrowError('missing_plugin_operation_handlers:news.import-articles');
  });

  it('rejects registered runtime handlers without a declared job type', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() =>
      mod.assertPluginOperationExecutionHandlerCoverage({
        declaredJobTypeIds: [],
        handlers: {
          'news.import-articles': vi.fn(),
        },
      })
    ).toThrowError('unknown_plugin_operation_handlers:news.import-articles');
  });

  it('covers the declared waste job types with registered handlers', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() => mod.assertStudioPluginOperationHandlerCoverage(mod.createStudioPluginOperationExecutionHandlers())).not.toThrow();
  });
});
