import { describe, expect, it } from 'vitest';
import type { AuthorizeResponse, EffectivePermission } from '@sva/core';

import { filterPermissions, mapAuthorizeDecision } from './-iam.models';

describe('iam.models', () => {
  it('maps authorize diagnostics reason_code into view model', () => {
    const decision: AuthorizeResponse = {
      allowed: false,
      reason: 'context_attribute_missing',
      instanceId: '11111111-1111-1111-8111-111111111111',
      action: 'content.read',
      resourceType: 'content',
      evaluatedAt: '2026-03-01T12:00:00.000Z',
      diagnostics: {
        stage: 'impersonation',
        reason_code: 'DENY_TICKET_REQUIRED',
      },
    };

    const mapped = mapAuthorizeDecision(decision);
    expect(mapped.allowed).toBe(false);
    expect(mapped.reason).toBe('context_attribute_missing');
    expect(mapped.reasonCode).toBe('DENY_TICKET_REQUIRED');
  });

  it('filters permissions by query and selected organization ids', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        organizationId: 'org-a',
        sourceRoleIds: ['role-1'],
      },
      {
        action: 'iam.user.read',
        resourceType: 'iam',
        organizationId: 'org-b',
        sourceRoleIds: ['role-2'],
      },
      {
        action: 'feature.toggle',
        resourceType: 'feature',
        sourceRoleIds: ['role-3'],
      },
    ];

    const filtered = filterPermissions(permissions, {
      query: 'read',
      organizationIds: ['org-a', 'org-b'],
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((entry) => entry.action)).toEqual(['content.read', 'iam.user.read']);
  });

  it('keeps permissions without organization when no org filter is selected', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'feature.toggle',
        resourceType: 'feature',
        sourceRoleIds: ['role-3'],
      },
    ];

    expect(filterPermissions(permissions, { query: 'feature' })).toHaveLength(1);
  });

  it('ignores empty diagnostics and trimmed organization filters', () => {
    const decision = mapAuthorizeDecision({
      allowed: true,
      reason: 'allowed_by_rbac',
      instanceId: '11111111-1111-1111-8111-111111111111',
      action: 'content.read',
      resourceType: 'content',
      diagnostics: {},
    } as AuthorizeResponse);

    const filtered = filterPermissions(
      [
        {
          action: 'content.read',
          resourceType: 'content',
          organizationId: 'org-a',
          sourceRoleIds: ['role-1'],
        },
      ],
      { organizationIds: [' org-a ', ''] }
    );

    expect(decision.reasonCode).toBeUndefined();
    expect(filtered).toHaveLength(1);
  });
});
