import { describe, expect, it } from 'vitest';

import {
  allowReasonCodes,
  denyReasonCodes,
  iamApiErrorCodes,
  type AuthorizeRequest,
  type AuthorizeResponse,
  type MePermissionsResponse,
} from './authorization-contract.js';

describe('authorization-contract exports', () => {
  it('keeps allow and deny reason codes stable for runtime/API interoperability', () => {
    expect(allowReasonCodes).toEqual(['allowed_by_rbac', 'allowed_by_abac']);
    expect(denyReasonCodes).toEqual([
      'permission_missing',
      'instance_scope_mismatch',
      'context_attribute_missing',
      'abac_condition_unmet',
      'hierarchy_restriction',
      'policy_conflict_restrictive_wins',
      'geo_scope_mismatch',
      'group_restriction',
      'legal_acceptance_required',
    ]);
  });

  it('exposes stable API error codes for authorize and me-permissions endpoints', () => {
    expect(iamApiErrorCodes).toEqual([
      'unauthorized',
      'invalid_request',
      'invalid_instance_id',
      'invalid_organization_id',
      'instance_scope_mismatch',
      'impersonation_not_active',
      'impersonation_expired',
      'database_unavailable',
      'legal_acceptance_required',
      'geo_depth_exceeded',
      'snapshot_integrity_error',
    ]);
  });

  it('supports authorize payload and response shapes with snapshot metadata', () => {
    const request: AuthorizeRequest = {
      instanceId: 'tenant-a',
      action: 'news.publish',
      resource: {
        type: 'article',
        id: 'article-1',
        organizationId: '11111111-1111-4111-8111-111111111111',
        attributes: {
          geoUnitId: '22222222-2222-4222-8222-222222222222',
        },
      },
      context: {
        actingAsUserId: 'kc-user-2',
        requestId: 'req-1',
        traceId: 'trace-1',
      },
    };

    const response: AuthorizeResponse = {
      allowed: false,
      reason: 'context_attribute_missing',
      denialCode: 'context_attribute_missing',
      instanceId: request.instanceId,
      action: request.action,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      evaluatedAt: '2026-05-15T10:00:00.000Z',
      requestId: 'req-1',
      traceId: 'trace-1',
      snapshotVersion: 'snapshot-1',
      cacheStatus: 'degraded',
      diagnostics: {
        stage: 'impersonation',
      },
    };

    expect(response.resourceId).toBe('article-1');
    expect(response.snapshotVersion).toBe('snapshot-1');
    expect(response.cacheStatus).toBe('degraded');
  });

  it('supports me-permissions responses with provenance metadata', () => {
    const response: MePermissionsResponse = {
      instanceId: 'tenant-a',
      organizationId: '11111111-1111-4111-8111-111111111111',
      permissions: [
        {
          action: 'news.read',
          resourceType: 'article',
          effect: 'allow',
          sourceUserIds: ['user-1'],
          provenance: {
            sourceKinds: ['direct_user'],
            inheritedFromOrganizationId: '11111111-1111-4111-8111-111111111111',
          },
        },
      ],
      subject: {
        actorUserId: 'user-1',
        effectiveUserId: 'user-2',
        isImpersonating: true,
      },
      evaluatedAt: '2026-05-15T10:00:00.000Z',
      cacheStatus: 'hit',
      snapshotVersion: 'snapshot-2',
      provenance: {
        hasDirectUserPermissions: true,
        hasGroupDerivedPermissions: false,
        hasGeoInheritance: false,
      },
    };

    expect(response.subject.isImpersonating).toBe(true);
    expect(response.permissions[0]?.provenance?.sourceKinds).toEqual(['direct_user']);
  });
});
