import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const validatorPath = fileURLToPath(new URL('./verify-studio-image-contract.mjs', import.meta.url));
const revision = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const regularPlugins = [
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
];
const excludedWorkspacePackages = {
  studio: ['plugin-ssf'],
  ssf: [
    ...regularPlugins.map((id) => `plugin-${id}`),
    'waste-management-contracts',
    'waste-management-runtime',
  ],
};

const validInput = (distribution: 'studio' | 'ssf') => {
  const repository = `ghcr.io/smart-village-solutions/sva-studio${distribution === 'ssf' ? '-ssf' : ''}`;
  const imageRef = `${repository}@${digest}`;
  const includedPluginIds = distribution === 'studio' ? regularPlugins : ['ssf'];
  return {
    imageRef,
    expectedRevision: revision,
    distribution,
    inspection: [
      {
        RepoDigests: [imageRef],
        Config: {
          Labels: {
            'org.opencontainers.image.source':
              'https://github.com/smart-village-solutions/sva-studio',
            'org.opencontainers.image.revision': revision,
            'com.sva-studio.distribution': distribution,
          },
          Env: [`SVA_STUDIO_DISTRIBUTION=${distribution}`],
        },
      },
    ],
    runtimeManifest: {
      schemaVersion: 1,
      distribution,
      includedPluginIds,
      excludedWorkspacePackages: excludedWorkspacePackages[distribution],
    },
    packages:
      distribution === 'studio'
        ? [
            'plugin-sdk',
            ...regularPlugins.filter((id) => id !== 'waste-management').map((id) => `plugin-${id}`),
            'waste-management-contracts',
            'waste-management-runtime',
          ]
        : ['plugin-sdk', 'plugin-ssf'],
    chunkProvenance: {
      schemaVersion: 1,
      distribution,
      chunks: [
        {
          path: 'public/assets/index.js',
          sha256: 'c'.repeat(64),
          pluginPackages: [distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news'],
        },
        {
          path: 'server/_ssr/router.mjs',
          sha256: 'd'.repeat(64),
          pluginPackages: [distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news'],
        },
      ],
    },
    chunkFiles: [
      { path: 'public/assets/index.js', sha256: 'c'.repeat(64) },
      { path: 'server/_ssr/router.mjs', sha256: 'd'.repeat(64) },
    ],
  };
};

const verify = (input: ReturnType<typeof validInput>) =>
  execFileSync(process.execPath, [validatorPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

describe('verify-studio-image-contract', () => {
  it.each(['studio', 'ssf'] as const)(
    'accepts the exact %s digest and inventory',
    (distribution) => {
      expect(JSON.parse(verify(validInput(distribution)))).toMatchObject({
        distribution,
        revision,
        includedPluginIds: distribution === 'ssf' ? ['ssf'] : regularPlugins,
        presentWorkspacePackages: [...validInput(distribution).packages].sort(),
        verifiedChunks: { chunks: 2 },
      });
    }
  );

  it.each([
    [
      'repository',
      (input: ReturnType<typeof validInput>) => {
        input.imageRef = input.imageRef.replace('sva-studio-ssf', 'sva-studio');
        input.inspection[0]!.RepoDigests = [input.imageRef];
      },
    ],
    [
      'lookalike repository',
      (input: ReturnType<typeof validInput>) => {
        input.imageRef = input.imageRef.replace('ghcr.io', 'ghcrXio');
        input.inspection[0]!.RepoDigests = [input.imageRef];
      },
    ],
    [
      'digest',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.RepoDigests = [];
      },
    ],
    [
      'revision',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.Config.Labels['org.opencontainers.image.revision'] = 'c'.repeat(40);
      },
    ],
    [
      'source',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.Config.Labels['org.opencontainers.image.source'] =
          'https://example.invalid/repo';
      },
    ],
    [
      'label',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.Config.Labels['com.sva-studio.distribution'] = 'studio';
      },
    ],
    [
      'runtime env',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.Config.Env = ['SVA_STUDIO_DISTRIBUTION=studio'];
      },
    ],
    [
      'conflicting runtime env',
      (input: ReturnType<typeof validInput>) => {
        input.inspection[0]!.Config.Env.push('SVA_STUDIO_DISTRIBUTION=studio');
      },
    ],
    [
      'manifest distribution',
      (input: ReturnType<typeof validInput>) => {
        input.runtimeManifest.distribution = 'studio';
      },
    ],
    [
      'manifest plugins',
      (input: ReturnType<typeof validInput>) => {
        input.runtimeManifest.includedPluginIds = ['news'];
      },
    ],
    [
      'manifest exclusions',
      (input: ReturnType<typeof validInput>) => {
        input.runtimeManifest.excludedWorkspacePackages = [];
      },
    ],
    [
      'excluded plugin',
      (input: ReturnType<typeof validInput>) => {
        input.packages.push('plugin-news');
      },
    ],
    [
      'unknown plugin',
      (input: ReturnType<typeof validInput>) => {
        input.packages.push('plugin-unknown');
      },
    ],
    [
      'missing ssf plugin',
      (input: ReturnType<typeof validInput>) => {
        input.packages = ['plugin-sdk'];
      },
    ],
    [
      'excluded runtime',
      (input: ReturnType<typeof validInput>) => {
        input.packages.push('waste-management-runtime');
      },
    ],
  ])('rejects %s mismatch', (_reason, mutate) => {
    const input = validInput('ssf');
    mutate(input);
    expect(() => verify(input)).toThrow();
  });

  it('rejects an unpinned image ref', () => {
    const input = validInput('studio');
    input.imageRef = 'ghcr.io/smart-village-solutions/sva-studio:latest';
    expect(() => verify(input)).toThrow();
  });

  it('rejects a studio image without the host-owned Waste runtime package', () => {
    const input = validInput('studio');
    input.packages = input.packages.filter((name) => name !== 'waste-management-runtime');
    expect(() => verify(input)).toThrow();
  });

  it('rejects changed final bytes, an unknown final chunk and a tampered provenance manifest', () => {
    const changedBytes = validInput('ssf');
    changedBytes.chunkFiles[0]!.sha256 = 'e'.repeat(64);
    expect(() => verify(changedBytes)).toThrow();

    const unknownFile = validInput('ssf');
    unknownFile.chunkFiles.push({ path: 'server/unknown.mjs', sha256: 'e'.repeat(64) });
    expect(() => verify(unknownFile)).toThrow();

    const tamperedManifest = validInput('ssf');
    tamperedManifest.chunkProvenance.chunks[0]!.sha256 = 'e'.repeat(64);
    expect(() => verify(tamperedManifest)).toThrow();

    const wrongDistribution = validInput('ssf');
    wrongDistribution.chunkProvenance.distribution = 'studio';
    expect(() => verify(wrongDistribution)).toThrow();
  });

  it('rejects excluded plugin provenance despite otherwise valid chunk hashes', () => {
    const input = validInput('ssf');
    input.chunkProvenance.chunks[0]!.pluginPackages.push('plugin-news');
    expect(() => verify(input)).toThrow();
  });
});
