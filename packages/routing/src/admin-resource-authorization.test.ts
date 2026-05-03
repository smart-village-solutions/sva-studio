import { describe, expect, it, vi } from 'vitest';

import {
  createMemoizedUserContext,
  ensureAssignedModule,
  ensureRequiredPermissions,
} from './admin-resource-authorization.js';

describe('admin resource authorization helpers', () => {
  it('injects a memoized getUser wrapper even when no auth context is provided', async () => {
    const { getUser, options } = createMemoizedUserContext({ href: '/admin/news' });

    await expect(getUser()).resolves.toBeUndefined();
    expect(options.context?.auth?.getUser).toBe(getUser);
    await expect(options.context?.auth?.getUser?.()).resolves.toBeUndefined();
  });

  it('memoizes getUser calls against the original auth context', async () => {
    const originalGetUser = vi.fn(async () => ({ assignedModules: ['news'] }));
    const { getUser, options } = createMemoizedUserContext({
      context: {
        auth: {
          getUser: originalGetUser,
        },
      },
      href: '/admin/news',
    });

    await expect(getUser()).resolves.toEqual({ assignedModules: ['news'] });
    await expect(options.context.auth.getUser()).resolves.toEqual({ assignedModules: ['news'] });
    expect(originalGetUser).toHaveBeenCalledTimes(1);
  });

  it('normalizes synchronous getUser failures into a memoized rejected promise', async () => {
    const originalGetUser = vi.fn(() => {
      throw new Error('sync getUser failed');
    });
    const { getUser, options } = createMemoizedUserContext({
      context: {
        auth: {
          getUser: originalGetUser,
        },
      },
      href: '/admin/news',
    });

    await expect(getUser()).rejects.toThrow('sync getUser failed');
    await expect(options.context.auth.getUser()).rejects.toThrow('sync getUser failed');
    expect(originalGetUser).toHaveBeenCalledTimes(1);
  });

  it('skips module enforcement when the resource does not declare a module id', async () => {
    await expect(
      ensureAssignedModule(
        {
          resourceId: 'news.content',
          basePath: 'news',
          titleKey: 'news.navigation.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
          },
        },
        undefined
      )
    ).resolves.toBeUndefined();
  });

  it('rejects users without the required assigned module', async () => {
    await expect(
      ensureAssignedModule(
        {
          resourceId: 'news.content',
          basePath: 'news',
          titleKey: 'news.navigation.title',
          guard: 'content',
          moduleId: 'news',
          views: {
            list: { bindingKey: 'content' },
          },
        },
        { assignedModules: ['events'] }
      )
    ).rejects.toSatisfy(
      (response: Response) =>
        response instanceof Response &&
        response.status === 307 &&
        response.headers.get('Location') === '/?error=auth.insufficientRole'
    );
  });

  it('allows routes without declared required permissions', async () => {
    await expect(
      ensureRequiredPermissions(
        {
          resourceId: 'news.content',
          basePath: 'news',
          titleKey: 'news.navigation.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
          },
        },
        'list',
        undefined
      )
    ).resolves.toBeUndefined();
  });

  it('rejects users without all required permissions', async () => {
    await expect(
      ensureRequiredPermissions(
        {
          resourceId: 'news.content',
          basePath: 'news',
          titleKey: 'news.navigation.title',
          guard: 'content',
          permissions: {
            detail: ['news.read', 'news.publish'],
          },
          views: {
            detail: { bindingKey: 'contentDetail' },
          },
        },
        'detail',
        { permissionActions: ['news.read'] }
      )
    ).rejects.toSatisfy(
      (response: Response) =>
        response instanceof Response &&
        response.status === 307 &&
        response.headers.get('Location') === '/?error=auth.insufficientRole'
    );
  });
});
