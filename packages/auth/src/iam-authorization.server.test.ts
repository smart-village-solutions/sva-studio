import { describe, expect, it } from 'vitest';

import type { AuthorizeRequest, EffectivePermission } from '@sva/core';
import { evaluateAuthorizeDecision } from './iam-authorization.server';

describe('evaluateAuthorizeDecision', () => {
  const baseRequest: AuthorizeRequest = {
    instanceId: '11111111-1111-1111-8111-111111111111',
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
      },
    ];

    const decision = evaluateAuthorizeDecision(baseRequest, permissions);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('permission_missing');
  });

  it('allows inherited organization permission when hierarchy path includes parent', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: '11111111-1111-1111-8111-111111111111',
        sourceRoleIds: ['role-parent'],
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
