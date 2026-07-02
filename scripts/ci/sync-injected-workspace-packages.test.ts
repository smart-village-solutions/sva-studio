import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { collectWorkspacePackages, findReachableWorkspacePackageNames } from './sync-injected-workspace-packages.js';

const tempDirs: string[] = [];

const writePackageJson = (packageDir: string, name: string) => {
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name, type: 'module' }), 'utf8');
};

describe('sync-injected-workspace-packages', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('limits reachable workspace packages to the consumer dependency graph', async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'sync-injected-workspace-packages-'));
    tempDirs.push(tempRoot);

    const appDir = path.join(tempRoot, 'apps', 'demo-app');
    const reachableSourceDir = path.join(tempRoot, 'packages', 'reachable-lib');
    const transitiveSourceDir = path.join(tempRoot, 'packages', 'transitive-lib');
    const unrelatedSourceDir = path.join(tempRoot, 'packages', 'unrelated-lib');
    const virtualStoreDir = path.join(tempRoot, 'node_modules', '.pnpm');
    const reachableInjectedDir = path.join(
      virtualStoreDir,
      '@sva+reachable-lib@file+packages+reachable-lib',
      'node_modules',
      '@sva',
      'reachable-lib'
    );
    const transitiveInjectedDir = path.join(
      virtualStoreDir,
      '@sva+transitive-lib@file+packages+transitive-lib',
      'node_modules',
      '@sva',
      'transitive-lib'
    );
    const unrelatedInjectedDir = path.join(
      virtualStoreDir,
      '@sva+unrelated-lib@file+packages+unrelated-lib',
      'node_modules',
      '@sva',
      'unrelated-lib'
    );

    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - packages/*\n', 'utf8');
    writePackageJson(appDir, 'demo-app');
    writePackageJson(reachableSourceDir, '@sva/reachable-lib');
    writePackageJson(transitiveSourceDir, '@sva/transitive-lib');
    writePackageJson(unrelatedSourceDir, '@sva/unrelated-lib');
    writePackageJson(reachableInjectedDir, '@sva/reachable-lib');
    writePackageJson(transitiveInjectedDir, '@sva/transitive-lib');
    writePackageJson(unrelatedInjectedDir, '@sva/unrelated-lib');

    mkdirSync(path.join(appDir, 'node_modules', '@sva'), { recursive: true });
    mkdirSync(path.join(reachableInjectedDir, 'node_modules', '@sva'), { recursive: true });
    symlinkSync(reachableInjectedDir, path.join(appDir, 'node_modules', '@sva', 'reachable-lib'), 'dir');
    symlinkSync(transitiveInjectedDir, path.join(reachableInjectedDir, 'node_modules', '@sva', 'transitive-lib'), 'dir');

    const workspacePackages = await collectWorkspacePackages(tempRoot);
    const reachableWorkspacePackageNames = await findReachableWorkspacePackageNames(appDir, workspacePackages);

    expect([...reachableWorkspacePackageNames].sort()).toEqual(['@sva/reachable-lib', '@sva/transitive-lib']);
    expect(reachableWorkspacePackageNames.has('@sva/unrelated-lib')).toBe(false);
  });

  it('keeps traversing injected transitive workspace dependencies when the consumer links to the workspace source package', async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'sync-injected-workspace-packages-'));
    tempDirs.push(tempRoot);

    const appDir = path.join(tempRoot, 'apps', 'demo-app');
    const directSourceDir = path.join(tempRoot, 'packages', 'direct-lib');
    const transitiveSourceDir = path.join(tempRoot, 'packages', 'transitive-lib');
    const virtualStoreDir = path.join(tempRoot, 'node_modules', '.pnpm');
    const directInjectedDir = path.join(
      virtualStoreDir,
      '@sva+direct-lib@file+packages+direct-lib',
      'node_modules',
      '@sva',
      'direct-lib'
    );
    const directInjectedNodeModulesDir = path.join(
      virtualStoreDir,
      '@sva+direct-lib@file+packages+direct-lib',
      'node_modules'
    );
    const transitiveInjectedDir = path.join(
      virtualStoreDir,
      '@sva+transitive-lib@file+packages+transitive-lib',
      'node_modules',
      '@sva',
      'transitive-lib'
    );

    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - packages/*\n', 'utf8');
    writePackageJson(appDir, 'demo-app');
    writePackageJson(directSourceDir, '@sva/direct-lib');
    writePackageJson(transitiveSourceDir, '@sva/transitive-lib');
    writePackageJson(directInjectedDir, '@sva/direct-lib');
    writePackageJson(transitiveInjectedDir, '@sva/transitive-lib');

    mkdirSync(path.join(appDir, 'node_modules', '@sva'), { recursive: true });
    mkdirSync(path.join(directInjectedNodeModulesDir, '@sva'), { recursive: true });
    symlinkSync(directSourceDir, path.join(appDir, 'node_modules', '@sva', 'direct-lib'), 'dir');
    symlinkSync(transitiveInjectedDir, path.join(directInjectedNodeModulesDir, '@sva', 'transitive-lib'), 'dir');

    const workspacePackages = await collectWorkspacePackages(tempRoot);
    const reachableWorkspacePackageNames = await findReachableWorkspacePackageNames(appDir, workspacePackages);

    expect([...reachableWorkspacePackageNames].sort()).toEqual(['@sva/direct-lib', '@sva/transitive-lib']);
  });

  it('ignores malformed package metadata and does not recurse into external dependencies', async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'sync-injected-workspace-packages-'));
    tempDirs.push(tempRoot);

    const appDir = path.join(tempRoot, 'apps', 'demo-app');
    const directSourceDir = path.join(tempRoot, 'packages', 'direct-lib');
    const transitiveSourceDir = path.join(tempRoot, 'packages', 'transitive-lib');
    const virtualStoreDir = path.join(tempRoot, 'node_modules', '.pnpm');
    const externalDir = path.join(virtualStoreDir, 'external-lib@1.0.0', 'node_modules', 'external-lib');
    const malformedDir = path.join(virtualStoreDir, 'broken-lib@1.0.0', 'node_modules', 'broken-lib');
    const transitiveInjectedDir = path.join(
      virtualStoreDir,
      '@sva+transitive-lib@file+packages+transitive-lib',
      'node_modules',
      '@sva',
      'transitive-lib'
    );

    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - packages/*\n', 'utf8');
    writePackageJson(appDir, 'demo-app');
    writePackageJson(directSourceDir, '@sva/direct-lib');
    writePackageJson(transitiveSourceDir, '@sva/transitive-lib');
    writeFileSync(
      path.join(directSourceDir, 'package.json'),
      JSON.stringify({ name: '@sva/direct-lib', type: 'module' }),
      'utf8'
    );
    writePackageJson(transitiveInjectedDir, '@sva/transitive-lib');
    writePackageJson(externalDir, 'external-lib');
    mkdirSync(path.join(malformedDir), { recursive: true });
    writeFileSync(path.join(malformedDir, 'package.json'), '{"name":', 'utf8');

    mkdirSync(path.join(appDir, 'node_modules', '@sva'), { recursive: true });
    mkdirSync(path.join(directSourceDir, 'node_modules'), { recursive: true });
    mkdirSync(path.join(externalDir, 'node_modules', '@sva'), { recursive: true });
    symlinkSync(directSourceDir, path.join(appDir, 'node_modules', '@sva', 'direct-lib'), 'dir');
    symlinkSync(externalDir, path.join(directSourceDir, 'node_modules', 'external-lib'), 'dir');
    symlinkSync(malformedDir, path.join(directSourceDir, 'node_modules', 'broken-lib'), 'dir');
    symlinkSync(
      transitiveInjectedDir,
      path.join(externalDir, 'node_modules', '@sva', 'transitive-lib'),
      'dir'
    );

    const workspacePackages = await collectWorkspacePackages(tempRoot);
    const reachableWorkspacePackageNames = await findReachableWorkspacePackageNames(appDir, workspacePackages);

    expect([...reachableWorkspacePackageNames]).toEqual(['@sva/direct-lib']);
  });
});
