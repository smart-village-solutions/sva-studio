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
      deploySummaryImmutability: 'dev-latest-allowed',
      deploySummaryRollbackHint:
        'Rollback nicht über latest, sondern über vorherigen SHA-Tag oder Digest ausführen.',
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
      deploySummaryImmutability: 'commit-sha-tag',
      deploySummaryRollbackHint:
        'Rollback über den vorherigen Commit-SHA-Tag oder einen bekannten Digest ausführen, nicht über latest.',
      deploySummaryTag: '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
      imageRef:
        'ghcr.io/smart-village-solutions/sva-studio:5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de',
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

  it('accepts an already-qualified commit sha tag in staging', () => {
    const tag = '5bdcfd1be7d7a72ba94c23ce16834bc1ebecc5de';
    const result = resolvePromoteImageContract({
      environment: 'staging',
      imageInput: `ghcr.io/smart-village-solutions/sva-studio:${tag}`,
    });

    expect(result).toMatchObject({
      deployRevision: tag,
      deploySummaryTag: tag,
      imageRef: `ghcr.io/smart-village-solutions/sva-studio:${tag}`,
      imageType: 'tag',
    });
  });

  it('accepts an already-qualified tag in dev without duplicating the repository', () => {
    const result = resolvePromoteImageContract({
      environment: 'dev',
      imageInput: 'ghcr.io/smart-village-solutions/sva-studio:preview',
    });

    expect(result).toMatchObject({
      deployRevision: 'preview',
      deploySummaryImmutability: 'mutable-dev-tag',
      deploySummaryRollbackHint:
        'Rollback über einen vorherigen Commit-SHA-Tag oder bekannten Digest ausführen; der Dev-Tag ist veränderlich.',
      deploySummaryTag: 'preview',
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio:preview',
    });
  });

  it('rejects a qualified tag from a different repository', () => {
    expect(() =>
      resolvePromoteImageContract({
        environment: 'dev',
        imageInput: 'ghcrXio/smart-village-solutions/sva-studio:preview',
      })
    ).toThrow(/Ungültige Image-Tag-Referenz/u);
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
      deploySummaryImmutability: 'digest',
      deploySummaryRollbackHint: 'Rollback über den vorherigen freigegebenen Digest ausführen.',
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
      deploySummaryImmutability: 'digest',
      deploySummaryRollbackHint: 'Rollback über den vorherigen freigegebenen Digest ausführen.',
      deploySummaryTag: 'none',
      imageRef: `ghcr.io/smart-village-solutions/sva-studio@${digest}`,
      imageType: 'digest',
    });
  });
});
