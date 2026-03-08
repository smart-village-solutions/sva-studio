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
        role_id: 'role-1',
        organization_id: '22222222-2222-2222-8222-222222222222',
      },
      {
        permission_key: 'content.read',
        role_id: 'role-2',
        organization_id: '22222222-2222-2222-8222-222222222222',
      },
      {
        permission_key: 'content.publish',
        role_id: 'role-3',
        organization_id: null,
      },
    ]);

    expect(permissions).toEqual([
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '22222222-2222-2222-8222-222222222222',
        sourceRoleIds: ['role-1', 'role-2'],
      },
      {
        action: 'content.publish',
        resourceType: 'content',
        organizationId: undefined,
        sourceRoleIds: ['role-3'],
      },
    ]);
  });

  it('resolves instance ids from the request and falls back to the user scope', () => {
    expect(
      resolveInstanceIdFromRequest(
        new Request('http://localhost/iam/me/permissions?instanceId=22222222-2222-2222-8222-222222222222'),
        '11111111-1111-1111-8111-111111111111'
      )
    ).toBe('22222222-2222-2222-8222-222222222222');

    expect(
      resolveInstanceIdFromRequest(
        new Request('http://localhost/iam/me/permissions'),
        '11111111-1111-1111-8111-111111111111'
      )
    ).toBe('11111111-1111-1111-8111-111111111111');
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

  it('builds me/permissions responses with request metadata and subject details', () => {
    const response = buildMePermissionsResponse({
      instanceId: '11111111-1111-1111-8111-111111111111',
      organizationId: '22222222-2222-2222-8222-222222222222',
      permissions: [
        {
          action: 'content.read',
          resourceType: 'content',
          sourceRoleIds: ['role-1'],
        },
      ],
      actorUserId: 'actor-sub',
      effectiveUserId: 'target-sub',
      isImpersonating: true,
    });

    expect(response).toEqual(
      expect.objectContaining({
        instanceId: '11111111-1111-1111-8111-111111111111',
        organizationId: '22222222-2222-2222-8222-222222222222',
        requestId: 'req-shared',
        traceId: 'trace-shared',
        subject: {
          actorUserId: 'actor-sub',
          effectiveUserId: 'target-sub',
          isImpersonating: true,
        },
      })
    );
    expect(response.evaluatedAt).toEqual(expect.any(String));
  });
});
