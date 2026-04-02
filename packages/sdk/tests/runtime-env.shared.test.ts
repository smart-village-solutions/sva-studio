import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
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
      '--local-override-file',
      'config/runtime/local-keycloak.hb.local.vars',
      '--actor',
      'gha',
    ]);

    expect(result).toEqual({
      jsonOutput: true,
      releaseMode: 'schema-and-app',
      maintenanceWindow: '2026-03-20 19:00-19:15 CET',
      rollbackHint: 'Redeploy previous digest',
      imageTag: 'ghcr.io/example/app:1.2.3',
      localOverrideFile: 'config/runtime/local-keycloak.hb.local.vars',
      actor: 'gha',
    });
  });

  it('requires an image digest for production-like acceptance releases', () => {
    expect(() =>
      resolveAcceptanceDeployOptions(
        {
          GITHUB_ACTOR: 'gha',
          GITHUB_WORKFLOW: 'Acceptance Deploy',
        },
        {
          jsonOutput: false,
        }
      )
    ).toThrow(/Image-Digest/);
  });

  it('requires a maintenance window for schema-and-app releases', () => {
    expect(() =>
      resolveAcceptanceDeployOptions(
        {
          GITHUB_ACTOR: 'gha',
          GITHUB_WORKFLOW: 'Acceptance Deploy',
          SVA_IMAGE_DIGEST: 'sha256:abc',
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
        SVA_IMAGE_DIGEST: 'sha256:abc',
      },
      {
        jsonOutput: false,
      }
    );

    expect(result).toEqual({
      actor: 'gha',
      workflow: 'Acceptance Deploy',
      imageDigest: 'sha256:abc',
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:abc',
      imageRepository: 'sva-studio',
      releaseMode: 'app-only',
      monitoringConfigImageTag: undefined,
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
      imageRef: 'ghcr.io/example/sva-studio@sha256:abc',
      imageRepository: 'sva-studio',
      imageTag: 'ghcr.io/example/sva-studio:1.2.3',
      imageDigest: 'sha256:abc',
      internalProbes: [
        {
          name: 'internal-live',
          scope: 'internal',
          status: 'ok',
          target: 'http://app:3000/health/live',
          message: 'ok',
          durationMs: 12,
          httpStatus: 200,
        },
      ],
      maintenanceWindow: '2026-03-20 19:00-19:15 CET',
      rollbackHint: 'Redeploy previous digest',
      migrationFiles: ['packages/data/migrations/0001_init.sql'],
      migrationReport: {
        status: 'ok',
        startedAt: '2026-03-20T11:59:50.000Z',
        completedAt: '2026-03-20T11:59:59.000Z',
        details: {
          gooseVersion: 'v3.26.0',
        },
      },
      stackName: 'sva-studio',
      observability: {
        grafanaUrl: 'https://grafana.internal',
        lokiUrl: 'https://loki.internal',
        notes: ['Internal only'],
      },
      externalProbes: [
        {
          name: 'public-iam-context',
          scope: 'external',
          status: 'ok',
          target: 'https://example.test/api/v1/iam/me/context',
          message: '401 as expected',
          durationMs: 33,
          httpStatus: 401,
        },
      ],
      releaseDecision: {
        technicalGatePassed: true,
        summary: 'Alle technischen Gates erfolgreich.',
      },
      releaseManifest: {
        actor: 'gha',
        commitSha: 'abc123',
        imageDigest: 'sha256:abc',
        imageRef: 'ghcr.io/example/sva-studio@sha256:abc',
        imageRepository: 'sva-studio',
        imageTag: 'ghcr.io/example/sva-studio:1.2.3',
        monitoringConfigImageTag: '1.2.3',
        profile: 'acceptance-hb',
        releaseMode: 'schema-and-app',
        workflow: 'Acceptance Deploy',
      },
      steps: [
        {
          name: 'environment-precheck',
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
        releaseManifestPath: paths.releaseManifestPath,
        phaseReportPath: paths.phaseReportPath,
        migrationReportPath: paths.migrationReportPath,
        internalVerifyPath: paths.internalVerifyPath,
        externalSmokePath: paths.externalSmokePath,
      },
      stackStatus: {
        services: 'service summary',
        tasks: 'task summary',
      },
    };

    const markdown = formatAcceptanceDeployReportMarkdown(report);

    expect(markdown).toContain('Release-Modus: `schema-and-app`');
    expect(markdown).toContain('Rollback-Hinweis: Redeploy previous digest');
    expect(markdown).toContain('`packages/data/migrations/0001_init.sql`');
    expect(markdown).toContain('Goose-Version: `v3.26.0`');
    expect(markdown).toContain('Grafana: https://grafana.internal');
    expect(markdown).toContain('service summary');
    expect(markdown).toContain('Image-Ref: `ghcr.io/example/sva-studio@sha256:abc`');
    expect(markdown).toContain('Freigabeentscheidung: Alle technischen Gates erfolgreich.');
    expect(markdown).toContain('`public-iam-context` -> `ok`');
  });
});
