import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const validatorPath = fileURLToPath(new URL('./verify-studio-image-contract.mjs', import.meta.url));
const revision = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const regularPlugins = [
  'app-translations',
  'categories',
  'cockpit',
  'cockpit-cards',
  'events',
  'faq',
  'generic-items',
  'news',
  'poi',
  'projects',
  'surveys',
  'vouchers',
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
const workspacePluginIds = [
  'app-translations',
  'categories',
  'news',
  'events',
  'poi',
  'generic-items',
  'vouchers',
  'faq',
  'cockpit',
  'cockpit-cards',
  'projects',
  'surveys',
  'ssf',
  'waste-management',
];

const validInput = (
  distribution: 'studio' | 'ssf' | 'custom',
  customPluginIds = ['categories', 'news', 'ssf']
) => {
  const repository = `ghcr.io/smart-village-solutions/sva-studio${distribution === 'ssf' ? '-ssf' : ''}`;
  const imageRef = `${repository}@${digest}`;
  const selectedPluginIds =
    distribution === 'custom'
      ? workspacePluginIds.filter((id) => customPluginIds.includes(id))
      : distribution === 'studio'
        ? [...regularPlugins]
        : ['ssf'];
  const fingerprint =
    distribution === 'custom'
      ? createHash('sha256').update(JSON.stringify(selectedPluginIds)).digest('hex')
      : undefined;
  const excluded = workspacePluginIds
    .filter((id) => !selectedPluginIds.includes(id))
    .map((id) => `plugin-${id}`);
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
            'com.sva-studio.plugin-set-fingerprint': fingerprint ?? '',
          },
          Env: [`SVA_STUDIO_DISTRIBUTION=${distribution}`],
        },
      },
    ],
    runtimeManifest: {
      schemaVersion: 1,
      distribution,
      ...(fingerprint ? { pluginSetFingerprint: fingerprint } : {}),
      includedPluginIds: selectedPluginIds,
      installedPlugins: [] as { pluginId: string; sourceRef: string }[],
      excludedWorkspacePackages:
        distribution === 'custom' ? excluded : excludedWorkspacePackages[distribution],
    },
    expectedPluginIds: distribution === 'custom' ? selectedPluginIds : null,
    packages:
      distribution === 'custom'
        ? [
            'plugin-sdk',
            ...selectedPluginIds
              .filter((id) => id !== 'waste-management')
              .map((id) => `plugin-${id}`),
            'waste-management-contracts',
            'waste-management-runtime',
          ]
        : distribution === 'studio'
          ? [
              'plugin-sdk',
              ...regularPlugins
                .filter((id) => id !== 'waste-management')
                .map((id) => `plugin-${id}`),
              'waste-management-contracts',
              'waste-management-runtime',
            ]
          : ['plugin-sdk', 'plugin-ssf'],
    chunkProvenance: {
      schemaVersion: 1,
      distribution,
      ...(fingerprint ? { pluginSetFingerprint: fingerprint } : {}),
      chunks: [
        {
          path: 'public/assets/index.js',
          sha256: 'c'.repeat(64),
          pluginPackages:
            distribution === 'custom'
              ? selectedPluginIds.map((id) => `plugin-${id}`)
              : [distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news'],
        },
        {
          path: 'server/_ssr/router.mjs',
          sha256: 'd'.repeat(64),
          pluginPackages:
            distribution === 'custom'
              ? selectedPluginIds.map((id) => `plugin-${id}`)
              : [distribution === 'ssf' ? 'plugin-ssf' : 'plugin-news'],
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
  it.each(['studio', 'custom'] as const)(
    'verifies app translation chunks and requires their package in %s',
    (distribution) => {
      const input = validInput(distribution, ['app-translations']);
      for (const chunk of input.chunkProvenance.chunks)
        chunk.pluginPackages.push('plugin-app-translations');
      expect(JSON.parse(verify(input)).includedPluginIds).toContain('app-translations');
      input.packages = input.packages.filter((name) => name !== 'plugin-app-translations');
      expect(() => verify(input)).toThrow('plugin_package_inventory_mismatch:app-translations');
    }
  );

  it('rejects app translation code in the SSF image', () => {
    const input = validInput('ssf');
    input.chunkProvenance.chunks[0]!.pluginPackages.push('plugin-app-translations');
    expect(() => verify(input)).toThrow('chunk_provenance_excluded_plugin:plugin-app-translations');
  });

  it.each(['studio', 'custom'] as const)(
    'verifies voucher chunks and requires the voucher package in %s',
    (distribution) => {
      const input = validInput(distribution, ['poi', 'vouchers']);
      for (const chunk of input.chunkProvenance.chunks)
        chunk.pluginPackages.push('plugin-vouchers');
      expect(JSON.parse(verify(input)).includedPluginIds).toContain('vouchers');
      input.packages = input.packages.filter((name) => name !== 'plugin-vouchers');
      expect(() => verify(input)).toThrow('plugin_package_inventory_mismatch:vouchers');
    }
  );

  it('rejects voucher code in the SSF image', () => {
    const input = validInput('ssf');
    input.chunkProvenance.chunks[0]!.pluginPackages.push('plugin-vouchers');
    expect(() => verify(input)).toThrow('chunk_provenance_excluded_plugin:plugin-vouchers');
  });

  it('accepts an attested installed package and rejects an undeclared package in the chunks', () => {
    const input = validInput('studio');
    input.runtimeManifest.installedPlugins.push({
      pluginId: 'calendar',
      sourceRef: '@vendor/calendar',
    });
    input.runtimeManifest.includedPluginIds.push('calendar');
    const [clientChunk, serverChunk] = input.chunkProvenance.chunks;
    if (!clientChunk || !serverChunk) throw new Error('chunk_fixture_incomplete');
    clientChunk.pluginPackages.push('@vendor/calendar');
    expect(() => verify(input)).toThrow();
    serverChunk.pluginPackages.push('@vendor/calendar');
    expect(JSON.parse(verify(input)).includedPluginIds).toContain('calendar');
    clientChunk.pluginPackages.push('@vendor/hidden');
    expect(() => verify(input)).toThrow();
  });

  it.each(['@vendor/plugin.calendar', '@vendor/plugin_calendar'])(
    'accepts valid npm package names in the runtime image manifest: %s',
    (sourceRef) => {
      const input = validInput('studio');
      input.runtimeManifest.installedPlugins.push({ pluginId: 'calendar', sourceRef });
      input.runtimeManifest.includedPluginIds.push('calendar');
      for (const chunk of input.chunkProvenance.chunks) chunk.pluginPackages.push(sourceRef);
      expect(JSON.parse(verify(input)).includedPluginIds).toContain('calendar');
    }
  );

  it.each(['@vendor/..', '@vendor/Plugin'])(
    'rejects malformed package refs in the runtime manifest and chunk provenance: %s',
    (sourceRef) => {
      const manifestInput = validInput('studio');
      manifestInput.runtimeManifest.installedPlugins.push({ pluginId: 'calendar', sourceRef });
      manifestInput.runtimeManifest.includedPluginIds.push('calendar');
      expect(() => verify(manifestInput)).toThrow('runtime_manifest_mismatch');

      const chunkInput = validInput('studio');
      chunkInput.chunkProvenance.chunks[0]!.pluginPackages.push(sourceRef);
      expect(() => verify(chunkInput)).toThrow('chunk_provenance_manifest_invalid');
    }
  );

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

  it('accepts a custom digest only with its normalized set fingerprint and exact package inventory', () => {
    const input = validInput('custom');
    expect(JSON.parse(verify(input))).toMatchObject({
      distribution: 'custom',
      includedPluginIds: ['categories', 'news', 'ssf'],
      excludedWorkspacePackages: input.runtimeManifest.excludedWorkspacePackages,
    });
    input.inspection[0]!.Config.Labels['com.sva-studio.plugin-set-fingerprint'] = '0'.repeat(64);
    expect(() => verify(input)).toThrow();
  });

  it.each([
    [
      'manifest fingerprint',
      (input: ReturnType<typeof validInput>) => {
        input.runtimeManifest.pluginSetFingerprint = '0'.repeat(64);
      },
    ],
    [
      'provenance fingerprint',
      (input: ReturnType<typeof validInput>) => {
        input.chunkProvenance.pluginSetFingerprint = '0'.repeat(64);
      },
    ],
    [
      'unselected package',
      (input: ReturnType<typeof validInput>) => {
        input.packages.push('plugin-events');
      },
    ],
    [
      'unselected executable source',
      (input: ReturnType<typeof validInput>) => {
        input.chunkProvenance.chunks[0]!.pluginPackages.push('plugin-events');
      },
    ],
    [
      'missing selected package',
      (input: ReturnType<typeof validInput>) => {
        input.packages = input.packages.filter((name) => name !== 'plugin-categories');
      },
    ],
    [
      'missing selected server entry',
      (input: ReturnType<typeof validInput>) => {
        input.chunkProvenance.chunks[1]!.pluginPackages = ['plugin-news', 'plugin-ssf'];
      },
    ],
    [
      'noncanonical selection',
      (input: ReturnType<typeof validInput>) => {
        input.expectedPluginIds = ['ssf', 'news', 'categories'];
      },
    ],
    [
      'duplicate selection',
      (input: ReturnType<typeof validInput>) => {
        input.expectedPluginIds = ['news', 'news'];
      },
    ],
  ])('rejects a custom image with %s', (_reason, mutate) => {
    const input = validInput('custom');
    mutate(input);
    expect(() => verify(input)).toThrow();
  });

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
      'present waste contracts',
      (input: ReturnType<typeof validInput>) => {
        input.packages.push('waste-management-contracts');
      },
    ],
    [
      'present waste runtime',
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

  it('rejects a studio image without the Waste contracts package', () => {
    const input = validInput('studio');
    input.packages = input.packages.filter((name) => name !== 'waste-management-contracts');
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

  it.each(['waste-management-contracts', 'waste-management-runtime'] as const)(
    'accepts %s provenance in Studio and rejects it in SSF',
    (packageName) => {
      const studio = validInput('studio');
      studio.chunkProvenance.chunks[0]!.pluginPackages.push(packageName);
      expect(JSON.parse(verify(studio)).verifiedChunks.pluginPackages).toContain(packageName);

      const ssf = validInput('ssf');
      ssf.chunkProvenance.chunks[0]!.pluginPackages.push(packageName);
      expect(() => verify(ssf)).toThrow(`chunk_provenance_excluded_plugin:${packageName}`);
    }
  );
});
