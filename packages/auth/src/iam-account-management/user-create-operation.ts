import {
  logger,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { ensureManagedRealmRolesExist } from './shared-managed-role-sync.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import type { CreateUserPayload } from './user-create-persistence.js';
import { persistCreatedUser } from './user-create-persistence.js';
import { maskEmail } from './user-mapping.js';

type CreateUserActorInfo = {
  instanceId: string;
  actorAccountId: string;
  actorRoles?: readonly string[];
  requestId?: string;
  traceId?: string;
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
}): Promise<Awaited<ReturnType<typeof persistCreatedUser>>> => {
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

    if (result.roleNames.length > 0) {
      await ensureManagedRealmRolesExist({
        instanceId: actor.instanceId,
        identityProvider,
        externalRoleNames: result.roleNames,
        actorAccountId: actor.actorAccountId,
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
      await trackKeycloakCall('sync_roles', () =>
        identityProvider.provider.syncRoles(result.responseData.keycloakSubject, result.roleNames)
      );
    }

    return result;
  } catch (error) {
    logger.error('IAM user creation failed', {
      workspace_id: actor.instanceId,
      context: {
        operation: 'create_user',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        actor_account_id: actor.actorAccountId,
        email_masked: maskEmail(payload.email),
        error: error instanceof Error ? error.message : String(error),
      },
    });

    if (createdExternalId) {
      try {
        await deactivateCreatedExternalUser({
          actor,
          createdExternalId,
        });
      } catch (compensationError) {
        logger.error('IAM user create compensation failed', {
          workspace_id: actor.instanceId,
          context: {
            operation: 'create_user_compensation',
            keycloak_subject: createdExternalId,
            request_id: actor.requestId,
            trace_id: actor.traceId,
            error: compensationError instanceof Error ? compensationError.message : String(compensationError),
          },
        });
      }
    }

    throw error;
  }
};
