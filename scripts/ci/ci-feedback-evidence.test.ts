import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildCiFeedbackEvidence, writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('ci-feedback-evidence', () => {
  it('writes a versioned head-bound failed-gate artifact', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-feedback-evidence-'));
    temporaryDirectories.push(rootDir);
    const evidence = buildCiFeedbackEvidence({
      gate: 'unit',
      status: 'failed',
      baseSha: 'base-sha',
      headSha: 'head-sha',
      scopeMode: 'affected',
      plan: {
        mode: 'changed-first',
        reason: 'directly-changed-projects-first',
        directProjects: ['plugin-news'],
        remainingProjects: ['routing'],
        unmappedFiles: [],
      },
      phases: [{ label: 'unit:direct-projects', durationMs: 1200 }],
      startedAt: new Date('2026-08-13T10:00:00.000Z'),
      finishedAt: new Date('2026-08-13T10:00:01.200Z'),
    });

    const evidencePath = writeCiFeedbackEvidence(evidence, rootDir);
    const written = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as typeof evidence;

    expect(written).toEqual(evidence);
    expect(written.schemaVersion).toBe(1);
    expect(written.headSha).toBe('head-sha');
    expect(written.firstConfirmedFailureAt).toBe('2026-08-13T10:00:01.200Z');
  });

  it('does not claim a failure timestamp for a passed gate', () => {
    const evidence = buildCiFeedbackEvidence({
      gate: 'coverage',
      status: 'passed',
      baseSha: 'base-sha',
      headSha: 'head-sha',
      scopeMode: 'full',
      plan: null,
      phases: [],
      startedAt: new Date('2026-08-13T10:00:00.000Z'),
      finishedAt: new Date('2026-08-13T10:00:01.000Z'),
    });

    expect(evidence.firstConfirmedFailureAt).toBeNull();
  });
});
