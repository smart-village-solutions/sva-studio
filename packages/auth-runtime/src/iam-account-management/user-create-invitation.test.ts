import { describe, expect, it } from 'vitest';

import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import { buildInvitationFailure } from './user-create-invitation.js';

describe('user create invitation', () => {
  it('does not expose raw unexpected error messages in invitation failures', () => {
    expect(buildInvitationFailure(new Error('smtp password leaked'))).toEqual({
      status: 'failed',
      error: {
        code: 'internal_error',
        message: 'Einladungs-E-Mail konnte nicht versendet werden.',
        retryable: false,
      },
    });
  });

  it('keeps specific unavailable and request error mappings intact', () => {
    expect(buildInvitationFailure(new KeycloakAdminUnavailableError('boom'))).toEqual({
      status: 'failed',
      error: {
        code: 'keycloak_unavailable',
        message: 'Einladungs-E-Mail zum Passwort setzen konnte nicht an Keycloak übergeben werden.',
        retryable: true,
      },
    });

    expect(
      buildInvitationFailure(
        new KeycloakAdminRequestError({
          message: 'not ready',
          statusCode: 404,
          code: 'user_not_ready',
          retryable: true,
        })
      )
    ).toEqual({
      status: 'failed',
      error: {
        code: 'keycloak_user_not_ready',
        message: 'Der Nutzer wurde in Keycloak angelegt, war aber für den Einladungsversand noch nicht bereit.',
        retryable: true,
      },
    });
  });
});
