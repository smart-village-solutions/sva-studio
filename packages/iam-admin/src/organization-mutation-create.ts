import type { z } from 'zod';
import { createOrganizationSchema } from './organization-schemas.js';
import type {
  OrganizationMutationAuthenticatedRequestContext,
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';
import {
  completeFailedIdempotency,
  createAdminMutationHandler,
} from './organization-mutation-request.js';
import type { QueryClient } from './query-client.js';

const CREATE_ORGANIZATION_ENDPOINT = 'POST:/api/v1/iam/organizations';
type CreateState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly context: OrganizationMutationAuthenticatedRequestContext;
  readonly input: {
    readonly data: z.infer<typeof createOrganizationSchema>;
    readonly rawBody: string;
  };
  readonly endpoint: string;
  readonly idempotencyKey: string;
};

const persistOrganization = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: CreateState,
  client: QueryClient
): Promise<unknown | undefined> => {
  const { actor, input } = state;
  const hierarchy = await deps.resolveHierarchyFields(client, {
    instanceId: actor.instanceId,
    parentOrganizationId: input.data.parentOrganizationId,
  });
  if (!hierarchy.ok) {
    throw hierarchy;
  }

  const organizationId = deps.randomUUID();
  const inserted = await client.query<{ id: string }>(
    `
INSERT INTO iam.organizations (
  id,
  instance_id,
  organization_key,
  display_name,
  metadata,
  organization_type,
  content_author_policy,
  parent_organization_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8::uuid, $9::uuid[], $10::int, true)
RETURNING id;
`,
    [
      organizationId,
      actor.instanceId,
      input.data.organizationKey,
      input.data.displayName,
      JSON.stringify(input.data.metadata ?? {}),
      input.data.organizationType,
      input.data.contentAuthorPolicy,
      input.data.parentOrganizationId ?? null,
      hierarchy.hierarchyPath,
      hierarchy.depth,
    ]
  );

  const createdOrganizationId = inserted.rows[0]?.id ?? organizationId;
  await deps.upsertOrganizationMainserverCredentials(client, {
    instanceId: actor.instanceId,
    organizationId: createdOrganizationId,
    actorAccountId: actor.actorAccountId,
    mainserverApplicationId: input.data.mainserverApplicationId,
    mainserverApplicationSecret: input.data.mainserverApplicationSecret,
  });
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    eventType: 'organization.created',
    result: 'success',
    payload: {
      organizationId: createdOrganizationId,
      organizationKey: input.data.organizationKey,
      organizationType: input.data.organizationType,
    },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return deps.loadOrganizationDetail(client, {
    instanceId: actor.instanceId,
    organizationId: createdOrganizationId,
  });
};

const completeCreate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: CreateState,
  created: unknown
): Promise<Response> => {
  const { actor, context, endpoint, idempotencyKey } = state;
  deps.logger.info('Organization created', {
    workspace_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    context: {
      operation: 'organization_created',
      organization_id: (created as { readonly id?: string }).id,
      organization_key: (created as { readonly organizationKey?: string }).organizationKey,
    },
  });

  let responseData = created;
  if (deps.afterOrganizationCreated) {
    try {
      responseData =
        (await deps.afterOrganizationCreated({
          actor,
          actorSubject: context.user.id,
          organization: created,
        })) ?? created;
    } catch (error) {
      deps.logger.error('IAM organization post-create processing failed', {
        workspace_id: actor.instanceId,
        context: {
          operation: 'organization_post_create',
          organization_id: (created as { readonly id?: string }).id,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
        },
      });
    }
  }

  const responseBody = deps.asApiItem(responseData, actor.requestId);
  await deps.completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint,
    idempotencyKey,
    status: 'COMPLETED',
    responseStatus: 201,
    responseBody,
  });

  return deps.jsonResponse(201, responseBody);
};

const failCreate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: CreateState,
  error: unknown
): Promise<Response> => {
  const { actor, endpoint, idempotencyKey } = state;
  if (deps.isHierarchyError(error)) {
    const responseBody = {
      error: { code: error.code, message: error.message },
      ...(actor.requestId ? { requestId: actor.requestId } : {}),
    };
    return completeFailedIdempotency(deps, {
      actor,
      endpoint,
      idempotencyKey,
      responseStatus: error.status,
      responseBody,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  deps.logger.error('IAM organization creation failed', {
    workspace_id: actor.instanceId,
    context: {
      operation: 'create_organization',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      actor_account_id: actor.actorAccountId,
      error: message,
    },
  });
  const status = message.includes('organizations_instance_key_uniq') ? 409 : 503;
  const responseBody = {
    error: {
      code: status === 409 ? 'conflict' : 'database_unavailable',
      message:
        status === 409
          ? 'Organisation mit diesem Schlüssel existiert bereits.'
          : 'IAM-Datenbank ist nicht erreichbar.',
    },
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
  };
  return completeFailedIdempotency(deps, {
    actor,
    endpoint,
    idempotencyKey,
    responseStatus: status,
    responseBody,
  });
};

const executeCreate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: CreateState
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
    const created = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      persistOrganization(deps, state, client)
    );
    if (!created) {
      throw new Error('organization_not_created');
    }
    return await completeCreate(deps, state, created);
  } catch (error) {
    return failCreate(deps, state, error);
  }
};

export const createOrganizationHandler = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const createOrganizationInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    idempotency: ({ request, actor }) => {
      const idempotency = deps.requireIdempotencyKey(request, actor.requestId);
      return 'error' in idempotency
        ? idempotency.error
        : {
            endpoint: CREATE_ORGANIZATION_ENDPOINT,
            idempotencyKey: idempotency.key,
          };
    },
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody(request, createOrganizationSchema);
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: (state) => executeCreate(deps, state),
  });
  return { createOrganizationInternal };
};
