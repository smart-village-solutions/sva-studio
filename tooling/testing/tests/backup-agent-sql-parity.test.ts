import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const backupModuleUrl = (name: string): string =>
  pathToFileURL(resolve(import.meta.dirname, '../../../deploy/backup-agent', name)).href;

import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Captured byte hashes from agent.mjs at 79816d23c, before responsibility extraction.
const fixtures = [
  {
    environment: 'staging',
    database: 'studio',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: 'b3393ed77082cf915a646698cf7009d38be955ae63d7bdfd38e6daa37ffd9895',
  },
  {
    environment: 'staging',
    database: 'studio',
    name: 'runtimePrincipalProbeSql',
    sha256: 'd765e4d6f0f82556077987037654e87e99fa2b7de1f05561203411a9a0fb770f',
  },
  {
    environment: 'staging',
    database: 'ssf',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: 'd7c877cb719e173e2934fd65a7af28513c5ef0591c0aa827f4977c48b595ffc3',
  },
  {
    environment: 'staging',
    database: 'ssf',
    name: 'runtimePrincipalProbeSql',
    sha256: '1756b44711e0f1de0278b953eed159be60c9c521c641e583a4c75a436a6cf6e4',
  },
  {
    environment: 'staging',
    database: 'ssf',
    name: 'buildSsfRuntimePrincipalReconciliationSql',
    sha256: 'd7c877cb719e173e2934fd65a7af28513c5ef0591c0aa827f4977c48b595ffc3',
  },
  {
    environment: 'staging',
    database: 'ssf',
    name: 'ssfRuntimePrincipalProbeSql',
    sha256: '1756b44711e0f1de0278b953eed159be60c9c521c641e583a4c75a436a6cf6e4',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: '50b51d54ee1cdb5fcfc66a70448838d96dd0a4f7876f8c8ec9d4f53fa43bcb29',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'runtimePrincipalProbeSql',
    sha256: '3ccb37f315c1f6c75b096ab8de32004c92407eed8a40af453dc2d6e466fac3f4',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'buildWasteRuntimePrincipalReconciliationSql',
    sha256: '50b51d54ee1cdb5fcfc66a70448838d96dd0a4f7876f8c8ec9d4f53fa43bcb29',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'wasteRuntimePrincipalProbeSql',
    sha256: '3ccb37f315c1f6c75b096ab8de32004c92407eed8a40af453dc2d6e466fac3f4',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'wasteRuntimeConnectLockSql',
    locked: false,
    sha256: '3445d23aec060905a1ed5f9a30fd17fa49ae20ffb8c221ae39c71a948095940e',
  },
  {
    environment: 'staging',
    database: 'waste',
    name: 'wasteRuntimeConnectLockSql',
    locked: true,
    sha256: '2c31ca43fc25c208d52f2fe1126a74ef0b5e45609f31789ad98650c026386b01',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: '1fb20495389466be60a325e3367f2c4b86b37312811b5d7b44eb5524dfd479b1',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'runtimePrincipalProbeSql',
    sha256: 'd6f9a7264827062f111cfe519fadee59f2e487ec7282ef4e938f44af4420933e',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'buildWasteRuntimePrincipalReconciliationSql',
    sha256: '1fb20495389466be60a325e3367f2c4b86b37312811b5d7b44eb5524dfd479b1',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'wasteRuntimePrincipalProbeSql',
    sha256: 'd6f9a7264827062f111cfe519fadee59f2e487ec7282ef4e938f44af4420933e',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'wasteRuntimeConnectLockSql',
    locked: false,
    sha256: '832af1e771d24de645a394a424bbaf0349aebc4c377d166a687907d46ec65a17',
  },
  {
    environment: 'staging',
    database: 'waste-restore',
    name: 'wasteRuntimeConnectLockSql',
    locked: true,
    sha256: 'd87d4f82de44f52fab982bfae3b59212ef4dc140adc4be6d75861b3a9fa30ac9',
  },
  {
    environment: 'prod',
    database: 'studio',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: 'b3393ed77082cf915a646698cf7009d38be955ae63d7bdfd38e6daa37ffd9895',
  },
  {
    environment: 'prod',
    database: 'studio',
    name: 'runtimePrincipalProbeSql',
    sha256: 'd765e4d6f0f82556077987037654e87e99fa2b7de1f05561203411a9a0fb770f',
  },
  {
    environment: 'prod',
    database: 'ssf',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: 'd7c877cb719e173e2934fd65a7af28513c5ef0591c0aa827f4977c48b595ffc3',
  },
  {
    environment: 'prod',
    database: 'ssf',
    name: 'runtimePrincipalProbeSql',
    sha256: '1756b44711e0f1de0278b953eed159be60c9c521c641e583a4c75a436a6cf6e4',
  },
  {
    environment: 'prod',
    database: 'ssf',
    name: 'buildSsfRuntimePrincipalReconciliationSql',
    sha256: 'd7c877cb719e173e2934fd65a7af28513c5ef0591c0aa827f4977c48b595ffc3',
  },
  {
    environment: 'prod',
    database: 'ssf',
    name: 'ssfRuntimePrincipalProbeSql',
    sha256: '1756b44711e0f1de0278b953eed159be60c9c521c641e583a4c75a436a6cf6e4',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: '50b51d54ee1cdb5fcfc66a70448838d96dd0a4f7876f8c8ec9d4f53fa43bcb29',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'runtimePrincipalProbeSql',
    sha256: '3ccb37f315c1f6c75b096ab8de32004c92407eed8a40af453dc2d6e466fac3f4',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'buildWasteRuntimePrincipalReconciliationSql',
    sha256: '50b51d54ee1cdb5fcfc66a70448838d96dd0a4f7876f8c8ec9d4f53fa43bcb29',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'wasteRuntimePrincipalProbeSql',
    sha256: '3ccb37f315c1f6c75b096ab8de32004c92407eed8a40af453dc2d6e466fac3f4',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'wasteRuntimeConnectLockSql',
    locked: false,
    sha256: '3445d23aec060905a1ed5f9a30fd17fa49ae20ffb8c221ae39c71a948095940e',
  },
  {
    environment: 'prod',
    database: 'waste',
    name: 'wasteRuntimeConnectLockSql',
    locked: true,
    sha256: '2c31ca43fc25c208d52f2fe1126a74ef0b5e45609f31789ad98650c026386b01',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'buildRuntimePrincipalReconciliationSql',
    sha256: '1fb20495389466be60a325e3367f2c4b86b37312811b5d7b44eb5524dfd479b1',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'runtimePrincipalProbeSql',
    sha256: 'd6f9a7264827062f111cfe519fadee59f2e487ec7282ef4e938f44af4420933e',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'buildWasteRuntimePrincipalReconciliationSql',
    sha256: '1fb20495389466be60a325e3367f2c4b86b37312811b5d7b44eb5524dfd479b1',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'wasteRuntimePrincipalProbeSql',
    sha256: 'd6f9a7264827062f111cfe519fadee59f2e487ec7282ef4e938f44af4420933e',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'wasteRuntimeConnectLockSql',
    locked: false,
    sha256: '832af1e771d24de645a394a424bbaf0349aebc4c377d166a687907d46ec65a17',
  },
  {
    environment: 'prod',
    database: 'waste-restore',
    name: 'wasteRuntimeConnectLockSql',
    locked: true,
    sha256: 'd87d4f82de44f52fab982bfae3b59212ef4dc140adc4be6d75861b3a9fa30ac9',
  },
  {
    name: 'restoreSchemaResetSql',
    owner: 'fixture"owner',
    sha256: '2be10448cba4667d7eaa33bf9b39ac80d1d4460c0a93f4cd6a94e196b0982d49',
  },
  {
    name: 'ssfRestoreSchemaResetSql',
    owner: 'fixture"owner',
    sha256: '0a84baaebf62d26a94671e6bed0bd0a92d058b7bcd81797675a43486a4d54e43',
  },
  {
    name: 'wasteRestoreSchemaResetSql',
    owner: 'fixture"owner',
    sha256: '9046a6919fee7c9e5ec3a94120ca9c4acb97a2ab2aa431f85629f4047dd36438',
  },
  {
    name: 'wasteImportBackfillSql',
    owner: 'fixture_owner',
    sha256: '79ba57863def9c727cc3db03e3884c112b6c32c9ece6ad88bfe7270e85e0f8dd',
  },
] as const;

type SqlBuilder = (...args: unknown[]) => string;
type DatabaseTarget = Record<string, unknown>;
type SqlApi = {
  deriveWasteInventoryTarget: (
    environment: string,
    inventory: { instanceId: string; databaseName: string; status: string },
    operation: string
  ) => DatabaseTarget;
  deriveWasteDatabaseName: (id: string) => string;
  resolveDatabaseTarget: (environment: string, database?: string) => DatabaseTarget;
  buildRuntimePrincipalReconciliationSql: (target: DatabaseTarget) => string;
  wasteRuntimeConnectLockSql: (target: DatabaseTarget, locked: boolean) => string;
  wasteImportBackfillSql: (owner: string) => string;
};
let api: SqlApi;
let builders: Record<string, SqlBuilder>;

beforeAll(async () => {
  for (const prefix of ['BACKUP_STAGING', 'BACKUP_PROD']) {
    vi.stubEnv(`${prefix}_POSTGRES_DB`, 'sva_studio');
    vi.stubEnv(`${prefix}_SSF_POSTGRES_DB`, 'sva_studio_ssf');
    vi.stubEnv(`${prefix}_SSF_RUNTIME_USER`, 'sva_ssf_runtime');
  }
  vi.resetModules();
  api = Object.assign(
    {},
    await import(backupModuleUrl('runtime-config.mjs')),
    await import(backupModuleUrl('principal-reconciliation.mjs')),
    await import(backupModuleUrl('principal-probes.mjs')),
    await import(backupModuleUrl('restore-data.mjs'))
  ) as SqlApi;
  builders = api as unknown as Record<string, SqlBuilder>;
});
afterAll(() => vi.unstubAllEnvs());

describe('backup SQL byte parity with the pre-extraction agent', () => {
  it.each(fixtures)('$name $environment $database $locked $owner', (fixture) => {
    let args: unknown[];
    if ('owner' in fixture) {
      args = [fixture.owner];
    } else {
      const target = fixture.database.startsWith('waste')
        ? api.deriveWasteInventoryTarget(
            fixture.environment,
            {
              instanceId: 'fixture-town',
              databaseName: api.deriveWasteDatabaseName('fixture-town'),
              status: 'ready',
            },
            fixture.database.endsWith('restore') ? 'restore' : 'backup'
          )
        : api.resolveDatabaseTarget(fixture.environment, fixture.database);
      args = 'locked' in fixture ? [target, fixture.locked] : [target];
    }
    const sql = builders[fixture.name](...args);
    expect(createHash('sha256').update(sql).digest('hex')).toBe(fixture.sha256);
  });

  it('retains target and identifier rejection before returning SQL', () => {
    const studio = api.resolveDatabaseTarget('staging');
    expect(() =>
      api.buildRuntimePrincipalReconciliationSql({ ...studio, runtimeUser: 'foreign' })
    ).toThrow('runtime_principal_target_invalid');
    expect(() => api.wasteRuntimeConnectLockSql(studio, true)).toThrow(
      'runtime_principal_target_invalid'
    );
    expect(() => api.wasteImportBackfillSql('owner"; DROP ROLE')).toThrow(
      'runtime_principal_target_invalid'
    );
  });
});
