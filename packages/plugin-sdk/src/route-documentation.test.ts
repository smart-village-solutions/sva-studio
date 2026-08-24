import { describe, expect, it } from 'vitest';

import { assertPluginRouteDocumentation, defineRouteDocumentation } from './route-documentation.js';

describe('route documentation contract', () => {
  it('normalizes documented pages and explicit exclusions', () => {
    expect(
      defineRouteDocumentation({ kind: 'page', id: ' news.overview ', pageType: 'overview' })
    ).toEqual({ kind: 'page', id: 'news.overview', pageType: 'overview' });
    expect(defineRouteDocumentation({ kind: 'excluded', reason: 'help-page' })).toEqual({
      kind: 'excluded',
      reason: 'help-page',
    });
  });

  it('requires plugin-owned page ids or an explicit exclusion', () => {
    expect(() => assertPluginRouteDocumentation('news', 'news.list', undefined)).toThrow(
      'plugin_route_documentation_missing:news:news.list'
    );
    expect(() =>
      assertPluginRouteDocumentation('news', 'news.list', {
        kind: 'page',
        id: 'events.overview',
        pageType: 'overview',
      })
    ).toThrow('plugin_route_documentation_owner_mismatch:news:news.list:events.overview');
  });
});
