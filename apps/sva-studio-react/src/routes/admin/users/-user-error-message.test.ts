import { describe, expect, it } from 'vitest';

import { setActiveLocale, t } from '../../../i18n';
import { userErrorMessage } from './-user-error-message';

describe('userErrorMessage', () => {
  it('prefers runtime diagnostics before falling back to raw error codes', () => {
    expect(userErrorMessage(null)).toBe(t('admin.users.messages.error'));

    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 401,
        code: 'unauthorized',
        message: 'Unauthorized',
        diagnosticStatus: 'recovery_laeuft',
      } as never)
    ).toBe(t('admin.users.errors.recoveryRunning'));

    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 503,
        code: 'keycloak_unavailable',
        message: 'reconcile failed',
        classification: 'keycloak_reconcile',
      } as never)
    ).toBe(t('admin.users.errors.keycloakReconcile'));
  });

  it('maps unexpected client and http failures deterministically', () => {
    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 0,
        code: 'non_json_response',
        message: 'socket hang up',
      } as never)
    ).toBe(t('admin.users.errors.unexpectedClient', { message: 'socket hang up' }));

    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'internal_error',
        message: 'http_502',
      } as never)
    ).toBe(t('admin.users.errors.unexpectedHttp', { status: '502' }));

    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'internal_error',
        message: 'connection reset',
      } as never)
    ).toBe(t('admin.users.errors.unexpectedClient', { message: 'connection reset' }));
  });

  it('maps mainserver reprovisioning errors to dedicated user messages', () => {
    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'mainserver_user_conflict',
        message: 'Conflict',
      } as never)
    ).toBe(t('admin.users.errors.mainserverUserConflict'));

    expect(
      userErrorMessage({
        name: 'IamHttpError',
        status: 504,
        code: 'mainserver_provisioning_failed',
        message: 'Timeout',
      } as never)
    ).toBe(t('admin.users.errors.mainserverProvisioningFailed'));
  });

  it.each([
    {
      code: 'mainserver_tenant_forbidden',
      expected:
        'The Mainserver rejected provisioning for this organization. Check the active organization and tenant assignment.',
    },
    {
      code: 'mainserver_request_rejected',
      expected:
        'The Mainserver rejected the provisioning request as invalid. Check the integration contract and requested role.',
    },
  ])('localizes the bulk rejection code $code in English', ({ code, expected }) => {
    setActiveLocale('en');
    try {
      expect(
        userErrorMessage({
          name: 'IamHttpError',
          status: code === 'mainserver_tenant_forbidden' ? 403 : 422,
          code,
          message: 'Nicht lokalisierte Servermeldung',
        } as never)
      ).toBe(expected);
    } finally {
      setActiveLocale('de');
    }
  });
});
