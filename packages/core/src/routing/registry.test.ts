import { describe, expect, it, vi } from 'vitest';

import { buildRouteTree, mergeRouteFactories, type RouteFactory } from './registry.js';

describe('routing registry helpers', () => {
  it('merges core and plugin route factories while keeping the original order', () => {
    const root = { id: 'root' };
    const coreFactory: RouteFactory<typeof root, string> = () => 'core-route';
    const pluginFactory: RouteFactory<typeof root, string> = () => 'plugin-route';

    expect(mergeRouteFactories([coreFactory], [pluginFactory]).map((factory) => factory(root))).toEqual([
      'core-route',
      'plugin-route',
    ]);
  });

  it('returns the core factories unchanged when no plugin factories are passed', () => {
    const coreFactoryA: RouteFactory<{ id: string }, string> = () => 'a';
    const coreFactoryB: RouteFactory<{ id: string }, string> = () => 'b';

    expect(mergeRouteFactories([coreFactoryA, coreFactoryB])).toEqual([coreFactoryA, coreFactoryB]);
  });

  it('builds the route tree from all factory results', () => {
    const addChildren = vi.fn((routes: string[]) => ({ routes, kind: 'tree' as const }));
    const root = { addChildren };
    const factoryA: RouteFactory<typeof root, string> = () => 'route-a';
    const factoryB: RouteFactory<typeof root, string> = () => 'route-b';

    expect(buildRouteTree(root, [factoryA, factoryB])).toEqual({
      routes: ['route-a', 'route-b'],
      kind: 'tree',
    });
    expect(addChildren).toHaveBeenCalledWith(['route-a', 'route-b']);
  });
});
