import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definePluginManifest, type PluginCatalogSourceType } from '@sva/plugin-sdk';

const registerPluginOperationExecutionHandlersMock = vi.fn();

vi.mock('@sva/auth-runtime/server', () => ({
  registerPluginOperationExecutionHandlers: registerPluginOperationExecutionHandlersMock,
}));

const createPluginJobExecutionHandlersMock = vi.fn(() => ({
  'waste-management.apply-migrations': vi.fn(),
  'waste-management.import-data': vi.fn(),
  'waste-management.initialize-data-source': vi.fn(),
  'waste-management.reset-data': vi.fn(),
  'waste-management.seed-data': vi.fn(),
}));

vi.mock('../../../../packages/plugin-waste-management/src/server.ts', () => ({
  createPluginJobExecutionHandlers: createPluginJobExecutionHandlersMock,
}));

const createBrowserPluginModuleExports = (jobTypeIds: readonly string[]) => ({
  pluginWasteManagement: {
    id: 'waste-management',
    displayName: 'Waste Management',
    routes: [],
    jobTypes: jobTypeIds.map((jobTypeId) => ({
      jobTypeId,
      queue: 'plugin-operations',
      displayName: jobTypeId,
    })),
    translations: {},
  },
});

const declaredWasteJobTypeIds = [
  'waste-management.apply-migrations',
  'waste-management.import-data',
  'waste-management.initialize-data-source',
  'waste-management.reset-data',
  'waste-management.seed-data',
] as const;

const mockWasteBrowserPluginModule = (moduleExports: Record<string, unknown>): void => {
  vi.doMock('../../../../packages/plugin-waste-management/src/index.ts', () => moduleExports);
};

const createJobPluginSource = (input: {
  readonly pluginId: string;
  readonly runtimeRequirement?: string;
  readonly sourceType?: PluginCatalogSourceType;
  readonly sourceRef?: string;
  readonly jobsEntry?: string;
}) => ({
  pluginId: input.pluginId,
  sourceType: input.sourceType ?? 'workspace',
  sourceRef: input.sourceRef ?? 'packages/plugin-waste-management',
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
      jobs: input.jobsEntry ?? './dist/server.js',
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
    createPluginJobExecutionHandlersMock.mockClear();
    vi.resetModules();
    mockWasteBrowserPluginModule(createBrowserPluginModuleExports(declaredWasteJobTypeIds));
  });

  it('registers the current studio plugin operation handlers after coverage validation', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = await mod.registerStudioPluginOperationHandlers();

    expect(Object.keys(handlers).sort()).toEqual([
      'waste-management.apply-migrations',
      'waste-management.import-data',
      'waste-management.initialize-data-source',
      'waste-management.reset-data',
      'waste-management.seed-data',
    ]);
    expect(registerPluginOperationExecutionHandlersMock).toHaveBeenCalledWith(handlers);
  }, 30000);

  it('keeps the server runtime decoupled from the browser plugin snapshot module', async () => {
    const currentFilePath = fileURLToPath(import.meta.url);
    const source = readFileSync(resolve(dirname(currentFilePath), 'plugin-operation-runtime.server.ts'), 'utf8');

    expect(source).not.toContain("from './plugins.js'");
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
          'news.import-articles': {
            handler: vi.fn(),
            queueName: 'plugin-imports',
          },
        },
      })
    ).toThrowError('unknown_plugin_operation_handlers:news.import-articles');
  });

  it('covers the declared waste job types with registered handlers', async () => {
    const mod = await import('./plugin-operation-runtime.server');
    const handlers = await mod.createStudioPluginOperationExecutionHandlers();

    expect(() => mod.assertStudioPluginOperationHandlerCoverage(handlers)).not.toThrow();
  });

  it('rejects active plugin job types without a matching runtime handler', async () => {
    mockWasteBrowserPluginModule(
      createBrowserPluginModuleExports([
      ...declaredWasteJobTypeIds,
      'waste-management.unimplemented-job',
      ])
    );
    const mod = await import('./plugin-operation-runtime.server');
    const handlers = await mod.createStudioPluginOperationExecutionHandlers();

    expect(() => mod.assertStudioPluginOperationHandlerCoverage(handlers)).toThrowError(
      'missing_plugin_operation_handlers:waste-management.unimplemented-job'
    );
  });

  it('registers only plugins that survive catalog validation', async () => {
    mockWasteBrowserPluginModule({
      helper: {
        foo: 'bar',
      },
    });
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = await mod.registerStudioPluginOperationHandlers();

    expect(handlers).toEqual({});
    expect(registerPluginOperationExecutionHandlersMock).toHaveBeenCalledWith({});
  });

  it('resolves job runtimes by runtime contract id instead of plugin id', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = await mod.createPluginOperationExecutionHandlersFromSnapshot({
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

    const handlers = await mod.createPluginOperationExecutionHandlersFromSnapshot({
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

    await expect(
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
    ).rejects.toThrowError('plugin_job_runtime_requirement_missing:custom-waste-plugin');
  });

  it('rejects missing host runtime providers for declared runtime contracts', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    await expect(
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [createJobPluginSource({ pluginId: 'custom-waste-plugin', runtimeRequirement: 'custom.runtime' })],
        runtimeFactories: {},
      })
    ).rejects.toThrowError('plugin_job_runtime_provider_missing:custom-waste-plugin:custom.runtime');
  });

  it('rejects package job sources without a loadable module factory', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    await expect(
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [
          {
            ...createJobPluginSource({
            pluginId: 'installed-waste-plugin',
            runtimeRequirement: 'waste-management.operations',
            sourceType: 'installed-distribution',
          }),
            sourceRef: '@acme/plugin-waste-management',
          },
        ],
        runtimeFactories: {
          'waste-management.operations': () => ({}),
        },
      })
    ).rejects.toThrowError('missing_plugin_job_module_factory:installed-waste-plugin');
  });

  it('rejects duplicate job handler ids across plugin job modules', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    await expect(
      mod.createPluginOperationExecutionHandlersFromSnapshot({
        pluginSources: [
          createJobPluginSource({
            pluginId: 'workspace-waste-plugin',
            runtimeRequirement: 'waste-management.operations',
          }),
          createJobPluginSource({
            pluginId: 'workspace-waste-plugin-2',
            runtimeRequirement: 'waste-management.operations',
          }),
        ],
        runtimeFactories: {
          'waste-management.operations': () => ({}),
        },
      })
    ).rejects.toThrowError(
      /^duplicate_plugin_operation_handler:waste-management\.[^:]+:workspace-waste-plugin-2:workspace-waste-plugin$/
    );
  });

  it('prefers manifest-declared workspace job entries before falling back to src/server.ts', async () => {
    const mod = await import('./plugin-operation-runtime.server');

    const handlers = await mod.createPluginOperationExecutionHandlersFromSnapshot({
      pluginSources: [
        {
          ...createJobPluginSource({
            pluginId: 'workspace-waste-plugin',
            runtimeRequirement: 'waste-management.operations',
          }),
          manifest: definePluginManifest({
            pluginId: 'workspace-waste-plugin',
            version: '0.0.1',
            sdkVersion: '0.0.1',
            hostCompatibility: {
              studioVersionRange: '^0.0.1',
              requiredCapabilities: ['jobs'],
            },
            entryPoints: {
              jobs: './dist/server.js',
            },
            runtimeRequirements: {
              jobs: 'waste-management.operations',
            },
          }),
        },
      ],
      runtimeFactories: {
        'waste-management.operations': () => ({}),
      },
    });

    expect(Object.keys(handlers)).toContain('waste-management.initialize-data-source');
    expect(createPluginJobExecutionHandlersMock).toHaveBeenCalled();
  });
});
