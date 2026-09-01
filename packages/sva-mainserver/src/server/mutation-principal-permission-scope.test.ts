import { describe, expect, it } from 'vitest';

import { selectMainserverActionAccessScopePermissions } from './mutation-principal-permission-scope.js';

describe('selectMainserverActionAccessScopePermissions', () => {
  it('selects exact action and resource-type candidates independently of their namespaces', () => {
    expect(
      selectMainserverActionAccessScopePermissions(
        [{ action: 'news.update', resourceType: 'content', accessScope: 'all' }],
        'news.update',
        'content',
        'all'
      )
    ).toEqual([{ action: 'news.update', resourceType: 'content', accessScope: 'all' }]);
  });

  it('includes canonical unscoped grants and excludes narrower scopes', () => {
    const unscoped = { action: 'content.transferOwnership', resourceType: 'content' };
    expect(
      selectMainserverActionAccessScopePermissions(
        [
          unscoped,
          {
            action: 'content.transferOwnership',
            resourceType: 'content',
            accessScope: 'organization',
          },
        ],
        'content.transferOwnership',
        'content',
        'all'
      )
    ).toEqual([unscoped]);
  });
});
