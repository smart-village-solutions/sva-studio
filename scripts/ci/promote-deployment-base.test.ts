import { describe, expect, it } from 'vitest';

import { resolveEffectiveDeploymentBase } from './promote-deployment-base.ts';

const liveRevision = '9f9fae6279289f17f0508cca2c2e54617a7dad42';
const declaredBase = '3720948fc73b84ce056a65b914e40c686e1cb60b';
const head = 'fc67901ff8f2c27a7bdea7eb4fce68b60316dc46';

describe('promote deployment base', () => {
  it('uses the OCI revision of the actually deployed image instead of a newer push predecessor', () => {
    expect(
      resolveEffectiveDeploymentBase({
        declaredBase,
        environment: 'dev',
        head,
        liveImage: 'ghcr.io/smart-village-solutions/sva-studio@sha256:' + 'a'.repeat(64),
        inspection: {
          image: { config: { Labels: { 'org.opencontainers.image.revision': liveRevision } } },
        },
        isAncestor: () => true,
      })
    ).toEqual({
      declaredBase,
      effectiveBase: liveRevision,
      source: 'live-image',
    });
  });

  it('accepts the expected repository when Swarm preserves a tag before the digest', () => {
    expect(
      resolveEffectiveDeploymentBase({
        declaredBase,
        environment: 'staging',
        head,
        liveImage: 'ghcr.io/smart-village-solutions/sva-studio:main@sha256:' + 'e'.repeat(64),
        inspection: {
          image: { config: { Labels: { 'org.opencontainers.image.revision': liveRevision } } },
        },
        isAncestor: () => true,
      })
    ).toMatchObject({ effectiveBase: liveRevision, source: 'live-image' });
  });

  it('fails closed when the deployed image has no trustworthy revision', () => {
    expect(() =>
      resolveEffectiveDeploymentBase({
        declaredBase,
        environment: 'staging',
        head,
        liveImage: 'ghcr.io/smart-village-solutions/sva-studio@sha256:' + 'b'.repeat(64),
        inspection: {},
        isAncestor: () => true,
      })
    ).toThrow(/OCI-Revision/u);
  });

  it('rejects a live revision outside the promoted ancestry', () => {
    expect(() =>
      resolveEffectiveDeploymentBase({
        declaredBase,
        environment: 'prod',
        head,
        liveImage: 'ghcr.io/smart-village-solutions/sva-studio@sha256:' + 'c'.repeat(64),
        inspection: {
          image: { config: { Labels: { 'org.opencontainers.image.revision': liveRevision } } },
        },
        isAncestor: () => false,
      })
    ).toThrow(/Ancestor/u);
  });

  it('rejects a foreign live repository even when its label looks valid', () => {
    expect(() =>
      resolveEffectiveDeploymentBase({
        declaredBase,
        environment: 'prod',
        head,
        liveImage: 'ghcr.io/foreign/studio@sha256:' + 'd'.repeat(64),
        inspection: {
          image: { config: { Labels: { 'org.opencontainers.image.revision': liveRevision } } },
        },
        isAncestor: () => true,
      })
    ).toThrow(/Repository/u);
  });
});
