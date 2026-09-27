import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const scriptPath = path.join(workspaceRoot, 'scripts/ci/studio-distribution-artifact.ts');
const temporaryDirectories: string[] = [];

const runArtifactCommand = (
  command: 'write-manifest' | 'prune-deploy',
  target: string,
  distribution: string
) => {
  execFileSync(process.execPath, ['--import', 'tsx', scriptPath, command, target, distribution], {
    cwd: workspaceRoot,
  });
};

describe('studio-distribution-artifact', () => {
  afterEach(() => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      rmSync(directoryPath, { recursive: true, force: true });
    }
  });

  it('writes the attested manifest and removes SSF from a studio deploy tree', () => {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'studio-distribution-artifact-'));
    temporaryDirectories.push(temporaryDirectory);

    const deployRoot = path.join(temporaryDirectory, 'deploy');
    const outputRoot = path.join(temporaryDirectory, 'output');
    for (const packageRoot of [
      path.join(deployRoot, 'node_modules', '@sva', 'plugin-ssf'),
      path.join(deployRoot, 'node_modules', '@sva', 'plugin-news'),
      path.join(
        deployRoot,
        'node_modules',
        '.pnpm',
        '@sva+plugin-ssf@1.0.0',
        'node_modules',
        '@sva',
        'plugin-ssf'
      ),
      path.join(
        deployRoot,
        'node_modules',
        '.pnpm',
        '@sva+plugin-news@1.0.0',
        'node_modules',
        '@sva',
        'plugin-news'
      ),
    ]) {
      mkdirSync(packageRoot, { recursive: true });
    }
    mkdirSync(outputRoot, { recursive: true });

    runArtifactCommand('prune-deploy', deployRoot, 'studio');
    runArtifactCommand('write-manifest', outputRoot, 'studio');

    expect(existsSync(path.join(deployRoot, 'node_modules', '@sva', 'plugin-ssf'))).toBe(false);
    expect(
      existsSync(
        path.join(
          deployRoot,
          'node_modules',
          '.pnpm',
          '@sva+plugin-ssf@1.0.0',
          'node_modules',
          '@sva',
          'plugin-ssf'
        )
      )
    ).toBe(false);
    expect(existsSync(path.join(deployRoot, 'node_modules', '@sva', 'plugin-news'))).toBe(true);
    expect(
      JSON.parse(
        readFileSync(
          path.join(outputRoot, 'server', 'generated', 'studio-distribution.json'),
          'utf8'
        )
      )
    ).toEqual({
      schemaVersion: 1,
      distribution: 'studio',
      includedPluginIds: [
        'categories',
        'cockpit-cards',
        'events',
        'faq',
        'generic-items',
        'news',
        'poi',
        'projects',
        'surveys',
        'waste-management',
      ],
      excludedWorkspacePackages: ['plugin-ssf'],
    });
  });

  it('writes the SSF exclusion contract and removes regular plugin packages', () => {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'studio-distribution-artifact-'));
    temporaryDirectories.push(temporaryDirectory);
    const deployRoot = path.join(temporaryDirectory, 'deploy');
    const outputRoot = path.join(temporaryDirectory, 'output');
    for (const packageName of ['plugin-ssf', 'plugin-news', 'waste-management-runtime']) {
      mkdirSync(path.join(deployRoot, 'node_modules', '@sva', packageName), { recursive: true });
      mkdirSync(
        path.join(
          deployRoot,
          'node_modules',
          '.pnpm',
          `${packageName}@1.0.0`,
          'node_modules',
          '@sva',
          packageName
        ),
        { recursive: true }
      );
    }
    mkdirSync(outputRoot, { recursive: true });

    runArtifactCommand('prune-deploy', deployRoot, 'ssf');
    runArtifactCommand('write-manifest', outputRoot, 'ssf');

    expect(existsSync(path.join(deployRoot, 'node_modules', '@sva', 'plugin-ssf'))).toBe(true);
    for (const packageName of ['plugin-news', 'waste-management-runtime']) {
      expect(existsSync(path.join(deployRoot, 'node_modules', '@sva', packageName))).toBe(false);
      expect(
        existsSync(
          path.join(
            deployRoot,
            'node_modules',
            '.pnpm',
            `${packageName}@1.0.0`,
            'node_modules',
            '@sva',
            packageName
          )
        )
      ).toBe(false);
    }
    expect(
      JSON.parse(
        readFileSync(
          path.join(outputRoot, 'server', 'generated', 'studio-distribution.json'),
          'utf8'
        )
      )
    ).toEqual({
      schemaVersion: 1,
      distribution: 'ssf',
      includedPluginIds: ['ssf'],
      excludedWorkspacePackages: [
        'plugin-categories',
        'plugin-cockpit-cards',
        'plugin-events',
        'plugin-faq',
        'plugin-generic-items',
        'plugin-news',
        'plugin-poi',
        'plugin-projects',
        'plugin-surveys',
        'plugin-waste-management',
        'waste-management-contracts',
        'waste-management-runtime',
      ],
    });
  });
});
