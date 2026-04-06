import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  assertRequiredImagePlatform,
  formatImagePlatforms,
  parseImagePlatformsFromDockerManifestVerbose,
  supportsRequiredImagePlatform,
} from '../../../scripts/ops/runtime/image-platform.ts';

describe('image-platform', () => {
  it('parses a single-manifest docker inspect response with descriptor platform', () => {
    const raw = JSON.stringify({
      Ref: 'ghcr.io/example/app:stable',
      Descriptor: {
        digest: 'sha256:abc',
        mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
        platform: {
          architecture: 'amd64',
          os: 'linux',
        },
        size: 1234,
      },
    });

    expect(parseImagePlatformsFromDockerManifestVerbose(raw)).toEqual([
      {
        architecture: 'amd64',
        os: 'linux',
      },
    ]);
  });

  it('parses a manifest list response with multiple platforms', () => {
    const raw = JSON.stringify({
      manifests: [
        {
          digest: 'sha256:linux',
          platform: {
            architecture: 'amd64',
            os: 'linux',
          },
        },
        {
          digest: 'sha256:darwin',
          platform: {
            architecture: 'arm64',
            os: 'darwin',
          },
        },
      ],
    });

    const platforms = parseImagePlatformsFromDockerManifestVerbose(raw);

    expect(platforms).toEqual([
      {
        architecture: 'amd64',
        os: 'linux',
      },
      {
        architecture: 'arm64',
        os: 'darwin',
      },
    ]);
    expect(formatImagePlatforms(platforms)).toBe('linux/amd64, darwin/arm64');
  });

  it('rejects images without linux amd64 support', () => {
    const platforms = [
      {
        architecture: 'arm64',
        os: 'linux',
      },
    ] as const;

    expect(supportsRequiredImagePlatform(platforms)).toBe(false);
    expect(() => assertRequiredImagePlatform('ghcr.io/example/app:bad', platforms)).toThrow(/linux\/amd64/);
  });
});
