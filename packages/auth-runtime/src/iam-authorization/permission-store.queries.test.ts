import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

const INSTANCE_ID = 'de-test';
const KEYCLOAK_SUBJECT = 'kc-user-1';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';

describe('permission-store queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.withInstanceScopedDb.mockImplementation(
      async (
        _instanceId: string,
        work: (client: { query: typeof state.query }) => Promise<unknown>
      ) => work({ query: state.query })
    );
  });

  it('keeps instance permissions organization-agnostic on scoped loads', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        {
          permission_key: 'media.read',
          organization_id: ORGANIZATION_ID,
          access_scope: null,
          effect: 'allow',
        },
        {
          permission_key: 'content.read',
          organization_id: ORGANIZATION_ID,
          access_scope: 'organization',
          effect: 'allow',
        },
        {
          permission_key: 'roles.read',
          organization_id: null,
          access_scope: 'all',
          effect: 'allow',
        },
      ],
    });

    const { loadPermissionsFromDb } = await import('./permission-store.queries.js');
    const permissions = await loadPermissionsFromDb({
      instanceId: INSTANCE_ID,
      keycloakSubject: KEYCLOAK_SUBJECT,
      organizationId: ORGANIZATION_ID,
    });

    expect(permissions).toEqual([
      {
        action: 'media.read',
        resourceType: 'media',
        effect: 'allow',
      },
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: ORGANIZATION_ID,
        effect: 'allow',
        accessScope: 'organization',
      },
      {
        action: 'roles.read',
        resourceType: 'roles',
        effect: 'allow',
        accessScope: 'all',
      },
    ]);
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('target.id IS NOT NULL'),
      [
        INSTANCE_ID,
        KEYCLOAK_SUBJECT,
        ORGANIZATION_ID,
        expect.arrayContaining(['content.read']),
      ]
    );
  });

  it('projects organization ids only for scope-sensitive permissions on unscoped loads', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        {
          permission_key: 'media.read',
          organization_id: ORGANIZATION_ID,
          access_scope: null,
          effect: 'allow',
        },
        {
          permission_key: 'content.read',
          organization_id: ORGANIZATION_ID,
          access_scope: 'all',
          effect: 'allow',
        },
        {
          permission_key: 'news.read',
          organization_id: ORGANIZATION_ID,
          access_scope: null,
          effect: 'allow',
        },
      ],
    });

    const { loadPermissionsFromDb } = await import('./permission-store.queries.js');
    const permissions = await loadPermissionsFromDb({
      instanceId: INSTANCE_ID,
      keycloakSubject: KEYCLOAK_SUBJECT,
    });

    expect(permissions).toEqual([
      {
        action: 'media.read',
        resourceType: 'media',
        effect: 'allow',
      },
      {
        action: 'content.read',
        resourceType: 'content',
        effect: 'allow',
        accessScope: 'all',
      },
      {
        action: 'news.read',
        resourceType: 'news',
        organizationId: ORGANIZATION_ID,
        effect: 'allow',
      },
    ]);
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('CASE'),
      [
        INSTANCE_ID,
        KEYCLOAK_SUBJECT,
        expect.arrayContaining(['content.read']),
      ]
    );
  });
});
