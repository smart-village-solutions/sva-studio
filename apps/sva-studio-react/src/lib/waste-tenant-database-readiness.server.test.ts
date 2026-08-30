import type { ExternalInterfaceRecord, WasteTenantProvisioningRecord } from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import { createReadWasteTenantDatabaseReadinessOperation } from './waste-tenant-database-readiness.server.js';

const provisioning: WasteTenantProvisioningRecord = {
  instanceId: 'tenant-a',
  status: 'ready',
  desiredGeneration: 3,
  completedGeneration: 3,
  databaseName: 'sva_waste_tenant_a',
  interfaceId: 'waste-management:tenant-a',
  requestedAt: '2026-08-30T10:00:00.000Z',
  completedAt: '2026-08-30T10:01:00.000Z',
  updatedAt: '2026-08-30T10:01:00.000Z',
};

const managedInterface: ExternalInterfaceRecord = {
  id: 'waste-management:tenant-a',
  instanceId: 'tenant-a',
  typeKey: 'postgresql',
  ownerKind: 'plugin',
  ownerId: 'waste-management',
  displayName: 'Waste PostgreSQL',
  alias: 'waste-management',
  enabled: true,
  isDefault: true,
  category: 'database',
  authMode: 'database_credentials',
  publicConfig: { databaseName: 'sva_waste_tenant_a' },
  statusCheckKind: 'postgresql',
  visibleStatus: 'ok',
  lastCheckStatus: 'succeeded',
};

describe('Waste tenant database readiness', () => {
  it('reports ready only from the tenant-scoped provisioning and managed interface evidence', async () => {
    const loadProvisioning = vi.fn(async () => provisioning);
    const loadManagedInterface = vi.fn(async () => managedInterface);
    const readReadiness = createReadWasteTenantDatabaseReadinessOperation({
      loadProvisioning,
      loadManagedInterface,
    });

    await expect(readReadiness('tenant-a')).resolves.toEqual({
      revision: 'waste-tenant-database-v1',
      checks: [
        { checkId: 'waste-management.tenant-provisioning', status: 'ready' },
        { checkId: 'waste-management.tenant-database-interface', status: 'ready' },
      ],
    });
    expect(loadProvisioning).toHaveBeenCalledWith('tenant-a');
    expect(loadManagedInterface).toHaveBeenCalledWith('tenant-a', 'postgresql', 'waste-management');
  });

  it.each([
    ['missing evidence', null, null],
    [
      'incomplete provisioning',
      { ...provisioning, status: 'provisioning', completedGeneration: 2 },
      managedInterface,
    ],
    [
      'mismatched interface ownership',
      provisioning,
      { ...managedInterface, ownerId: 'other-plugin' },
    ],
  ] as const)('reports blocked for %s', async (_label, provisioningEvidence, interfaceEvidence) => {
    const readReadiness = createReadWasteTenantDatabaseReadinessOperation({
      loadProvisioning: vi.fn(async () => provisioningEvidence),
      loadManagedInterface: vi.fn(async () => interfaceEvidence),
    });

    const result = await readReadiness('tenant-a');

    expect(result.checks.some(({ status }) => status === 'blocked')).toBe(true);
    expect(
      result.checks
        .filter(({ status }) => status === 'blocked')
        .every(({ messageKey }) => messageKey?.startsWith('wasteManagement.readiness.'))
    ).toBe(true);
  });
});
