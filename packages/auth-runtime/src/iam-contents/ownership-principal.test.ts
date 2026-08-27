import { describe, expect, it } from 'vitest';

import { resolveContentOwnerPrincipal } from './ownership-principal.js';

describe('content owner principal', () => {
  it('resolves an account-only owner', () => {
    expect(
      resolveContentOwnerPrincipal({
        ownerUserId: '11111111-1111-4111-8111-111111111111',
      })
    ).toEqual({
      type: 'account',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('returns undefined when no owner is recorded', () => {
    expect(resolveContentOwnerPrincipal({})).toBeUndefined();
  });

  it('treats an organization as owner for legacy rows with both owner fields', () => {
    expect(
      resolveContentOwnerPrincipal({
        ownerUserId: '11111111-1111-4111-8111-111111111111',
        ownerOrganizationId: '22222222-2222-4222-8222-222222222222',
      })
    ).toEqual({
      type: 'organization',
      id: '22222222-2222-4222-8222-222222222222',
    });
  });
});
