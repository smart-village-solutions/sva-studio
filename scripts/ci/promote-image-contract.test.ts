import { describe, expect, it } from 'vitest';

import {
  resolvePromoteImageContract,
  validatePromoteImageContract,
} from './promote-image-contract.ts';

describe('promote-image-contract', () => {
  it('allows latest in dev and resolves a tag-based image ref', () => {
    const result = resolvePromoteImageContract({
      environment: 'dev',
      imageInput: 'latest',
    });

    expect(result).toMatchObject({
      deployRevision: 'latest',
      deploySummaryDigest: 'not-pinned',
      deploySummaryTag: 'latest',
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio:latest',
      imageType: 'tag',
    });
  });

  it('blocks latest in staging', () => {
    expect(() =>
      validatePromoteImageContract({
        environment: 'staging',
        imageInput: 'latest',
      })
    ).toThrow(/latest.*staging/u);
  });

  it('allows a commit sha tag in staging', () => {
    const result = resolvePromoteImageContract({
      environment: 'staging',
      imageInput: '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
    });

    expect(result).toMatchObject({
      deployRevision: '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
      deploySummaryDigest: 'not-pinned',
      deploySummaryTag: '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio:5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
      imageType: 'tag',
    });
  });

  it('blocks a non-immutable tag in staging', () => {
    expect(() =>
      validatePromoteImageContract({
        environment: 'staging',
        imageInput: 'release-candidate',
      })
    ).toThrow(/Commit-SHA-Tag oder Digest/u);
  });

  it('blocks a commit sha tag in prod because prod requires a digest', () => {
    expect(() =>
      validatePromoteImageContract({
        environment: 'prod',
        imageInput: '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
      })
    ).toThrow(/Digest/u);
  });

  it('allows a digest in prod and resolves an immutable image ref', () => {
    const digest = 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    const result = resolvePromoteImageContract({
      environment: 'prod',
      imageInput: digest,
    });

    expect(result).toMatchObject({
      deployRevision: digest,
      deploySummaryDigest: digest,
      deploySummaryTag: 'none',
      imageRef: `ghcr.io/smart-village-solutions/sva-studio@${digest}`,
      imageType: 'digest',
    });
  });

  it('accepts an already-qualified ghcr digest ref and normalizes summary fields', () => {
    const digest = 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    const result = resolvePromoteImageContract({
      environment: 'prod',
      imageInput: `ghcr.io/smart-village-solutions/sva-studio@${digest}`,
    });

    expect(result).toMatchObject({
      deployRevision: digest,
      deploySummaryDigest: digest,
      deploySummaryTag: 'none',
      imageRef: `ghcr.io/smart-village-solutions/sva-studio@${digest}`,
      imageType: 'digest',
    });
  });
});
