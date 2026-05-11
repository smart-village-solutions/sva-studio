import { describe, expect, it } from 'vitest';

import {
  createPluginBuildRegistries,
  getNodeSourceRefFromGlobPath,
  getRelativePackagePath,
  getWorkspaceSourceRefFromGlobPath,
  resolvePluginModuleFromRegistry,
  trimImportGlobPrefix,
} from './plugin-build-registry';

describe('plugin build registry helpers', () => {
  it('normalizes glob prefixes and resolves workspace or node source refs', () => {
    expect(trimImportGlobPrefix('../../../../packages/plugin-news/src/index.ts')).toBe(
      'packages/plugin-news/src/index.ts'
    );
    expect(getWorkspaceSourceRefFromGlobPath('../../../../packages/plugin-news/src/index.ts')).toBe(
      'packages/plugin-news'
    );
    expect(getWorkspaceSourceRefFromGlobPath('../../../../unexpected/plugin.ts')).toBeUndefined();
    expect(getNodeSourceRefFromGlobPath('../../../../node_modules/@scope/plugin/dist/index.js')).toBe(
      '@scope/plugin'
    );
    expect(getNodeSourceRefFromGlobPath('../../../../node_modules/plugin/dist/index.js')).toBe('plugin');
    expect(getNodeSourceRefFromGlobPath('../../../../unexpected/plugin.ts')).toBeUndefined();
  });

  it('derives relative package paths and falls back to normalized raw paths when needed', () => {
    expect(getRelativePackagePath('../../../../packages/plugin-news/src/index.ts', 'packages/plugin-news')).toBe(
      'src/index.ts'
    );
    expect(getRelativePackagePath('../../../../node_modules/@scope/plugin/dist/index.js', '@scope/plugin')).toBe(
      'dist/index.js'
    );
    expect(getRelativePackagePath('../../../../somewhere/else/index.js', '@scope/plugin')).toBe(
      'somewhere/else/index.js'
    );
  });

  it('builds registries only for entries with resolvable source refs and resolves candidate modules', async () => {
    const workspaceManifest = { id: 'workspace-plugin', entryPoints: {} } as never;
    const nodeManifest = { id: 'node-plugin', entryPoints: {} } as never;
    const workspaceModule = { pluginWorkspace: { id: 'workspace-plugin' } };
    const nodeModule = { pluginNode: { id: 'node-plugin' } };

    const registries = createPluginBuildRegistries({
      workspaceManifestModules: {
        '../../../../packages/plugin-workspace/plugin.manifest.json': workspaceManifest,
        '../../../../invalid-workspace/plugin.manifest.json': nodeManifest,
      },
      workspacePluginModuleLoaders: {
        '../../../../packages/plugin-workspace/src/index.ts': async () => workspaceModule,
        '../../../../invalid-workspace/src/index.ts': async () => nodeModule,
      },
      nodeManifestModules: {
        '../../../../node_modules/@scope/plugin-node/plugin.manifest.json': nodeManifest,
        '../../../../invalid-node/plugin.manifest.json': workspaceManifest,
      },
      nodePluginModuleLoaders: {
        '../../../../node_modules/@scope/plugin-node/dist/index.js': async () => nodeModule,
        '../../../../invalid-node/dist/index.js': async () => workspaceModule,
      },
    });

    expect(registries.workspaceManifestRegistry.get('packages/plugin-workspace')).toBe(workspaceManifest);
    expect(registries.workspaceManifestRegistry.size).toBe(1);
    expect(typeof registries.workspacePluginRegistry.get('packages/plugin-workspace::src/index.ts')).toBe('function');
    expect(registries.workspacePluginRegistry.size).toBe(1);

    expect(registries.nodeManifestRegistry.get('@scope/plugin-node')).toBe(nodeManifest);
    expect(registries.nodeManifestRegistry.size).toBe(1);
    expect(typeof registries.nodePluginRegistry.get('@scope/plugin-node::dist/index.js')).toBe('function');
    expect(registries.nodePluginRegistry.size).toBe(1);

    expect(await
      resolvePluginModuleFromRegistry(registries.workspacePluginRegistry, 'packages/plugin-workspace', [
        'dist/index.js',
        'src/index.ts',
      ])
    ).toBe(workspaceModule);
    expect(await
      resolvePluginModuleFromRegistry(registries.nodePluginRegistry, '@scope/plugin-node', [
        'src/index.ts',
        'dist/index.js',
      ])
    ).toBe(nodeModule);
    expect(await
      resolvePluginModuleFromRegistry(registries.nodePluginRegistry, '@scope/plugin-node', ['src/missing.ts'])
    ).toBeUndefined();
  });
});
