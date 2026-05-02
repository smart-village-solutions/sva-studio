import { redirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { enforceUiRouteAccessRequirements } from './ui-route-access.js';

const createBeforeLoadOptions = (
  user:
    | {
        readonly assignedModules?: readonly string[];
        readonly permissionActions?: readonly string[];
      }
    | null
) => ({
  context: {
    auth: {
      getUser: async () =>
        user
          ? {
              roles: [],
              assignedModules: user.assignedModules,
              permissionActions: user.permissionActions,
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
