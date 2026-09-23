import type { IamCreateUserResult } from '@sva/core';
import {
  filterTenantTechnicalKeycloakRoleNames,
  resolveTenantTechnicalKeycloakRoleNames,
} from '@sva/iam-admin';
import { logger, trackKeycloakCall, withInstanceScopedDb } from './shared.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import {
  buildInvitationFailure,
  logInvitationFailure,
  sendPasswordSetupInvitation,
  type CreateUserActorInfo,
} from './user-create-invitation.js';
import type { CreateUserPayload } from './user-create-persistence.js';
import { persistCreatedUser, prepareCreatedUserAssignments } from './user-create-persistence.js';
import { maskEmail } from './user-mapping.js';
import { provisionMainserverUserCredentials } from './mainserver-user-provisioning.js';
import { persistProvisionedMainserverCredentials } from './mainserver-credential-persistence.js';
import { logMainserverProvisioningFailure } from './user-create-mainserver-provisioning-log.js';
import { withSsfAccountCreate } from './ssf-account-create.js';
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
  const technicalRoleNames = filterTenantTechnicalKeycloakRoleNames(input.roleNames);
  if (technicalRoleNames.length === 0) {
    return;
  }

  await ensureManagedRealmRolesExist({
    instanceId: input.actor.instanceId,
    identityProvider: input.identityProvider,
    roleKeys: technicalRoleNames,
    actorAccountId: input.actor.actorAccountId,
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });
  await trackKeycloakCall('sync_roles', () =>
    input.identityProvider.provider.syncRoles(input.keycloakSubject, [...technicalRoleNames])
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
    identityProvider: input.identityProvider.provider,
    instanceId: input.actor.instanceId,
    keycloakSubject: input.keycloakSubject,
    credentials,
    trackKeycloakCall,
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
      error,
    });
    return buildCreateUserResult(input.responseData, buildInvitationFailure(error));
  }
};

const deleteCreatedExternalUser = async (input: {
  actor: CreateUserActorInfo;
  identityProvider: IdentityProviderResolution;
  createdExternalId: string;
}) => {
  await trackKeycloakCall('delete_user_compensation', () =>
    input.identityProvider.provider.deleteUser(input.createdExternalId)
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
    return await withSsfAccountCreate({
      instanceId: actor.instanceId,
      execute: async ({ readClaims }) => {
        const assignments = await withInstanceScopedDb(actor.instanceId, (client) =>
          prepareCreatedUserAssignments(client, { actor, actorSubject, payload })
        );
        const claims = await withInstanceScopedDb(actor.instanceId, (client) =>
          readClaims({
            client,
            keycloakSubject: 'new-account',
            roleIds: assignments.effectiveRoleIds,
            roleNames: assignments.effectiveRoles.map((role) => role.role_name),
          })
        );
        const createdIdentityUser = await trackKeycloakCall('create_user', () =>
          identityProvider.provider.createUser({
            username: payload.email,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            enabled: payload.status !== 'inactive',
            attributes: {
              instanceId: actor.instanceId,
              ...claims.attributes,
            },
          })
        );
        const externalId = createdIdentityUser.externalId;
        createdExternalId = externalId;

        await syncUserRolesIfNeeded({
          actor,
          identityProvider,
          keycloakSubject: externalId,
          roleNames: resolveTenantTechnicalKeycloakRoleNames(assignments.effectiveRoles),
        });

        const result = await withInstanceScopedDb(actor.instanceId, (client) =>
          persistCreatedUser(client, {
            actor,
            actorSubject,
            externalId,
            payload,
            assignments,
          })
        );

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
      },
    });
  } catch (error) {
    logCreateUserFailure({
      actor,
      email: payload.email,
      error,
    });

    if (createdExternalId) {
      try {
        await deleteCreatedExternalUser({
          actor,
          identityProvider,
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
