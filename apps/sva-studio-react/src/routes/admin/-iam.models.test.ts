import { describe, expect, it } from 'vitest';
import type { AuthorizeResponse, EffectivePermission } from '@sva/core';

import {
  filterPermissions,
  formatPermissionSourceKindLabels,
  formatPermissionSourceKinds,
  getFirstAllowedTab,
  mapAuthorizeDecision,
  mapDsrCanonicalStatusToTranslationKey,
  mapDsrStatusTone,
  mapDsrStatusToTranslationKey,
  mapDsrTypeToTranslationKey,
  mapGovernanceTypeToTranslationKey,
  mapIamTabToTranslationKey,
  normalizeIamTab,
} from './-iam.models';

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
        effect: 'allow',
        resourceId: 'resource-a',
        sourceUserIds: [],
        sourceRoleIds: ['role-1'],
        sourceGroupIds: [],
        scope: {
          region: 'eu',
        },
      },
      {
        action: 'iam.user.read',
        resourceType: 'iam',
        organizationId: 'org-b',
        sourceUserIds: [],
        sourceRoleIds: ['role-2'],
        sourceGroupIds: ['group-1'],
      },
      {
        action: 'feature.toggle',
        resourceType: 'feature',
        sourceUserIds: [],
        sourceRoleIds: ['role-3'],
        sourceGroupIds: [],
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
        sourceUserIds: [],
        sourceRoleIds: ['role-3'],
        sourceGroupIds: [],
      },
    ];

    expect(filterPermissions(permissions, { query: 'feature' })).toHaveLength(1);
  });

  it('matches permission queries against resource ids, effects and serialized scope values', () => {
    const permissions: EffectivePermission[] = [
      {
        action: 'content.read',
        resourceType: 'content',
        resourceId: 'article-1',
        effect: 'deny',
        sourceUserIds: [],
        sourceRoleIds: ['role-1'],
        sourceGroupIds: ['group-1'],
        scope: {
          region: 'eu',
          tenant: 'north',
        },
      },
    ];

    expect(filterPermissions(permissions, { query: 'article-1' })).toHaveLength(1);
    expect(filterPermissions(permissions, { query: 'deny' })).toHaveLength(1);
    expect(filterPermissions(permissions, { query: 'tenant:north' })).toHaveLength(1);
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
          sourceUserIds: [],
          sourceRoleIds: ['role-1'],
          sourceGroupIds: [],
        },
      ],
      { organizationIds: [' org-a ', ''] }
    );

    expect(decision.reasonCode).toBeUndefined();
    expect(filtered).toHaveLength(1);
  });

  it('formats permission source kinds via localized labels and keeps unknown values readable', () => {
    expect(formatPermissionSourceKindLabels(undefined)).toBe('—');
    expect(formatPermissionSourceKindLabels([])).toBe('—');
    expect(formatPermissionSourceKindLabels(['direct_user'])).toBe('Nutzer');
    expect(formatPermissionSourceKindLabels(['direct_role'])).toBe('Rolle');
    expect(formatPermissionSourceKindLabels(['group_role'])).toBe('Gruppe');
    expect(formatPermissionSourceKindLabels(['delegation'])).toBe('Delegation');
    expect(formatPermissionSourceKindLabels(['user', 'role', 'group'])).toBe('Nutzer, Rolle, Gruppe');
    expect(formatPermissionSourceKindLabels(['custom_source'])).toBe('custom_source');
  });

  it('formats permission provenance source kinds from effective permissions', () => {
    const permission: EffectivePermission = {
      action: 'content.read',
      resourceType: 'content',
      sourceUserIds: [],
      sourceRoleIds: ['role-1'],
      sourceGroupIds: ['group-1'],
      provenance: {
        sourceKinds: ['direct_user', 'group_role'],
      },
    };

    expect(formatPermissionSourceKinds(permission)).toBe('Nutzer, Gruppe');
    expect(
      formatPermissionSourceKinds({
        ...permission,
        provenance: undefined,
      })
    ).toBe('—');
  });

  it('normalizes invalid IAM tabs to rights', () => {
    expect(normalizeIamTab('governance')).toBe('governance');
    expect(normalizeIamTab('unknown')).toBe('rights');
    expect(normalizeIamTab(undefined)).toBe('rights');
  });

  it('returns the first allowed tab or falls back to rights', () => {
    expect(getFirstAllowedTab(['governance', 'dsr'])).toBe('governance');
    expect(getFirstAllowedTab([])).toBe('rights');
  });

  it('maps DSR canonical statuses to translation keys', () => {
    expect(mapDsrStatusToTranslationKey({ canonicalStatus: 'queued' })).toBe('admin.iam.dsr.status.queued');
    expect(mapDsrStatusToTranslationKey({ canonicalStatus: 'in_progress' })).toBe('admin.iam.dsr.status.inProgress');
    expect(mapDsrStatusToTranslationKey({ canonicalStatus: 'completed' })).toBe('admin.iam.dsr.status.completed');
    expect(mapDsrStatusToTranslationKey({ canonicalStatus: 'blocked' })).toBe('admin.iam.dsr.status.blocked');
    expect(mapDsrStatusToTranslationKey({ canonicalStatus: 'failed' })).toBe('admin.iam.dsr.status.failed');
  });

  it('maps IAM tab, governance type and DSR filter values to static translation keys', () => {
    expect(mapIamTabToTranslationKey('rights')).toBe('admin.iam.tabs.rights');
    expect(mapGovernanceTypeToTranslationKey('legal_acceptance')).toBe('admin.iam.governance.types.legal_acceptance');
    expect(mapDsrTypeToTranslationKey('recipient_notification')).toBe('admin.iam.dsr.types.recipient_notification');
    expect(mapDsrCanonicalStatusToTranslationKey('in_progress')).toBe('admin.iam.dsr.status.inProgress');
  });

  it('maps DSR status tones for success, error and pending variants', () => {
    expect(mapDsrStatusTone({ canonicalStatus: 'completed' })).toContain('text-primary');
    expect(mapDsrStatusTone({ canonicalStatus: 'blocked' })).toContain('text-destructive');
    expect(mapDsrStatusTone({ canonicalStatus: 'failed' })).toContain('text-destructive');
    expect(mapDsrStatusTone({ canonicalStatus: 'queued' })).toContain('text-secondary');
  });
});
