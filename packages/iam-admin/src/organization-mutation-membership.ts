import type { z } from 'zod';
import { updateOrganizationMembershipSchema } from './organization-schemas.js';
import type {
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';
import { createAdminMutationHandler, readOrganizationId } from './organization-mutation-request.js';
import type { QueryClient } from './query-client.js';

type UpdateMembershipState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly organizationId: string;
  readonly accountId: string;
  readonly input: { readonly data: z.infer<typeof updateOrganizationMembershipSchema> };
};
type CurrentMembership = {
  readonly membership_visibility: 'internal' | 'external';
  readonly is_default_context: boolean;
};

const resolveMembershipUpdate = async (
  client: QueryClient,
  state: UpdateMembershipState,
  current: CurrentMembership | undefined
) => {
  const { actor, organizationId, accountId, input } = state;
  const nextVisibility = input.data.visibility ?? current?.membership_visibility ?? 'internal';
  const requestedDefaultContext =
    input.data.isDefaultContext ?? current?.is_default_context ?? false;
  const requiresFallbackPromotion =
    input.data.isDefaultContext === false && current?.is_default_context;
  let nextDefaultContext = requestedDefaultContext;

  if (requiresFallbackPromotion) {
    const fallbackMembership = await client.query<{ organization_id: string }>(
      `
SELECT organization_id
FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND organization_id <> $3::uuid
ORDER BY created_at ASC, organization_id ASC
LIMIT 1;
`,
      [actor.instanceId, accountId, organizationId]
    );
    nextDefaultContext = fallbackMembership.rowCount === 0;
  }
  return { nextVisibility, nextDefaultContext, requiresFallbackPromotion };
};

const writeMembershipUpdate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: UpdateMembershipState,
  client: QueryClient,
  selection: Awaited<ReturnType<typeof resolveMembershipUpdate>>
): Promise<{ readonly status: 'ok'; readonly detail: unknown | undefined }> => {
  const { actor, organizationId, accountId, input } = state;
  const { nextVisibility, nextDefaultContext, requiresFallbackPromotion } = selection;
  if (input.data.isDefaultContext === true) {
    await client.query(
      `
UPDATE iam.account_organizations
SET is_default_context = false
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [actor.instanceId, accountId]
    );
  }

  await client.query(
    `
UPDATE iam.account_organizations
SET
  membership_visibility = $4,
  is_default_context = $5::boolean
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND organization_id = $3::uuid;
`,
    [actor.instanceId, accountId, organizationId, nextVisibility, nextDefaultContext]
  );

  if (requiresFallbackPromotion && !nextDefaultContext) {
    await client.query(
      `
WITH fallback_membership AS (
  SELECT organization_id
  FROM iam.account_organizations
  WHERE instance_id = $1
    AND account_id = $2::uuid
    AND organization_id <> $3::uuid
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
      [actor.instanceId, accountId, organizationId]
    );
  }

  await deps.notifyPermissionInvalidation(client, {
    instanceId: actor.instanceId,
    trigger: 'organization_membership_updated',
  });
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    subjectId: accountId,
    eventType: 'organization.membership_updated',
    result: 'success',
    payload: {
      organizationId,
      accountId,
      visibility: nextVisibility,
      isDefaultContext: nextDefaultContext,
    },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  const detail = await deps.loadOrganizationDetail(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  return { status: 'ok' as const, detail };
};

const updateMembershipTransaction = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: UpdateMembershipState,
  client: QueryClient
) => {
  const { actor, organizationId, accountId } = state;
  const current = await client.query<{
    membership_visibility: 'internal' | 'external';
    is_default_context: boolean;
  }>(
    `
SELECT membership.membership_visibility, membership.is_default_context
FROM iam.account_organizations membership
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
  const selection = await resolveMembershipUpdate(client, state, current.rows[0]);
  return writeMembershipUpdate(deps, state, client, selection);
};

const executeMembershipUpdate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: UpdateMembershipState
): Promise<Response> => {
  const { actor } = state;
  try {
    const result = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      updateMembershipTransaction(deps, state, client)
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

export const createOrganizationMembershipUpdateHandler = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const updateOrganizationMembershipInternal = createAdminMutationHandler(deps, {
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
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody(request, updateOrganizationMembershipSchema);
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: (state) => executeMembershipUpdate(deps, state),
  });
  return { updateOrganizationMembershipInternal };
};
