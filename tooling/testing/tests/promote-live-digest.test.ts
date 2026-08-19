import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries -- contract test for the repository-level CI script
import {
  matchesExpectedLiveImage,
  parseLiveDigestEnvironment,
  readLiveConfigRevision,
} from '../../../scripts/ci/promote-live-digest.ts';

describe('matchesExpectedLiveImage', () => {
  const digest = 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const tag = 'ghcr.io/smart-village-solutions/sva-studio:5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de';

  it('accepts a live tag reference resolved to an immutable digest', () => {
    expect(matchesExpectedLiveImage(tag, `${tag}@${digest}`)).toBe(true);
  });

  it('rejects a live image from another target tag', () => {
    expect(
      matchesExpectedLiveImage(tag, `ghcr.io/smart-village-solutions/sva-studio:other@${digest}`)
    ).toBe(false);
  });

  it.each(['dev', 'staging', 'prod'] as const)(
    'accepts the %s promotion environment',
    (environment) => {
      expect(parseLiveDigestEnvironment(environment)).toBe(environment);
    }
  );

  it('rejects environments outside the Studio promotion contract', () => {
    expect(() => parseLiveDigestEnvironment('preview')).toThrow(
      'Der Live-Digest-Nachweis ist nur für dev, staging oder prod zulässig.'
    );
  });

  it('reads the config revision bound to the inspected live service', () => {
    const revision = 'a'.repeat(64);
    expect(readLiveConfigRevision({ 'sva.config.revision': revision })).toBe(revision);
  });

  it.each([
    undefined,
    {},
    { 'sva.config.revision': 'not-a-revision' },
    { 'sva.config.revision': 'person@example.test https://internal.example.test' },
  ])('does not invent or expose an invalid live config revision', (labels) => {
    expect(readLiveConfigRevision(labels)).toBeNull();
  });

  it('keeps CLI stderr static when live-contract resolution fails', () => {
    const script = resolve(import.meta.dirname, '../../../scripts/ci/promote-live-digest.ts');
    const sentinel = 'person@example.test https://internal.example.test\nsecret=value';
    const result = spawnSync(
      process.execPath,
      ['--no-warnings', '--experimental-strip-types', script, 'preview'],
      {
        encoding: 'utf8',
        env: { ...process.env, QUANTUM_ENDPOINT: sentinel },
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('PROMOTE_INTERNAL_ERROR\n');
    expect(result.stderr).not.toContain(sentinel);
  });
});
