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
});
