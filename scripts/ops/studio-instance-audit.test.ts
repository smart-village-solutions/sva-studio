import { describe, expect, it, vi } from 'vitest';

import { inspectLocalStudioIam } from './studio-instance-audit/local-iam.ts';
import { loadAuditTargets } from './studio-instance-audit/registry.ts';
import { inspectTenantSecrets } from './studio-instance-audit/secrets.ts';
import { runHttpChecks } from './studio-instance-audit/http-checks.ts';
import { assertStudioAuditRuntime } from './studio-instance-audit/runtime.ts';
import { runStudioInstanceAuditCli } from './studio-instance-audit.ts';

describe('runStudioInstanceAuditCli', () => {
  it('returns exit code 0 when the audit succeeds', async () => {
    const executeAudit = vi.fn(async () => ({
      outputPath: '/tmp/report.html',
      result: {
        generatedAt: '2026-06-10T12:00:00.000Z',
        instances: [],
        profile: 'studio',
        status: 'pass' as const,
      },
    }));

    await expect(
      runStudioInstanceAuditCli([], {
        executeAudit,
        logger: { error: vi.fn(), info: vi.fn() },
      }),
    ).resolves.toBe(0);
  });
});

describe('assertStudioAuditRuntime', () => {
  it('accepts the studio profile when required tools are available', () => {
    const rootDir = process.cwd();

    expect(
      assertStudioAuditRuntime({
        commandExists: () => true,
        env: { SVA_RUNTIME_PROFILE: 'studio' },
        rootDir,
      }),
    ).toMatchObject({
      profile: 'studio',
      reportsDir: `${rootDir}/docs/reports`,
      rootDir,
    });
  });
});

describe('loadAuditTargets', () => {
  it('returns only active instances with required host and realm fields', async () => {
    const queryRows = vi.fn(async () =>
      [
        {
          auth_client_secret_configured: true,
          auth_client_id: 'sva-studio',
          auth_realm: 'bb-guben',
          display_name: 'Guben',
          instance_id: 'bb-guben',
          parent_domain: 'studio.smart-village.app',
          primary_hostname: 'bb-guben.studio.smart-village.app',
          status: 'active',
          tenant_admin_client_id: 'bb-guben-admin',
          tenant_admin_client_secret_configured: true,
          tenant_admin_email: 'admin@example.com',
          tenant_admin_first_name: 'Ada',
          tenant_admin_last_name: 'Admin',
          tenant_admin_username: 'ada.admin',
        },
      ] as const,
    );

    await expect(loadAuditTargets({ queryRows })).resolves.toEqual([
      {
        authClientSecretConfigured: true,
        authClientId: 'sva-studio',
        authRealm: 'bb-guben',
        displayName: 'Guben',
        instanceId: 'bb-guben',
        parentDomain: 'studio.smart-village.app',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        status: 'active',
        tenantAdminClientId: 'bb-guben-admin',
        tenantAdminClientSecretConfigured: true,
        tenantAdminEmail: 'admin@example.com',
        tenantAdminFirstName: 'Ada',
        tenantAdminLastName: 'Admin',
        tenantAdminUsername: 'ada.admin',
      },
    ]);
  });
});

describe('runHttpChecks', () => {
  it('passes an abort timeout signal into both reachability probes', async () => {
    const fetchImplMock = vi.fn(async () => new Response(null, { status: 200 }));
    const fetchImpl = fetchImplMock as typeof fetch;

    await runHttpChecks(
      {
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
      },
      {
        fetchImpl,
        timeoutMs: 1234,
      },
    );

    expect(fetchImplMock).toHaveBeenCalledTimes(2);
    for (const [, requestInit] of fetchImplMock.mock
      .calls as unknown as Array<[string, RequestInit | undefined]>) {
      expect(requestInit).toMatchObject({
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      });
    }
  });
});

describe('studio instance audit sql escaping', () => {
  it('escapes instance ids in tenant secret queries', async () => {
    let receivedSql = '';
    const queryOne: Parameters<typeof inspectTenantSecrets>[0]['queryOne'] = async <T extends Record<string, unknown>>(
      sql: string
    ) => {
      receivedSql = sql;
      return null;
    };

    await inspectTenantSecrets({ queryOne }, `tenant' OR '1'='1`);

    expect(receivedSql).toContain(`WHERE id = 'tenant'' OR ''1''=''1'`);
  });

  it('escapes instance ids in local iam queries', async () => {
    let receivedSql = '';
    const queryOne: Parameters<typeof inspectLocalStudioIam>[0]['queryOne'] = async <T extends Record<string, unknown>>(
      sql: string
    ) => {
      receivedSql = sql;
      return { count: 0 } as unknown as T;
    };

    await inspectLocalStudioIam({ queryOne }, `tenant' OR '1'='1`);

    expect(receivedSql).toContain(`WHERE ar.instance_id = 'tenant'' OR ''1''=''1'`);
  });
});
