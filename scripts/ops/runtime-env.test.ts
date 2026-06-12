import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { runtimeEnvDangerousOperations, runtimeEnvRemoteVerification, runtimeEnvSmokeWarmup } from './runtime-env.ts';
import type { AcceptanceProbeResult } from './runtime-env.shared.ts';
import { parseRuntimeCliOptions } from './runtime-env.shared.ts';

const {
  assertDangerousOperationApproved,
  resolveLocalDangerousApprovalRequirement,
  resolveRemoteDangerousApprovalRequirement,
} = runtimeEnvDangerousOperations;

const {
  assertLoginFlow,
  buildKeycloakClientSecretCheck,
  buildLocalProvisioningWorkerCheck,
  buildStudioImageVerifyEvidenceCheck,
  decorateDoctorCheck,
  mergeExplicitTenantTargetsWithRegistry,
  parseTenantRealmOverrides,
  readStudioImageVerifyEvidence,
  repairLocalRuntimeWithDeps,
  requireLocalInstanceRegistryReconciliationInput,
  resolveTenantRuntimeTargets,
  selectReleaseBlockingTenantTargets,
  selectSmokeTenantTargets,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker,
  tryReadGithubStudioImageVerifyEvidence,
  verifyDbSchemaSnapshot,
  waitForPostDeployStabilization,
} = runtimeEnvRemoteVerification;

const {
  deriveInternalVerifyMaxAttempts,
  runExternalSmokeWithWarmup,
  shouldRetryExternalSmoke,
  shouldRetryInternalProbeFailure,
  shouldRetryInternalVerify,
  shouldRetryInternalVerifyAttempt,
  waitForRemoteSmokeWarmup,
} = runtimeEnvSmokeWarmup;

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

  it('retries swarm app task failures in ready state during warmup', () => {
    expect(
      shouldRetryInternalProbeFailure(
        createProbe({
          details: {
            currentState: 'ready 2 seconds ago',
          },
          message: 'Swarm-App-Task ist nicht stabil running (ready).',
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

describe('deriveInternalVerifyMaxAttempts', () => {
  it('caps derived attempts when retry delay is zero or negative', () => {
    expect(deriveInternalVerifyMaxAttempts({ retryDelayMs: 0, warmupWindowMs: 90_000 })).toBe(91);
    expect(deriveInternalVerifyMaxAttempts({ retryDelayMs: -100, warmupWindowMs: 90_000 })).toBe(91);
  });
});

describe('dangerous runtime operation approval', () => {
  it('parses the dangerous approval token from runtime cli options', () => {
    expect(parseRuntimeCliOptions(['--approve-dangerous=studio:reset'])).toMatchObject({
      approvalToken: 'studio:reset',
    });
  });

  it('requires an exact approval token for dangerous commands', () => {
    expect(() =>
      assertDangerousOperationApproved({
        actualApprovalToken: undefined,
        expectedApprovalToken: 'local-keycloak:repair:authoritative',
        reason: 'Autoritativer lokaler Repair kann geschuetzte Identitaetsfelder bewusst ueberschreiben.',
      }),
    ).toThrow('--approve-dangerous=local-keycloak:repair:authoritative');
  });

  it('accepts the matching dangerous approval token', () => {
    expect(() =>
      assertDangerousOperationApproved({
        actualApprovalToken: 'studio:reset',
        expectedApprovalToken: 'studio:reset',
        reason: 'Remote-Reset setzt Postgres und Redis der Zielumgebung zurueck.',
      }),
    ).not.toThrow();
  });

  it('marks only authoritative local mutations as dangerous', () => {
    expect(
      resolveLocalDangerousApprovalRequirement('local-keycloak', 'repair', {
        authoritative: false,
      }),
    ).toBeNull();

    expect(
      resolveLocalDangerousApprovalRequirement('local-keycloak', 'repair', {
        authoritative: true,
      }),
    ).toEqual({
      reason: 'Autoritativer lokaler Repair kann geschuetzte Identitaetsfelder bewusst ueberschreiben.',
      token: 'local-keycloak:repair:authoritative',
    });
  });

  it('derives canonical tokens for dangerous remote mutations', () => {
    expect(resolveRemoteDangerousApprovalRequirement('studio', 'reset', {})).toEqual({
      reason: 'Remote-Reset setzt Postgres und Redis der Zielumgebung zurueck.',
      token: 'studio:reset',
    });

    expect(
      resolveRemoteDangerousApprovalRequirement('studio', 'deploy', {
        releaseMode: 'schema-and-app',
      }),
    ).toEqual({
      reason: 'Remote-Deploy im Modus schema-and-app mutiert Laufzeit und Datenbankschema.',
      token: 'studio:deploy:schema-and-app',
    });
  });
});

describe('assertLoginFlow', () => {
  it('includes the HTTP status when login warmup returns a non-redirect response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body><h1>404 Not Found</h1></body></html>', {
        status: 404,
        headers: {
          'content-type': 'text/html',
        },
      }),
    );

    try {
      await expect(
        assertLoginFlow('studio', {
          SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        }),
      ).rejects.toThrow('Status 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('buildLocalProvisioningWorkerCheck', () => {
  it('skips the provisioning worker check for mock-auth profiles', () => {
    expect(buildLocalProvisioningWorkerCheck('local-builder', null, () => false)).toMatchObject({
      code: 'local_provisioning_worker_not_applicable',
      name: 'keycloak-provisioning-worker',
      status: 'skipped',
    });
  });

  it('returns a warning when the local provisioning worker state is missing', () => {
    expect(buildLocalProvisioningWorkerCheck('local-keycloak', null, () => false)).toMatchObject({
      code: 'local_keycloak_provisioning_worker_missing',
      name: 'keycloak-provisioning-worker',
      status: 'warn',
    });
  });

  it('returns a warning when the local provisioning worker process is stale', () => {
    expect(
      buildLocalProvisioningWorkerCheck(
        'local-keycloak',
        {
          command: 'tsx packages/auth-runtime/src/iam-instance-registry/worker.ts',
          launcher: 'local-provisioning-worker-runner',
          logFile: '/tmp/local-keycloak.worker.log',
          pid: 1234,
          profile: 'local-keycloak',
          startedAt: '2026-05-06T10:15:20.000Z',
        },
        () => false,
      ),
    ).toMatchObject({
      code: 'local_keycloak_provisioning_worker_stale',
      status: 'warn',
    });
  });

  it('returns ok when the local provisioning worker is running', () => {
    expect(
      buildLocalProvisioningWorkerCheck(
        'local-keycloak',
        {
          command: 'tsx packages/auth-runtime/src/iam-instance-registry/worker.ts',
          launcher: 'local-provisioning-worker-runner',
          logFile: '/tmp/local-keycloak.worker.log',
          pid: 1234,
          profile: 'local-keycloak',
          startedAt: '2026-05-06T10:15:20.000Z',
        },
        () => true,
      ),
    ).toMatchObject({
      code: 'local_keycloak_provisioning_worker_running',
      status: 'ok',
    });
  });
});

describe('decorateDoctorCheck', () => {
  it('derives tenant secret repair metadata from readiness diagnostics', () => {
    expect(
      decorateDoctorCheck({
        code: 'ready_failed',
        details: {
          payload: {
            checks: {
              diagnostics: {
                auth: {
                  invalid_secret_instance_ids: ['de-musterhausen'],
                  reason_code: 'tenant_auth_client_secret_missing',
                },
              },
            },
          },
        },
        message: 'Readiness antwortet mit 503.',
        name: 'health-ready',
        status: 'error',
      }),
    ).toMatchObject({
      driftClass: 'tenant_secrets',
      reasonCode: 'tenant_auth_client_secret_missing',
      recommendedAction: 'env:repair:local-keycloak',
      repairable: true,
    });
  });

  it('marks local identity drift as repairable with reconcile guidance', () => {
    expect(
      decorateDoctorCheck({
        code: 'local_instance_identity_drift',
        message: 'Identity drift',
        name: 'instance-identity',
        status: 'warn',
      }),
    ).toMatchObject({
      driftClass: 'instance_identity',
      reasonCode: 'instance_identity_drift',
      recommendedAction: 'env:reconcile:local-instance-registry',
      repairable: true,
    });
  });
});

describe('repairLocalRuntimeWithDeps', () => {
  it('runs migrate, reconcile, secret sync and postflight doctor in order', async () => {
    const calls: string[] = [];

    const result = await repairLocalRuntimeWithDeps(
      {
        preflightDoctor: async () => {
          calls.push('preflight');
          return {
            checks: [
              {
                code: 'goose_status_failed',
                message: 'pending',
                name: 'migration-status',
                reasonCode: 'schema_migration_drift',
                repairable: true,
                recommendedAction: 'env:migrate:local-keycloak',
                status: 'error',
              },
            ],
            generatedAt: '2026-05-31T12:00:00.000Z',
            profile: 'local-keycloak',
            status: 'error',
          };
        },
        runMigrate: async () => {
          calls.push('migrate');
        },
        reconcileInstanceRegistry: async () => {
          calls.push('reconcile');
        },
        syncTenantSecrets: async () => {
          calls.push('sync-secrets');
          return {
            attemptedInstanceIds: ['de-musterhausen'],
            errors: [],
            healedInstanceIds: ['de-musterhausen'],
            remainingAuthSecretInstanceIds: [],
            remainingTenantAdminSecretInstanceIds: [],
          };
        },
        postflightDoctor: async () => {
          calls.push('postflight');
          return {
            checks: [],
            generatedAt: '2026-05-31T12:01:00.000Z',
            profile: 'local-keycloak',
            status: 'ok',
          };
        },
      },
      { authoritative: false },
    );

    expect(calls).toEqual(['preflight', 'migrate', 'reconcile', 'sync-secrets', 'postflight']);
    expect(result.postflightReport.status).toBe('ok');
    expect(result.tenantSecretSync.healedInstanceIds).toEqual(['de-musterhausen']);
  });

  it('fails with a targeted message when identity drift remains in preserve mode', async () => {
    await expect(
      repairLocalRuntimeWithDeps(
        {
          preflightDoctor: async () => ({
            checks: [],
            generatedAt: '2026-05-31T12:00:00.000Z',
            profile: 'local-keycloak',
            status: 'ok',
          }),
          runMigrate: async () => {},
          reconcileInstanceRegistry: async () => {},
          syncTenantSecrets: async () => ({
            attemptedInstanceIds: [],
            errors: [],
            healedInstanceIds: [],
            remainingAuthSecretInstanceIds: [],
            remainingTenantAdminSecretInstanceIds: [],
          }),
          postflightDoctor: async () => ({
            checks: [
              {
                code: 'local_instance_identity_drift',
                message: 'drift remains',
                name: 'instance-identity',
                reasonCode: 'instance_identity_drift',
                recommendedAction: 'env:reconcile:local-instance-registry',
                repairable: true,
                status: 'warn',
              },
            ],
            generatedAt: '2026-05-31T12:01:00.000Z',
            profile: 'local-keycloak',
            status: 'warn',
          }),
        },
        { authoritative: false },
      ),
    ).rejects.toThrow('--authoritative');
  });
});

describe('verifyDbSchemaSnapshot', () => {
  it('detects missing and unexpected schema objects', () => {
    expect(
      verifyDbSchemaSnapshot(
        `
          CREATE TABLE public.actual_table (
            id uuid NOT NULL
          );
        `,
        `
          CREATE TABLE public.expected_table (
            id uuid NOT NULL
          );
        `,
      ),
    ).toEqual({
      contentDrift: false,
      ignoredSchemas: ['graphile_worker'],
      missingObjects: ['table:public.expected_table'],
      status: 'drift',
      unexpectedObjects: ['table:public.actual_table'],
    });
  });
});

describe('shouldRunLocalProvisioningWorker', () => {
  it('runs only for local keycloak profiles', () => {
    expect(shouldRunLocalProvisioningWorker('local-keycloak')).toBe(true);
    expect(shouldRunLocalProvisioningWorker('local-builder')).toBe(false);
    expect(shouldRunLocalProvisioningWorker('studio')).toBe(false);
  });
});

describe('shouldCheckLocalInstanceRegistryDriftBeforeCommand', () => {
  it('keeps drift checks for read-only startup commands only', () => {
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('up')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('update')).toBe(true);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('reconcile')).toBe(false);
    expect(shouldCheckLocalInstanceRegistryDriftBeforeCommand('migrate')).toBe(false);
  });
});

describe('requireLocalInstanceRegistryReconciliationInput', () => {
  it('throws when explicit reconcile config is incomplete', () => {
    expect(() =>
      requireLocalInstanceRegistryReconciliationInput({
        SVA_PARENT_DOMAIN: 'studio.example.org',
      }),
    ).toThrow('Lokaler Instanz-Registry-Abgleich erfordert SVA_PARENT_DOMAIN und SVA_ALLOWED_INSTANCE_IDS.');
  });
});

describe('buildKeycloakClientSecretCheck', () => {
  it('verifies auth, admin and provisioner clients when their secrets authenticate', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === 'https://keycloak.example/realms/platform/protocol/openid-connect/token') {
        return new Response(
          JSON.stringify({
            error: 'unauthorized_client',
            error_description: 'Client not enabled to retrieve service account',
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }

      if (
        url === 'https://keycloak.example/realms/master/protocol/openid-connect/token'
        || url === 'https://keycloak.example/realms/provisioning/protocol/openid-connect/token'
      ) {
        return new Response(JSON.stringify({ access_token: 'token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    try {
      await expect(
        buildKeycloakClientSecretCheck('local-keycloak', {
          SVA_AUTH_ISSUER: 'https://keycloak.example/realms/platform',
          SVA_AUTH_CLIENT_ID: 'studio-bff',
          SVA_AUTH_CLIENT_SECRET: 'auth-secret',
          KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
          KEYCLOAK_ADMIN_REALM: 'master',
          KEYCLOAK_ADMIN_CLIENT_ID: 'iam-service',
          KEYCLOAK_ADMIN_CLIENT_SECRET: 'admin-secret',
          KEYCLOAK_PROVISIONER_REALM: 'provisioning',
          KEYCLOAK_PROVISIONER_CLIENT_ID: 'provisioner',
          KEYCLOAK_PROVISIONER_CLIENT_SECRET: 'provisioner-secret',
        }),
      ).resolves.toMatchObject({
        code: 'keycloak_client_secrets_verified',
        name: 'keycloak-client-secrets',
        status: 'ok',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns an error when a client secret is rejected by Keycloak', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'Invalid client secret',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    );

    try {
      await expect(
        buildKeycloakClientSecretCheck('local-keycloak', {
          KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example',
          KEYCLOAK_ADMIN_REALM: 'master',
          KEYCLOAK_ADMIN_CLIENT_ID: 'iam-service',
          KEYCLOAK_ADMIN_CLIENT_SECRET: 'wrong-secret',
        }),
      ).resolves.toMatchObject({
        code: 'keycloak_client_secret_check_failed',
        name: 'keycloak-client-secrets',
        status: 'error',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('skips the check for mock-auth profiles', async () => {
    await expect(buildKeycloakClientSecretCheck('local-builder', {})).resolves.toMatchObject({
      code: 'keycloak_client_secrets_not_applicable',
      name: 'keycloak-client-secrets',
      status: 'skipped',
    });
  });
});

describe('waitForPostDeployStabilization', () => {
  it('waits for the default stabilization delay after deploy', async () => {
    const waitFn = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const delayMs = await waitForPostDeployStabilization({}, waitFn);

    expect(delayMs).toBe(5000);
    expect(waitFn).toHaveBeenCalledWith(5000);
  });

  it('skips the delay when it is disabled explicitly', async () => {
    const waitFn = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    const delayMs = await waitForPostDeployStabilization(
      {
        SVA_POST_DEPLOY_STABILIZATION_DELAY_MS: '0',
      },
      waitFn,
    );

    expect(delayMs).toBe(0);
    expect(waitFn).not.toHaveBeenCalled();
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

describe('waitForRemoteSmokeWarmup', () => {
  it('waits through transient remote smoke warmup failures', async () => {
    const runner = vi
      .fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValueOnce([
        createProbe({
          message: 'Erwartet HTTP 200, erhalten 404.',
          name: 'public-live',
          status: 'error',
          target: 'https://studio.smart-village.app/health/live',
        }),
      ])
      .mockResolvedValueOnce([
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-live',
          status: 'ok',
          target: 'https://studio.smart-village.app/health/live',
        }),
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-ready',
          status: 'ok',
          target: 'https://studio.smart-village.app/health/ready',
        }),
        createProbe({
          message: 'Probe erfolgreich mit HTTP 302.',
          name: 'public-auth-login',
          status: 'ok',
          target: 'https://studio.smart-village.app/auth/login',
        }),
      ]);

    await expect(
      waitForRemoteSmokeWarmup(
        {
          SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        },
        {
          maxAttempts: 2,
          retryDelayMs: 0,
          runner,
          runtimeProfile: 'studio',
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({ name: 'public-live', status: 'ok' }),
      expect.objectContaining({ name: 'public-ready', status: 'ok' }),
      expect.objectContaining({ name: 'public-auth-login', status: 'ok' }),
    ]);

    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('ignores non-blocking external probe failures while blocking warmup probes are still retryable', async () => {
    const runner = vi
      .fn<(env: NodeJS.ProcessEnv) => Promise<readonly AcceptanceProbeResult[]>>()
      .mockResolvedValueOnce([
        createProbe({
          message: 'Erwartet HTTP 200, erhalten 404.',
          name: 'public-live',
          status: 'error',
          target: 'https://studio.smart-village.app/health/live',
        }),
        createProbe({
          message: 'IAM-Instanzliste lieferte HTML statt JSON/API-Vertrag.',
          name: 'public-iam-instances',
          status: 'error',
          target: 'https://studio.smart-village.app/api/v1/iam/instances',
        }),
      ])
      .mockResolvedValueOnce([
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-live',
          status: 'ok',
          target: 'https://studio.smart-village.app/health/live',
        }),
        createProbe({
          message: 'Probe erfolgreich mit HTTP 200.',
          name: 'public-ready',
          status: 'ok',
          target: 'https://studio.smart-village.app/health/ready',
        }),
        createProbe({
          message: 'Probe erfolgreich mit HTTP 302.',
          name: 'public-auth-login',
          status: 'ok',
          target: 'https://studio.smart-village.app/auth/login',
        }),
        createProbe({
          message: 'IAM-Instanzliste lieferte HTML statt JSON/API-Vertrag.',
          name: 'public-iam-instances',
          status: 'error',
          target: 'https://studio.smart-village.app/api/v1/iam/instances',
        }),
      ]);

    await expect(
      waitForRemoteSmokeWarmup(
        {
          SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        },
        {
          maxAttempts: 2,
          retryDelayMs: 0,
          runner,
          runtimeProfile: 'studio',
        },
      ),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'public-live', status: 'ok' }),
        expect.objectContaining({ name: 'public-ready', status: 'ok' }),
        expect.objectContaining({ name: 'public-auth-login', status: 'ok' }),
        expect.objectContaining({ name: 'public-iam-instances', status: 'error' }),
      ]),
    );

    expect(runner).toHaveBeenCalledTimes(2);
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
      SVA_ALLOWED_INSTANCE_IDS: 'demo2',
    });

    expect(resolution.source).toBe('local_allowlist');
    expect(resolution.targets).toEqual([
      {
        authRealm: 'demo2',
        host: 'demo2.studio.example.org',
        instanceId: 'demo2',
      },
    ]);
  });

  it('uses configured tenant realm overrides for allowlist-derived tenant scopes', async () => {
    const resolution = await resolveTenantRuntimeTargets('studio', {
      SVA_PARENT_DOMAIN: 'studio.smart-village.app',
      SVA_ALLOWED_INSTANCE_IDS: 'hb-meinquartier',
      SVA_TENANT_REALM_OVERRIDES: 'hb-meinquartier=saas-hb-meinquartier',
    });

    expect(resolution).toEqual({
      source: 'legacy_allowlist_fallback',
      targets: [
        {
          authRealm: 'saas-hb-meinquartier',
          host: 'hb-meinquartier.studio.smart-village.app',
          instanceId: 'hb-meinquartier',
        },
      ],
    });
  });

  it('hydrates explicit remote tenant scopes with the registry auth realm when available', () => {
    expect(
      mergeExplicitTenantTargetsWithRegistry(
        [
          {
            authRealm: 'hb-meinquartier',
            host: 'hb-meinquartier.studio.smart-village.app',
            instanceId: 'hb-meinquartier',
          },
        ],
        [
          {
            authRealm: 'saas-hb-meinquartier',
            host: 'hb-meinquartier.studio.smart-village.app',
            instanceId: 'hb-meinquartier',
          },
        ]
      )
    ).toEqual([
      {
        authRealm: 'saas-hb-meinquartier',
        host: 'hb-meinquartier.studio.smart-village.app',
        instanceId: 'hb-meinquartier',
      },
    ]);
  });

  it('keeps the explicit tenant scope as fallback when the registry has no matching instance entry', () => {
    expect(
      mergeExplicitTenantTargetsWithRegistry(
        [
          {
            authRealm: 'hb-meinquartier',
            host: 'hb-meinquartier.studio.smart-village.app',
            instanceId: 'hb-meinquartier',
          },
        ],
        [
          {
            authRealm: 'bb-guben',
            host: 'bb-guben.studio.smart-village.app',
            instanceId: 'bb-guben',
          },
        ]
      )
    ).toEqual([
      {
        authRealm: 'hb-meinquartier',
          host: 'hb-meinquartier.studio.smart-village.app',
          instanceId: 'hb-meinquartier',
        },
    ]);
  });

  it('parses tenant realm overrides from env syntax', () => {
    expect(
      Array.from(
        parseTenantRealmOverrides('hb-meinquartier=saas-hb-meinquartier,de-musterhausen=de-musterhausen').entries()
      )
    ).toEqual([
      ['hb-meinquartier', 'saas-hb-meinquartier'],
      ['de-musterhausen', 'de-musterhausen'],
    ]);
  });
});

describe('selectReleaseBlockingTenantTargets', () => {
  const tenantTargets = [
    {
      authRealm: 'saas-hb-meinquartier',
      host: 'hb-meinquartier.studio.smart-village.app',
      instanceId: 'hb-meinquartier',
    },
    {
      authRealm: 'de-studio-sandbox',
      host: 'de-studio-sandbox.studio.smart-village.app',
      instanceId: 'de-studio-sandbox',
    },
  ] as const;

  it('keeps only de-studio-sandbox as a release-blocking tenant on studio', () => {
    expect(selectReleaseBlockingTenantTargets('studio', tenantTargets)).toEqual([
      {
        authRealm: 'de-studio-sandbox',
        host: 'de-studio-sandbox.studio.smart-village.app',
        instanceId: 'de-studio-sandbox',
      },
    ]);
  });

  it('keeps all tenant targets on non-studio profiles', () => {
    expect(selectReleaseBlockingTenantTargets('local-keycloak', tenantTargets)).toEqual(tenantTargets);
  });
});

describe('selectSmokeTenantTargets', () => {
  const tenantTargets = [
    {
      authRealm: 'bb-guben',
      host: 'bb-guben.studio.smart-village.app',
      instanceId: 'bb-guben',
    },
    {
      authRealm: 'de-studio-sandbox',
      host: 'de-studio-sandbox.studio.smart-village.app',
      instanceId: 'de-studio-sandbox',
    },
    {
      authRealm: 'saas-hb-meinquartier',
      host: 'hb-meinquartier.studio.smart-village.app',
      instanceId: 'hb-meinquartier',
    },
  ] as const;

  it('keeps explicit operator tenant scopes on studio smoke runs without release mode', () => {
    expect(
      selectSmokeTenantTargets('studio', tenantTargets, {
        env: {
          SVA_TENANT_SCOPE_INSTANCE_IDS: 'bb-guben',
        },
        source: 'explicit_env',
      })
    ).toEqual(tenantTargets);
  });

  it('keeps only de-studio-sandbox as a blocking tenant for studio acceptance release runs', () => {
    expect(
      selectSmokeTenantTargets('studio', tenantTargets, {
        env: {
          SVA_ACCEPTANCE_RELEASE_MODE: 'app-only',
        },
        source: 'registry',
      })
    ).toEqual([
      {
        authRealm: 'de-studio-sandbox',
        host: 'de-studio-sandbox.studio.smart-village.app',
        instanceId: 'de-studio-sandbox',
      },
    ]);
  });

  it('fails when the blocking studio tenant is missing during an acceptance release run', () => {
    expect(() =>
      selectSmokeTenantTargets(
        'studio',
        [
          {
            authRealm: 'bb-guben',
            host: 'bb-guben.studio.smart-village.app',
            instanceId: 'bb-guben',
          },
        ],
        {
          env: {
            SVA_ACCEPTANCE_RELEASE_MODE: 'app-only',
          },
          source: 'registry',
        }
      )
    ).toThrow(/de-studio-sandbox/u);
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
