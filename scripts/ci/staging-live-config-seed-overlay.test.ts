import { describe, expect, it } from 'vitest';

import { PromoteContractError } from './promote-result.ts';
import { verifyStagingLiveConfigSeedOverlay } from './staging-live-config-seed-overlay.ts';

const revision = 'a'.repeat(64);
const baseStack = {
  name: 'studio-staging',
  services: {
    app: {
      image: `registry.example/studio@sha256:${'b'.repeat(64)}`,
      deploy: { labels: { 'traefik.enable': 'true' }, replicas: 1 },
      environment: { NODE_ENV: 'production' },
    },
    redis: { image: 'redis:8' },
  },
};

const seededStack = () => ({
  ...structuredClone(baseStack),
  services: {
    ...structuredClone(baseStack.services),
    app: {
      ...structuredClone(baseStack.services.app),
      deploy: {
        ...structuredClone(baseStack.services.app.deploy),
        labels: {
          ...baseStack.services.app.deploy.labels,
          'sva.config.revision': revision,
        },
      },
    },
  },
});

const failureCode = (operation: () => unknown): string => {
  try {
    operation();
    return 'none';
  } catch (error) {
    expect(error).toBeInstanceOf(PromoteContractError);
    return (error as PromoteContractError).failure.code;
  }
};

describe('staging live config seed overlay', () => {
  it('accepts exactly one added app deploy label', () => {
    expect(verifyStagingLiveConfigSeedOverlay(baseStack, seededStack(), revision)).toEqual({
      label: 'sva.config.revision',
      revision,
    });
  });

  it.each([
    [
      'an already present base label',
      { ...baseStack, services: { ...baseStack.services, app: seededStack().services.app } },
      seededStack(),
    ],
    [
      'a wrong revision',
      baseStack,
      {
        ...seededStack(),
        services: {
          ...seededStack().services,
          app: {
            ...seededStack().services.app,
            deploy: {
              ...seededStack().services.app.deploy,
              labels: {
                ...seededStack().services.app.deploy.labels,
                'sva.config.revision': 'c'.repeat(64),
              },
            },
          },
        },
      },
    ],
    [
      'an image change',
      baseStack,
      {
        ...seededStack(),
        services: {
          ...seededStack().services,
          app: { ...seededStack().services.app, image: 'registry.example/other:latest' },
        },
      },
    ],
    [
      'a replica change',
      baseStack,
      {
        ...seededStack(),
        services: {
          ...seededStack().services,
          app: {
            ...seededStack().services.app,
            deploy: { ...seededStack().services.app.deploy, replicas: 2 },
          },
        },
      },
    ],
  ])('rejects %s', (_, base, seeded) => {
    expect(failureCode(() => verifyStagingLiveConfigSeedOverlay(base, seeded, revision))).toBe(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
  });

  it.each([null, {}, { services: {} }, { services: { app: {} } }])(
    'rejects malformed stack input %#',
    (stack) => {
      expect(failureCode(() => verifyStagingLiveConfigSeedOverlay(stack, stack, revision))).toBe(
        'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
      );
    }
  );

  it('keeps rejected CLI input redacted', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'seed-overlay-test-'));
    const base = resolve(directory, 'base.json');
    const seeded = resolve(directory, 'seeded.json');
    writeFileSync(base, JSON.stringify(baseStack));
    writeFileSync(
      seeded,
      JSON.stringify({ ...seededStack(), sentinel: 'person@example.test\nhttps://internal.test' })
    );
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        resolve(import.meta.dirname, 'staging-live-config-seed-overlay.ts'),
        '--base',
        base,
        '--seeded',
        seeded,
        '--revision',
        revision,
      ],
      { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED\n');
    expect(result.stderr).not.toContain('person@example.test');
    expect(result.stderr).not.toContain('internal.test');
  });

  it('maps unexpected CLI failures to the static internal contract', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        resolve(import.meta.dirname, 'staging-live-config-seed-overlay.ts'),
        '--base',
        '/definitely/missing/person@example.test.json',
        '--seeded',
        '/also/missing/internal.test.json',
        '--revision',
        revision,
      ],
      { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('PROMOTE_INTERNAL_ERROR\n');
    expect(result.stderr).not.toContain('person@example.test');
    expect(result.stderr).not.toContain('internal.test');
  });
});
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
