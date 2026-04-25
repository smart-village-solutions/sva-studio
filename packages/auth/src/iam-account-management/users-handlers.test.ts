import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/iam-admin', () => ({
  buildUpdatedUserParams: (
    userId: string,
    instanceId: string,
    _keycloakSubject: string,
    payload: {
      readonly email?: string;
      readonly displayName?: string;
      readonly firstName?: string;
      readonly lastName?: string;
      readonly status?: 'active' | 'inactive' | 'pending';
    }
  ) => [
    userId,
    instanceId,
    payload.email ? `enc:${payload.email}` : null,
    payload.displayName ? `enc:${payload.displayName}` : null,
    payload.firstName ? `enc:${payload.firstName}` : null,
    payload.lastName ? `enc:${payload.lastName}` : null,
    null,
    null,
    null,
    null,
    null,
    null,
    payload.status ?? null,
    null,
  ],
}));

import { buildUpdatedUserParams, hasSystemAdminRole } from './user-update-utils.ts';

describe('iam-account-management/users-handlers helpers', () => {
  it('detects system admin assignments', () => {
    expect(hasSystemAdminRole([{ roleKey: 'editor' }, { roleKey: 'system_admin' }])).toBe(true);
    expect(hasSystemAdminRole([{ roleKey: 'editor' }])).toBe(false);
  });

  it('builds encrypted update params and keeps optional fields nullable', () => {
    expect(
      buildUpdatedUserParams('user-1', 'instance-1', 'kc-1', {
        email: 'user@example.com',
        displayName: 'User Name',
        firstName: 'User',
        lastName: 'Name',
        status: 'active',
      })
    ).toEqual([
      'user-1',
      'instance-1',
      'enc:user@example.com',
      'enc:User Name',
      'enc:User',
      'enc:Name',
      null,
      null,
      null,
      null,
      null,
      null,
      'active',
      null,
    ]);
  });
});
