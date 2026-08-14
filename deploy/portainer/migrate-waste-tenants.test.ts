import { describe, expect, it, vi } from 'vitest';

import { buildWasteSchemaManifest } from '../../scripts/ci/render-waste-schema-manifest.ts';

const { migrateWasteTenantDatabases, parseWasteSchemaManifest, resolveGrantStatements } =
  await import('./migrate-waste-tenants.mjs');

const namesFor = (instanceId: string) => ({
  appRole: `${instanceId}_app`,
  database: `${instanceId}_db`,
  migratorRole: `${instanceId}_migrator`,
  ownerRole: `${instanceId}_owner`,
  publicAppRole: `${instanceId}_public`,
});

describe('Waste-Tenant-Migration', () => {
  it('parses the generated canonical schema manifest', () => {
    const manifest = parseWasteSchemaManifest(JSON.stringify(buildWasteSchemaManifest()));

    expect(manifest.schemaStatements.join('\n')).toContain(
      'ALTER TABLE "public".waste_cities ADD COLUMN IF NOT EXISTS postal_code TEXT'
    );
    expect(manifest.requiredTables).toContain('waste_cities');
  });

  it('resolves only validated role placeholders in grant statements', () => {
    const manifest = buildWasteSchemaManifest();
    const grants = resolveGrantStatements(manifest, namesFor('tenant')).join('\n');

    expect(grants).toContain('TO "tenant_app"');
    expect(grants).toContain('TO "tenant_public"');
    expect(grants).toContain('FOR ROLE "tenant_owner"');
    expect(grants).not.toContain('waste_manifest_');
  });

  it('reconciles ready and disabled tenant databases and verifies all required tables', async () => {
    const manifest = buildWasteSchemaManifest();
    const adminClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { database_name: 'alpha_db', instance_id: 'alpha', status: 'ready' },
          { database_name: 'beta_db', instance_id: 'beta', status: 'disabled' },
        ],
      }),
    };
    const tenantClients = new Map<
      string,
      { end: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> }
    >();
    const connectTenant = vi.fn(async (database: string) => {
      const client = {
        end: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(async (sql: string) =>
          sql.includes('information_schema.tables')
            ? { rows: manifest.requiredTables.map((table_name) => ({ table_name })) }
            : { rows: [] }
        ),
      };
      tenantClients.set(database, client);
      return client;
    });

    await expect(
      migrateWasteTenantDatabases({
        adminClient,
        connectTenant,
        deriveNames: namesFor,
        manifest,
      })
    ).resolves.toEqual({ migratedTenantCount: 2, status: 'ok' });

    expect(connectTenant).toHaveBeenCalledTimes(2);
    expect(tenantClients.get('alpha_db')?.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN IF NOT EXISTS postal_code TEXT')
    );
    expect(tenantClients.get('beta_db')?.end).toHaveBeenCalledOnce();
  });

  it('fails closed before connecting when the registry database name has drifted', async () => {
    const connectTenant = vi.fn();
    const adminClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ database_name: 'unexpected_db', instance_id: 'alpha', status: 'ready' }],
      }),
    };

    await expect(
      migrateWasteTenantDatabases({
        adminClient,
        connectTenant,
        deriveNames: namesFor,
        manifest: buildWasteSchemaManifest(),
      })
    ).rejects.toThrow('waste_migration_registry_database_mismatch');
    expect(connectTenant).not.toHaveBeenCalled();
  });
});
