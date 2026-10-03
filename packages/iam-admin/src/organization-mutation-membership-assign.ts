import type { z } from 'zod';
import { assignOrganizationMembershipSchema } from './organization-schemas.js';
import type {
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';
import {
  completeFailedIdempotency,
  createAdminMutationHandler,
  readOrganizationId,
} from './organization-mutation-request.js';
import type { QueryClient } from './query-client.js';

const ASSIGN_MEMBERSHIP_ENDPOINT = 'POST:/api/v1/iam/organizations/$organizationId/memberships';
type AssignState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly organizationId: string;
  readonly input: {
    readonly data: z.infer<typeof assignOrganizationMembershipSchema>;
    readonly rawBody: string;
  };
  readonly endpoint: string;
  readonly idempotencyKey: string;
};

const writeMembershipAssignment = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: AssignState,
  client: QueryClient
): Promise<{ readonly status: 'ok'; readonly detail: unknown | undefined }> => {
  const { actor, organizationId, input } = state;
  if (input.data.isDefaultContext) {
    await client.query(
      `
UPDATE iam.account_organizations
SET is_default_context = false
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [actor.instanceId, input.data.accountId]
    );
  }

  const existingDefault = await client.query<{ organization_id: string }>(
    `
SELECT organization_id
FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND is_default_context = true
LIMIT 1;
`,
    [actor.instanceId, input.data.accountId]
  );
  const shouldUseDefault = input.data.isDefaultContext ?? existingDefault.rowCount === 0;

  await client.query(
    `
INSERT INTO iam.account_organizations (
  instance_id,
  account_id,
  organization_id,
  is_default_context,
  membership_visibility
)
VALUES ($1, $2::uuid, $3::uuid, $4::boolean, $5)
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;
`,
    [
      actor.instanceId,
      input.data.accountId,
      organizationId,
      shouldUseDefault,
      input.data.visibility ?? 'internal',
    ]
  );

  await deps.notifyPermissionInvalidation(client, {
    instanceId: actor.instanceId,
    trigger: 'organization_membership_assigned',
  });
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    subjectId: input.data.accountId,
    eventType: 'organization.membership_assigned',
    result: 'success',
    payload: {
      organizationId,
      accountId: input.data.accountId,
      isDefaultContext: shouldUseDefault,
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

const assignMembershipTransaction = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: AssignState,
  client: QueryClient
) => {
  const { actor, organizationId, input } = state;
  const org = await deps.loadOrganizationById(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  if (!org) {
    return { status: 'not_found' as const };
  }
  if (!org.is_active) {
    return { status: 'inactive' as const };
  }

  const membershipAccount = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.accounts
WHERE id = $1::uuid
  AND instance_id = $2
LIMIT 1;
`,
    [input.data.accountId, actor.instanceId]
  );
  if (membershipAccount.rowCount === 0) {
    return { status: 'invalid_account' as const };
  }
  return writeMembershipAssignment(deps, state, client);
};

const executeAssign = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: AssignState
): Promise<Response> => {
  const { actor, input, endpoint, idempotencyKey } = state;
  const reserve = await deps.reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint,
    idempotencyKey,
    payloadHash: deps.toPayloadHash(input.rawBody),
  });
  if (reserve.status === 'replay') {
    return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }
  try {
    const organization = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      assignMembershipTransaction(deps, state, client)
    );
    if (organization.status === 'not_found') {
      return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
    }
    if (organization.status === 'inactive') {
      return deps.createApiError(
        409,
        'organization_inactive',
        'Inaktive Organisation erlaubt keine neue Membership.',
        actor.requestId
      );
    }
    if (organization.status === 'invalid_account') {
      return deps.createApiError(
        400,
        'invalid_request',
        'Account gehört nicht zur aktiven Instanz.',
        actor.requestId
      );
    }

    const responseBody = deps.asApiItem(organization.detail, actor.requestId);
    await deps.completeIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      endpoint,
      idempotencyKey,
      status: 'COMPLETED',
      responseStatus: 200,
      responseBody,
    });
    return deps.jsonResponse(200, responseBody);
  } catch {
    const responseBody = {
      error: {
        code: 'database_unavailable' as const,
        message: 'IAM-Datenbank ist nicht erreichbar.',
      },
      ...(actor.requestId ? { requestId: actor.requestId } : {}),
    };
    return completeFailedIdempotency(deps, {
      actor,
      endpoint,
      idempotencyKey,
      responseStatus: 503,
      responseBody,
    });
  }
};

export const createOrganizationMembershipAssignHandler = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const assignOrganizationMembershipInternal = createAdminMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      return organizationId instanceof Response ? organizationId : { organizationId };
    },
    idempotency: ({ request, actor }) => {
      const idempotency = deps.requireIdempotencyKey(request, actor.requestId);
      return 'error' in idempotency
        ? idempotency.error
        : {
            endpoint: ASSIGN_MEMBERSHIP_ENDPOINT,
            idempotencyKey: idempotency.key,
          };
    },
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody(request, assignOrganizationMembershipSchema);
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: (state) => executeAssign(deps, state),
  });
  return { assignOrganizationMembershipInternal };
};
