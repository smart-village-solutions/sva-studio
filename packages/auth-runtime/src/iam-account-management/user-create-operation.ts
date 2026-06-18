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
import { buildMainserverIdentityAttributes } from '../mainserver-credentials.js';
import type { CreateUserPayload } from './user-create-persistence.js';
import { persistCreatedUser } from './user-create-persistence.js';
import { maskEmail } from './user-mapping.js';
import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';
import { logMainserverProvisioningFailure } from './user-create-mainserver-provisioning-log.js';
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

const persistProvisionedMainserverCredentials = async (input: {
  identityProvider: IdentityProviderResolution;
  keycloakSubject: string;
  credentials: NonNullable<Awaited<ReturnType<typeof provisionMainserverUserCredentials>>>;
}) => {
  const existingAttributes = await trackKeycloakCall('get_user_attributes', () =>
    input.identityProvider.provider.getUserAttributes(input.keycloakSubject)
  );
  const nextAttributes = buildMainserverIdentityAttributes({
    existingAttributes,
    mainserverUserApplicationId: input.credentials.mainserverUserApplicationId,
    mainserverUserApplicationSecret: input.credentials.mainserverUserApplicationSecret,
  });

  await trackKeycloakCall('update_user', () =>
    input.identityProvider.provider.updateUser(input.keycloakSubject, {
      attributes: nextAttributes,
    })
  );
};
const enrichUserWithMainserverCredentials = (
  user: IamCreateUserResult['user'],
  credentials: NonNullable<Awaited<ReturnType<typeof provisionMainserverUserCredentials>>>
): IamCreateUserResult['user'] => ({
  ...user,
  mainserverUserApplicationId: credentials.mainserverUserApplicationId,
  mainserverUserApplicationSecretSet: true,
});

const tryProvisionMainserverCredentials = async (input: {
  actor: CreateUserActorInfo;
  actorSubject: string;
  identityProvider: IdentityProviderResolution;
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

  await persistProvisionedMainserverCredentials({
    identityProvider: input.identityProvider,
    keycloakSubject: input.keycloakSubject,
    credentials,
  });

  return credentials;
};

const resolveCreateUserResponseData = async (input: {
  actor: CreateUserActorInfo;
  actorSubject: string;
  identityProvider: IdentityProviderResolution;
  payload: CreateUserPayload;
  responseData: IamCreateUserResult['user'];
}) => {
  try {
    const mainserverCredentials = await tryProvisionMainserverCredentials({
      actor: input.actor,
      actorSubject: input.actorSubject,
      identityProvider: input.identityProvider,
      keycloakSubject: input.responseData.keycloakSubject,
      payload: input.payload,
    });
    return mainserverCredentials
      ? enrichUserWithMainserverCredentials(input.responseData, mainserverCredentials)
      : input.responseData;
  } catch (error) {
    logMainserverProvisioningFailure({
      actor: input.actor,
      email: input.payload.email,
      keycloakSubject: input.responseData.keycloakSubject,
      error,
    });
    return input.responseData;
  }
};

const finalizeCreateUserResult = async (input: {
  actor: CreateUserActorInfo;
  identityProvider: IdentityProviderResolution;
  payload: CreateUserPayload;
  responseData: IamCreateUserResult['user'];
}): Promise<IamCreateUserResult> => {
  if (input.payload.sendPasswordSetupEmail !== true) {
    return buildCreateUserResult(input.responseData, { status: 'not_requested' });
  }

  try {
    const invitation = await sendPasswordSetupInvitation({
      actor: input.actor,
      identityProvider: input.identityProvider,
      email: input.payload.email,
      keycloakSubject: input.responseData.keycloakSubject,
    });
    return buildCreateUserResult(input.responseData, invitation);
  } catch (error) {
    logInvitationFailure({
      actor: input.actor,
      keycloakSubject: input.responseData.keycloakSubject,
      error,
    });
    return buildCreateUserResult(input.responseData, buildInvitationFailure(error));
  }
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

    const responseData = await resolveCreateUserResponseData({
      actor,
      actorSubject,
      identityProvider,
      payload,
      responseData: result.responseData,
    });

    return finalizeCreateUserResult({
      actor,
      identityProvider,
      payload,
      responseData,
    });
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
