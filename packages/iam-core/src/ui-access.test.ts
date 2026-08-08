import { describe, expect, it } from 'vitest';

import type { EffectiveAccessSnapshot, UiAccessRequirement } from './ui-access.js';
import { evaluateUiAccess } from './ui-access.js';

const tenantScope = {
  kind: 'tenant',
  authGeneration: 2,
  instanceId: 'tenant-a',
  organizationId: 'org-a',
  moduleAssignmentGeneration: 3,
} as const;

const tenantRequirement = (
  actions: readonly string[],
  options: Partial<Extract<UiAccessRequirement, { kind: 'tenant' }>> = {}
): Extract<UiAccessRequirement, { kind: 'tenant' }> => ({
  kind: 'tenant',
  actions: { mode: 'allOf', values: actions },
  ...options,
});

const readyTenantSnapshot = (
  permissions: Extract<EffectiveAccessSnapshot, { status: 'ready'; scope: { kind: 'tenant' } }>['permissions'],
  assignedModules: readonly string[] = ['news']
): EffectiveAccessSnapshot => ({
  status: 'ready',
  scope: tenantScope,
  generation: 4,
  assignedModules,
  permissions,
  snapshotVersion: 'snapshot-1',
});

describe('evaluateUiAccess', () => {
  it('allows public surfaces without a session and requires authentication otherwise', () => {
    expect(evaluateUiAccess({ isAuthenticated: false, requirement: { kind: 'public' } })).toEqual({
      status: 'allowed',
      reason: 'public_surface',
    });
    expect(evaluateUiAccess({ isAuthenticated: false, requirement: { kind: 'authenticated' } })).toEqual({
      status: 'denied',
      reason: 'authentication_required',
    });
  });

  it.each([
    ['unresolved', 'snapshot_unresolved'],
    ['loading', 'snapshot_loading'],
  ] as const)('keeps %s snapshots fail-closed', (status, reason) => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.update']),
        snapshot: { status, scope: tenantScope, generation: 1 },
      })
    ).toEqual({ status: 'unresolved', reason });
  });

  it('propagates a stable snapshot error without preserving permissions', () => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.update']),
        snapshot: {
          status: 'error',
          scope: tenantScope,
          generation: 5,
          errorCode: 'permission_snapshot_unavailable',
        },
      })
    ).toEqual({
      status: 'error',
      reason: 'snapshot_error',
      errorCode: 'permission_snapshot_unavailable',
    });
  });

  it('keeps platform and tenant scopes separate', () => {
    const platformSnapshot: EffectiveAccessSnapshot = {
      status: 'ready',
      scope: { kind: 'platform', authGeneration: 1 },
      generation: 1,
      platformRoles: ['instance_registry_admin'],
    };

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: { kind: 'platform', roles: { mode: 'anyOf', values: ['instance_registry_admin'] } },
        snapshot: platformSnapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.read']),
        snapshot: platformSnapshot,
      })
    ).toEqual({ status: 'denied', reason: 'scope_mismatch' });
  });

  it('fails closed for invalid platform snapshots and missing platform roles', () => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          kind: 'platform',
          roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
        },
        snapshot: readyTenantSnapshot([]),
      })
    ).toEqual({ status: 'denied', reason: 'scope_mismatch' });

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          kind: 'platform',
          roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
        },
        snapshot: {
          status: 'ready',
          scope: { kind: 'platform', authGeneration: 1 },
          generation: 1,
        } as unknown as EffectiveAccessSnapshot,
      })
    ).toEqual({ status: 'denied', reason: 'scope_mismatch' });

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          kind: 'platform',
          roles: { mode: 'allOf', values: ['instance_registry_admin'] },
        },
        snapshot: {
          status: 'ready',
          scope: { kind: 'platform', authGeneration: 1 },
          generation: 1,
          platformRoles: [],
        },
      })
    ).toEqual({ status: 'denied', reason: 'platform_role_missing' });
  });

  it('allows authenticated surfaces after session resolution', () => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: { kind: 'authenticated' },
      })
    ).toEqual({ status: 'allowed', reason: 'authenticated_surface' });
  });

  it('requires module assignment in addition to an unscoped action', () => {
    const snapshot = readyTenantSnapshot(
      [{ action: 'news.update', resourceType: 'content', accessScope: 'all' }],
      []
    );

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.update'], { moduleId: 'news' }),
        snapshot,
      })
    ).toEqual({ status: 'denied', reason: 'module_assignment_missing' });
  });

  it('allows unscoped fully-qualified actions without rebuilding IAM semantics', () => {
    const snapshot = readyTenantSnapshot([
      { action: 'news.read', resourceType: 'content', accessScope: 'all' },
      { action: 'news.update', resourceType: 'content', accessScope: 'all' },
    ]);

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.read', 'news.update'], { moduleId: 'news' }),
        snapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
  });

  it('accepts existing camel-case segments in fully-qualified IAM actions', () => {
    const snapshot = readyTenantSnapshot([
      { action: 'iam.legalText.read', resourceType: 'legalText', accessScope: 'all' },
    ]);

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['iam.legalText.read']),
        snapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
  });

  it('requires a matching server capability for resource-scoped actions', () => {
    const snapshot = readyTenantSnapshot([
      { action: 'news.update', resourceType: 'content', accessScope: 'organization', organizationId: 'org-a' },
    ]);
    const requirement = tenantRequirement(['news.update'], { moduleId: 'news' });

    expect(evaluateUiAccess({ isAuthenticated: true, requirement, snapshot })).toEqual({
      status: 'denied',
      reason: 'resource_capability_missing',
    });
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          ...requirement,
          resourceCapability: {
            action: 'news.update',
            allowed: true,
            instanceId: 'tenant-a',
            organizationId: 'org-a',
            resourceType: 'content',
            resourceId: 'news-1',
          },
        },
        snapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_resource_capability' });
  });

  it('allows collection access with a scoped permission without treating it as an item capability', () => {
    const snapshot = readyTenantSnapshot([
      { action: 'news.read', resourceType: 'content', accessScope: 'organization', organizationId: 'org-a' },
    ]);

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.read'], {
          moduleId: 'news',
          resourceContext: 'collection',
        }),
        snapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['news.read'], { moduleId: 'news' }),
        snapshot,
      })
    ).toEqual({ status: 'denied', reason: 'resource_capability_missing' });
  });

  it('rejects denied capabilities and accepts tenant-wide capabilities', () => {
    const snapshot = readyTenantSnapshot([
      { action: 'news.update', resourceType: 'content', accessScope: 'organization' },
    ]);
    const requirement = tenantRequirement(['news.update'], { moduleId: 'news' });

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          ...requirement,
          resourceCapability: {
            action: 'news.update',
            allowed: false,
            instanceId: 'tenant-a',
            resourceType: 'content',
            resourceId: 'news-1',
          },
        },
        snapshot,
      })
    ).toEqual({ status: 'denied', reason: 'resource_capability_denied' });

    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: {
          ...requirement,
          resourceCapability: {
            action: 'news.update',
            allowed: true,
            instanceId: 'tenant-a',
            resourceType: 'content',
            resourceId: 'news-1',
          },
        },
        snapshot,
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_resource_capability' });
  });

  it('rejects empty action requirements', () => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement([]),
        snapshot: readyTenantSnapshot([]),
      })
    ).toEqual({ status: 'denied', reason: 'permission_missing' });
  });

  it('rejects unknown short action ids', () => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: tenantRequirement(['update']),
        snapshot: readyTenantSnapshot([{ action: 'update', resourceType: 'content', accessScope: 'all' }]),
      })
    ).toEqual({ status: 'denied', reason: 'permission_missing' });
  });

  it.each([
    {
      persona: 'read-only',
      requirement: tenantRequirement(['content.update']),
      snapshot: readyTenantSnapshot([
        { action: 'content.read', resourceType: 'content', accessScope: 'all' },
      ]),
      expected: { status: 'denied', reason: 'permission_missing' },
    },
    {
      persona: 'create-only',
      requirement: tenantRequirement(['content.create']),
      snapshot: readyTenantSnapshot([
        { action: 'content.create', resourceType: 'content', accessScope: 'all' },
      ]),
      expected: { status: 'allowed', reason: 'allowed_by_permission' },
    },
    {
      persona: 'update-only',
      requirement: tenantRequirement(['content.update']),
      snapshot: readyTenantSnapshot([
        { action: 'content.update', resourceType: 'content', accessScope: 'all' },
      ]),
      expected: { status: 'allowed', reason: 'allowed_by_permission' },
    },
    {
      persona: 'delete-only',
      requirement: tenantRequirement(['content.delete']),
      snapshot: readyTenantSnapshot([
        { action: 'content.delete', resourceType: 'content', accessScope: 'all' },
      ]),
      expected: { status: 'allowed', reason: 'allowed_by_permission' },
    },
    {
      persona: 'tenant system_admin without action',
      requirement: tenantRequirement(['content.delete']),
      snapshot: readyTenantSnapshot([]),
      expected: { status: 'denied', reason: 'permission_missing' },
    },
    {
      persona: 'technical platform admin',
      requirement: {
        kind: 'platform' as const,
        roles: { mode: 'anyOf' as const, values: ['instance_registry_admin'] },
      },
      snapshot: {
        status: 'ready' as const,
        scope: { kind: 'platform' as const, authGeneration: 2 },
        generation: 4,
        platformRoles: ['instance_registry_admin'],
      },
      expected: { status: 'allowed', reason: 'allowed_by_permission' },
    },
    {
      persona: 'missing module assignment',
      requirement: tenantRequirement(['news.read'], { moduleId: 'news' }),
      snapshot: readyTenantSnapshot(
        [{ action: 'news.read', resourceType: 'content', accessScope: 'all' }],
        []
      ),
      expected: { status: 'denied', reason: 'module_assignment_missing' },
    },
    {
      persona: 'organization switched after capability read',
      requirement: tenantRequirement(['content.update'], {
        resourceCapability: {
          action: 'content.update',
          allowed: true,
          instanceId: 'tenant-a',
          organizationId: 'org-before-switch',
          resourceType: 'content',
          resourceId: 'content-1',
        },
      }),
      snapshot: readyTenantSnapshot([
        {
          action: 'content.update',
          resourceType: 'content',
          accessScope: 'organization',
          organizationId: 'org-a',
        },
      ]),
      expected: { status: 'denied', reason: 'resource_capability_missing' },
    },
  ])('applies the persona matrix for $persona', ({ requirement, snapshot, expected }) => {
    expect(
      evaluateUiAccess({
        isAuthenticated: true,
        requirement,
        snapshot,
      })
    ).toEqual(expected);
  });
});
