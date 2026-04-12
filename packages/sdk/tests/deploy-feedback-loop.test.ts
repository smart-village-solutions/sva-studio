import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  listDeployReports,
  renderDeployFeedbackSummaryMarkdown,
  renderDeployReviewTemplate,
  summarizeDeployReports,
} from '../../../scripts/ops/deploy-feedback-loop.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AcceptanceDeployReport } from '../../../scripts/ops/runtime-env.shared.ts';

const tempDirs: string[] = [];

const createReport = (overrides: Partial<AcceptanceDeployReport> = {}): AcceptanceDeployReport => ({
  actor: 'gha',
  artifacts: {
    bootstrapJobPath: '/tmp/a.bootstrap-job.json',
    bootstrapReportPath: '/tmp/a.bootstrap.json',
    jsonPath: '/tmp/a.json',
    markdownPath: '/tmp/a.md',
    releaseManifestPath: '/tmp/a.manifest.json',
    phaseReportPath: '/tmp/a.phases.json',
    migrationJobPath: '/tmp/a.migration-job.json',
    migrationReportPath: '/tmp/a.migration.json',
    internalVerifyPath: '/tmp/a.internal.json',
    externalSmokePath: '/tmp/a.external.json',
  },
  generatedAt: '2026-03-21T12:00:00.000Z',
  imageDigest: 'sha256:abc',
  imageRef: 'ghcr.io/example/sva-studio@sha256:abc',
  imageRepository: 'sva-studio',
  internalProbes: [],
  migrationFiles: [],
  observability: { notes: [] },
  externalProbes: [],
  profile: 'acceptance-hb',
  releaseDecision: {
    summary: 'Alle technischen Gates erfolgreich.',
    technicalGatePassed: true,
  },
  releaseManifest: {
    actor: 'gha',
    imageDigest: 'sha256:abc',
    imageRef: 'ghcr.io/example/sva-studio@sha256:abc',
    imageRepository: 'sva-studio',
    profile: 'acceptance-hb',
    releaseMode: 'app-only',
    workflow: 'Acceptance Deploy',
  },
  releaseMode: 'app-only',
  reportId: 'acceptance-deploy-2026-03-21T12-00-00-000Z',
  rollbackHint: 'Redeploy previous digest',
  stackName: 'sva-studio',
  status: 'ok',
  steps: [
    {
      durationMs: 1000,
      finishedAt: '2026-03-21T12:00:01.000Z',
      name: 'environment-precheck',
      startedAt: '2026-03-21T12:00:00.000Z',
      status: 'ok',
      summary: 'ok',
    },
    {
      durationMs: 2000,
      finishedAt: '2026-03-21T12:00:03.000Z',
      name: 'release-decision',
      startedAt: '2026-03-21T12:00:01.000Z',
      status: 'ok',
      summary: 'ok',
    },
  ],
  workflow: 'Acceptance Deploy',
  ...overrides,
});

describe('deploy-feedback-loop', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads only primary deploy reports from the report directory', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'deploy-feedback-'));
    tempDirs.push(dir);

    writeFileSync(resolve(dir, 'report-a.json'), `${JSON.stringify(createReport())}\n`, 'utf8');
    writeFileSync(resolve(dir, 'report-a.manifest.json'), '{}\n', 'utf8');
    writeFileSync(resolve(dir, 'release-feedback-summary.json'), '{}\n', 'utf8');

    const reports = listDeployReports(dir);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.reportId).toBe('acceptance-deploy-2026-03-21T12-00-00-000Z');
  });

  it('ignores malformed reports without a generated timestamp before sorting', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'deploy-feedback-'));
    tempDirs.push(dir);

    writeFileSync(resolve(dir, 'report-invalid.json'), `${JSON.stringify({ reportId: 'broken', steps: [] })}\n`, 'utf8');
    writeFileSync(resolve(dir, 'report-valid.json'), `${JSON.stringify(createReport())}\n`, 'utf8');

    const reports = listDeployReports(dir);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.reportId).toBe('acceptance-deploy-2026-03-21T12-00-00-000Z');
  });

  it('summarizes failure categories, failed phases and success rate', () => {
    const success = createReport();
    const failed = createReport({
      generatedAt: '2026-03-22T12:00:00.000Z',
      reportId: 'acceptance-deploy-2026-03-22T12-00-00-000Z',
      status: 'error',
      failureCategory: 'ingress',
      releaseDecision: {
        summary: 'Technische Freigabe verweigert.',
        technicalGatePassed: false,
      },
      steps: [
        {
          durationMs: 1000,
          finishedAt: '2026-03-22T12:00:01.000Z',
          name: 'environment-precheck',
          startedAt: '2026-03-22T12:00:00.000Z',
          status: 'ok',
          summary: 'ok',
        },
        {
          durationMs: 3000,
          finishedAt: '2026-03-22T12:00:04.000Z',
          name: 'external-smoke',
          startedAt: '2026-03-22T12:00:01.000Z',
          status: 'error',
          summary: 'timeout',
        },
      ],
    });

    const summary = summarizeDeployReports([success, failed]);

    expect(summary.reportsAnalyzed).toBe(2);
    expect(summary.failureCategoryCounts.ingress).toBe(1);
    expect(summary.failedStepCounts['external-smoke']).toBe(1);
    expect(summary.technicalReleaseSuccessRate).toBe(0.5);
    expect(summary.stepDurationMs['environment-precheck']?.median).toBe(1000);
  });

  it('renders a markdown summary and review template with actionable sections', () => {
    const failed = createReport({
      status: 'error',
      failureCategory: 'image',
      releaseDecision: {
        summary: 'Technische Freigabe verweigert.',
        technicalGatePassed: false,
      },
      steps: [
        {
          durationMs: 1100,
          finishedAt: '2026-03-21T12:00:01.100Z',
          name: 'image-smoke',
          startedAt: '2026-03-21T12:00:00.000Z',
          status: 'error',
          summary: 'Container start failed',
        },
      ],
    });

    const summary = summarizeDeployReports([failed]);
    const summaryMarkdown = renderDeployFeedbackSummaryMarkdown(summary, [failed]);
    const reviewMarkdown = renderDeployReviewTemplate(failed);

    expect(summaryMarkdown).toContain('Deploy-Feedback-Summary');
    expect(summaryMarkdown).toContain('`image`: 1');
    expect(reviewMarkdown).toContain('Deploy-Review acceptance-deploy-2026-03-21T12-00-00-000Z');
    expect(reviewMarkdown).toContain('Empfohlene Richtung: Fehlenden Artefakt-Test oder Startup-Guard');
  });
});
