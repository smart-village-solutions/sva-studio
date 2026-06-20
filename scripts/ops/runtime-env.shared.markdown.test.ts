import { describe, expect, it } from 'vitest';

import { formatAcceptanceDeployReportMarkdown } from './runtime-env.shared.ts';
import type { AcceptanceDeployReport } from './runtime-env.shared.ts';

const createReport = (): AcceptanceDeployReport => ({
  actor: 'agent',
  artifacts: {
    bootstrapJobPath: 'bootstrap-job.json',
    bootstrapReportPath: 'bootstrap-report.json',
    externalSmokePath: 'external-smoke.json',
    internalVerifyPath: 'internal-verify.json',
    jsonPath: 'report.json',
    markdownPath: 'report.md',
    migrationJobPath: 'migration-job.json',
    migrationReportPath: 'migration-report.json',
    phaseReportPath: 'phase-report.json',
    releaseManifestPath: 'release-manifest.json',
  },
  bootstrapReport: undefined,
  externalProbes: [],
  generatedAt: '2026-06-20T15:00:00.000Z',
  imageDigest: 'sha256:deadbeef',
  imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
  imageRepository: 'ghcr.io/smart-village-solutions/sva-studio',
  imageTag: 'sha-deadbeef',
  internalProbes: [],
  maintenanceWindow: undefined,
  migrationFiles: [],
  migrationReport: undefined,
  observability: {
    grafanaUrl: 'https://grafana.example.test',
    lokiUrl: 'https://loki.example.test',
    notes: ['OTEL aktiv'],
  },
  profile: 'studio',
  releaseDecision: {
    summary: 'Freigabe erteilt.',
    technicalGatePassed: true,
  },
  releaseManifest: {
    actor: 'agent',
    commitSha: 'abc123def456',
    imageDigest: 'sha256:deadbeef',
    imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
    imageRepository: 'ghcr.io/smart-village-solutions/sva-studio',
    monitoringConfigImageTag: 'otel-v2',
    profile: 'studio',
    releaseMode: 'app-only',
    workflow: 'manual',
  },
  releaseMode: 'app-only',
  reportId: 'report-123',
  rollbackHint: 'Rollback via previous image',
  runtimeContract: {
    derivedKeys: ['SVA_PUBLIC_BASE_URL'],
    effectiveSummary: { SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app' },
    requiredKeys: ['SVA_PUBLIC_BASE_URL', 'APP_DB_USER'],
  },
  stackName: 'studio',
  stackStatus: undefined,
  status: 'ok',
  steps: [],
  workflow: 'manual',
});

describe('formatAcceptanceDeployReportMarkdown', () => {
  it('includes release manifest provenance details in the markdown output', () => {
    const markdown = formatAcceptanceDeployReportMarkdown(createReport());

    expect(markdown).toContain('## Release Manifest');
    expect(markdown).toContain('- Commit-SHA: `abc123def456`');
    expect(markdown).toContain('- Repository: `ghcr.io/smart-village-solutions/sva-studio`');
    expect(markdown).toContain('- Monitoring-Config-Tag: `otel-v2`');
  });
});
