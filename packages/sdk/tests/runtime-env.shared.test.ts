import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  assertDeterministicRemoteMutationContext,
  buildAcceptanceReportPaths,
  buildProdParityProbePlan,
  buildTrustedForwardedHeaders,
  formatAcceptanceDeployReportMarkdown,
  getRuntimeStatusExecutionMode,
  hasLocalEmergencyRemoteMutationOverride,
  isTruthyFlag,
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

  it('ignores a standalone script option separator', () => {
    const result = parseRuntimeCliOptions(['--', '--json']);

    expect(result).toEqual({
      jsonOutput: true,
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
      },
      'acceptance-hb'
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

  it('accepts remote mutations in a deterministic CI runner context', () => {
    expect(
      assertDeterministicRemoteMutationContext(
        {
          GITHUB_ACTIONS: 'true',
          GITHUB_WORKFLOW: 'Acceptance Deploy',
        },
        'acceptance-hb',
        'deploy',
      ),
    ).toEqual({ mode: 'ci-runner' });
  });

  it('accepts a documented local emergency override for remote mutations', () => {
    expect(
      assertDeterministicRemoteMutationContext(
        {
          SVA_ALLOW_LOCAL_REMOTE_MUTATIONS: 'true',
        },
        'studio',
        'migrate',
      ),
    ).toEqual({ mode: 'local-emergency' });
  });

  it('detects documented truthy flag values for local emergency overrides', () => {
    expect(isTruthyFlag('true')).toBe(true);
    expect(isTruthyFlag('On')).toBe(true);
    expect(isTruthyFlag('0')).toBe(false);
    expect(isTruthyFlag(undefined)).toBe(false);
    expect(hasLocalEmergencyRemoteMutationOverride({ SVA_ALLOW_LOCAL_REMOTE_MUTATIONS: 'yes' })).toBe(true);
    expect(hasLocalEmergencyRemoteMutationOverride({ SVA_ALLOW_LOCAL_REMOTE_MUTATIONS: 'false' })).toBe(false);
  });

  it('rejects remote mutations without runner or emergency context', () => {
    expect(() => assertDeterministicRemoteMutationContext({}, 'studio', 'deploy')).toThrow(/CI-\/Runner-Kontext/);
  });

  it('builds a prod parity plan for root and tenant hosts from runtime env', () => {
    expect(
      buildProdParityProbePlan({
        SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        SVA_ALLOWED_INSTANCE_IDS: 'bb-guben, de-musterhausen',
        SVA_PARENT_DOMAIN: 'studio.smart-village.app',
      }),
    ).toEqual({
      rootHost: 'studio.smart-village.app',
      tenantHosts: [
        { host: 'bb-guben.studio.smart-village.app', instanceId: 'bb-guben' },
        { host: 'de-musterhausen.studio.smart-village.app', instanceId: 'de-musterhausen' },
      ],
    });
  });

  it('builds trusted forwarded headers for parity probes', () => {
    expect(buildTrustedForwardedHeaders('bb-guben.studio.smart-village.app')).toEqual({
      forwarded: 'for=127.0.0.1;proto=https;host=bb-guben.studio.smart-village.app',
      'x-forwarded-host': 'bb-guben.studio.smart-village.app',
      'x-forwarded-proto': 'https',
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
        job: {
          jobServiceName: 'migrate',
          jobStackName: 'sva-studio-migrate-acceptance',
          exitCode: 0,
          state: 'complete',
        },
        details: {
          gooseVersion: 'v3.26.0',
        },
      },
      bootstrapReport: {
        status: 'ok',
        startedAt: '2026-03-20T12:00:00.000Z',
        completedAt: '2026-03-20T12:00:05.000Z',
        job: {
          jobServiceName: 'bootstrap',
          jobStackName: 'sva-studio-bootstrap-acceptance',
          exitCode: 0,
          state: 'complete',
        },
      },
      stackName: 'sva-studio',
      observability: {
        grafanaUrl: 'https://grafana.internal',
        lokiUrl: 'https://loki.internal',
        notes: ['Internal only'],
      },
      runtimeContract: {
        requiredKeys: ['SVA_RUNTIME_PROFILE', 'SVA_PUBLIC_BASE_URL', 'SVA_STACK_NAME'],
        derivedKeys: ['IAM_DATABASE_URL', 'REDIS_URL'],
        effectiveSummary: {
          runtimeProfile: 'acceptance-hb',
          stackName: 'sva-studio',
          publicBaseUrl: 'https://example.test',
        },
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
        bootstrapJobPath: paths.bootstrapJobPath,
        bootstrapReportPath: paths.bootstrapReportPath,
        migrationJobPath: paths.migrationJobPath,
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
    expect(markdown).toContain('Migrationsjob: `sva-studio-migrate-acceptance/migrate`');
    expect(markdown).toContain('Job-Exit-Code: `0`');
    expect(markdown).toContain('Bootstrap-Status: `ok`');
    expect(markdown).toContain('Bootstrap-Job: `sva-studio-bootstrap-acceptance/bootstrap`');
    expect(markdown).toContain('Bootstrap-Exit-Code: `0`');
    expect(markdown).toContain('Grafana: https://grafana.internal');
    expect(markdown).toContain('service summary');
    expect(markdown).toContain('Image-Ref: `ghcr.io/example/sva-studio@sha256:abc`');
    expect(markdown).toContain('Freigabeentscheidung: Alle technischen Gates erfolgreich.');
    expect(markdown).toContain('Ableitbare Schluessel: `IAM_DATABASE_URL, REDIS_URL`');
    expect(markdown).toContain('`public-iam-context` -> `ok`');
  });

  it('uses the runtime profile in default deploy slugs', () => {
    const result = resolveAcceptanceDeployOptions(
      {
        SVA_IMAGE_DIGEST: 'sha256:def',
      },
      {
        jsonOutput: false,
      },
      'studio'
    );

    expect(result.reportSlug).toBe('studio-deploy');
  });

  it('uses remote status execution for swarm profiles and local status execution for local profiles', () => {
    expect(getRuntimeStatusExecutionMode('studio')).toBe('remote');
    expect(getRuntimeStatusExecutionMode('acceptance-hb')).toBe('remote');
    expect(getRuntimeStatusExecutionMode('local-keycloak')).toBe('local');
  });
});
