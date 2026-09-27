import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const scriptPath = path.join(workspaceRoot, 'scripts/ci/studio-distribution-artifact.ts');
const temporaryDirectories: string[] = [];

const runArtifactCommand = (
  command: 'write-manifest' | 'write-chunk-provenance' | 'prune-deploy',
  target: string,
  distribution: string
) => {
  execFileSync(process.execPath, ['--import', 'tsx', scriptPath, command, target, distribution], {
    cwd: workspaceRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

describe('studio-distribution-artifact', () => {
  afterEach(() => {
    for (const directoryPath of temporaryDirectories.splice(0)) {
      rmSync(directoryPath, { recursive: true, force: true });
    }
  });

  const createChunkFixture = (distribution: 'studio' | 'ssf') => {
    const appRoot = mkdtempSync(path.join(os.tmpdir(), 'studio-chunk-provenance-'));
    temporaryDirectories.push(appRoot);
    const outputRoot = path.join(appRoot, '.output');
    const reportRoot = path.join(appRoot, '.generated', 'chunk-provenance');
    mkdirSync(path.join(outputRoot, 'public', 'assets'), { recursive: true });
    mkdirSync(path.join(outputRoot, 'server', '_ssr'), { recursive: true });
    mkdirSync(path.join(outputRoot, 'server', 'node_modules', 'tslib', 'modules'), {
      recursive: true,
    });
    mkdirSync(reportRoot, { recursive: true });
    for (const file of [
      'public/assets/index.js',
      'server/_ssr/router.mjs',
      'server/node_modules/tslib/tslib.js',
      'server/node_modules/tslib/tslib.es6.js',
      'server/node_modules/tslib/tslib.es6.mjs',
      'server/node_modules/tslib/modules/index.js',
    ])
      writeFileSync(path.join(outputRoot, file), `// ${file}`);
    const plugin = distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news';
    writeFileSync(
      path.join(reportRoot, 'client.json'),
      JSON.stringify([
        { fileName: 'assets/index.js', modules: [`/workspace/packages/${plugin}/src/client.ts`] },
      ])
    );
    writeFileSync(
      path.join(reportRoot, 'ssr.json'),
      JSON.stringify([
        { fileName: 'assets/router.js', modules: [`/workspace/packages/${plugin}/src/server.ts`] },
      ])
    );
    writeFileSync(
      path.join(reportRoot, 'nitro.json'),
      JSON.stringify([
        {
          fileName: '_ssr/router.mjs',
          modules: ['/workspace/app/node_modules/.nitro/vite/services/ssr/assets/router.js'],
        },
      ])
    );
    return { outputRoot, reportRoot };
  };

  it.each(['studio', 'ssf'] as const)(
    'attests all final %s chunks and maps SSR sources through Nitro',
    (distribution) => {
      const { outputRoot } = createChunkFixture(distribution);
      runArtifactCommand('write-chunk-provenance', outputRoot, distribution);
      const manifest = JSON.parse(
        readFileSync(
          path.join(outputRoot, 'server', 'generated', 'studio-chunk-provenance.json'),
          'utf8'
        )
      );
      expect(manifest).toMatchObject({ schemaVersion: 1, distribution });
      expect(manifest.chunks).toHaveLength(6);
      expect(
        manifest.chunks.find((chunk: { path: string }) => chunk.path === 'server/_ssr/router.mjs')
          .pluginPackages
      ).toEqual([distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news']);
    }
  );

  it('rejects an excluded source module and an unknown final JavaScript file', () => {
    const { outputRoot, reportRoot } = createChunkFixture('ssf');
    writeFileSync(
      path.join(reportRoot, 'client.json'),
      JSON.stringify([
        { fileName: 'assets/index.js', modules: ['/workspace/packages/plugin-news/src/page.ts'] },
      ])
    );
    expect(() => runArtifactCommand('write-chunk-provenance', outputRoot, 'ssf')).toThrow();
    writeFileSync(
      path.join(reportRoot, 'client.json'),
      JSON.stringify([
        { fileName: 'assets/index.js', modules: ['/workspace/packages/plugin-ssf/src/page.ts'] },
      ])
    );
    writeFileSync(path.join(outputRoot, 'server', 'unknown.mjs'), '// unknown');
    expect(() => runArtifactCommand('write-chunk-provenance', outputRoot, 'ssf')).toThrow();
  });

  it('rejects source maps from the final output', () => {
    const { outputRoot } = createChunkFixture('ssf');
    writeFileSync(path.join(outputRoot, 'public', 'assets', 'index.js.map'), '{}');
    expect(() => runArtifactCommand('write-chunk-provenance', outputRoot, 'ssf')).toThrow();
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
