import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/studio-image-build.yml'), 'utf8');

describe('Studio image build workflow contract', () => {
  it('publishes full commit tags and attests the image revision', () => {
    expect(workflow).toContain('image_tag="$(git rev-parse HEAD)"');
    expect(workflow).toContain('BUILD_REVISION: ${{ github.sha }}');
    expect(workflow).toContain('--build-arg "SVA_IMAGE_REVISION=${BUILD_REVISION}"');
  });
});
