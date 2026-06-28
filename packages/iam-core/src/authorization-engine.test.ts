import { describe, expect, it } from 'vitest';
import type { AuthorizeRequest, EffectivePermission } from './authorization-contract.js';
import { evaluateAuthorizeDecision } from './authorization-engine.js';

const baseRequest = (): AuthorizeRequest => ({
  instanceId: 'instance-a',
  action: 'read',
  resource: {
    type: 'document',
    id: 'doc-1',
    organizationId: 'org-child',
  },
  context: {
    organizationId: 'org-child',
    requestId: 'req-1',
    traceId: 'trace-1',
    attributes: {
      organizationHierarchy: ['org-root', 'org-child'],
    },
  },
});

const basePermission = (): EffectivePermission => ({
  action: 'read',
  resourceType: 'document',
  organizationId: 'org-root',
  sourceRoleIds: ['role-1'],
  sourceGroupIds: [],
});

describe('evaluateAuthorizeDecision', () => {
  it('denies when instance scope mismatches (stage 1)', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      context: {
        ...baseRequest().context,
        attributes: {
          instanceId: 'instance-b',
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [basePermission()]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('instance_scope_mismatch');
  });

  it('denies when no matching permission exists (stage 3)', () => {
    const request = baseRequest();

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        action: 'write',
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permission_missing');
    expect(result.diagnostics?.stage).toBe('rbac');
  });

  it('denies when ABAC requires actingAsUserId but context misses it (stage 4)', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      context: {
        ...baseRequest().context,
        attributes: {
          requireActingAs: true,
          organizationHierarchy: ['org-root', 'org-child'],
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [basePermission()]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('context_attribute_missing');
    expect(result.diagnostics?.stage).toBe('abac');
  });

  it('allows by RBAC when permission matches without active ABAC rules (stage 5)', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [basePermission()]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_rbac');
    expect(result.diagnostics?.stage).toBe('final');
  });

  it('allows by ABAC when active rules are satisfied (stage 5)', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      context: {
        ...baseRequest().context,
        actingAsUserId: 'user-impersonated',
        attributes: {
          requireActingAs: true,
          organizationHierarchy: ['org-root', 'org-child'],
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [basePermission()]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_abac');
  });

  it('treats duplicate matching permissions as allow-only grants', () => {
    const request = baseRequest();

    const result = evaluateAuthorizeDecision(request, [
      basePermission(),
      {
        action: 'read',
        resourceType: 'document',
        organizationId: 'org-child',
        scope: {
          restrictedOrganizationIds: ['org-child'],
        },
        sourceRoleIds: ['role-restrictive'],
        sourceGroupIds: [],
      },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_rbac');
  });

  it('matches resource-specific permissions only for the targeted resource id', () => {
    const request = baseRequest();

    const allowedResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        resourceId: 'doc-1',
      },
    ]);
    const deniedResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        resourceId: 'doc-2',
      },
    ]);

    expect(allowedResult.allowed).toBe(true);
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.reason).toBe('permission_missing');
  });

  it('allows own-scoped permissions only for records owned by the acting account', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          createdByAccountId: 'account-2',
          ownerUserId: 'account-1',
          organizationId: 'org-child',
        },
      },
      context: {
        ...baseRequest().context,
        attributes: {
          organizationHierarchy: ['org-root', 'org-child'],
          actorAccountId: 'account-1',
        },
      },
    };

    const allowedResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        accessScope: 'own',
      },
    ]);
    const deniedResult = evaluateAuthorizeDecision(
      {
        ...request,
        resource: {
          ...request.resource,
          attributes: {
            createdByAccountId: 'account-1',
            ownerUserId: 'account-2',
            organizationId: 'org-child',
          },
        },
      },
      [
        {
          ...basePermission(),
          accessScope: 'own',
        },
      ]
    );

    expect(allowedResult.allowed).toBe(true);
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.reason).toBe('abac_condition_unmet');
  });

  it('allows organization-scoped permissions for records owned by the actor or active organization', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          createdByAccountId: 'account-2',
          organizationId: 'org-other',
          ownerUserId: 'account-2',
          ownerOrganizationId: 'org-child',
        },
      },
      context: {
        ...baseRequest().context,
        attributes: {
          organizationHierarchy: ['org-root', 'org-child'],
          actorAccountId: 'account-1',
        },
      },
    };

    const allowedResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        accessScope: 'organization',
      },
    ]);
    const deniedResult = evaluateAuthorizeDecision(
      {
        ...request,
        resource: {
          ...request.resource,
          organizationId: 'org-other',
          attributes: {
            createdByAccountId: 'account-1',
            organizationId: 'org-other',
            ownerUserId: 'account-2',
            ownerOrganizationId: 'org-other',
          },
        },
        context: {
          ...request.context,
          organizationId: 'org-child',
        },
      },
      [
        {
          ...basePermission(),
          accessScope: 'organization',
        },
      ]
    );

    expect(allowedResult.allowed).toBe(true);
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.reason).toBe('abac_condition_unmet');
  });

  it('treats organization-scoped permissions as own-scoped when no active organization exists', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          ownerUserId: 'account-1',
          ownerOrganizationId: 'org-child',
        },
      },
      context: {
        ...baseRequest().context,
        organizationId: undefined,
        attributes: {
          actorAccountId: 'account-1',
        },
      },
    };

    const allowedResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        organizationId: undefined,
        accessScope: 'organization',
      },
    ]);
    const deniedResult = evaluateAuthorizeDecision(
      {
        ...request,
        resource: {
          ...request.resource,
          attributes: {
            ownerUserId: 'account-2',
            ownerOrganizationId: 'org-child',
          },
        },
      },
      [
        {
          ...basePermission(),
          organizationId: undefined,
          accessScope: 'organization',
        },
      ]
    );

    expect(allowedResult.allowed).toBe(true);
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.reason).toBe('abac_condition_unmet');
  });

  it('keeps ownerless records restricted to all-scoped permissions', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          organizationId: 'org-child',
        },
      },
      context: {
        ...baseRequest().context,
        attributes: {
          organizationHierarchy: ['org-root', 'org-child'],
          actorAccountId: 'account-1',
        },
      },
    };

    const ownResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        accessScope: 'own',
      },
    ]);
    const organizationResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        accessScope: 'organization',
      },
    ]);
    const allResult = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        accessScope: 'all',
      },
    ]);

    expect(ownResult.allowed).toBe(false);
    expect(organizationResult.allowed).toBe(false);
    expect(allResult.allowed).toBe(true);
  });

  it('allows globally scoped permissions without an organization id', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [
      {
        ...basePermission(),
        organizationId: undefined,
      },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_rbac');
  });

  it('denies organization-scoped permissions when the request has no target organization', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        organizationId: undefined,
      },
      context: {
        ...baseRequest().context,
        organizationId: undefined,
      },
    };

    const result = evaluateAuthorizeDecision(request, [basePermission()]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permission_missing');
  });

  it('denies with hierarchy restriction when organization is blocked', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      context: {
        ...baseRequest().context,
        attributes: {
          restrictedOrganizationIds: ['org-child'],
          organizationHierarchy: ['org-root', 'org-child'],
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [basePermission()]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hierarchy_restriction');
  });

  it('handles empty claims/unknown actions by denying permission', () => {
    const request: AuthorizeRequest = {
      instanceId: '',
      action: 'unknown-action',
      resource: {
        type: 'unknown-type',
      },
      context: {
        attributes: {},
      },
    };

    const result = evaluateAuthorizeDecision(request, []);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permission_missing');
  });

  it('denies when a geo-scoped permission does not match the resource scope', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          geoScope: 'DE-BY',
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        scope: {
          allowedGeoScopes: ['DE-BW'],
        },
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('abac_condition_unmet');
    expect(result.diagnostics?.stage).toBe('abac');
  });

  it('allows inherited geo-unit permissions for descendant geo units and reports provenance', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          geoUnitId: 'geo-child',
          geoHierarchy: ['geo-root', 'geo-child'],
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        sourceGroupIds: ['group-1'],
        provenance: { sourceKinds: ['group_role'] },
        scope: {
          allowedGeoUnitIds: ['geo-root'],
        },
      },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_abac');
    expect(result.provenance).toEqual({
      sourceKinds: ['group_role'],
      inheritedFromGeoUnitId: 'geo-root',
    });
  });

  it('prioritizes geo unit ids over legacy geo scopes when both are present', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          geoUnitId: 'geo-child',
          geoHierarchy: ['geo-root', 'geo-child'],
          geoScope: 'DE-BY',
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        scope: {
          allowedGeoUnitIds: ['geo-root'],
          allowedGeoScopes: ['DE-BW'],
        },
      },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_abac');
  });

  it('treats geo restrictions on allow permissions as scope conditions for that grant', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          geoUnitId: 'geo-child',
          geoHierarchy: ['geo-root', 'geo-child'],
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        provenance: { sourceKinds: ['direct_role'] },
        scope: {
          restrictedGeoUnitIds: ['geo-child'],
        },
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hierarchy_restriction');
  });

  it('denies when requireGeoScope is active but the resource scope is missing', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [
      {
        ...basePermission(),
        scope: {
          requireGeoScope: true,
        },
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('context_attribute_missing');
  });

  it('denies when an allow permission scope is marked forceDeny', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [
      {
        ...basePermission(),
        scope: {
          forceDeny: true,
        },
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('policy_conflict_restrictive_wins');
  });

  it('allows when a time window spans midnight and the request time is inside it', () => {
    const request: AuthorizeRequest = {
      ...baseRequest(),
      resource: {
        ...baseRequest().resource,
        attributes: {
          currentTime: '00:30',
        },
      },
    };

    const result = evaluateAuthorizeDecision(request, [
      {
        ...basePermission(),
        scope: {
          timeWindow: {
            start: '23:00',
            end: '01:00',
          },
          currentTime: '00:30',
        },
      },
    ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_abac');
  });

  it('denies when a time window is malformed', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [
      {
        ...basePermission(),
        scope: {
          timeWindow: {
            start: 'invalid',
            end: '17:00',
          },
        },
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('abac_condition_unmet');
  });
});
