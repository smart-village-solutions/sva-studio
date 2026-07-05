import { hasSystemAdminRole, type ApiErrorCode } from '@sva/core';
import { createMutationWorkflow } from '@sva/server-runtime';
import type { z } from 'zod';

import type { OrganizationMainserverCredentialState } from './organization-mainserver-credentials.js';
import {
  assignOrganizationMembershipSchema,
  createOrganizationSchema,
  updateOrganizationContextSchema,
  updateOrganizationSchema,
} from './organization-schemas.js';
import type { QueryClient } from './query-client.js';
import type { IdempotencyReserveResult } from './types.js';

export type OrganizationMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type OrganizationMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type PreparedOrganizationMutationActor = OrganizationMutationActor & {
  readonly actorAccountId: string;
};

type ParseRequestBodyResult<TData> =
  | { readonly ok: true; readonly data: TData; readonly rawBody: string }
  | { readonly ok: false };

type HierarchyResolution =
  | { readonly ok: true; readonly hierarchyPath: readonly string[]; readonly depth: number }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: ApiErrorCode;
      readonly message: string;
    };

type OrganizationRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly is_active: boolean;
  readonly parent_organization_id: string | null;
  readonly hierarchy_path: readonly string[] | null;
  readonly depth: number;
  readonly child_count: number;
  readonly membership_count: number;
};

export type OrganizationMutationHandlerDeps<TFeatureFlags = unknown> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly completeIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }) => Promise<void>;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'write';
    readonly requestId?: string;
  }) => Response | null;
  readonly createActorResolutionDetails: (input: {
    readonly actorResolution: 'missing_actor_account';
    readonly instanceId: string;
  }) => Readonly<Record<string, unknown>>;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly subjectId?: string;
      readonly eventType:
        | 'organization.created'
        | 'organization.updated'
        | 'organization.deactivated'
        | 'organization.membership_assigned'
        | 'organization.membership_removed'
        | 'organization.context_switched';
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin' | 'iam_ui',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly isHierarchyError: (value: unknown) => value is Extract<HierarchyResolution, { readonly ok: false }>;
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly authorizeOrganizationMutationAccess?: (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext,
    requestId?: string
  ) => Promise<Response | null> | Response | null;
  readonly loadContextOptions: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly accountId: string }
  ) => Promise<readonly { readonly organizationId: string; readonly organizationKey: string; readonly isActive: boolean }[]>;
  readonly loadOrganizationById: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<OrganizationRow | undefined>;
  readonly loadOrganizationDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<unknown | undefined>;
  readonly logger: {
    readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject?: string;
      readonly trigger:
        | 'organization_membership_assigned'
        | 'organization_membership_removed'
        | 'organization_context_switched';
    }
  ) => Promise<void>;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodType<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly randomUUID: () => string;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly rebuildOrganizationSubtree: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId: string }
  ) => Promise<void>;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoles: (
    ctx: OrganizationMutationAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveActorInfo: (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext,
    options: {
      readonly requireActorMembership: true;
      readonly provisionMissingActorMembership: true;
    }
  ) => Promise<{ readonly actor: OrganizationMutationActor } | { readonly error: Response }>;
  readonly resolveHierarchyFields: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId?: string; readonly parentOrganizationId?: string | null }
  ) => Promise<HierarchyResolution>;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly upsertOrganizationMainserverCredentials: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly organizationId: string;
      readonly actorAccountId?: string;
      readonly mainserverApplicationId?: string;
      readonly mainserverApplicationSecret?: string;
    }
  ) => Promise<OrganizationMainserverCredentialState>;
  readonly updateSession: (sessionId: string, patch: { readonly activeOrganizationId?: string }) => Promise<void>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const CREATE_ORGANIZATION_ENDPOINT = 'POST:/api/v1/iam/organizations';
const ASSIGN_MEMBERSHIP_ENDPOINT = 'POST:/api/v1/iam/organizations/$organizationId/memberships';

const createMissingOrganizationMutationAuthorizerResponse = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  requestId?: string
): Response =>
  deps.createApiError(
    403,
    'forbidden',
    'Autorisierungsstrategie für Organisationsmutationen ist nicht konfiguriert.',
    requestId,
    {
      reason_code: 'missing_organization_mutation_authorizer',
    }
  );

const prepareAdminMutation = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: OrganizationMutationAuthenticatedRequestContext
): Promise<{ readonly actor: PreparedOrganizationMutationActor } | { readonly error: Response }> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }
  const accessCheck = deps.authorizeOrganizationMutationAccess
    ? await deps.authorizeOrganizationMutationAccess(request, ctx, requestContext.requestId)
    : createMissingOrganizationMutationAuthorizerResponse(deps, requestContext.requestId);
  if (accessCheck) {
    return { error: accessCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution;
  }
  if (!actorResolution.actor.actorAccountId) {
    return {
      error: deps.createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        actorResolution.actor.requestId,
        deps.createActorResolutionDetails({
          actorResolution: 'missing_actor_account',
          instanceId: actorResolution.actor.instanceId,
        })
      ),
    };
  }

  return { actor: { ...actorResolution.actor, actorAccountId: actorResolution.actor.actorAccountId } };
};

const consumeWriteRateLimit = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  actor: OrganizationMutationActor,
  ctx: OrganizationMutationAuthenticatedRequestContext
): Response | null =>
  deps.consumeRateLimit({
    instanceId: actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actor.requestId,
  });

const readOrganizationId = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  requestId?: string
): string | Response => {
  const organizationId = deps.readPathSegment(request, 4);
  if (!organizationId || !deps.isUuid(organizationId)) {
    return deps.createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', requestId);
  }
  return organizationId;
};

const hasOwn = <TObject extends object>(value: TObject, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const hasMainserverCredentialPatch = (value: z.infer<typeof updateOrganizationSchema>): boolean =>
  hasOwn(value, 'mainserverApplicationId') || hasOwn(value, 'mainserverApplicationSecret');

const completeFailedIdempotency = async <TFeatureFlags>(
  deps: Pick<OrganizationMutationHandlerDeps<TFeatureFlags>, 'completeIdempotency' | 'jsonResponse'>,
  input: {
    readonly actor: PreparedOrganizationMutationActor;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }
): Promise<Response> => {
  await deps.completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: input.endpoint,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
  return deps.jsonResponse(input.responseStatus, input.responseBody);
};

type OrganizationAdminMutationState = {
  readonly actor: PreparedOrganizationMutationActor;
};

type OrganizationAdminMutationInput<TPrepared extends object, TIdempotency extends object, TInput> = {
  readonly prepare?: (
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor: PreparedOrganizationMutationActor;
    }>
  ) => Promise<TPrepared | Response> | TPrepared | Response;
  readonly requireRateLimit?: boolean;
  readonly idempotency?: (
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor: PreparedOrganizationMutationActor;
    } & TPrepared>
  ) => Promise<TIdempotency | Response> | TIdempotency | Response;
  readonly parse: (
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor: PreparedOrganizationMutationActor;
    } & TPrepared & TIdempotency>
  ) => Promise<TInput | Response>;
  readonly execute: (
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor: PreparedOrganizationMutationActor;
      input: TInput;
    } & TPrepared & TIdempotency>
  ) => Promise<Response>;
  readonly mapError?: (
    error: unknown,
    state: Readonly<{
      request: Request;
      context: OrganizationMutationAuthenticatedRequestContext;
      actor?: PreparedOrganizationMutationActor;
    } & Partial<TPrepared & TIdempotency>>
  ) => Response;
};

const createAdminMutationHandler = <
  TFeatureFlags,
  TPrepared extends object = Record<never, never>,
  TIdempotency extends object = Record<never, never>,
  TInput = void,
>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  input: OrganizationAdminMutationInput<TPrepared, TIdempotency, TInput>
) => {
  const runIdempotency = input.idempotency;
  const workflow = createMutationWorkflow<
    OrganizationMutationAuthenticatedRequestContext,
    OrganizationAdminMutationState & TPrepared,
    Record<never, never>,
    TIdempotency,
    TInput,
    Response
  >({
    prepare: async ({ request, context }) => {
      const prepared = await prepareAdminMutation(deps, request, context);
      if ('error' in prepared) {
        return prepared.error;
      }

      const preparedState = input.prepare
        ? await input.prepare({
            request,
            context,
            actor: prepared.actor,
          })
        : {};
      if (preparedState instanceof Response) {
        return preparedState;
      }

      return {
        actor: prepared.actor,
        ...preparedState,
      } as OrganizationAdminMutationState & TPrepared;
    },
    authorize: async () => ({}),
    csrf: ({ request, context, actor }) => {
      const csrfError = deps.validateCsrf(request, actor.requestId);
      if (csrfError) {
        return csrfError;
      }

      if (input.requireRateLimit) {
        const rateLimit = consumeWriteRateLimit(deps, actor, context);
        if (rateLimit) {
          return rateLimit;
        }
      }

      return undefined;
    },
    idempotency: runIdempotency
      ? async (state) => {
          return runIdempotency(
            state as Readonly<{
              request: Request;
              context: OrganizationMutationAuthenticatedRequestContext;
              actor: PreparedOrganizationMutationActor;
            } & TPrepared>
          );
        }
      : undefined,
    parse: async (state) => input.parse(state as never),
    execute: async (state) => input.execute(state as never),
    mapError: (error, state) =>
      input.mapError
        ? input.mapError(error, state as never)
        : deps.createApiError(
            503,
            'database_unavailable',
            'IAM-Datenbank ist nicht erreichbar.',
            state.actor?.requestId ?? deps.getWorkspaceContext().requestId
          ),
    respond: (response) => response,
  });

  return (request: Request, context: OrganizationMutationAuthenticatedRequestContext): Promise<Response> =>
    workflow(request, context);
};

export const createOrganizationMutationHandlers = <TFeatureFlags>(
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
    execute: async ({ actor, input, endpoint, idempotencyKey }) => {
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
        const created = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
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
        });

        if (!created) {
          throw new Error('organization_not_created');
        }

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

        const responseBody = deps.asApiItem(created, actor.requestId);
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
      } catch (error) {
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
      }
    },
  });

  const updateOrganizationInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      return organizationId instanceof Response ? organizationId : { organizationId };
    },
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody(request, updateOrganizationSchema);
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: async ({ actor, organizationId, input }) => {
      try {
        const updated = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const existing = await deps.loadOrganizationById(client, { instanceId: actor.instanceId, organizationId });
        if (!existing) {
          return undefined;
        }

        const nextParentOrganizationId =
          input.data.parentOrganizationId === undefined ? existing.parent_organization_id : input.data.parentOrganizationId;
        const hierarchy = await deps.resolveHierarchyFields(client, {
          instanceId: actor.instanceId,
          organizationId,
          parentOrganizationId: nextParentOrganizationId,
        });
        if (!hierarchy.ok) {
          throw hierarchy;
        }

        await client.query(
          `
UPDATE iam.organizations
SET
  organization_key = COALESCE($3, organization_key),
  display_name = COALESCE($4, display_name),
  parent_organization_id = $5::uuid,
  organization_type = COALESCE($6, organization_type),
  content_author_policy = COALESCE($7, content_author_policy),
  is_active = COALESCE($8, is_active),
  metadata = COALESCE($9::jsonb, metadata),
  hierarchy_path = $10::uuid[],
  depth = $11::int,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
          [
            actor.instanceId,
            organizationId,
            input.data.organizationKey ?? null,
            input.data.displayName ?? null,
            nextParentOrganizationId ?? null,
            input.data.organizationType ?? null,
            input.data.contentAuthorPolicy ?? null,
            input.data.isActive ?? null,
            input.data.metadata ? JSON.stringify(input.data.metadata) : null,
            hierarchy.hierarchyPath,
            hierarchy.depth,
          ]
        );
        if (hasMainserverCredentialPatch(input.data)) {
          await deps.upsertOrganizationMainserverCredentials(client, {
            instanceId: actor.instanceId,
            organizationId,
            actorAccountId: actor.actorAccountId,
            mainserverApplicationId: input.data.mainserverApplicationId,
            mainserverApplicationSecret: input.data.mainserverApplicationSecret,
          });
        }

        await deps.rebuildOrganizationSubtree(client, { instanceId: actor.instanceId, organizationId });
        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'organization.updated',
          result: 'success',
          payload: { organizationId, parentOrganizationId: nextParentOrganizationId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        return deps.loadOrganizationDetail(client, { instanceId: actor.instanceId, organizationId });
      });

      if (!updated) {
        return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
      }
      return deps.jsonResponse(200, deps.asApiItem(updated, actor.requestId));
      } catch (error) {
        if (deps.isHierarchyError(error)) {
          return deps.createApiError(error.status, error.code, error.message, actor.requestId);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('organizations_instance_key_uniq')) {
          return deps.createApiError(409, 'conflict', 'Organisation mit diesem Schlüssel existiert bereits.', actor.requestId);
        }
        return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actor.requestId);
      }
    },
  });

  const deactivateOrganizationInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      return organizationId instanceof Response ? organizationId : { organizationId };
    },
    parse: async () => undefined,
    execute: async ({ actor, organizationId }) => {
      try {
        const result = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const organization = await deps.loadOrganizationById(client, { instanceId: actor.instanceId, organizationId });
        if (!organization) {
          return { status: 'not_found' as const };
        }
        if (organization.child_count > 0) {
          return { status: 'conflict' as const };
        }

        await client.query(
          `
UPDATE iam.contents
SET organization_id = NULL,
    updated_at = NOW()
WHERE instance_id = $1
  AND organization_id = $2::uuid;
`,
          [actor.instanceId, organizationId]
        );
        await client.query(
          `
UPDATE iam.organizations
SET is_active = false,
    updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
          [actor.instanceId, organizationId]
        );
        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'organization.deactivated',
          result: 'success',
          payload: { organizationId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
        return { status: 'ok' as const };
      });

      if (result.status === 'not_found') {
        return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
      }
      if (result.status === 'conflict') {
        return deps.createApiError(
          409,
          'conflict',
          'Organisation mit Children kann nicht gelöscht werden.',
          actor.requestId
        );
      }
      return deps.jsonResponse(200, deps.asApiItem({ id: organizationId }, actor.requestId));
      } catch {
        return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actor.requestId);
      }
    },
  });

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
    execute: async ({ actor, organizationId, input, endpoint, idempotencyKey }) => {
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
        const organization = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const org = await deps.loadOrganizationById(client, { instanceId: actor.instanceId, organizationId });
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
          [actor.instanceId, input.data.accountId, organizationId, shouldUseDefault, input.data.visibility ?? 'internal']
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
          payload: { organizationId, accountId: input.data.accountId, isDefaultContext: shouldUseDefault },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        const detail = await deps.loadOrganizationDetail(client, { instanceId: actor.instanceId, organizationId });
        return { status: 'ok' as const, detail };
      });

      if (organization.status === 'not_found') {
        return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
      }
      if (organization.status === 'inactive') {
        return deps.createApiError(409, 'organization_inactive', 'Inaktive Organisation erlaubt keine neue Membership.', actor.requestId);
      }
      if (organization.status === 'invalid_account') {
        return deps.createApiError(400, 'invalid_request', 'Account gehört nicht zur aktiven Instanz.', actor.requestId);
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
        error: { code: 'database_unavailable' as const, message: 'IAM-Datenbank ist nicht erreichbar.' },
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
    },
  });

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
    execute: async ({ actor, organizationId, accountId }) => {
      try {
        const result = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const current = await client.query<{ is_default_context: boolean }>(
          `
SELECT is_default_context
FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND organization_id = $3::uuid
LIMIT 1;
`,
          [actor.instanceId, accountId, organizationId]
        );
        if (current.rowCount === 0) {
          return { status: 'not_found' as const };
        }

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

        const detail = await deps.loadOrganizationDetail(client, { instanceId: actor.instanceId, organizationId });
        return { status: 'ok' as const, detail };
      });

      if (result.status === 'not_found') {
        return deps.createApiError(404, 'not_found', 'Membership nicht gefunden.', actor.requestId);
      }
      return deps.jsonResponse(200, deps.asApiItem(result.detail, actor.requestId));
      } catch {
        return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actor.requestId);
      }
    },
  });

  const updateMyOrganizationContextInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const requestContext = deps.getWorkspaceContext();
    const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_ui', requestContext.requestId);
    if (featureCheck) {
      return featureCheck;
    }

    const actorResolution = await deps.resolveActorInfo(request, ctx, {
      requireActorMembership: true,
      provisionMissingActorMembership: true,
    });
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    if (!actorResolution.actor.actorAccountId) {
      return deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
    }
    const actor = { ...actorResolution.actor, actorAccountId: actorResolution.actor.actorAccountId };

    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await deps.parseRequestBody(request, updateOrganizationContextSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    try {
      const organizations = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
        deps.loadContextOptions(client, { instanceId: actor.instanceId, accountId: actor.actorAccountId })
      );
      if (hasSystemAdminRole(ctx.user.roles)) {
        await deps.updateSession(ctx.sessionId, { activeOrganizationId: undefined });

        return deps.jsonResponse(
          200,
          deps.asApiItem(
            {
              activeOrganizationId: undefined,
              organizations,
            },
            actor.requestId
          )
        );
      }
      const target = organizations.find((organization) => organization.organizationId === parsed.data.organizationId);
      if (!target) {
        return deps.createApiError(400, 'invalid_organization_id', 'Organisation gehört nicht zum Benutzerkontext.', actor.requestId);
      }
      if (!target.isActive) {
        return deps.createApiError(409, 'organization_inactive', 'Inaktive Organisation kann kein aktiver Kontext sein.', actor.requestId);
      }

      await deps.updateSession(ctx.sessionId, { activeOrganizationId: target.organizationId });
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        await deps.notifyPermissionInvalidation(client, {
          instanceId: actor.instanceId,
          keycloakSubject: ctx.user.id,
          trigger: 'organization_context_switched',
        });
        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          subjectId: actor.actorAccountId,
          eventType: 'organization.context_switched',
          result: 'success',
          payload: {
            organizationId: target.organizationId,
            organizationKey: target.organizationKey,
          },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      const response = {
        activeOrganizationId: target.organizationId,
        organizations,
      };

      deps.logger.info('Organization context switched', {
        workspace_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        context: {
          operation: 'organization_context_switched',
          organization_id: target.organizationId,
        },
      });

      return deps.jsonResponse(200, deps.asApiItem(response, actor.requestId));
    } catch {
      return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actor.requestId);
    }
  };

  return {
    assignOrganizationMembershipInternal,
    createOrganizationInternal,
    deactivateOrganizationInternal,
    removeOrganizationMembershipInternal,
    updateMyOrganizationContextInternal,
    updateOrganizationInternal,
  };
};
