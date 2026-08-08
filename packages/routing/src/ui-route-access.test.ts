import { redirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import {
  enforceRouteAccessRequirement,
  enforceUiRouteAccessRequirements,
} from './ui-route-access.js';

const createBeforeLoadOptions = (
  user:
    | {
        readonly assignedModules?: readonly string[];
        readonly permissionActions?: readonly string[];
        readonly permissionStatus?: 'ready' | 'degraded';
        readonly instanceId?: string;
        readonly roles?: readonly string[];
      }
    | null
) => ({
  context: {
    auth: {
      getUser: async () =>
        user
          ? {
              roles: user.roles ?? [],
              instanceId: user.instanceId,
              assignedModules: user.assignedModules,
              permissionActions: user.permissionActions,
              permissionStatus: user.permissionStatus,
            }
          : null,
    },
  },
});

describe('enforceUiRouteAccessRequirements', () => {
  it('returns early when no module or permission requirements are declared', async () => {
    await expect(
      enforceUiRouteAccessRequirements({}, createBeforeLoadOptions(null))
    ).resolves.toBeUndefined();
  });

  it('redirects when the required module is missing', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        { requiredModuleId: 'media' },
        createBeforeLoadOptions({ assignedModules: ['news'] })
      )
    ).rejects.toMatchObject(redirect({ href: '/?error=auth.insufficientRole' }));
  });

  it('redirects when the permission snapshot is degraded', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        { requiredModuleId: 'media' },
        createBeforeLoadOptions({
          assignedModules: ['media'],
          permissionStatus: 'degraded',
        })
      )
    ).rejects.toMatchObject(redirect({ href: '/?error=auth.insufficientRole' }));
  });

  it('redirects when one of the required permissions is missing', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        { requiredPermissions: ['media.read', 'media.update'] },
        createBeforeLoadOptions({ permissionActions: ['media.read'] })
      )
    ).rejects.toMatchObject(redirect({ href: '/?error=auth.insufficientRole' }));
  });

  it('redirects when required permissions are declared but no permission snapshot is present', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        { requiredPermissions: ['media.read'] },
        createBeforeLoadOptions({ assignedModules: ['media'] })
      )
    ).rejects.toMatchObject(redirect({ href: '/?error=auth.insufficientRole' }));
  });

  it('allows access when only the required module is satisfied', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        { requiredModuleId: 'media' },
        createBeforeLoadOptions({ assignedModules: ['media'] })
      )
    ).resolves.toBeUndefined();
  });

  it('allows access when module assignment and permissions are both satisfied', async () => {
    await expect(
      enforceUiRouteAccessRequirements(
        {
          requiredModuleId: 'media',
          requiredPermissions: ['media.read'],
        },
        createBeforeLoadOptions({
          assignedModules: ['media'],
          permissionActions: ['media.read', 'media.update'],
        })
      )
    ).resolves.toBeUndefined();
  });
});

describe('enforceRouteAccessRequirement', () => {
  const insufficientRoleRedirect = redirect({ href: '/?error=auth.insufficientRole' });

  it.each([undefined, { kind: 'public' } as const])(
    'allows a route without a protected requirement (%s)',
    async (requirement) => {
      await expect(
        enforceRouteAccessRequirement(requirement, createBeforeLoadOptions(null))
      ).resolves.toBeUndefined();
    }
  );

  it('rejects protected routes without an authenticated user', async () => {
    await expect(
      enforceRouteAccessRequirement(
        { kind: 'authenticated' },
        createBeforeLoadOptions(null)
      )
    ).rejects.toMatchObject(insufficientRoleRedirect);
  });

  it('allows authenticated routes without further authorization requirements', async () => {
    await expect(
      enforceRouteAccessRequirement(
        { kind: 'authenticated' },
        createBeforeLoadOptions({})
      )
    ).resolves.toBeUndefined();
  });

  it('allows platform routes only for matching platform roles', async () => {
    const requirement = {
      kind: 'platform',
      roles: { mode: 'anyOf', values: ['instance_registry_admin', 'support'] },
    } as const;

    await expect(
      enforceRouteAccessRequirement(
        requirement,
        createBeforeLoadOptions({ roles: ['support'] })
      )
    ).resolves.toBeUndefined();
    await expect(
      enforceRouteAccessRequirement(
        requirement,
        createBeforeLoadOptions({ instanceId: 'instance-1', roles: ['support'] })
      )
    ).rejects.toMatchObject(insufficientRoleRedirect);
  });

  it('allows tenant routes when every declared condition is satisfied', async () => {
    await expect(
      enforceRouteAccessRequirement(
        {
          kind: 'tenant',
          moduleId: 'news',
          actions: { mode: 'allOf', values: ['news.read', 'news.update'] },
        },
        createBeforeLoadOptions({
          instanceId: 'instance-1',
          assignedModules: ['news'],
          permissionActions: ['news.read', 'news.update'],
        })
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      label: 'an empty action requirement',
      user: { instanceId: 'instance-1' },
      requirement: { kind: 'tenant', actions: { mode: 'allOf', values: [] } } as const,
    },
    {
      label: 'a degraded permission snapshot',
      user: {
        instanceId: 'instance-1',
        permissionStatus: 'degraded' as const,
        permissionActions: ['news.read'],
      },
      requirement: {
        kind: 'tenant',
        actions: { mode: 'anyOf', values: ['news.read'] },
      } as const,
    },
    {
      label: 'a missing module assignment',
      user: { instanceId: 'instance-1', permissionActions: ['news.read'] },
      requirement: {
        kind: 'tenant',
        moduleId: 'news',
        actions: { mode: 'anyOf', values: ['news.read'] },
      } as const,
    },
    {
      label: 'a resource capability without server-side evidence',
      user: { instanceId: 'instance-1', permissionActions: ['news.read'] },
      requirement: {
        kind: 'tenant',
        actions: { mode: 'anyOf', values: ['news.read'] },
        resourceCapability: { resourceType: 'news', capability: 'read' },
      } as const,
    },
  ])('rejects tenant routes with $label', async ({ requirement, user }) => {
    await expect(
      enforceRouteAccessRequirement(requirement, createBeforeLoadOptions(user))
    ).rejects.toMatchObject(insufficientRoleRedirect);
  });
});
