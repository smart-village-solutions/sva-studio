import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  buildStudioImageVerifyEvidenceCheck,
  readStudioImageVerifyEvidence,
  resolveTenantRuntimeTargets,
  runExternalSmokeWithWarmup,
  shouldRetryExternalSmoke,
  shouldRetryInternalVerify,
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
        name: 'studio-image-verify-evidence',
        status: 'ok',
      });
    } finally {
      rmSync(evidencePath, { force: true });
    }

    expect(
      buildStudioImageVerifyEvidenceCheck('studio', {
        SVA_IMAGE_DIGEST: 'sha256:missing-digest',
      })
    ).toMatchObject({
      code: 'image_verify_evidence_missing',
      name: 'studio-image-verify-evidence',
      status: 'warn',
    });
  });
});
