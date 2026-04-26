import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  findFilePlacementViolations,
  findGeneratedSourceArtifacts,
  getTrackedFiles,
  isGeneratedSourceArtifact,
} from '../../../scripts/ci/check-file-placement.ts';
import { deleteGeneratedSourceArtifacts } from '../../../scripts/ci/clean-source-artifacts.ts';

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
      'CLAUDE.md',
      'docs/staging/2026-03/report.md',
      'docs/pr/45/review.md',
    ]);

    expect(violations).toEqual([]);
  });

  it('recognizes generated package source artifacts', () => {
    expect(isGeneratedSourceArtifact('packages/auth/src/auth-server/session.js')).toBe(true);
    expect(isGeneratedSourceArtifact('packages/sdk/src/logger/index.server.d.ts')).toBe(true);
    expect(isGeneratedSourceArtifact('packages/sdk/dist/index.js')).toBe(false);
    expect(isGeneratedSourceArtifact('apps/sva-studio-react/src/main.tsx')).toBe(false);
  });

  it('finds generated source artifacts on disk, including ignored local files', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-placement-'));

    fs.mkdirSync(path.join(rootDir, 'packages/auth/src/auth-server'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'packages/sdk/dist'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'packages/auth/src/auth-server/session.js'), '');
    fs.writeFileSync(path.join(rootDir, 'packages/auth/src/auth-server/session.d.ts'), '');
    fs.writeFileSync(path.join(rootDir, 'packages/sdk/dist/index.js'), '');

    expect(findGeneratedSourceArtifacts(rootDir)).toEqual([
      'packages/auth/src/auth-server/session.d.ts',
      'packages/auth/src/auth-server/session.js',
    ]);

    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('deletes generated source artifacts from package source trees', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-artifacts-'));

    fs.mkdirSync(path.join(rootDir, 'packages/core/src/iam'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'packages/core/src/iam/authorization-engine.js'), '');
    fs.writeFileSync(path.join(rootDir, 'packages/core/src/iam/authorization-engine.d.ts'), '');

    expect(deleteGeneratedSourceArtifacts(rootDir)).toBe(2);
    expect(findGeneratedSourceArtifacts(rootDir)).toEqual([]);

    fs.rmSync(rootDir, { recursive: true, force: true });
  });
});
