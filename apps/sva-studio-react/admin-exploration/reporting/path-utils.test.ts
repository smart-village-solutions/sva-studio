import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { toPortableArtifactPath } from './path-utils.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');

describe('toPortableArtifactPath', () => {
  it('uses the repository root as the default base for absolute paths', () => {
    const artifactPath = resolve(repoRoot, 'docs/reports/admin-exploration/story-loop/report.md');

    expect(toPortableArtifactPath(artifactPath)).toBe('docs/reports/admin-exploration/story-loop/report.md');
  });

  it('keeps relative input paths unchanged', () => {
    expect(toPortableArtifactPath('docs/reports/local/report.md')).toBe('docs/reports/local/report.md');
  });

  it('returns dot when the given absolute path equals the base directory', () => {
    expect(toPortableArtifactPath(repoRoot)).toBe('.');
  });

  it('accepts an explicit cwd override for absolute paths', () => {
    const artifactPath = resolve(repoRoot, 'apps/sva-studio-react/admin-exploration/reporting/report.ts');

    expect(toPortableArtifactPath(artifactPath, resolve(repoRoot, 'apps/sva-studio-react'))).toBe(
      'admin-exploration/reporting/report.ts'
    );
  });
});
