import { describe, expect, it } from 'vitest';

import {
  getAuthenticatedInstanceId,
  validateAuthenticatedIamPayloads,
} from './restore-authenticated-iam-smoke.ts';

describe('authenticated restore IAM smoke', () => {
  const authMe = {
    user: {
      instanceId: 'de-musterhausen',
      permissionActions: ['iam.user.read'],
      permissionStatus: 'ok',
    },
  };
  const permissions = { permissions: [{ action: 'iam.user.read' }] };

  it('accepts a non-degraded authenticated permission snapshot', () => {
    expect(() => validateAuthenticatedIamPayloads(authMe, permissions)).not.toThrow();
    expect(getAuthenticatedInstanceId(authMe)).toBe('de-musterhausen');
  });

  it('rejects an auth session without an instance id', () => {
    expect(() =>
      getAuthenticatedInstanceId({ user: { permissionActions: [], permissionStatus: 'ok' } })
    ).toThrow('restore_iam_smoke_auth_payload_invalid');
  });

  it('rejects degraded auth sessions and malformed permission payloads', () => {
    expect(() =>
      validateAuthenticatedIamPayloads(
        { user: { permissionActions: [], permissionStatus: 'degraded' } },
        permissions
      )
    ).toThrow('restore_iam_smoke_permissions_degraded');
    expect(() => validateAuthenticatedIamPayloads(authMe, { permissions: null })).toThrow(
      'restore_iam_smoke_permissions_payload_invalid'
    );
  });
});
