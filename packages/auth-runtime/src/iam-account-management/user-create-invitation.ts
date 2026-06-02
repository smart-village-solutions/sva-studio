import type { IamCreateUserResult, IamUserInvitationError } from '@sva/core';
import { resolveAuthConfigForInstance } from '../config.js';
import { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared.js';

export type CreateUserActorInfo = {
  instanceId: string;
  actorAccountId: string;
  actorRoles?: readonly string[];
  requestId?: string;
  traceId?: string;
};

type InvitationResult = IamCreateUserResult['invitation'];

const INVITATION_READINESS_RETRY_DELAYS_MS = [200, 500, 1_000] as const;
const INVITATION_DELIVERY_RETRY_DELAYS_MS = [250, 750] as const;
const INVITATION_NOT_READY_MESSAGE =
  'Der Nutzer wurde in Keycloak angelegt, war aber für den Einladungsversand noch nicht bereit.';

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isMatchingListedUser = (
  users: readonly {
    externalId: string;
    email?: string;
  }[],
  input: {
    email: string;
    keycloakSubject: string;
  }
) => {
  const normalizedEmail = input.email.trim().toLowerCase();
  return users.some(
    (user) =>
      user.externalId === input.keycloakSubject || user.email?.trim().toLowerCase() === normalizedEmail
  );
};

const isInvitationTargetNotReadyError = (error: unknown) =>
  error instanceof KeycloakAdminRequestError && error.statusCode === 404;

const waitForKeycloakUserReadiness = async (input: {
  actor: CreateUserActorInfo;
  identityProvider: IdentityProviderResolution;
  email: string;
  keycloakSubject: string;
}) => {
  for (let attempt = 0; attempt <= INVITATION_READINESS_RETRY_DELAYS_MS.length; attempt += 1) {
    const users = await trackKeycloakCall('list_users_after_create', () =>
      input.identityProvider.provider.listUsers({
        email: input.email,
      })
    );
    if (isMatchingListedUser(users, input)) {
      return;
    }

    if (attempt < INVITATION_READINESS_RETRY_DELAYS_MS.length) {
      await sleep(INVITATION_READINESS_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new KeycloakAdminRequestError({
    message: INVITATION_NOT_READY_MESSAGE,
    statusCode: 404,
    code: 'user_not_ready',
    retryable: true,
  });
};

const executeActionsEmailWithRetry = async (input: {
  actor: CreateUserActorInfo;
  authConfig: Awaited<ReturnType<typeof resolveAuthConfigForInstance>>;
  executeActionsEmail: NonNullable<IdentityProviderResolution['provider']['executeActionsEmail']>;
  keycloakSubject: string;
}) => {
  for (let attempt = 0; attempt <= INVITATION_DELIVERY_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await trackKeycloakCall('execute_actions_email', async () => {
        await input.executeActionsEmail(input.keycloakSubject, {
          actions: ['UPDATE_PASSWORD'],
          clientId: input.authConfig.clientId,
          redirectUri: input.authConfig.redirectUri,
        });
      });
      return;
    } catch (error) {
      if (!isInvitationTargetNotReadyError(error) || attempt >= INVITATION_DELIVERY_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await sleep(INVITATION_DELIVERY_RETRY_DELAYS_MS[attempt]);
    }
  }
};

export const sendPasswordSetupInvitation = async (input: {
  actor: CreateUserActorInfo;
  identityProvider: IdentityProviderResolution;
  email: string;
  keycloakSubject: string;
}): Promise<InvitationResult> => {
  const executeActionsEmail = input.identityProvider.provider.executeActionsEmail?.bind(
    input.identityProvider.provider
  );
  if (!executeActionsEmail) {
    throw new Error('execute_actions_email_not_supported');
  }

  const authConfig = await resolveAuthConfigForInstance(input.actor.instanceId);
  await waitForKeycloakUserReadiness(input);
  await executeActionsEmailWithRetry({
    actor: input.actor,
    authConfig,
    executeActionsEmail,
    keycloakSubject: input.keycloakSubject,
  });

  return { status: 'sent' };
};

export const buildInvitationFailure = (error: unknown): InvitationResult => {
  const invitationError: IamUserInvitationError =
    error instanceof KeycloakAdminUnavailableError
      ? {
          code: 'keycloak_unavailable',
          message:
            'Einladungs-E-Mail zum Passwort setzen konnte nicht an Keycloak übergeben werden.',
          retryable: true,
        }
      : error instanceof KeycloakAdminRequestError && error.code === 'user_not_ready'
        ? {
            code: 'keycloak_user_not_ready',
            message: INVITATION_NOT_READY_MESSAGE,
            retryable: true,
          }
        : isInvitationTargetNotReadyError(error)
          ? {
              code: 'keycloak_user_not_ready',
              message: INVITATION_NOT_READY_MESSAGE,
              retryable: true,
            }
          : error instanceof Error && error.message === 'execute_actions_email_not_supported'
            ? {
                code: 'execute_actions_email_not_supported',
                message: 'Der konfigurierte Identity-Provider unterstützt keine Einladungs-E-Mails.',
                retryable: false,
              }
            : {
                code: 'internal_error',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              };

  return {
    status: 'failed',
    error: invitationError,
  };
};

export const logInvitationFailure = (input: {
  actor: CreateUserActorInfo;
  keycloakSubject: string;
  error: unknown;
}) => {
  logger.error('IAM user invitation email failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'execute_actions_email',
      instance_id: input.actor.instanceId,
      keycloak_subject: input.keycloakSubject,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      actor_account_id: input.actor.actorAccountId,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
};
