import { describe, expect, it } from 'vitest';
import { evaluateAuthorizeDecision } from '@sva/core';
import type { AuthorizeRequest, EffectivePermission } from '@sva/core';

const INSTANCE = 'inst-test';
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ROLE_1 = 'role-1111-1111-1111-1111-111111111111';
const GROUP_1 = 'grp-1111-1111-1111-1111-111111111111';

const baseRequest = (overrides?: Partial<AuthorizeRequest>): AuthorizeRequest => ({
  instanceId: INSTANCE,
  action: 'content.read',
  resource: { type: 'content', ...overrides?.resource },
  ...overrides,
});

const allowPerm = (overrides?: Partial<EffectivePermission>): EffectivePermission => ({
  action: 'content.read',
  resourceType: 'content',
  effect: 'allow',
  sourceRoleIds: [ROLE_1],
  ...overrides,
});

const denyPerm = (overrides?: Partial<EffectivePermission>): EffectivePermission => ({
  action: 'content.read',
  resourceType: 'content',
  effect: 'deny',
  sourceRoleIds: [ROLE_1],
  ...overrides,
});

/**
 * 8-row conflict matrix for the IAM permission engine.
 *
 * Covers: empty, RBAC allow, explicit deny, group-sourced allow,
 * hierarchy restriction, geo scope mismatch, geo scope match, resource-id filtering.
 */
describe('IAM permission conflict matrix', () => {
  it('row 1 — empty permissions → permission_missing', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permission_missing');
  });

  it('row 2 — matching allow permission → allowed_by_rbac', () => {
    const result = evaluateAuthorizeDecision(baseRequest(), [allowPerm()]);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_rbac');
  });

  it('row 3 — allow + explicit force-deny → policy_conflict_restrictive_wins', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest(),
      [
        allowPerm(),
        denyPerm({ scope: { forceDeny: true } }),
      ]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('policy_conflict_restrictive_wins');
  });

  it('row 4 — allow sourced from group (sourceGroupIds) → allowed_by_rbac', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest(),
      [
        allowPerm({
          sourceRoleIds: [] as unknown as readonly string[],
          sourceGroupIds: [GROUP_1],
          groupName: 'editors',
        }),
      ]
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_rbac');
  });

  it('row 5 — allow + hierarchy restriction for target org → hierarchy_restriction', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest({ resource: { type: 'content', organizationId: ORG_A } }),
      [
        allowPerm({ organizationId: ORG_A }),
        denyPerm({ scope: { restrictedOrganizationIds: [ORG_A] } }),
      ]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('hierarchy_restriction');
  });

  it('row 6 — allow with geo scope, resource has non-matching geo → abac_condition_unmet', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest({ resource: { type: 'content', attributes: { geoScope: 'de-nrw' } } }),
      [allowPerm({ scope: { allowedGeoScopes: ['de-bw'] } })]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('abac_condition_unmet');
  });

  it('row 7 — allow with geo scope requirement, resource matches geo → allowed_by_abac', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest({ resource: { type: 'content', attributes: { geoScope: 'de-bw' } } }),
      [allowPerm({ scope: { allowedGeoScopes: ['de-bw'] } })]
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed_by_abac');
  });

  it('row 8 — allow scoped to specific resourceId, request uses different id → permission_missing', () => {
    const result = evaluateAuthorizeDecision(
      baseRequest({ resource: { type: 'content', id: 'article-999' } }),
      [allowPerm({ resourceId: 'article-123' })]
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permission_missing');
  });
});
