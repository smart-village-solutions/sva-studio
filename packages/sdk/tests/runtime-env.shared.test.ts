import { describe, expect, it } from 'vitest';

import {
  buildAcceptanceReportPaths,
  formatAcceptanceDeployReportMarkdown,
  parseRuntimeCliOptions,
  resolveAcceptanceDeployOptions,
  type AcceptanceDeployReport,
} from '../../../scripts/ops/runtime-env.shared.ts';

describe('runtime-env.shared', () => {
  it('parses deploy cli options with explicit values', () => {
    const result = parseRuntimeCliOptions([
      '--json',
      '--release-mode=schema-and-app',
      '--maintenance-window',
      '2026-03-20 19:00-19:15 CET',
      '--rollback-hint=Redeploy previous digest',
      '--image-tag=ghcr.io/example/app:1.2.3',
      '--actor',
      'gha',
    ]);

    expect(result).toEqual({
      jsonOutput: true,
      releaseMode: 'schema-and-app',
      maintenanceWindow: '2026-03-20 19:00-19:15 CET',
      rollbackHint: 'Redeploy previous digest',
      imageTag: 'ghcr.io/example/app:1.2.3',
      actor: 'gha',
    });
  });

  it('requires a maintenance window for schema-and-app releases', () => {
    expect(() =>
      resolveAcceptanceDeployOptions(
        {
          GITHUB_ACTOR: 'gha',
          GITHUB_WORKFLOW: 'Acceptance Deploy',
        },
        {
          jsonOutput: false,
          releaseMode: 'schema-and-app',
        }
      )
    ).toThrow(/Wartungsfenster/);
  });

  it('resolves deploy defaults from env and sanitizes the report slug', () => {
    const result = resolveAcceptanceDeployOptions(
      {
        GITHUB_ACTOR: 'gha',
        GITHUB_WORKFLOW: 'Acceptance Deploy',
        SVA_ACCEPTANCE_REPORT_SLUG: 'Acceptance Deploy HB',
        SVA_ACCEPTANCE_RELEASE_MODE: 'app-only',
      },
      {
        jsonOutput: false,
      }
    );

    expect(result).toEqual({
      actor: 'gha',
      workflow: 'Acceptance Deploy',
      releaseMode: 'app-only',
      reportSlug: 'acceptance-deploy-hb',
      rollbackHint: 'Vorherigen unveraenderlichen Image-Tag oder Digest erneut deployen.',
    });
  });

  it('renders a markdown report with the required evidence fields', () => {
    const paths = buildAcceptanceReportPaths('/tmp/artifacts', 'acceptance-deploy', '2026-03-20T12:00:00.000Z');
    const report: AcceptanceDeployReport = {
      profile: 'acceptance-hb',
      status: 'ok',
      generatedAt: '2026-03-20T12:00:00.000Z',
      reportId: paths.reportId,
      releaseMode: 'schema-and-app',
      actor: 'gha',
      workflow: 'Acceptance Deploy',
      imageTag: 'ghcr.io/example/sva-studio:1.2.3',
      imageDigest: 'sha256:abc',
      maintenanceWindow: '2026-03-20 19:00-19:15 CET',
      rollbackHint: 'Redeploy previous digest',
      migrationFiles: ['packages/data/migrations/up/0001_init.sql'],
      stackName: 'sva-studio',
      observability: {
        grafanaUrl: 'https://grafana.internal',
        lokiUrl: 'https://loki.internal',
        notes: ['Internal only'],
      },
      steps: [
        {
          name: 'precheck',
          status: 'ok',
          summary: 'Precheck passed',
          startedAt: '2026-03-20T12:00:00.000Z',
          finishedAt: '2026-03-20T12:00:03.000Z',
          durationMs: 3000,
        },
      ],
      artifacts: {
        jsonPath: paths.jsonPath,
        markdownPath: paths.markdownPath,
      },
      stackStatus: {
        services: 'service summary',
        tasks: 'task summary',
      },
    };

    const markdown = formatAcceptanceDeployReportMarkdown(report);

    expect(markdown).toContain('Release-Modus: `schema-and-app`');
    expect(markdown).toContain('Rollback-Hinweis: Redeploy previous digest');
    expect(markdown).toContain('`packages/data/migrations/up/0001_init.sql`');
    expect(markdown).toContain('Grafana: https://grafana.internal');
    expect(markdown).toContain('service summary');
  });
});
