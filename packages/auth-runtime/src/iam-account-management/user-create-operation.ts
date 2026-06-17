import type { IamCreateUserResult } from '@sva/core';
import {
  logger,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import {
  buildInvitationFailure,
  logInvitationFailure,
  sendPasswordSetupInvitation,
  type CreateUserActorInfo,
} from './user-create-invitation.js';
import type { CreateUserPayload } from './user-create-persistence.js';
import { persistCreatedUser } from './user-create-persistence.js';
import { maskEmail } from './user-mapping.js';
import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';

type InvitationResult = IamCreateUserResult['invitation'];

const buildCreateUserResult = (
  user: IamCreateUserResult['user'],
  invitation: InvitationResult
): IamCreateUserResult => ({
  user,
  invitation,
});

const logCreateUserFailure = (input: {
  actor: CreateUserActorInfo;
  email: string;
  error: unknown;
}) => {
  logger.error('IAM user creation failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'create_user',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      actor_account_id: input.actor.actorAccountId,
      email_masked: maskEmail(input.email),
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
};

const logCreateUserCompensationFailure = (input: {
  actor: CreateUserActorInfo;
  createdExternalId: string;
  error: unknown;
}) => {
  logger.error('IAM user create compensation failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'create_user_compensation',
      keycloak_subject: input.createdExternalId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
};

const logMainserverProvisioningFailure = (input: {
  actor: CreateUserActorInfo;
  email: string;
  keycloakSubject: string;
  error: unknown;
}) => {
  logger.error('IAM user mainserver provisioning failed', {
    workspace_id: input.actor.instanceId,
    context: {
      operation: 'create_user_mainserver_provisioning',
      instance_id: input.actor.instanceId,
      request_id: input.actor.requestId,
      trace_id: input.actor.traceId,
      actor_account_id: input.actor.actorAccountId,
      keycloak_subject: input.keycloakSubject,
      email_masked: maskEmail(input.email),
      error: input.error instanceof Error ? input.error.message : String(input.error),
    },
  });
};

const syncUserRolesIfNeeded = async (input: {
  actor: CreateUserActorInfo;
  identityProvider: IdentityProviderResolution;
  keycloakSubject: string;
  roleNames: readonly string[];
}) => {
  if (input.roleNames.length === 0) {
    return;
  }

  await ensureManagedRealmRolesExist({
    instanceId: input.actor.instanceId,
    identityProvider: input.identityProvider,
    externalRoleNames: input.roleNames,
    actorAccountId: input.actor.actorAccountId,
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });
  await trackKeycloakCall('sync_roles', () =>
    input.identityProvider.provider.syncRoles(input.keycloakSubject, input.roleNames)
  );
};

const provisionMainserverCredentialsIfPossible = async (input: {
  actor: CreateUserActorInfo;
  actorSubject: string;
  keycloakSubject: string;
  payload: CreateUserPayload;
}) => {
  const credentials = await provisionMainserverUserCredentials({
    actor: input.actor,
    actorSubject: input.actorSubject,
    keycloakSubject: input.keycloakSubject,
    payload: input.payload,
  });
  if (!credentials) {
    return null;
  }

  return credentials;
};

const deactivateCreatedExternalUser = async (input: {
  actor: CreateUserActorInfo;
  createdExternalId: string;
}) => {
  const fallbackIdentityProvider = await resolveIdentityProviderForInstance(input.actor.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!fallbackIdentityProvider) {
    return;
  }

  await trackKeycloakCall('deactivate_user_compensation', () =>
    fallbackIdentityProvider.provider.deactivateUser(input.createdExternalId)
  );
};

export const executeCreateUser = async (input: {
  actor: CreateUserActorInfo;
  actorSubject: string;
  identityProvider: IdentityProviderResolution;
  payload: CreateUserPayload;
}): Promise<IamCreateUserResult> => {
  const { actor, actorSubject, identityProvider, payload } = input;
  let createdExternalId: string | undefined;

  try {
    const createdIdentityUser = await trackKeycloakCall('create_user', () =>
      identityProvider.provider.createUser({
        username: payload.email,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        enabled: payload.status !== 'inactive',
        attributes: {
          instanceId: actor.instanceId,
        },
      })
    );
    const externalId = createdIdentityUser.externalId;
    createdExternalId = externalId;

    const result = await withInstanceScopedDb(actor.instanceId, (client) =>
      persistCreatedUser(client, {
        actor,
        actorSubject,
        externalId,
        payload,
      })
    );

    await syncUserRolesIfNeeded({
      actor,
      identityProvider,
      keycloakSubject: result.responseData.keycloakSubject,
      roleNames: result.roleNames,
    });

    let mainserverCredentials: Awaited<ReturnType<typeof provisionMainserverCredentialsIfPossible>> = null;
    try {
      mainserverCredentials = await provisionMainserverCredentialsIfPossible({
        actor,
        actorSubject,
        keycloakSubject: result.responseData.keycloakSubject,
        payload,
      });
    } catch (error) {
      logMainserverProvisioningFailure({
        actor,
        email: payload.email,
        keycloakSubject: result.responseData.keycloakSubject,
        error,
      });
    }
    const responseData = mainserverCredentials
      ? {
          ...result.responseData,
          mainserverUserApplicationId: mainserverCredentials.mainserverUserApplicationId,
          mainserverUserApplicationSecretSet: true,
        }
      : result.responseData;

    if (payload.sendPasswordSetupEmail !== true) {
      return buildCreateUserResult(responseData, { status: 'not_requested' });
    }

    try {
      const invitation = await sendPasswordSetupInvitation({
        actor,
        identityProvider,
        email: payload.email,
        keycloakSubject: responseData.keycloakSubject,
      });
      return buildCreateUserResult(responseData, invitation);
    } catch (error) {
      logInvitationFailure({
        actor,
        keycloakSubject: responseData.keycloakSubject,
        error,
      });
      return buildCreateUserResult(responseData, buildInvitationFailure(error));
    }
  } catch (error) {
    logCreateUserFailure({
      actor,
      email: payload.email,
      error,
    });

    if (createdExternalId) {
      try {
        await deactivateCreatedExternalUser({
          actor,
          createdExternalId,
        });
      } catch (compensationError) {
        logCreateUserCompensationFailure({
          actor,
          createdExternalId,
          error: compensationError,
        });
      }
    }

    throw error;
  }
};
