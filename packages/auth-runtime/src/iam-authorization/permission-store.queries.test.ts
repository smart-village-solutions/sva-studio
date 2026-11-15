import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateAuthorizeDecision } from '@sva/iam-core';

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
        },
        {
          permission_key: 'content.read',
          organization_id: ORGANIZATION_ID,
          access_scope: 'organization',
        },
        {
          permission_key: 'roles.read',
          organization_id: null,
          access_scope: 'all',
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
      },
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: ORGANIZATION_ID,
        accessScope: 'organization',
      },
      {
        action: 'roles.read',
        resourceType: 'roles',
        accessScope: 'all',
      },
    ]);
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining('target.id IS NOT NULL'), [
      INSTANCE_ID,
      KEYCLOAK_SUBJECT,
      ORGANIZATION_ID,
      expect.arrayContaining(['content.read']),
      expect.arrayContaining(['content.read', 'iam.role.read']),
    ]);
    expect(state.query.mock.calls[0]?.[0]).toContain(
      'p.permission_key = ANY($5::text[]) OR permission_module.effective_active = true'
    );
  });

  it('projects organization ids only for scope-sensitive permissions on unscoped loads', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        {
          permission_key: 'media.read',
          organization_id: ORGANIZATION_ID,
          access_scope: null,
        },
        {
          permission_key: 'content.read',
          organization_id: ORGANIZATION_ID,
          access_scope: 'all',
        },
        {
          permission_key: 'news.read',
          organization_id: ORGANIZATION_ID,
          access_scope: null,
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
      },
      {
        action: 'content.read',
        resourceType: 'content',
        accessScope: 'all',
      },
      {
        action: 'news.read',
        resourceType: 'news',
        organizationId: ORGANIZATION_ID,
      },
    ]);
    expect(state.query).toHaveBeenCalledWith(expect.stringContaining('CASE'), [
      INSTANCE_ID,
      KEYCLOAK_SUBJECT,
      expect.arrayContaining(['content.read']),
      expect.arrayContaining(['content.read', 'iam.role.read']),
    ]);
    expect(state.query.mock.calls[0]?.[0]).toContain(
      'p.permission_key = ANY($4::text[]) OR permission_module.effective_active = true'
    );
  });
  it.each(['organization', 'own'] as const)(
    'reduces %s grants to personal access when an organisation member has no active organisation',
    async (accessScope) => {
      state.query.mockResolvedValueOnce({
        rows: [
          {
            permission_key: 'content.readHistory',
            organization_id: ORGANIZATION_ID,
            access_scope: accessScope,
          },
        ],
      });
      const { loadPermissionsFromDb } = await import('./permission-store.queries.js');
      const permissions = await loadPermissionsFromDb({
        instanceId: INSTANCE_ID,
        keycloakSubject: KEYCLOAK_SUBJECT,
      });
      expect(permissions).toEqual([
        { action: 'content.readHistory', resourceType: 'content', accessScope: 'own' },
      ]);
      for (const [attributes, allowed] of [
        [{ ownerUserId: 'account-1' }, true],
        [{ ownerUserId: 'account-other' }, false],
        [{ ownerOrganizationId: ORGANIZATION_ID }, false],
      ] as const) {
        expect(
          evaluateAuthorizeDecision(
            {
              instanceId: INSTANCE_ID,
              action: 'content.readHistory',
              resource: { type: 'content', attributes },
              context: { attributes: { actorAccountId: 'account-1' } },
            },
            permissions
          ).allowed
        ).toBe(allowed);
      }
    }
  );
});
