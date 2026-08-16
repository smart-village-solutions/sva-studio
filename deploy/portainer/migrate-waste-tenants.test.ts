import { describe, expect, it, vi } from 'vitest';

const {
  migrateWasteTenantDatabase,
  migrateWasteTenantDatabases,
  parseDatabasePort,
  validateWasteTenantMigrations,
  wasteTenantMigrations,
} = await import('./migrate-waste-tenants.mjs');

const migrationId = '20260816_01_add_waste_city_postal_code';
const tourShiftMigrationId = '20260816_02_tour_date_shift_date_contract';

const namesFor = (instanceId: string) => ({
  appRole: `${instanceId}_app`,
  database: `${instanceId}_db`,
  migratorRole: `${instanceId}_migrator`,
  ownerRole: `${instanceId}_owner`,
  publicAppRole: `${instanceId}_public`,
});

const createTenantClient = ({
  appliedMigrationIds = [],
  failMessage = 'database_failure',
  failOnSql,
  tourShiftVerificationSatisfied = true,
  verificationSatisfied = true,
}: {
  readonly appliedMigrationIds?: readonly string[];
  readonly failMessage?: string;
  readonly failOnSql?: string;
  readonly tourShiftVerificationSatisfied?: boolean;
  readonly verificationSatisfied?: boolean;
} = {}) => ({
  end: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(async (sql: string) => {
    if (failOnSql && sql.includes(failOnSql)) throw new Error(failMessage);
    if (sql.includes('SELECT migration_id')) {
      return { rows: appliedMigrationIds.map((migration_id) => ({ migration_id })) };
    }
    if (sql.includes('information_schema.columns')) {
      return {
        rows: [
          {
            satisfied: sql.includes('pg_get_indexdef')
              ? tourShiftVerificationSatisfied
              : verificationSatisfied,
          },
        ],
      };
    }
    return { rows: [] };
  }),
});

const queriedSql = (client: ReturnType<typeof createTenantClient>) =>
  client.query.mock.calls.map(([sql]) => sql).join('\n');

const createAdminClient = (rows: readonly object[]) => ({
  query: vi.fn(async (sql: string) => ({
    rows: sql.includes('SELECT instance_id') ? rows : [],
  })),
});

describe('Waste-Tenant-Migration', () => {
  it('contains the additive postal-code migration and the guarded tour-shift contract', () => {
    expect(validateWasteTenantMigrations(wasteTenantMigrations)).toBe(wasteTenantMigrations);
    expect(wasteTenantMigrations).toHaveLength(2);
    expect(wasteTenantMigrations[0]).toMatchObject({
      id: migrationId,
      statements: ['ALTER TABLE public.waste_cities ADD COLUMN IF NOT EXISTS postal_code TEXT;'],
    });
    expect(wasteTenantMigrations[0]?.statements.join('\n')).not.toMatch(
      /\b(?:DELETE|DROP|TRUNCATE|UPDATE)\b/u
    );
    expect(wasteTenantMigrations[1]).toMatchObject({ id: tourShiftMigrationId });
    expect(wasteTenantMigrations[1]?.statements.join('\n')).toContain(
      'waste_migration_tour_date_shift_data_present'
    );
    expect(wasteTenantMigrations[1]?.statements.join('\n')).toContain(
      'ALTER COLUMN original_date TYPE DATE'
    );
    expect(wasteTenantMigrations[1]?.verification.sql).toContain('pg_get_indexdef');
    expect(wasteTenantMigrations[1]?.verification.sql).toContain('pg_get_expr');
    expect(wasteTenantMigrations[1]?.verification.sql).toContain('indnkeyatts = 3');
    expect(wasteTenantMigrations[1]?.verification.sql).toContain('nothas_year');
  });

  it('rejects duplicate migration identifiers before connecting to a tenant', () => {
    expect(() =>
      validateWasteTenantMigrations([wasteTenantMigrations[0], wasteTenantMigrations[0]])
    ).toThrow('waste_migration_catalog_id_invalid');
  });

  it('accepts only valid PostgreSQL ports', () => {
    expect(parseDatabasePort('5432', 'invalid_port')).toBe(5432);
    expect(() => parseDatabasePort('not-a-port', 'invalid_port')).toThrow('invalid_port');
    expect(() => parseDatabasePort('65536', 'invalid_port')).toThrow('invalid_port');
  });

  it('migrates ready and disabled tenant databases in isolated transactions', async () => {
    const adminClient = createAdminClient([
      { database_name: 'alpha_db', instance_id: 'alpha', status: 'ready' },
      { database_name: 'beta_db', instance_id: 'beta', status: 'disabled' },
    ]);
    const tenantClients = new Map<string, ReturnType<typeof createTenantClient>>();
    const connectTenant = vi.fn(async (database: string) => {
      const client = createTenantClient();
      tenantClients.set(database, client);
      return client;
    });

    await expect(
      migrateWasteTenantDatabases({ adminClient, connectTenant, deriveNames: namesFor })
    ).resolves.toEqual({ appliedMigrationCount: 4, migratedTenantCount: 2, status: 'ok' });

    for (const database of ['alpha_db', 'beta_db']) {
      const client = tenantClients.get(database);
      if (!client) throw new Error(`missing_test_tenant_client:${database}`);
      expect(queriedSql(client)).toContain('BEGIN;');
      expect(queriedSql(client)).toContain('ADD COLUMN IF NOT EXISTS postal_code TEXT');
      expect(queriedSql(client)).toContain('COMMIT;');
      expect(queriedSql(client)).not.toContain('ROLLBACK;');
      expect(client.end).toHaveBeenCalledOnce();
    }
    const adminSql = adminClient.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(adminSql).toContain('LOCK TABLE iam.instance_waste_provisioning IN SHARE MODE');
    expect(adminSql).toContain('COMMIT;');
    expect(adminSql).not.toContain('ROLLBACK;');
  });

  it('holds the inventory stable and fails before tenant access during provisioning', async () => {
    const connectTenant = vi.fn();
    const adminClient = createAdminClient([
      { database_name: 'alpha_db', instance_id: 'alpha', status: 'provisioning' },
    ]);

    await expect(
      migrateWasteTenantDatabases({ adminClient, connectTenant, deriveNames: namesFor })
    ).rejects.toThrow('waste_migration_provisioning_in_progress');

    expect(connectTenant).not.toHaveBeenCalled();
    const adminSql = adminClient.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(adminSql).toContain('LOCK TABLE iam.instance_waste_provisioning IN SHARE MODE');
    expect(adminSql).toContain('ROLLBACK;');
    expect(adminSql).not.toContain('COMMIT;');
  });

  it('verifies but does not reapply an already recorded migration', async () => {
    const client = createTenantClient({
      appliedMigrationIds: [migrationId, tourShiftMigrationId],
    });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).resolves.toEqual({ appliedMigrationCount: 0 });

    expect(queriedSql(client)).toContain('information_schema.columns');
    expect(queriedSql(client)).not.toContain('ADD COLUMN IF NOT EXISTS postal_code TEXT');
    expect(queriedSql(client)).not.toContain('INSERT INTO public.sva_waste_schema_migrations');
    expect(queriedSql(client)).toContain('COMMIT;');
    expect(queriedSql(client)).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE public.sva_waste_schema_migrations FROM "alpha_app", "alpha_public"'
    );
  });

  it('rolls back all tenant changes when a migration statement fails', async () => {
    const client = createTenantClient({ failOnSql: 'ADD COLUMN IF NOT EXISTS' });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).rejects.toThrow('database_failure');

    expect(queriedSql(client)).toContain('ROLLBACK;');
    expect(queriedSql(client)).not.toContain('COMMIT;');
    expect(queriedSql(client)).not.toContain('INSERT INTO public.sva_waste_schema_migrations');
  });

  it('rolls back when the additive migration cannot be verified', async () => {
    const client = createTenantClient({ verificationSatisfied: false });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).rejects.toThrow(`waste_migration_verification_failed:${migrationId}`);

    expect(queriedSql(client)).toContain('ROLLBACK;');
    expect(queriedSql(client)).not.toContain('COMMIT;');
    expect(queriedSql(client)).not.toContain('INSERT INTO public.sva_waste_schema_migrations');
  });

  it('rolls back the hard cut when its empty-table preflight fails', async () => {
    const client = createTenantClient({
      failMessage: 'waste_migration_tour_date_shift_data_present',
      failOnSql: 'IF EXISTS (SELECT 1 FROM public.waste_tour_date_shifts LIMIT 1)',
    });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).rejects.toThrow('waste_migration_tour_date_shift_data_present');

    expect(queriedSql(client)).toContain('ROLLBACK;');
    expect(queriedSql(client)).not.toContain('ALTER COLUMN original_date TYPE DATE');
    expect(queriedSql(client)).not.toContain('pg_get_indexdef');
  });

  it('rolls back when the migrated index contract does not match its postcondition', async () => {
    const client = createTenantClient({ tourShiftVerificationSatisfied: false });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).rejects.toThrow(`waste_migration_verification_failed:${tourShiftMigrationId}`);

    expect(queriedSql(client)).toContain('pg_get_indexdef');
    expect(queriedSql(client)).toContain('ROLLBACK;');
    expect(queriedSql(client)).not.toContain('COMMIT;');
  });

  it('preserves the migration and rollback failures when rollback itself fails', async () => {
    const client = createTenantClient();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('ADD COLUMN IF NOT EXISTS')) throw new Error('database_failure');
      if (sql === 'ROLLBACK;') throw new Error('rollback_failure');
      if (sql.includes('SELECT migration_id')) return { rows: [] };
      return { rows: [] };
    });

    await expect(
      migrateWasteTenantDatabase({
        appRole: 'alpha_app',
        client,
        migrations: wasteTenantMigrations,
        ownerRole: 'alpha_owner',
        publicAppRole: 'alpha_public',
      })
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'rollback_failure' }),
      errors: [expect.objectContaining({ message: 'database_failure' })],
      message: 'waste_migration_rollback_failed',
    });
  });

  it('fails closed before connecting when the registry database name has drifted', async () => {
    const connectTenant = vi.fn();
    const adminClient = createAdminClient([
      { database_name: 'unexpected_db', instance_id: 'alpha', status: 'ready' },
    ]);

    await expect(
      migrateWasteTenantDatabases({ adminClient, connectTenant, deriveNames: namesFor })
    ).rejects.toThrow('waste_migration_registry_database_mismatch');
    expect(connectTenant).not.toHaveBeenCalled();
  });
});
