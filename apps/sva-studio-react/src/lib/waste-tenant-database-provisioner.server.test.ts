import { describe, expect, it, vi } from 'vitest';

import {
  createProvisionTenantDatabaseOperation,
  deriveWasteTenantDatabaseNames,
} from './waste-tenant-database-provisioner.server.js';
import { requiredWasteTables } from './waste-management-operations.shared.js';

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
});
