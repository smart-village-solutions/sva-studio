import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveAuthConfigForInstance: vi.fn(async () => ({
    clientId: 'studio-client',
    redirectUri: 'https://studio.example/auth/callback',
  })),
  resolveInvitationDestination: vi.fn(),
  ensureAccountInvitationRealmValues: vi.fn(async () => undefined),
}));

vi.mock('../config.js', () => ({
  resolveAuthConfigForInstance: state.resolveAuthConfigForInstance,
}));
vi.mock('./invitation-destination.js', () => ({
  resolveInvitationDestination: state.resolveInvitationDestination,
}));
vi.mock('./account-invitation-guard.js', () => ({
  ensureAccountInvitationRealmValues: state.ensureAccountInvitationRealmValues,
}));

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client.js';
import { buildInvitationFailure, sendPasswordSetupInvitation } from './user-create-invitation.js';

describe('user create invitation', () => {
  it('sends the initial SSF invitation with the selected client and login URL', async () => {
    const executeActionsEmail = vi.fn(async () => undefined);
    state.resolveInvitationDestination.mockResolvedValueOnce({
      clientId: 'ssf-frontend',
      redirectUri: 'https://dialog.kassel.de/login',
    });
    await expect(
      sendPasswordSetupInvitation({
        actor: { instanceId: 'tenant-a', actorAccountId: 'actor-a' },
        identityProvider: {
          provider: {
            listUsers: vi.fn(async () => [{ externalId: 'kc-a' }]),
            executeActionsEmail,
          },
        } as never,
        email: 'user@example.test',
        keycloakSubject: 'kc-a',
        invitationPurpose: 'ssf',
      })
    ).resolves.toEqual({ status: 'sent' });
    expect(state.resolveInvitationDestination).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a', purpose: 'ssf' })
    );
    expect(executeActionsEmail).toHaveBeenCalledWith('kc-a', {
      actions: ['UPDATE_PASSWORD'],
      clientId: 'ssf-frontend',
      redirectUri: 'https://dialog.kassel.de/login',
    });
  });
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

  it('reports an unavailable SSF destination without leaking its internal state', () => {
    expect(buildInvitationFailure(new Error('ssf_invitation_client_not_ready'))).toEqual({
      status: 'failed',
      error: {
        code: 'ssf_invitation_unavailable',
        message:
          'Die KasselDIALOG-Einladung konnte nicht versendet werden, weil das SSF-Anmeldeziel für diese Instanz nicht bereit ist.',
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
        message:
          'Der Nutzer wurde in Keycloak angelegt, war aber für den Einladungsversand noch nicht bereit.',
        retryable: true,
      },
    });
  });
});
