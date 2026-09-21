import { describe, expect, it, vi } from 'vitest';
import { createListRealmCatalogHandler } from './service-realm-catalog.js';

describe('realm catalog', () => {
  it('filters and paginates while keeping system and assigned realms disabled', async () => {
    const list = createListRealmCatalogHandler({
      listKeycloakRealms: vi.fn(async () => [
        { realm: 'tenant-b' },
        { realm: 'master' },
        { realm: 'tenant-a' },
      ]),
      repository: {
        listInstances: vi.fn(async () => [{ instanceId: 'a', authRealm: 'tenant-a' }]),
      },
    } as never);

    expect(await list({ page: 1, pageSize: 3 })).toEqual({
      page: 1,
      pageSize: 3,
      total: 3,
      data: [
        { realm: 'master', status: 'disabled', reasonCode: 'system_realm' },
        {
          realm: 'tenant-a',
          status: 'disabled',
          reasonCode: 'already_assigned',
          assignedInstanceId: 'a',
        },
        { realm: 'tenant-b', status: 'selectable' },
      ],
    });
    expect(await list({ search: 'B', pageSize: 1 })).toMatchObject({
      total: 1,
      data: [{ realm: 'tenant-b', status: 'selectable' }],
    });
  });
});
