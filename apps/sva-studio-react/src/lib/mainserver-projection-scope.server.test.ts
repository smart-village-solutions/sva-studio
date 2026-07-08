import { describe, expect, it } from 'vitest';

import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.server';

describe('mainserver projection scope', () => {
  it('builds a scope key with the no-organization fallback', () => {
    expect(
      buildMainserverProjectionScopeKey({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        contentType: 'news.article',
      })
    ).toBe('de-musterhausen::account-1::no-organization::news.article');
  });

  it('rejects blank actor account ids', () => {
    expect(() =>
      buildMainserverProjectionScopeKey({
        instanceId: 'de-musterhausen',
        actorAccountId: '   ',
        activeOrganizationId: 'org-1',
        contentType: 'news.article',
      })
    ).toThrowError('mainserver_projection_scope_requires_actor_account_id');
  });
});
