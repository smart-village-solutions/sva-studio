import type {
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';
import { createAdminMutationHandler, readOrganizationId } from './organization-mutation-request.js';
import type { QueryClient } from './query-client.js';

type RemoveState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly organizationId: string;
  readonly accountId: string;
};

export const revokeOrganizationMemberSessions = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  client: QueryClient,
  instanceId: string,
  organizationId: string
): Promise<void> => {
  const members = await client.query<{ keycloak_subject: string }>(
    `
SELECT account.keycloak_subject
FROM iam.account_organizations membership
JOIN iam.accounts account
  ON account.id = membership.account_id
 AND account.instance_id = membership.instance_id
WHERE membership.instance_id = $1
  AND membership.organization_id = $2::uuid;
`,
    [instanceId, organizationId]
  );
  for (const member of members.rows) {
    await deps.revokeUserSessions({
      keycloakSubject: member.keycloak_subject,
      reason: 'organization_membership_removed',
    });
  }
};

const removeMembershipTransaction = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: RemoveState,
  client: QueryClient
) => {
  const { actor, organizationId, accountId } = state;
  const current = await client.query<{ is_default_context: boolean; keycloak_subject: string }>(
    `
SELECT membership.is_default_context, account.keycloak_subject
FROM iam.account_organizations membership
JOIN iam.accounts account
  ON account.id = membership.account_id
 AND account.instance_id = membership.instance_id
WHERE membership.instance_id = $1
  AND membership.account_id = $2::uuid
  AND membership.organization_id = $3::uuid
LIMIT 1;
`,
    [actor.instanceId, accountId, organizationId]
  );
  if (current.rowCount === 0) {
    return { status: 'not_found' as const };
  }

  await deps.revokeUserSessions({
    keycloakSubject: current.rows[0].keycloak_subject,
    reason: 'organization_membership_removed',
  });

  await client.query(
    `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND organization_id = $3::uuid;
`,
    [actor.instanceId, accountId, organizationId]
  );

  if (current.rows[0]?.is_default_context) {
    await client.query(
      `
WITH fallback_membership AS (
  SELECT organization_id
  FROM iam.account_organizations
  WHERE instance_id = $1
    AND account_id = $2::uuid
  ORDER BY created_at ASC, organization_id ASC
  LIMIT 1
)
UPDATE iam.account_organizations membership
SET is_default_context = true
FROM fallback_membership
WHERE membership.instance_id = $1
  AND membership.account_id = $2::uuid
  AND membership.organization_id = fallback_membership.organization_id;
`,
      [actor.instanceId, accountId]
    );
  }

  await deps.notifyPermissionInvalidation(client, {
    instanceId: actor.instanceId,
    trigger: 'organization_membership_removed',
  });
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    subjectId: accountId,
    eventType: 'organization.membership_removed',
    result: 'success',
    payload: { organizationId, accountId },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  const detail = await deps.loadOrganizationDetail(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  return { status: 'ok' as const, detail };
};

const executeRemove = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: RemoveState
): Promise<Response> => {
  const { actor } = state;
  try {
    const result = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      removeMembershipTransaction(deps, state, client)
    );
    if (result.status === 'not_found') {
      return deps.createApiError(404, 'not_found', 'Membership nicht gefunden.', actor.requestId);
    }
    return deps.jsonResponse(200, deps.asApiItem(result.detail, actor.requestId));
  } catch {
    return deps.createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actor.requestId
    );
  }
};

export const createOrganizationMembershipRemoveHandler = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const removeOrganizationMembershipInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      if (organizationId instanceof Response) {
        return organizationId;
      }
      const accountId = deps.readPathSegment(request, 6);
      if (!accountId || !deps.isUuid(accountId)) {
        return deps.createApiError(400, 'invalid_request', 'Ungültige accountId.', actor.requestId);
      }
      return { organizationId, accountId };
    },
    parse: async () => undefined,
    execute: (state) => executeRemove(deps, state),
  });
  return { removeOrganizationMembershipInternal };
};
