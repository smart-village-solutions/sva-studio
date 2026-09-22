import type { IamCreateUserResult } from '@sva/core';
import { filterTenantTechnicalKeycloakRoleNames } from '@sva/iam-admin';
import {
  logger,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { readInstanceRegistryPluginTenantLifecycleRegistry } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { withRegistryRepository } from '../iam-instance-registry/repository.js';
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
import { persistProvisionedMainserverCredentials } from './mainserver-credential-persistence.js';
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

const requestSsfAuthorizationReconcile = async (actor: CreateUserActorInfo): Promise<void> => {
  const lifecycle = readInstanceRegistryPluginTenantLifecycleRegistry().get('ssf');
  const contractRevision = lifecycle?.contractRevision;
  if (!lifecycle || !contractRevision) return;

  try {
    await withRegistryRepository((repository) =>
      repository.persistPluginTenantLifecycleReconcileIntents({
        instanceId: actor.instanceId,
        lifecycles: [{ pluginId: lifecycle.pluginId, contractRevision }],
        forcePluginIds: ['ssf'],
      })
    );
  } catch (error) {
    logger.error('SSF authorization reconcile scheduling failed after IAM user creation', {
      workspace_id: actor.instanceId,
      context: {
        operation: 'schedule_ssf_authorization_reconcile',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
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
  const fallbackIdentityProvider = await resolveIdentityProviderForInstance(
    input.actor.instanceId,
    {
      executionMode: 'tenant_admin',
    }
  );
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
    await requestSsfAuthorizationReconcile(actor);

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
