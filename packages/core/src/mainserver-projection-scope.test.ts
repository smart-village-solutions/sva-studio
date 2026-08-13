import { describe, expect, it } from 'vitest';

import { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.js';

describe('mainserver projection scope', () => {
  it('keeps actor, organization and credential views isolated', () => {
    const base = {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      activeOrganizationId: 'org-1',
      contentType: 'news.article',
    } as const;

    expect(buildMainserverProjectionScopeKey(base)).toBe(
      'de-musterhausen::account-1::org-1::news.article'
    );
    expect(buildMainserverProjectionScopeKey({ ...base, actingPrincipalType: 'user' })).toBe(
      'de-musterhausen::account-1::org-1::user::news.article'
    );
    expect(
      buildMainserverProjectionScopeKey({ ...base, actingPrincipalType: 'organization' })
    ).toBe('de-musterhausen::account-1::org-1::organization::news.article');
  });

  it('rejects an empty actor account id', () => {
    expect(() =>
      buildMainserverProjectionScopeKey({
        instanceId: 'de-musterhausen',
        actorAccountId: ' ',
        contentType: 'news.article',
      })
    ).toThrow('mainserver_projection_scope_requires_actor_account_id');
  });
});
