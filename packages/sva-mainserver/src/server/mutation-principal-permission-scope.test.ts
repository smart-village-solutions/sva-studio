import { describe, expect, it } from 'vitest';

import { hasMainserverActionAccessScope } from './mutation-principal-permission-scope.js';

describe('hasMainserverActionAccessScope', () => {
  it('matches the explicit resource type independently of the action namespace', () => {
    expect(
      hasMainserverActionAccessScope(
        [{ action: 'news.update', resourceType: 'content', accessScope: 'all' }],
        'news.update',
        'content',
        'all'
      )
    ).toBe(true);
  });
});
