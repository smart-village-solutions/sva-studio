import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const backupModuleUrl = (name: string): string =>
  pathToFileURL(resolve(import.meta.dirname, '../../../deploy/backup-agent', name)).href;

type RuntimeConfig = {
  operationState: { active: boolean; terminalRequests: Set<string> };
  routePaths: { request: string; restore: string; capability: string };
  targets: Record<'staging' | 'prod', { host: string }>;
  deriveWasteDatabaseName: (instanceId: string) => string;
};
type Execution = (request: Record<string, unknown>) => Promise<void>;
type RuntimeIO = {
  runCommand: (command: string, args: string[], options?: Record<string, unknown>) => Promise<void>;
  runCapture: (
    command: string,
    args: string[],
    options?: Record<string, unknown>
  ) => Promise<string>;
  runSql: (target: unknown, env: unknown, sql: string) => Promise<string>;
  sha256: (path: string) => Promise<string>;
  readSecret: (name: string) => Promise<string>;
  s3Env: (target: unknown) => Promise<Record<string, string>>;
  uploadJson: (target: unknown, key: string, value: unknown) => Promise<void>;
};
type Authorization = { bbPrignitzWasteImportSha256: string };
type ArchiveWriter = {
  writeCompatibleRestoreSql: (source: string, target: string) => Promise<void>;
};
type ImportWriter = {
  writeWasteImportSql: (source: string, target: string, owner: string) => Promise<void>;
};

import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { executeBackupForIntegration } = (await import(backupModuleUrl('backup-execution.mjs'))) as {
  executeBackupForIntegration: Execution;
};
const { executeRestoreForIntegration } = (await import(
  backupModuleUrl('restore-execution.mjs')
)) as { executeRestoreForIntegration: Execution };
const { executeWasteImportForIntegration } = (await import(
  backupModuleUrl('waste-import-execution.mjs')
)) as { executeWasteImportForIntegration: Execution };
const { deriveWasteDatabaseName, operationState } = (await import(
  backupModuleUrl('runtime-config.mjs')
)) as RuntimeConfig;
const { bbPrignitzWasteImportSha256 } = (await import(
  backupModuleUrl('request-authorization.mjs')
)) as Authorization;
const { runCommand, runCapture, runSql, sha256, uploadJson } = (await import(
  backupModuleUrl('runtime-io.mjs')
)) as RuntimeIO;

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(async () => undefined),
  rm: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 42 })),
  writeFile: vi.fn(async () => undefined),
}));
vi.mock('../../../deploy/backup-agent/runtime-io.mjs', async (original) => ({
  ...(await original<RuntimeIO>()),
  runCommand: vi.fn(async () => undefined),
  runCapture: vi.fn(async () => ''),
  runSql: vi.fn(async () => ''),
  sha256: vi.fn(async () => ''),
  readSecret: vi.fn(async () => 'fixture-password'),
  s3Env: vi.fn(async () => ({})),
  uploadJson: vi.fn(async () => undefined),
}));
vi.mock('../../../deploy/backup-agent/archive-operations.mjs', async (original) => ({
  ...(await original<ArchiveWriter>()),
  writeCompatibleRestoreSql: vi.fn(async () => undefined),
}));
vi.mock('../../../deploy/backup-agent/restore-data.mjs', async (original) => ({
  ...(await original<ImportWriter>()),
  writeWasteImportSql: vi.fn(async () => undefined),
}));

const trace: string[] = [];
const inventory = {
  waste_tours: 65,
  waste_cities: 596,
  waste_regions: 14,
  waste_streets: 1438,
  waste_fractions: 7,
  waste_holiday_rules: 120,
  waste_house_numbers: 1438,
  waste_tour_date_shifts: 0,
  waste_global_date_shifts: 0,
  waste_location_tour_links: 2938,
  waste_collection_locations: 718,
  waste_custom_recurrence_presets: 0,
  waste_location_tour_pickup_dates: 160,
};
const probe = {
  databaseConnect: true,
  roleMembership: true,
  runtimeUserSchemaUsage: true,
  runtimeRoleSchemaUsage: true,
  runtimeUserTablesReady: true,
  runtimeRoleTablesReady: true,
  runtimeUserSequencesReady: true,
  runtimeRoleSequencesReady: true,
};
const request = (database = 'studio') => ({
  version: 1,
  action: 'restore-and-verify-v1',
  requestId: 'fixture-operation-123',
  environment: 'staging',
  database,
  ...(database === 'waste' ? { tenantInstanceId: 'fixture-town' } : {}),
  sourceObjectKey: 'staging/archive/fixture.dump',
  sourceSha256: 'b'.repeat(64),
  maintenanceWindowReference: 'INC-42',
  deployImageDigest: `sha256:${'a'.repeat(64)}`,
});
const importRequest = () => ({
  ...request('waste'),
  action: 'import-waste-data-v1',
  sourceSha256: bbPrignitzWasteImportSha256,
});
const results = () =>
  vi
    .mocked(uploadJson)
    .mock.calls.filter(([, key]) => key.includes('/results/'))
    .map(
      ([, , value]) =>
        value as {
          status: string;
          mutationStarted?: boolean;
          runtimeConnectLocked?: boolean;
          errorCode?: string;
          steps: Array<{ step: string }>;
        }
    );
const assertReleased = (id: string) => {
  expect(operationState.active).toBe(false);
  expect(operationState.terminalRequests.has(id)).toBe(true);
};

beforeEach(() => {
  for (const mock of [runCommand, runCapture, runSql, sha256, uploadJson]) {
    if (!vi.isMockFunction(mock)) throw new Error('External IO must be mocked before execution');
  }
  vi.clearAllMocks();
  trace.length = 0;
  vi.stubEnv('BACKUP_AGENT_IMAGE_REF', 'fixture@sha256:synthetic');
  vi.stubEnv('BACKUP_AGENT_TOOL_VERSIONS', '{}');
  vi.stubEnv('BACKUP_S3_ENDPOINT', 'http://fixture.invalid');
  operationState.active = true;
  operationState.terminalRequests.clear();
  vi.mocked(runCommand).mockImplementation(async (command, args) => {
    trace.push(`${command}:${args.join(' ')}`);
  });
  vi.mocked(sha256).mockImplementation(async (file) => {
    trace.push(`hash:${file.split('/').slice(-1)[0]}`);
    if (file.endsWith('source.dump')) return 'b'.repeat(64);
    if (file.endsWith('source.sql')) return bbPrignitzWasteImportSha256;
    return 'c'.repeat(64);
  });
  vi.mocked(uploadJson).mockImplementation(async (_target, key) => {
    trace.push(`evidence:${key}`);
  });
  vi.mocked(runCapture).mockImplementation(async (command, args) => {
    if (command === 'pg_restore' && args.includes('--list'))
      return 'TABLE public goose_db_version\nTABLE iam instances\nTABLE ssf server_settings\nTABLE ssf server_locales\nTABLE ssf tenant_settings\nTABLE ssf tenant_locales\nTABLE ssf authorization_projections\nTABLE public waste_regions\nTABLE public waste_collection_locations\nTABLE public waste_tours';
    if (command === 'pg_restore')
      return 'COPY public.goose_db_version (id, version_id, is_applied) FROM stdin;\n1\t12\tt\n\\.\n';
    if (args.some((arg) => arg.includes('FROM iam.instance_waste_provisioning')))
      return JSON.stringify([
        {
          instanceId: 'fixture-town',
          databaseName: deriveWasteDatabaseName('fixture-town'),
          status: 'ready',
        },
      ]);
    return '1';
  });
  vi.mocked(runSql).mockImplementation(async (_target, _env, sql) => {
    trace.push(`sql:${sql}`);
    if (sql.includes("'publicRuntimeSchemaUsage'"))
      return JSON.stringify({
        databaseConnect: true,
        runtimeUserSchemaUsage: true,
        runtimeUserTablesReady: true,
        publicRuntimeSchemaUsage: true,
        publicRuntimeTablesReadable: true,
        publicRuntimeReminderWrites: true,
      });
    if (sql.includes("'databaseConnect'")) return JSON.stringify(probe);
    if (sql.includes('pg_stat_activity') || sql.includes('COALESCE(sum')) return '0';
    if (sql.includes('max(version_id)')) return '12';
    if (sql.includes("table_schema = 'ssf'")) return '5';
    if (sql.includes('to_regclass')) return 't';
    if (sql.includes("'assignments'"))
      return JSON.stringify({ assignments: 160, assignmentLocations: 160 });
    if (sql.includes("'waste_tours'")) return JSON.stringify(inventory);
    if (sql.includes('count(*)')) return '13';
    return '';
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('backup execution evidence and cleanup boundaries without external IO', () => {
  it('retains backup transfer order, evidence and slot release', async () => {
    const body = request();
    await executeBackupForIntegration(body);
    expect(results().slice(-1)[0]?.status).toBe('succeeded');
    expect(
      results()
        .slice(-1)[0]
        ?.steps.map(({ step }) => step)
    ).toEqual(['pg_dump', 'upload', 'download', 'size-and-checksum-verify', 'archive-validate']);
    expect(vi.mocked(runCommand).mock.calls.map(([command]) => command)).toEqual([
      'pg_dump',
      'aws',
      'aws',
      'aws',
      'pg_restore',
    ]);
    expect(stat).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it.each(['studio', 'ssf', 'waste'])(
    'keeps %s restore safety before mutation and postchecks after principal repair',
    async (database) => {
      const body = request(database);
      await executeRestoreForIntegration(body);
      expect(results().slice(-1)[0]).toMatchObject({
        status: 'database-restored',
        mutationStarted: true,
      });
      const safety = trace.findIndex((step) =>
        step.includes('evidence:control/restores/safety-backups/')
      );
      const mutation = trace.findIndex(
        (step) => step.startsWith('sql:') && step.includes('DROP SCHEMA')
      );
      expect(safety).toBeGreaterThan(-1);
      expect(mutation).toBeGreaterThan(safety);
      const steps =
        results()
          .slice(-1)[0]
          ?.steps.map(({ step }) => step) ?? [];
      expect(steps.indexOf('runtime-principal-probe')).toBeLessThan(
        steps.indexOf('database-postchecks')
      );
      const safetyUpload = vi
        .mocked(runCommand)
        .mock.calls.find(
          ([command, args]) =>
            command === 'aws' && args.some((arg) => arg.includes('safety-before-restore'))
        );
      expect(safetyUpload?.[2]).toMatchObject({ timeoutMs: 5 * 60_000 });
      expect(rm).toHaveBeenCalledOnce();
      assertReleased(body.requestId);
    }
  );

  it('reports a pre-mutation checksum failure and cleans up without schema changes', async () => {
    vi.mocked(sha256).mockResolvedValueOnce('wrong');
    const body = request();
    await executeRestoreForIntegration(body);
    expect(results().slice(-1)[0]).toMatchObject({
      status: 'failed',
      mutationStarted: false,
      errorCode: 'checksum_mismatch',
    });
    expect(trace.some((step) => step.includes('DROP SCHEMA'))).toBe(false);
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('retains mutation evidence when restore execution fails after schema reset', async () => {
    vi.mocked(runCommand).mockImplementation(async (command, args) => {
      if (command === 'psql' && args.includes('--file')) throw new Error('psql_failed_1:fixture');
    });
    const body = request();
    await executeRestoreForIntegration(body);
    expect(results().slice(-1)[0]).toMatchObject({
      status: 'failed',
      mutationStarted: true,
      errorCode: 'psql_failed_1',
    });
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('releases the restore slot and cleans up even when result persistence fails', async () => {
    vi.mocked(uploadJson).mockImplementation(async (_target, key) => {
      if (key.includes('/results/')) throw new Error('result-unavailable');
    });
    const body = request();
    await expect(executeRestoreForIntegration(body)).rejects.toThrow('result-unavailable');
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('preserves pre-try restore setup failure boundaries', async () => {
    vi.stubEnv('BACKUP_AGENT_IMAGE_REF', '');
    const body = request();
    await expect(executeRestoreForIntegration(body)).rejects.toThrow(
      'BACKUP_AGENT_IMAGE_REF is required'
    );
    expect(mkdir).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
    expect(operationState.active).toBe(true);
    expect(operationState.terminalRequests.size).toBe(0);
  });

  it('retains waste import success, backfill and principal evidence', async () => {
    const body = importRequest();
    await executeWasteImportForIntegration(body);
    expect(results().slice(-1)[0]).toMatchObject({
      status: 'waste-data-imported',
      mutationStarted: true,
    });
    expect(
      results()
        .slice(-1)[0]
        ?.steps.map(({ step }) => step)
    ).toContain('legacy-pickup-backfill');
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('unlocks waste access only on a failure before mutation', async () => {
    const implementation = vi.mocked(runSql).getMockImplementation();
    if (!implementation) throw new Error('Missing SQL fixture implementation');
    vi.mocked(runSql).mockImplementation(async (target, env, sql) =>
      sql.includes('COALESCE(sum') ? '1' : implementation(target, env, sql)
    );
    const body = importRequest();
    await executeWasteImportForIntegration(body);
    expect(results().slice(-1)[0]).toMatchObject({
      status: 'failed',
      mutationStarted: false,
      runtimeConnectLocked: false,
      errorCode: 'waste_import_target_not_empty',
    });
    expect(
      trace.some((step) => step.startsWith('sql:') && step.includes('GRANT CONNECT ON DATABASE'))
    ).toBe(true);
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('keeps the waste connect lock authoritative after mutation has started', async () => {
    vi.mocked(runCommand).mockImplementation(async (command, args) => {
      if (command === 'psql' && args.includes('--single-transaction'))
        throw new Error('psql_failed_1:fixture');
    });
    const body = importRequest();
    await executeWasteImportForIntegration(body);
    expect(results().slice(-1)[0]).toMatchObject({
      status: 'failed',
      mutationStarted: true,
      runtimeConnectLocked: true,
    });
    expect(
      trace.some((step) => step.startsWith('sql:') && step.includes('GRANT CONNECT ON DATABASE'))
    ).toBe(false);
    expect(rm).toHaveBeenCalledOnce();
    assertReleased(body.requestId);
  });

  it('releases the waste slot even if both target discovery and failure persistence fail', async () => {
    vi.mocked(runCapture).mockRejectedValueOnce(new Error('inventory-unavailable'));
    vi.mocked(uploadJson).mockRejectedValueOnce(new Error('result-unavailable'));
    const body = importRequest();
    await executeWasteImportForIntegration(body);
    expect(mkdir).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
    assertReleased(body.requestId);
  });
});
