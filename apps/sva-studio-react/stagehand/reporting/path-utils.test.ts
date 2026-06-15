import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { toPortableArtifactPath } from './path-utils.ts';

describe('toPortableArtifactPath', () => {
  it('uses the repository root as the default base for absolute paths', () => {
    const artifactPath = resolve(process.cwd(), 'docs/reports/stagehand-admin-exploration/story-loop/report.md');

    expect(toPortableArtifactPath(artifactPath)).toBe('docs/reports/stagehand-admin-exploration/story-loop/report.md');
  });

  it('keeps relative input paths unchanged', () => {
    expect(toPortableArtifactPath('docs/reports/local/report.md')).toBe('docs/reports/local/report.md');
  });
});
