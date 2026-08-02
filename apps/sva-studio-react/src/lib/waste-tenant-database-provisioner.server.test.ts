import { describe, expect, it, vi } from 'vitest';
import type { ExternalInterfaceRecord } from '@sva/core';

import {
  createProvisionTenantDatabaseOperation,
  deriveWasteTenantDatabaseNames,
} from './waste-tenant-database-provisioner.server.js';
import { requiredWasteTables } from './waste-management-operations.shared.js';

const createProvisioningPool = (options: {
  readonly missingTables?: boolean;
  readonly invalidRuntimeUrlPart?: string;
} = {}) => (url: string) => ({
  connect: async () => ({
    query: async <TRow>(text: string) => {
      if (text.includes('FROM pg_roles')) return { rowCount: 0, rows: [] as TRow[] };
      if (text.includes('FROM pg_database')) {
        return { rowCount: 1, rows: [{ exists: true }] as TRow[] };
      }
      if (text.includes('information_schema.tables')) {
        const tables = options.missingTables ? requiredWasteTables.slice(1) : requiredWasteTables;
        return {
          rowCount: tables.length,
          rows: tables.map((table_name) => ({ table_name })) as TRow[],
        };
      }
      if (text.includes('has_table_privilege')) {
        const isApp = url.includes('_app:');
        const isInvalid = options.invalidRuntimeUrlPart
          ? url.includes(options.invalidRuntimeUrlPart)
          : false;
        return {
          rowCount: 1,
          rows: [{
            can_select: !isInvalid,
            can_insert: isApp,
            can_insert_subscription: true,
          }] as TRow[],
        };
      }
      return { rowCount: 0, rows: [] as TRow[] };
    },
    release: vi.fn(),
  }),
  end: vi.fn(async () => undefined),
});

const createReadyDeps = (overrides: Record<string, unknown> = {}) => ({
  getProvisionerDatabaseUrl: () =>
    'postgresql://provisioner:admin@postgres:5432/sva_studio',
  createPool: createProvisioningPool(),
  createPassword: () => 'test-secret',
  protectSecret: (plaintext: string) => `encrypted:${plaintext}`,
  claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
  completeProvisioning: vi.fn(async (input) => ({ ...input, status: 'ready' } as never)),
  failProvisioning: vi.fn(async () => null),
  loadManagedInterface: vi.fn(async () => null),
  saveManagedInterface: vi.fn(async () => undefined),
  now: () => new Date('2026-08-02T10:00:00.000Z'),
  ...overrides,
});

describe('waste tenant database provisioner', () => {
  it('derives stable, bounded and collision-resistant PostgreSQL identifiers', () => {
    const names = deriveWasteTenantDatabaseNames('BB Prignitz/Äußerst-langer Tenant-Identifier-1234567890');
    expect(Object.values(names).every((name) => /^[a-z][a-z0-9_]{0,62}$/u.test(name))).toBe(true);
    expect(names).toEqual(
      deriveWasteTenantDatabaseNames('BB Prignitz/Äußerst-langer Tenant-Identifier-1234567890')
    );
    expect(names.database).not.toBe(deriveWasteTenantDatabaseNames('bb-prignitz').database);
  });

  it('provisions roles, database, migrations and a hidden managed interface before readiness', async () => {
    const statements: Array<{ url: string; text: string; values?: readonly unknown[] }> = [];
    const savedInterfaces: Record<string, unknown>[] = [];
    const completeProvisioning = vi.fn(async (input) => ({ ...input, status: 'ready' } as never));
    const failProvisioning = vi.fn(async () => null);
    const createPool = (url: string) => ({
      connect: async () => ({
        query: async <TRow>(text: string, values?: readonly unknown[]) => {
          statements.push({ url, text, values });
          if (text.includes('FROM pg_roles')) {
            return { rowCount: 0, rows: [] as TRow[] };
          }
          if (text.includes('FROM pg_database')) {
            return { rowCount: 1, rows: [{ exists: false }] as TRow[] };
          }
          if (text.includes('information_schema.tables')) {
            return {
              rowCount: requiredWasteTables.length,
              rows: requiredWasteTables.map((table_name) => ({ table_name })) as TRow[],
            };
          }
          if (text.includes('has_table_privilege')) {
            return {
              rowCount: 1,
              rows: [
                {
                  can_select: true,
                  can_insert: url.includes('_app:app-secret@'),
                  can_insert_subscription: true,
                },
              ] as TRow[],
            };
          }
          return { rowCount: 0, rows: [] as TRow[] };
        },
        release: vi.fn(),
      }),
      end: vi.fn(async () => undefined),
    });

    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () => 'postgresql://provisioner:admin@postgres:5432/sva_studio',
      createPool,
      createPassword: vi
        .fn()
        .mockReturnValueOnce('migrator-secret')
        .mockReturnValueOnce('app-secret')
        .mockReturnValueOnce('public-secret'),
      protectSecret: (plaintext, aad) => `encrypted:${aad}:${plaintext}`,
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      completeProvisioning,
      failProvisioning,
      loadManagedInterface: vi.fn(async () => null),
      saveManagedInterface: vi.fn(async (record) => {
        savedInterfaces.push(record as unknown as Record<string, unknown>);
      }),
      now: () => new Date('2026-08-02T10:00:00.000Z'),
    });

    const result = await operation(
      'bb-prignitz',
      { operation: 'provision-tenant-database', desiredGeneration: 1 },
      { jobId: '00000000-0000-4000-8000-000000000001' }
    );

    expect(result.details).toMatchObject({
      interfaceId: 'waste-management:bb-prignitz',
      desiredGeneration: 1,
    });
    expect(savedInterfaces).toHaveLength(2);
    expect(savedInterfaces[0]).toMatchObject({
      ownerKind: 'plugin',
      ownerId: 'waste-management',
      alias: 'waste-management',
      enabled: false,
      visibleStatus: 'disabled',
    });
    expect(savedInterfaces[1]).toMatchObject({ enabled: true, visibleStatus: 'ok' });
    expect(JSON.stringify(savedInterfaces[0]?.publicConfig)).not.toContain('secret');
    expect(String(savedInterfaces[0]?.secretConfigCiphertext)).toContain('app-secret');
    expect(statements.some(({ text }) => text.startsWith('CREATE DATABASE'))).toBe(true);
    expect(statements.some(({ text }) => text.includes('TO CURRENT_USER WITH ADMIN OPTION'))).toBe(true);
    expect(statements.some(({ text }) => text.includes('REVOKE ALL ON DATABASE'))).toBe(true);
    expect(
      statements.some(({ text }) =>
        text.includes('public.waste_email_reminder_subscriptions')
      )
    ).toBe(true);
    expect(statements.some(({ text }) => text.includes('CREATE TABLE IF NOT EXISTS'))).toBe(true);
    expect(completeProvisioning).toHaveBeenCalledOnce();
    expect(failProvisioning).not.toHaveBeenCalled();
  });

  it('records a redacted failed state when privileged deployment configuration is absent', async () => {
    const failProvisioning = vi.fn(async (input) => ({ ...input, status: 'failed' } as never));
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () => undefined,
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      failProvisioning,
    });

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 2 },
        { jobId: '00000000-0000-4000-8000-000000000002' }
      )
    ).rejects.toThrow('waste_database_provisioner_url_missing');
    expect(failProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        errorCode: 'waste_database_provisioner_url_missing',
        errorMessage: 'Die Waste-Datenbank konnte nicht vollständig provisioniert werden.',
      })
    );
  });

  it.each([
    [{ operation: 'provision-tenant-database', desiredGeneration: 0 }, { jobId: 'job' }],
    [{ operation: 'provision-tenant-database', desiredGeneration: 1 }, { jobId: '' }],
  ])('rejects malformed provisioning input before claiming work', async (input, context) => {
    const claimProvisioning = vi.fn();
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({ claimProvisioning })
    );

    await expect(operation('tenant-a', input, context)).rejects.toThrow(
      'invalid_waste_tenant_provisioning_input'
    );
    expect(claimProvisioning).not.toHaveBeenCalled();
  });

  it('rejects a stale provisioning claim before touching infrastructure', async () => {
    const createPool = vi.fn();
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({ claimProvisioning: vi.fn(async () => null), createPool })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_tenant_provisioning_claim_rejected');
    expect(createPool).not.toHaveBeenCalled();
  });

  it('fails closed when secret protection is unavailable', async () => {
    const failProvisioning = vi.fn(async () => null);
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () =>
        'postgresql://provisioner:admin@postgres:5432/sva_studio',
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      failProvisioning,
    });

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_database_secret_protection_missing');
    expect(failProvisioning).toHaveBeenCalledOnce();
  });

  it('persists a disabled error interface when encryption returns no ciphertext', async () => {
    const saveManagedInterface = vi.fn(async () => undefined);
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({ protectSecret: () => null, saveManagedInterface })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_database_secret_protection_failed');
    expect(saveManagedInterface).not.toHaveBeenCalled();
  });

  it('rejects an alias owned outside the Waste plugin and records the failed interface', async () => {
    const saveManagedInterface = vi.fn(async () => undefined);
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({
        loadManagedInterface: vi.fn(async () => ({
          ownerKind: 'tenant',
          ownerId: 'tenant-a',
        } as ExternalInterfaceRecord)),
        saveManagedInterface,
      })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_managed_interface_owner_conflict');
    expect(saveManagedInterface).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, visibleStatus: 'error' })
    );
  });

  it('fails closed when migrations leave the Waste schema incomplete', async () => {
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({ createPool: createProvisioningPool({ missingTables: true }) })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_database_schema_incomplete');
  });

  it.each(['_app:', '_public:'])(
    'fails closed when %s runtime privileges do not match the contract',
    async (invalidRuntimeUrlPart) => {
      const operation = createProvisionTenantDatabaseOperation(
        createReadyDeps({
          createPool: createProvisioningPool({ invalidRuntimeUrlPart }),
        })
      );

      await expect(
        operation(
          'tenant-a',
          { operation: 'provision-tenant-database', desiredGeneration: 1 },
          { jobId: 'job-1' }
        )
      ).rejects.toThrow('waste_database_runtime_privileges_invalid');
    }
  );

  it('keeps the interface failed when the readiness transition is rejected', async () => {
    const saveManagedInterface = vi.fn(async () => undefined);
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({
        completeProvisioning: vi.fn(async () => null),
        saveManagedInterface,
      })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_tenant_provisioning_completion_rejected');
    expect(saveManagedInterface).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, visibleStatus: 'error' })
    );
  });

  it('preserves the original failure when failure-state persistence also rejects', async () => {
    const saveManagedInterface = vi
      .fn(async () => undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('interface failure write rejected'));
    const operation = createProvisionTenantDatabaseOperation(
      createReadyDeps({
        createPool: createProvisioningPool({ missingTables: true }),
        saveManagedInterface,
        failProvisioning: vi.fn(async () => {
          throw new Error('provisioning failure write rejected');
        }),
      })
    );

    await expect(
      operation(
        'tenant-a',
        { operation: 'provision-tenant-database', desiredGeneration: 1 },
        { jobId: 'job-1' }
      )
    ).rejects.toThrow('waste_database_schema_incomplete');
    expect(saveManagedInterface).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
        lastCheckStatus: 'failed',
        updatedAt: '2026-08-02T10:00:00.000Z',
      })
    );
  });

  it('reconciles a partially provisioned tenant without recreating or deleting its database data', async () => {
    const names = deriveWasteTenantDatabaseNames('bb-prignitz');
    const statements: string[] = [];
    const savedInterfaces: Record<string, unknown>[] = [];
    const createPool = (url: string) => ({
      connect: async () => ({
        query: async <TRow>(text: string) => {
          statements.push(text);
          if (text.includes('FROM pg_roles')) {
            return {
              rowCount: 4,
              rows: [
                names.ownerRole,
                names.migratorRole,
                names.appRole,
                names.publicAppRole,
              ].map((rolname) => ({ rolname })) as TRow[],
            };
          }
          if (text.includes('FROM pg_database')) {
            return { rowCount: 1, rows: [{ exists: true }] as TRow[] };
          }
          if (text.includes('information_schema.tables')) {
            return {
              rowCount: requiredWasteTables.length,
              rows: requiredWasteTables.map((table_name) => ({ table_name })) as TRow[],
            };
          }
          if (text.includes('has_table_privilege')) {
            return {
              rowCount: 1,
              rows: [
                {
                  can_select: true,
                  can_insert: url.includes('_app:rotated-app@'),
                  can_insert_subscription: true,
                },
              ] as TRow[],
            };
          }
          return { rowCount: 0, rows: [] as TRow[] };
        },
        release: vi.fn(),
      }),
      end: vi.fn(async () => undefined),
    });
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: () =>
        'postgresql://provisioner:admin@postgres:5432/sva_studio',
      createPool,
      createPassword: vi
        .fn()
        .mockReturnValueOnce('rotated-migrator')
        .mockReturnValueOnce('rotated-app')
        .mockReturnValueOnce('rotated-public'),
      protectSecret: (plaintext) => `encrypted:${plaintext}`,
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      completeProvisioning: vi.fn(async (input) => ({ ...input, status: 'ready' } as never)),
      failProvisioning: vi.fn(async () => null),
      loadManagedInterface: vi.fn(
        async () =>
          ({
            id: 'waste-management:bb-prignitz',
            instanceId: 'bb-prignitz',
            typeKey: 'postgresql',
            ownerKind: 'plugin',
            ownerId: 'waste-management',
            displayName: 'Waste PostgreSQL',
            alias: 'waste-management',
            enabled: false,
            isDefault: true,
            category: 'database',
            publicConfig: { schemaName: 'public', databaseName: names.database, managed: true },
            statusCheckKind: 'postgresql',
            visibleStatus: 'error',
            createdAt: '2026-08-01T08:00:00.000Z',
            updatedAt: '2026-08-01T08:00:00.000Z',
          }) satisfies ExternalInterfaceRecord
      ),
      saveManagedInterface: vi.fn(async (record) => {
        savedInterfaces.push(record as unknown as Record<string, unknown>);
      }),
      now: () => new Date('2026-08-02T10:00:00.000Z'),
    });

    await operation(
      'bb-prignitz',
      { operation: 'provision-tenant-database', desiredGeneration: 2 },
      { jobId: '00000000-0000-4000-8000-000000000003' }
    );

    expect(statements.filter((text) => text.startsWith('ALTER ROLE '))).toHaveLength(4);
    expect(statements.some((text) => text.startsWith('CREATE ROLE '))).toBe(false);
    expect(statements.some((text) => text.startsWith('CREATE DATABASE '))).toBe(false);
    expect(
      statements.some((text) => /\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/iu.test(text))
    ).toBe(false);
    expect(savedInterfaces).toHaveLength(2);
    expect(savedInterfaces[0]).toMatchObject({
      createdAt: '2026-08-01T08:00:00.000Z',
      enabled: false,
    });
    expect(savedInterfaces[1]).toMatchObject({ enabled: true, visibleStatus: 'ok' });
  });

  it('activates additional tenants with the same deployment contract and isolated databases', async () => {
    const statements: string[] = [];
    const interfaces: Array<{ instanceId: string; enabled: boolean }> = [];
    const provisionerUrl = vi.fn(() => 'postgresql://provisioner:admin@postgres:5432/sva_studio');
    let passwordIndex = 0;
    const operation = createProvisionTenantDatabaseOperation({
      getProvisionerDatabaseUrl: provisionerUrl,
      createPassword: () => `tenant-secret-${String(passwordIndex += 1)}`,
      protectSecret: (plaintext) => `encrypted:${plaintext}`,
      claimProvisioning: vi.fn(async () => ({ status: 'provisioning' } as never)),
      completeProvisioning: vi.fn(async (input) => ({ ...input, status: 'ready' } as never)),
      failProvisioning: vi.fn(async () => null),
      loadManagedInterface: vi.fn(async () => null),
      saveManagedInterface: vi.fn(async (record) => {
        interfaces.push({ instanceId: record.instanceId, enabled: record.enabled });
      }),
      createPool: (url) => ({
        connect: async () => ({
          query: async <TRow>(text: string) => {
            statements.push(`${url}\n${text}`);
            if (text.includes('FROM pg_roles')) return { rowCount: 0, rows: [] as TRow[] };
            if (text.includes('FROM pg_database')) {
              return { rowCount: 1, rows: [{ exists: false }] as TRow[] };
            }
            if (text.includes('information_schema.tables')) {
              return {
                rowCount: requiredWasteTables.length,
                rows: requiredWasteTables.map((table_name) => ({ table_name })) as TRow[],
              };
            }
            if (text.includes('has_table_privilege')) {
              return {
                rowCount: 1,
                rows: [{ can_select: true, can_insert: url.includes('_app:'), can_insert_subscription: true }] as TRow[],
              };
            }
            return { rowCount: 0, rows: [] as TRow[] };
          },
          release: vi.fn(),
        }),
        end: vi.fn(async () => undefined),
      }),
    });

    await operation('bb-prignitz', { operation: 'provision-tenant-database', desiredGeneration: 1 }, { jobId: '00000000-0000-4000-8000-000000000011' });
    await operation('bb-guben', { operation: 'provision-tenant-database', desiredGeneration: 1 }, { jobId: '00000000-0000-4000-8000-000000000012' });

    expect(provisionerUrl).toHaveBeenCalledTimes(2);
    expect(interfaces.filter(({ enabled }) => enabled)).toEqual([
      { instanceId: 'bb-prignitz', enabled: true },
      { instanceId: 'bb-guben', enabled: true },
    ]);
    const createdDatabases = statements.filter((statement) => statement.includes('CREATE DATABASE'));
    expect(createdDatabases).toHaveLength(2);
    expect(createdDatabases[0]).not.toBe(createdDatabases[1]);
    expect(createdDatabases.join('\n')).toContain(deriveWasteTenantDatabaseNames('bb-prignitz').database);
    expect(createdDatabases.join('\n')).toContain(deriveWasteTenantDatabaseNames('bb-guben').database);
  });
});
