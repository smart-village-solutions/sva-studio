import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';

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
    schema: z.ZodSchema<TData>
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
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: OrganizationMutationActor } | { readonly error: Response }>;
  readonly resolveHierarchyFields: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly organizationId?: string; readonly parentOrganizationId?: string | null }
  ) => Promise<HierarchyResolution>;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly updateSession: (sessionId: string, patch: { readonly activeOrganizationId?: string }) => Promise<void>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);
const CREATE_ORGANIZATION_ENDPOINT = 'POST:/api/v1/iam/organizations';
const ASSIGN_MEMBERSHIP_ENDPOINT = 'POST:/api/v1/iam/organizations/$organizationId/memberships';

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
  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
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

export const createOrganizationMutationHandlers = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const createOrganizationInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareAdminMutation(deps, request, ctx);
    if ('error' in prepared) {
      return prepared.error;
    }
    const { actor } = prepared;

    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }
    const rateLimit = consumeWriteRateLimit(deps, actor, ctx);
    if (rateLimit) {
      return rateLimit;
    }

    const idempotency = deps.requireIdempotencyKey(request, actor.requestId);
    if ('error' in idempotency) {
      return idempotency.error;
    }
    const parsed = await deps.parseRequestBody(request, createOrganizationSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      endpoint: CREATE_ORGANIZATION_ENDPOINT,
      idempotencyKey: idempotency.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
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
          parentOrganizationId: parsed.data.parentOrganizationId,
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
VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, $7, $8::uuid, $9::uuid[], $10::int, true)
RETURNING id;
`,
          [
            organizationId,
            actor.instanceId,
            parsed.data.organizationKey,
            parsed.data.displayName,
            JSON.stringify(parsed.data.metadata ?? {}),
            parsed.data.organizationType,
            parsed.data.contentAuthorPolicy,
            parsed.data.parentOrganizationId ?? null,
            hierarchy.hierarchyPath,
            hierarchy.depth,
          ]
        );

        const createdOrganizationId = inserted.rows[0]?.id ?? organizationId;
        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'organization.created',
          result: 'success',
          payload: {
            organizationId: createdOrganizationId,
            organizationKey: parsed.data.organizationKey,
            organizationType: parsed.data.organizationType,
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
        endpoint: CREATE_ORGANIZATION_ENDPOINT,
        idempotencyKey: idempotency.key,
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
          endpoint: CREATE_ORGANIZATION_ENDPOINT,
          idempotencyKey: idempotency.key,
          responseStatus: error.status,
          responseBody,
        });
      }

      const message = error instanceof Error ? error.message : String(error);
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
        endpoint: CREATE_ORGANIZATION_ENDPOINT,
        idempotencyKey: idempotency.key,
        responseStatus: status,
        responseBody,
      });
    }
  };

  const updateOrganizationInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareAdminMutation(deps, request, ctx);
    if ('error' in prepared) {
      return prepared.error;
    }
    const { actor } = prepared;

    const organizationId = readOrganizationId(deps, request, actor.requestId);
    if (organizationId instanceof Response) {
      return organizationId;
    }
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }
    const rateLimit = consumeWriteRateLimit(deps, actor, ctx);
    if (rateLimit) {
      return rateLimit;
    }

    const parsed = await deps.parseRequestBody(request, updateOrganizationSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    try {
      const updated = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const existing = await deps.loadOrganizationById(client, { instanceId: actor.instanceId, organizationId });
        if (!existing) {
          return undefined;
        }

        const nextParentOrganizationId =
          parsed.data.parentOrganizationId === undefined ? existing.parent_organization_id : parsed.data.parentOrganizationId;
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
  metadata = COALESCE($8::jsonb, metadata),
  hierarchy_path = $9::uuid[],
  depth = $10::int,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
          [
            actor.instanceId,
            organizationId,
            parsed.data.organizationKey ?? null,
            parsed.data.displayName ?? null,
            nextParentOrganizationId ?? null,
            parsed.data.organizationType ?? null,
            parsed.data.contentAuthorPolicy ?? null,
            parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
            hierarchy.hierarchyPath,
            hierarchy.depth,
          ]
        );

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
  };

  const deactivateOrganizationInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareAdminMutation(deps, request, ctx);
    if ('error' in prepared) {
      return prepared.error;
    }
    const { actor } = prepared;

    const organizationId = readOrganizationId(deps, request, actor.requestId);
    if (organizationId instanceof Response) {
      return organizationId;
    }
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }
    const rateLimit = consumeWriteRateLimit(deps, actor, ctx);
    if (rateLimit) {
      return rateLimit;
    }

    try {
      const result = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const organization = await deps.loadOrganizationById(client, { instanceId: actor.instanceId, organizationId });
        if (!organization) {
          return { status: 'not_found' as const };
        }
        if (organization.child_count > 0 || organization.membership_count > 0) {
          return { status: 'conflict' as const };
        }

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
          'Organisation mit Children oder Memberships kann nicht deaktiviert werden.',
          actor.requestId
        );
      }
      return deps.jsonResponse(200, deps.asApiItem({ id: organizationId }, actor.requestId));
    } catch {
      return deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actor.requestId);
    }
  };

  const assignOrganizationMembershipInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareAdminMutation(deps, request, ctx);
    if ('error' in prepared) {
      return prepared.error;
    }
    const { actor } = prepared;

    const organizationId = readOrganizationId(deps, request, actor.requestId);
    if (organizationId instanceof Response) {
      return organizationId;
    }
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const idempotency = deps.requireIdempotencyKey(request, actor.requestId);
    if ('error' in idempotency) {
      return idempotency.error;
    }
    const parsed = await deps.parseRequestBody(request, assignOrganizationMembershipSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      endpoint: ASSIGN_MEMBERSHIP_ENDPOINT,
      idempotencyKey: idempotency.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
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
          [parsed.data.accountId, actor.instanceId]
        );
        if (membershipAccount.rowCount === 0) {
          return { status: 'invalid_account' as const };
        }

        if (parsed.data.isDefaultContext) {
          await client.query(
            `
UPDATE iam.account_organizations
SET is_default_context = false
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
            [actor.instanceId, parsed.data.accountId]
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
          [actor.instanceId, parsed.data.accountId]
        );
        const shouldUseDefault = parsed.data.isDefaultContext ?? existingDefault.rowCount === 0;

        await client.query(
          `
INSERT INTO iam.account_organizations (
  instance_id,
  account_id,
  organization_id,
  is_default_context,
  membership_visibility
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::boolean, $5)
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;
`,
          [actor.instanceId, parsed.data.accountId, organizationId, shouldUseDefault, parsed.data.visibility ?? 'internal']
        );

        await deps.notifyPermissionInvalidation(client, {
          instanceId: actor.instanceId,
          trigger: 'organization_membership_assigned',
        });
        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          subjectId: parsed.data.accountId,
          eventType: 'organization.membership_assigned',
          result: 'success',
          payload: { organizationId, accountId: parsed.data.accountId, isDefaultContext: shouldUseDefault },
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
        endpoint: ASSIGN_MEMBERSHIP_ENDPOINT,
        idempotencyKey: idempotency.key,
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
        endpoint: ASSIGN_MEMBERSHIP_ENDPOINT,
        idempotencyKey: idempotency.key,
        responseStatus: 503,
        responseBody,
      });
    }
  };

  const removeOrganizationMembershipInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const prepared = await prepareAdminMutation(deps, request, ctx);
    if ('error' in prepared) {
      return prepared.error;
    }
    const { actor } = prepared;

    const organizationId = readOrganizationId(deps, request, actor.requestId);
    if (organizationId instanceof Response) {
      return organizationId;
    }
    const accountId = deps.readPathSegment(request, 6);
    if (!accountId || !deps.isUuid(accountId)) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige accountId.', actor.requestId);
    }
    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }
    const rateLimit = consumeWriteRateLimit(deps, actor, ctx);
    if (rateLimit) {
      return rateLimit;
    }

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
  };

  const updateMyOrganizationContextInternal = async (
    request: Request,
    ctx: OrganizationMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const requestContext = deps.getWorkspaceContext();
    const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_ui', requestContext.requestId);
    if (featureCheck) {
      return featureCheck;
    }

    const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
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
