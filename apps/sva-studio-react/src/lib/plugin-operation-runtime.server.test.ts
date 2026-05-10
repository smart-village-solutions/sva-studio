import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definePluginManifest, type PluginSnapshot } from '@sva/plugin-sdk';

const registerPluginOperationExecutionHandlersMock = vi.fn();

vi.mock('@sva/auth-runtime/server', () => ({
  registerPluginOperationExecutionHandlers: registerPluginOperationExecutionHandlersMock,
}));

const createJobPluginSource = (input: {
  readonly pluginId: string;
  readonly runtimeRequirement?: string;
}): PluginSnapshot['pluginSources'][number] => ({
  pluginId: input.pluginId,
  sourceType: 'workspace',
  sourceRef: 'packages/plugin-waste-management',
  manifest: definePluginManifest({
    pluginId: input.pluginId,
    version: '0.0.1',
    sdkVersion: '0.0.1',
    hostCompatibility: {
      studioVersionRange: '^0.0.1',
      requiredCapabilities: ['jobs'],
    },
    entryPoints: {
      browser: './dist/index.js',
      jobs: './dist/server.js',
    },
    runtimeRequirements: input.runtimeRequirement
      ? {
          jobs: input.runtimeRequirement,
        }
      : undefined,
  }),
});

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
  }, 15000);

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

  it('resolves job runtimes by runtime contract id instead of plugin id', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = mod.createPluginOperationExecutionHandlersFromSnapshot({
      pluginSources: [createJobPluginSource({ pluginId: 'custom-waste-plugin', runtimeRequirement: 'waste-management.operations' })],
      runtimeFactories: {
        'waste-management.operations': () => ({}),
      },
    });

    expect(Object.keys(handlers).sort()).toEqual([
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.initialize-data-source',
      'waste-management.reset-data',
      'waste-management.seed-data',
    ]);
  });

  it('ignores plugin sources without job entry points', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = mod.createPluginOperationExecutionHandlersFromSnapshot({
      pluginSources: [
        {
          pluginId: 'browser-only-plugin',
          sourceType: 'workspace',
          sourceRef: 'packages/plugin-news',
          manifest: definePluginManifest({
            pluginId: 'browser-only-plugin',
            version: '0.0.1',
            sdkVersion: '0.0.1',
            hostCompatibility: {
              studioVersionRange: '^0.0.1',
              requiredCapabilities: ['routing'],
            },
            entryPoints: {
              browser: './dist/index.js',
            },
          }),
        },
      ],
      runtimeFactories: {},
    });

    expect(handlers).toEqual({});
  });

  it('rejects job entry points without declared runtime requirements', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() =>
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [
          {
            pluginId: 'custom-waste-plugin',
            sourceType: 'workspace',
            sourceRef: 'packages/plugin-waste-management',
            manifest: {
              pluginId: 'custom-waste-plugin',
              version: '0.0.1',
              sdkVersion: '0.0.1',
              hostCompatibility: {
                studioVersionRange: '^0.0.1',
                requiredCapabilities: ['jobs'],
              },
              entryPoints: {
                browser: './dist/index.js',
                jobs: './dist/server.js',
              },
            },
          },
        ],
        runtimeFactories: {},
      })
    ).toThrowError('plugin_job_runtime_requirement_missing:custom-waste-plugin');
  });

  it('rejects missing host runtime providers for declared runtime contracts', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() =>
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [createJobPluginSource({ pluginId: 'custom-waste-plugin', runtimeRequirement: 'custom.runtime' })],
        runtimeFactories: {},
      })
    ).toThrowError('plugin_job_runtime_provider_missing:custom-waste-plugin:custom.runtime');
  });

  it('rejects package job sources without a loadable module factory', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    expect(() =>
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [
          {
            ...createJobPluginSource({
              pluginId: 'installed-waste-plugin',
              runtimeRequirement: 'waste-management.operations',
            }),
            sourceType: 'installed-distribution',
            sourceRef: '@acme/plugin-waste-management',
          },
        ],
        runtimeFactories: {
          'waste-management.operations': () => ({}),
        },
      })
    ).toThrowError('missing_plugin_job_module_factory:installed-waste-plugin');
  });
});
