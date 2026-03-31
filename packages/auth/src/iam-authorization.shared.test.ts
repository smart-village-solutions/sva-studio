import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    requestId: 'req-shared',
    traceId: 'trace-shared',
  }),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
    }),
  },
}));

import {
  buildMePermissionsResponse,
  readResourceType,
  resolveActingAsUserIdFromRequest,
  resolveGeoContextFromRequest,
  resolveInstanceIdFromRequest,
  resolveOrganizationIdFromRequest,
  toEffectivePermissions,
} from './iam-authorization/shared';

describe('iam authorization shared helpers', () => {
  it('derives resource types from permission keys', () => {
    expect(readResourceType('content.read')).toBe('content');
    expect(readResourceType('iam')).toBe('iam');
  });

  it('aggregates duplicate permission rows into effective permissions', () => {
    const permissions = toEffectivePermissions([
      {
        permission_key: 'content.read',
        action: 'content.read',
        resource_type: 'content',
        effect: 'allow',
        scope: { allowedGeoScopes: ['de-bw'] },
        role_id: 'role-2',
        group_id: 'group-1',
        source_kind: 'group_role',
        organization_id: '22222222-2222-2222-8222-222222222222',
      },
      {
        permission_key: 'content.read',
        action: 'content.read',
        resource_type: 'content',
        effect: 'allow',
        scope: { allowedGeoScopes: ['de-bw'] },
        role_id: 'role-1',
        group_id: null,
        source_kind: 'direct_role',
        organization_id: '22222222-2222-2222-8222-222222222222',
      },
      {
        permission_key: 'content.publish',
        resource_id: 'article-1',
        effect: 'deny',
        role_id: 'role-3',
        group_id: null,
        source_kind: 'direct_role',
        organization_id: null,
      },
    ]);

    expect(permissions).toEqual([
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '22222222-2222-2222-8222-222222222222',
        effect: 'allow',
        scope: { allowedGeoScopes: ['de-bw'] },
        sourceRoleIds: ['role-1', 'role-2'],
        sourceGroupIds: ['group-1'],
        provenance: { sourceKinds: ['direct_role', 'group_role'] },
      },
      {
        action: 'content.publish',
        resourceType: 'content',
        resourceId: 'article-1',
        organizationId: undefined,
        effect: 'deny',
        sourceRoleIds: ['role-3'],
        sourceGroupIds: [],
        provenance: { sourceKinds: ['direct_role'] },
      },
    ]);
  });

  it('resolves instance ids from the request and falls back to the user scope', () => {
    expect(
      resolveInstanceIdFromRequest(
        new Request('http://localhost/iam/me/permissions?instanceId=22222222-2222-2222-8222-222222222222'),
        'de-musterhausen'
      )
    ).toBe('22222222-2222-2222-8222-222222222222');

    expect(
      resolveInstanceIdFromRequest(
        new Request('http://localhost/iam/me/permissions'),
        'de-musterhausen'
      )
    ).toBe('de-musterhausen');
  });

  it('parses optional organization and acting-as parameters', () => {
    expect(
      resolveOrganizationIdFromRequest(
        new Request(
          'http://localhost/iam/me/permissions?organizationId=22222222-2222-2222-8222-222222222222'
        )
      )
    ).toBe('22222222-2222-2222-8222-222222222222');
    expect(resolveOrganizationIdFromRequest(new Request('http://localhost/iam/me/permissions'))).toBeUndefined();
    expect(resolveOrganizationIdFromRequest(new Request('http://localhost/iam/me/permissions?organizationId=invalid'))).toBeNull();
    expect(
      resolveActingAsUserIdFromRequest(
        new Request('http://localhost/iam/me/permissions?actingAsUserId=target-subject')
      )
    ).toBe('target-subject');
  });

  it('parses additive geo parameters for me/permissions', () => {
    expect(
      resolveGeoContextFromRequest(
        new Request(
          'http://localhost/iam/me/permissions?geoUnitId=22222222-2222-2222-8222-222222222222&geoHierarchy=11111111-1111-1111-8111-111111111111,22222222-2222-2222-8222-222222222222&geoHierarchy=33333333-3333-3333-8333-333333333333'
        )
      )
    ).toEqual({
      geoUnitId: '22222222-2222-2222-8222-222222222222',
      geoHierarchy: [
        '11111111-1111-1111-8111-111111111111',
        '22222222-2222-2222-8222-222222222222',
        '33333333-3333-3333-8333-333333333333',
      ],
    });

    expect(
      resolveGeoContextFromRequest(new Request('http://localhost/iam/me/permissions?geoUnitId=invalid'))
    ).toBeNull();
    expect(
      resolveGeoContextFromRequest(new Request('http://localhost/iam/me/permissions?geoHierarchy=invalid'))
    ).toBeNull();
  });

  it('builds me/permissions responses with request metadata and subject details', () => {
    const response = buildMePermissionsResponse({
      instanceId: 'de-musterhausen',
      organizationId: '22222222-2222-2222-8222-222222222222',
      permissions: [
        {
          action: 'content.read',
          resourceType: 'content',
          sourceRoleIds: ['role-1'],
          sourceGroupIds: ['group-1'],
          scope: { allowedGeoUnitIds: ['geo-root'] },
        },
      ],
      actorUserId: 'actor-sub',
      effectiveUserId: 'target-sub',
      isImpersonating: true,
    });

    expect(response).toEqual(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        organizationId: '22222222-2222-2222-8222-222222222222',
        requestId: 'req-shared',
        traceId: 'trace-shared',
        subject: {
          actorUserId: 'actor-sub',
          effectiveUserId: 'target-sub',
          isImpersonating: true,
        },
        provenance: {
          hasGroupDerivedPermissions: true,
          hasGeoInheritance: true,
        },
      })
    );
    expect(response.evaluatedAt).toEqual(expect.any(String));
  });
});
