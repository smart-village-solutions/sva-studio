import { describe, expect, it } from 'vitest';
import type { AuthorizeRequest, EffectivePermission } from './authorization-contract';
import { evaluateAuthorizeDecision } from './authorization-engine';

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

  it('denies when a matching deny permission overrides an inherited allow', () => {
    const request = baseRequest();

    const result = evaluateAuthorizeDecision(request, [
      basePermission(),
      {
        action: 'read',
        resourceType: 'document',
        organizationId: 'org-child',
        effect: 'deny',
        scope: {
          restrictedOrganizationIds: ['org-child'],
        },
        sourceRoleIds: ['role-restrictive'],
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hierarchy_restriction');
    expect(result.diagnostics?.stage).toBe('restrictive_rule');
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

  it('denies when a restrictive permission forces a deny', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [
      basePermission(),
      {
        ...basePermission(),
        effect: 'deny',
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
