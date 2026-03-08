import { describe, expect, it } from 'vitest';

import { findFilePlacementViolations, getTrackedFiles } from '../../../scripts/ci/check-file-placement.ts';

describe('check-file-placement', () => {
  it('returns tracked files from command output', () => {
    const files = getTrackedFiles({}, () => 'README.md\npackages/sdk/src/index.ts\n');

    expect(files).toEqual(['README.md', 'packages/sdk/src/index.ts']);
  });

  it('flags invalid root markdown and debug script placement', () => {
    const violations = findFilePlacementViolations([
      'ROADMAP.md',
      'debug_test.ts',
      'docs/pr/not-a-number/report.md',
    ]);

    expect(violations).toContain('ROADMAP.md: root-level markdown is not allowed');
    expect(violations).toContain('debug_test.ts: move to scripts/debug/(auth|otel)/');
    expect(violations).toContain(
      'docs/pr/not-a-number/report.md: invalid docs folder naming (expected docs/staging/YYYY-MM/... or docs/pr/<number>/...)'
    );
  });

  it('accepts valid docs placement and allowed root markdown', () => {
    const violations = findFilePlacementViolations([
      'README.md',
      'docs/staging/2026-03/report.md',
      'docs/pr/45/review.md',
    ]);

    expect(violations).toEqual([]);
  });
});
