import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  buildStudioImageVerifyEvidenceCheck,
  readStudioImageVerifyEvidence,
  resolveTenantRuntimeTargets,
  runExternalSmokeWithWarmup,
  shouldRetryExternalSmoke,
  shouldRetryInternalProbeFailure,
  shouldRetryInternalVerifyAttempt,
  shouldRetryInternalVerify,
  tryReadGithubStudioImageVerifyEvidence,
} from './runtime-env.ts';
import type { AcceptanceProbeResult } from './runtime-env.shared.ts';

const createProbe = (overrides: Partial<AcceptanceProbeResult>): AcceptanceProbeResult => ({
  durationMs: 10,
  message: 'ok',
  name: 'public-ready',
  scope: 'external',
  status: 'ok',
  target: 'https://studio.smart-village.app/health/ready',
  ...overrides,
});

describe('shouldRetryExternalSmoke', () => {
  it('retries only retryable warmup probe failures', () => {
    const probes = [
      createProbe({
        message: 'Erwartet HTTP 200, erhalten 404.',
        name: 'public-home',
        status: 'error',
      }),
      createProbe({
        message: 'Unerwarteter Ready-Status 504.',
        name: 'public-ready',
        status: 'error',
      }),
    ];

    expect(shouldRetryExternalSmoke(probes)).toBe(true);
  });

  it('does not retry non-warmup probe failures', () => {
    const probes = [
      createProbe({
        message: 'IAM-Kontext lieferte HTML statt eines API-Vertrags.',
        name: 'public-iam-context',
        status: 'error',
        target: 'https://studio.smart-village.app/api/v1/iam/me/context',
      }),
    ];

    expect(shouldRetryExternalSmoke(probes)).toBe(false);
  });
});

describe('shouldRetryInternalVerify', () => {
  it('retries warmup-only doctor failures when the retry signal is only present in details', () => {
    const shouldRetry = shouldRetryInternalVerify({
      checks: [
        {
          code: 'live_failed',
          details: {
            status: 404,
          },
          message: 'Live-Endpoint antwortet mit 404.',
          name: 'health-live',
          status: 'error',
        },
        {
          code: 'app_db_principal_not_ready',
          details: {
            payload: '<html><body><h1>404 Not Found</h1></body></html>',
            status: 404,
          },
          message: 'Die laufende App meldet Registry-/Auth- oder Datenbank-Readiness nicht stabil.',
          name: 'app-db-principal',
          status: 'error',
        },
      ],
      generatedAt: '2026-04-19T17:02:12.142Z',
      profile: 'studio',
      status: 'error',
    });

    expect(shouldRetry).toBe(true);
  });

  it('does not retry non-warmup doctor failures', () => {
    const shouldRetry = shouldRetryInternalVerify({
      checks: [
        {
          code: 'schema_guard_failed',
          message: 'Kritische IAM-Schema-Drift erkannt.',
          name: 'schema-guard',
          status: 'error',
        },
      ],
      generatedAt: '2026-04-19T17:02:12.142Z',
      profile: 'studio',
      status: 'error',
    });

    expect(shouldRetry).toBe(false);
  });

  it('does not retry when a retryable doctor failure is mixed with a non-retryable probe failure', () => {
    const shouldRetry = shouldRetryInternalVerifyAttempt({
      doctorReport: {
        checks: [
          {
            code: 'live_failed',
            details: {
              status: 404,
            },
            message: 'Live-Endpoint antwortet mit 404.',
            name: 'health-live',
            status: 'error',
          },
        ],
        generatedAt: '2026-04-19T17:02:12.142Z',
        profile: 'studio',
        status: 'error',
      },
      probes: [
        createProbe({
          message: 'Dienst studio_app wurde nicht gefunden.',
          name: 'swarm-services',
          scope: 'internal',
          status: 'error',
          target: 'studio',
        }),
      ],
    });

    expect(shouldRetry).toBe(false);
  });
});

describe('shouldRetryInternalProbeFailure', () => {
  it('retries warmup-like swarm app task states', () => {
    expect(
      shouldRetryInternalProbeFailure(
        createProbe({
          details: {
            desiredState: 'running',
            state: 'preparing',
          },
          message: 'Swarm-App-Task ist nicht stabil running (preparing).',
          name: 'swarm-app-task',
          scope: 'internal',
          status: 'error',
          target: 'studio/app',
        }),
      ),
    ).toBe(true);
  });

  it('does not retry non-warmup swarm app task failures', () => {
    expect(
      shouldRetryInternalProbeFailure(
        createProbe({
          details: {
            currentState: 'failed 2 seconds ago',
          },
          message: 'Task failed with exit code 1.',
          name: 'swarm-app-task',
          scope: 'internal',
          status: 'error',
          target: 'studio/app',
        }),
      ),
    ).toBe(false);
  });
});

describe('runExternalSmokeWithWarmup', () => {
  it('retries once after a transient warmup failure', async () => {
    const runner = vi
      .fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValueOnce([
        createProbe({
          message: 'Erwartet HTTP 200, erhalten 404.',
          name: 'public-home',
          status: 'error',
          target: 'https://studio.smart-village.app',
        }),
      ])
      .mockResolvedValueOnce([
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-home',
          status: 'ok',
          target: 'https://studio.smart-village.app',
        }),
      ]);

    const probes = await runExternalSmokeWithWarmup(
      {},
      {
        maxAttempts: 2,
        retryDelayMs: 0,
        runner,
      }
    );

    expect(runner).toHaveBeenCalledTimes(2);
    expect(probes[0]?.status).toBe('ok');
  });

  it('returns immediately for non-retryable failures', async () => {
    const runner = vi.fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>().mockResolvedValue([
      createProbe({
        message: 'IAM-Instanzliste lieferte HTML statt JSON/API-Vertrag.',
        name: 'public-iam-instances',
        status: 'error',
        target: 'https://studio.smart-village.app/api/v1/iam/instances',
      }),
    ]);

    const probes = await runExternalSmokeWithWarmup(
      {},
      {
        maxAttempts: 2,
        retryDelayMs: 0,
        runner,
      }
    );

    expect(runner).toHaveBeenCalledTimes(1);
    expect(probes[0]?.status).toBe('error');
  });
});

describe('resolveTenantRuntimeTargets', () => {
  it('prefers explicit tenant scope instance ids over the legacy allowlist', async () => {
    const resolution = await resolveTenantRuntimeTargets('local-keycloak', {
      SVA_PARENT_DOMAIN: 'studio.example.org',
      SVA_TENANT_SCOPE_INSTANCE_IDS: 'bb-guben,de-musterhausen',
      SVA_ALLOWED_INSTANCE_IDS: 'legacy-instance',
    });

    expect(resolution.source).toBe('explicit_env');
    expect(resolution.targets).toEqual([
      {
        authRealm: 'bb-guben',
        host: 'bb-guben.studio.example.org',
        instanceId: 'bb-guben',
      },
      {
        authRealm: 'de-musterhausen',
        host: 'de-musterhausen.studio.example.org',
        instanceId: 'de-musterhausen',
      },
    ]);
  });

  it('uses the local allowlist only as a local fallback when no explicit scope is configured', async () => {
    const resolution = await resolveTenantRuntimeTargets('local-keycloak', {
      SVA_PARENT_DOMAIN: 'studio.example.org',
      SVA_ALLOWED_INSTANCE_IDS: 'hb-meinquartier',
    });

    expect(resolution.source).toBe('local_allowlist');
    expect(resolution.targets).toEqual([
      {
        authRealm: 'hb-meinquartier',
        host: 'hb-meinquartier.studio.example.org',
        instanceId: 'hb-meinquartier',
      },
    ]);
  });
});

describe('studio image verify evidence', () => {
  const evidenceDir = resolve(process.cwd(), 'artifacts/runtime/image-verify');
  const evidencePath = resolve(evidenceDir, 'studio-image-verify-unit-test.json');

  it('finds matching image verify reports by digest and reports missing evidence as a studio warning', () => {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      evidencePath,
      JSON.stringify({
        imageRef: 'ghcr.io/smart-village-app/sva-studio@sha256:test-digest',
        reportId: 'studio-image-verify-unit-test',
        status: 'ok',
      })
    );

    try {
      expect(readStudioImageVerifyEvidence('sha256:test-digest')).toMatchObject({
        imageRef: 'ghcr.io/smart-village-app/sva-studio@sha256:test-digest',
        reportId: 'studio-image-verify-unit-test',
        source: 'local-artifact',
        status: 'ok',
      });

      expect(
        buildStudioImageVerifyEvidenceCheck(
          'studio',
          {},
          {
            actor: 'tester',
            imageDigest: 'sha256:test-digest',
            imageRef: 'ghcr.io/smart-village-app/sva-studio@sha256:test-digest',
            imageRepository: 'sva-studio',
            releaseMode: 'app-only',
            reportSlug: 'studio-deploy-local',
            rollbackHint: 'Redeploy previous digest',
            workflow: 'unit-test',
          }
        )
      ).toMatchObject({
        code: 'image_verify_evidence_present',
        details: {
          evidenceSource: 'local-artifact',
        },
        name: 'studio-image-verify-evidence',
        status: 'ok',
      });
    } finally {
      rmSync(evidencePath, { force: true });
    }

    vi.stubEnv('PATH', '');
    try {
      expect(
        buildStudioImageVerifyEvidenceCheck('studio', {
          SVA_IMAGE_DIGEST: 'sha256:missing-digest',
        })
      ).toMatchObject({
        code: 'image_verify_evidence_missing',
        details: {
          acceptedSources: ['artifacts/runtime/image-verify', 'GitHub Actions artifact "Studio Image Verify"'],
        },
        name: 'studio-image-verify-evidence',
        status: 'warn',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('accepts only digest-matching GitHub artifacts, paginates, and scans until a successful verify run is found', () => {
    const runCapture = vi.fn<(command: string, args: readonly string[]) => string>();
    const readArtifactEvidence = vi.fn<
      (args: { artifactName: string; imageDigest: string; owner: string; repo: string; runId: number }) =>
        | {
            imageRef: string;
            reportId?: string;
            status: 'ok';
          }
        | undefined
    >();

    runCapture.mockImplementation((command, args) => {
      if (command === 'git') {
        return 'git@github.com:smart-village-solutions/sva-studio.git\n';
      }

      if (command === 'gh' && args[0] === 'api' && /[?&]page=1$/u.test(args[1] ?? '')) {
        return JSON.stringify({
          artifacts: [
            {
              expired: false,
              name: 'studio-image-verify-deadbeefcafe-20260502T090000Z',
              workflow_run: { id: 1001 },
            },
            {
              expired: false,
              name: 'studio-image-verify-v1.2.3-20260502T091000Z',
              workflow_run: { id: 1002 },
            },
            ...Array.from({ length: 98 }, (_, index) => ({
              expired: false,
              name: `unrelated-artifact-${index}`,
              workflow_run: { id: 2000 + index },
            })),
          ],
        });
      }

      if (command === 'gh' && args[0] === 'api' && /[?&]page=2$/u.test(args[1] ?? '')) {
        return JSON.stringify({
          artifacts: [
            {
              expired: false,
              name: 'studio-image-verify-deadbeefcafe-20260502T092000Z',
              workflow_run: { id: 1003 },
            },
          ],
        });
      }

      if (command === 'gh' && args[0] === 'run' && args[2] === '1001') {
        return JSON.stringify({
          conclusion: 'failure',
          url: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/1001',
          workflowName: 'Studio Image Verify',
        });
      }

      if (command === 'gh' && args[0] === 'run' && args[2] === '1003') {
        return JSON.stringify({
          conclusion: 'success',
          url: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/1003',
          workflowName: 'Studio Image Verify',
        });
      }

      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    readArtifactEvidence.mockImplementation(({ artifactName, imageDigest }) => {
      if (artifactName !== 'studio-image-verify-deadbeefcafe-20260502T092000Z') {
        return undefined;
      }

      return {
        imageRef: `ghcr.io/smart-village-solutions/sva-studio@${imageDigest}`,
        reportId: 'studio-image-verify-report',
        status: 'ok',
      };
    });

    expect(
      tryReadGithubStudioImageVerifyEvidence('sha256:deadbeefcafebabefeedface', {
        commandExistsImpl: () => true,
        readArtifactEvidenceImpl: readArtifactEvidence,
        runCaptureImpl: runCapture,
      }),
    ).toMatchObject({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeefcafebabefeedface',
      path: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/1003',
      reportId: 'studio-image-verify-report',
      source: 'github-artifact',
      status: 'ok',
    });

    expect(runCapture).toHaveBeenCalledTimes(5);
    expect(runCapture.mock.calls.some(([, args]) => args.includes('1002'))).toBe(false);
    expect(readArtifactEvidence).toHaveBeenCalledTimes(1);
  });

  it('accepts tag-based GitHub artifacts when imageTag is provided and the downloaded report matches the digest', () => {
    const runCapture = vi.fn<(command: string, args: readonly string[]) => string>();
    const readArtifactEvidence = vi.fn<
      (args: { artifactName: string; imageDigest: string; owner: string; repo: string; runId: number }) =>
        | {
            imageRef: string;
            reportId?: string;
            status: 'ok';
          }
        | undefined
    >();

    runCapture.mockImplementation((command, args) => {
      if (command === 'git') {
        return 'git@github.com:smart-village-solutions/sva-studio.git\n';
      }

      if (command === 'gh' && args[0] === 'api') {
        return JSON.stringify({
          artifacts: [
            {
              expired: false,
              name: 'studio-image-verify-v1.2.3-20260502T091000Z',
              workflow_run: { id: 1002 },
            },
          ],
        });
      }

      if (command === 'gh' && args[0] === 'run' && args[2] === '1002') {
        return JSON.stringify({
          conclusion: 'success',
          url: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/1002',
          workflowName: 'Studio Image Verify',
        });
      }

      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    readArtifactEvidence.mockReturnValue({
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeefcafebabefeedface',
      reportId: 'studio-image-verify-v1.2.3-20260502T091000Z',
      status: 'ok',
    });

    expect(
      tryReadGithubStudioImageVerifyEvidence('sha256:deadbeefcafebabefeedface', {
        commandExistsImpl: () => true,
        imageTag: 'v1.2.3',
        readArtifactEvidenceImpl: readArtifactEvidence,
        runCaptureImpl: runCapture,
      }),
    ).toMatchObject({
      path: 'https://github.com/smart-village-solutions/sva-studio/actions/runs/1002',
      reportId: 'studio-image-verify-v1.2.3-20260502T091000Z',
      source: 'github-artifact',
      status: 'ok',
    });
    expect(readArtifactEvidence).toHaveBeenCalledWith({
      artifactName: 'studio-image-verify-v1.2.3-20260502T091000Z',
      imageDigest: 'sha256:deadbeefcafebabefeedface',
      owner: 'smart-village-solutions',
      repo: 'sva-studio',
      runId: 1002,
    });
  });

  it('ignores tag-based GitHub artifacts when no imageTag is provided', () => {
    const runCapture = vi.fn<(command: string, args: readonly string[]) => string>();

    runCapture.mockImplementation((command, args) => {
      if (command === 'git') {
        return 'git@github.com:smart-village-solutions/sva-studio.git\n';
      }

      if (command === 'gh' && args[0] === 'api') {
        return JSON.stringify({
          artifacts: [
            {
              expired: false,
              name: 'studio-image-verify-v1.2.3-20260502T091000Z',
              workflow_run: { id: 1002 },
            },
          ],
        });
      }

      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    expect(
      tryReadGithubStudioImageVerifyEvidence('sha256:deadbeefcafebabefeedface', {
        commandExistsImpl: () => true,
        runCaptureImpl: runCapture,
      }),
    ).toBeUndefined();
    expect(runCapture).toHaveBeenCalledTimes(2);
  });
});
