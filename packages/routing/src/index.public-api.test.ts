import { describe, expect, it } from 'vitest';

const [clientApi, guardsApi, pluginsApi, serverApi] = await Promise.all([
  import('./index'),
  import('./guards'),
  import('./plugins'),
  import('./index.server'),
]);

describe('@sva/routing public API', () => {
  it('keeps the root client entry focused on app wiring, paths and search helpers', () => {
    expect(Object.keys(clientApi).sort()).toEqual([
      'getClientRouteFactories',
      'normalizeIamTab',
      'normalizeRoleDetailTab',
      'routePaths',
      'uiRoutePaths',
    ]);
  });

  it('moves guard helpers onto the dedicated guards subpath', () => {
    expect(Object.keys(guardsApi).sort()).toEqual([
      'accountUiRouteGuards',
      'createAccountUiRouteGuards',
      'createAdminRoute',
      'createProtectedRoute',
    ]);
  });

  it('moves plugin helpers onto the dedicated plugins subpath', () => {
    expect(Object.keys(pluginsApi).sort()).toEqual([
      'getPluginRouteFactories',
      'mapPluginGuardToAccountGuard',
      'normalizeAdminResourceListSearch',
    ]);
  });

  it('keeps the server entry focused on server route composition and request dispatch', () => {
    expect(Object.keys(serverApi).sort()).toEqual([
      'authRoutePaths',
      'authServerRouteFactories',
      'dispatchAuthRouteRequest',
      'getServerRouteFactories',
      'normalizeIamTab',
      'normalizeRoleDetailTab',
      'resolveAuthRoutePathForRequestPath',
      'routePaths',
      'uiRoutePaths',
    ]);
  });
});
