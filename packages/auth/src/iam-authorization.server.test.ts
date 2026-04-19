import { describe, expect, it } from 'vitest';

import type { AuthorizeRequest, EffectivePermission } from '@sva/core';
import { evaluateAuthorizeDecision } from './iam-authorization.server';

describe('evaluateAuthorizeDecision', () => {
  const baseRequest: AuthorizeRequest = {
    instanceId: 'de-musterhausen',
    action: 'content.read',
    resource: {
      type: 'content',
      id: 'article-1',
      organizationId: '22222222-2222-2222-8222-222222222222',
    },
    context: {
      organizationId: '22222222-2222-2222-8222-222222222222',
      requestId: 'req-1',
      traceId: 'trace-1',
    },
  };

  it('allows matching action/resource in organization context', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '22222222-2222-2222-8222-222222222222',
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(baseRequest, permissions);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('allowed_by_rbac');
  });

  it('denies when action is missing', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.write',
        resourceType: 'content',
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(baseRequest, permissions);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('permission_missing');
  });

  it('denies when organization scope does not match', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '33333333-3333-3333-8333-333333333333',
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(baseRequest, permissions);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('permission_missing');
  });

  it('allows fully qualified plugin actions only on exact action match', () => {
    const pluginRequest: AuthorizeRequest = {
      ...baseRequest,
      action: 'news.publish',
      resource: {
        type: 'news',
        id: 'news-1',
      },
    };
    const permissions: EffectivePermission[] = [
      {
        action: 'news.publish',
        resourceType: 'news',
        sourceRoleIds: ['role-news-publisher'],
      },
    ];

    const decision = evaluateAuthorizeDecision(pluginRequest, permissions);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('allowed_by_rbac');
    expect(decision.action).toBe('news.publish');
  });

  it('denies fully qualified plugin actions from a foreign namespace', () => {
    const pluginRequest: AuthorizeRequest = {
      ...baseRequest,
      action: 'news.publish',
      resource: {
        type: 'news',
        id: 'news-1',
      },
    };
    const permissions: EffectivePermission[] = [
      {
        action: 'events.publish',
        resourceType: 'events',
        sourceRoleIds: ['role-events-publisher'],
      },
    ];

    const decision = evaluateAuthorizeDecision(pluginRequest, permissions);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('permission_missing');
    expect(decision.action).toBe('news.publish');
  });

  it('allows inherited organization permission when hierarchy path includes parent', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '11111111-1111-1111-8111-111111111111',
        sourceRoleIds: ['role-parent'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(
      {
        ...baseRequest,
        context: {
          ...baseRequest.context,
          attributes: {
            organizationHierarchy: [
              '11111111-1111-1111-8111-111111111111',
              '22222222-2222-2222-8222-222222222222',
            ],
          },
        },
      },
      permissions
    );

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('allowed_by_rbac');
  });

  it('denies when ABAC geo scope is not allowed', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(
      {
        ...baseRequest,
        context: {
          ...baseRequest.context,
          attributes: {
            allowedGeoScopes: ['de-bw'],
          },
        },
        resource: {
          ...baseRequest.resource,
          attributes: {
            geoScope: 'de-by',
          },
        },
      },
      permissions
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('abac_condition_unmet');
  });

  it('denies when hierarchy restrictions explicitly block target organization', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
      },
    ];

    const decision = evaluateAuthorizeDecision(
      {
        ...baseRequest,
        context: {
          ...baseRequest.context,
          attributes: {
            restrictedOrganizationIds: ['22222222-2222-2222-8222-222222222222'],
          },
        },
      },
      permissions
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('hierarchy_restriction');
  });
});
