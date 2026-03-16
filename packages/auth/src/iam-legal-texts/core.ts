import type { IamLegalTextListItem } from '@sva/core';
import { createSdkLogger, getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers';
import { ADMIN_ROLES } from '../iam-account-management/constants';
import { validateCsrf } from '../iam-account-management/csrf';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags';
import {
  completeIdempotency,
  emitActivityLog,
  logger as accountLogger,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { withAuthenticatedUser } from '../middleware.server';

import { createLegalTextSchema, updateLegalTextSchema } from './schemas';

const logger = createSdkLogger({ component: 'iam-legal-texts', level: 'info' });

type LegalTextRow = {
  id: string;
  legal_text_id: string;
  legal_text_version: string;
  locale: string;
  content_hash: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  acceptance_count: number;
  active_acceptance_count: number;
  last_accepted_at: string | null;
};

const withLegalTextsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

const withAuthenticatedLegalTextsHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withLegalTextsRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const requestContext = getWorkspaceContext();
      accountLogger.error('IAM legal texts request failed unexpectedly', {
        operation: 'iam_legal_texts_request',
        endpoint: request.url,
        request_id: requestContext.requestId,
        trace_id: requestContext.traceId,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      });

      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter IAM-Fehler.', {
        requestId: requestContext.requestId,
      });
    }
  });

const mapLegalTextListItem = (row: LegalTextRow): IamLegalTextListItem => ({
  id: row.id,
  legalTextId: row.legal_text_id,
  legalTextVersion: row.legal_text_version,
  locale: row.locale,
  contentHash: row.content_hash,
  isActive: row.is_active,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  acceptanceCount: row.acceptance_count,
  activeAcceptanceCount: row.active_acceptance_count,
  ...(row.last_accepted_at ? { lastAcceptedAt: row.last_accepted_at } : {}),
});

const loadLegalTextListItems = async (instanceId: string): Promise<readonly IamLegalTextListItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
      `
SELECT
  version.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  version.content_hash,
  version.is_active,
  version.published_at::text,
  version.created_at::text,
  COUNT(acceptance.id)::int AS acceptance_count,
  COUNT(*) FILTER (WHERE acceptance.revoked_at IS NULL)::int AS active_acceptance_count,
  MAX(acceptance.accepted_at)::text AS last_accepted_at
FROM iam.legal_text_versions version
LEFT JOIN iam.legal_text_acceptances acceptance
  ON acceptance.instance_id = version.instance_id
 AND acceptance.legal_text_version_id = version.id
WHERE version.instance_id = $1
GROUP BY version.id
ORDER BY version.legal_text_id ASC, version.locale ASC, version.published_at DESC, version.created_at DESC;
`,
      [instanceId]
    );

    return result.rows.map(mapLegalTextListItem);
  });

const loadLegalTextById = async (
  instanceId: string,
  legalTextVersionId: string
): Promise<IamLegalTextListItem | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<LegalTextRow>(
      `
SELECT
  version.id,
  version.legal_text_id,
  version.legal_text_version,
  version.locale,
  version.content_hash,
  version.is_active,
  version.published_at::text,
  version.created_at::text,
  COUNT(acceptance.id)::int AS acceptance_count,
  COUNT(*) FILTER (WHERE acceptance.revoked_at IS NULL)::int AS active_acceptance_count,
  MAX(acceptance.accepted_at)::text AS last_accepted_at
FROM iam.legal_text_versions version
LEFT JOIN iam.legal_text_acceptances acceptance
  ON acceptance.instance_id = version.instance_id
 AND acceptance.legal_text_version_id = version.id
WHERE version.instance_id = $1
  AND version.id = $2::uuid
GROUP BY version.id
LIMIT 1;
`,
      [instanceId, legalTextVersionId]
    );

    const row = result.rows[0];
    return row ? mapLegalTextListItem(row) : undefined;
  });

export const listLegalTextsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  try {
    const items = await loadLegalTextListItems(actorResolution.actor.instanceId);
    return new Response(
      JSON.stringify(asApiList(items, { page: 1, pageSize: items.length, total: items.length }, actorResolution.actor.requestId)),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Legal text list query failed', {
      operation: 'legal_texts_list',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Rechtstexte konnten nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

export const createLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createLegalTextSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/legal-texts',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return new Response(JSON.stringify(reserve.responseBody), {
      status: reserve.responseStatus,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  try {
    const createdId = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const insert = await client.query<{ id: string }>(
        `
INSERT INTO iam.legal_text_versions (
  instance_id,
  legal_text_id,
  legal_text_version,
  locale,
  content_hash,
  is_active,
  published_at
)
VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
ON CONFLICT (instance_id, legal_text_id, legal_text_version, locale) DO NOTHING
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          parsed.data.legalTextId,
          parsed.data.legalTextVersion,
          parsed.data.locale,
          parsed.data.contentHash,
          parsed.data.isActive,
          parsed.data.publishedAt ?? null,
        ]
      );

      const legalTextVersionId = insert.rows[0]?.id;
      if (!legalTextVersionId) {
        return undefined;
      }

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'iam.legal_text.created',
        result: 'success',
        payload: {
          legal_text_version_id: legalTextVersionId,
          legal_text_id: parsed.data.legalTextId,
          legal_text_version: parsed.data.legalTextVersion,
          locale: parsed.data.locale,
          is_active: parsed.data.isActive,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return legalTextVersionId;
    });

    if (!createdId) {
      const responseBody = {
        error: {
          code: 'conflict',
          message: 'Diese Rechtstext-Version existiert bereits.',
        },
        ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
      };
      await completeIdempotency({
        instanceId: actorResolution.actor.instanceId,
        actorAccountId: actorResolution.actor.actorAccountId,
        endpoint: 'POST:/api/v1/iam/legal-texts',
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: 409,
        responseBody,
      });
      return new Response(JSON.stringify(responseBody), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const item = await loadLegalTextById(actorResolution.actor.instanceId, createdId);
    if (!item) {
      throw new Error('created_legal_text_not_found');
    }

    const responseBody = asApiItem(item, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/legal-texts',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Legal text create failed', {
      operation: 'legal_text_create',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });

    const responseBody = {
      error: {
        code: 'database_unavailable',
        message: 'Rechtstext konnte nicht gespeichert werden.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    };
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/legal-texts',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody,
    });

    return new Response(JSON.stringify(responseBody), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const updateLegalTextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const legalTextVersionId = readPathSegment(request, 4);
  if (!legalTextVersionId) {
    return createApiError(400, 'invalid_request', 'Rechtstext-ID fehlt.', actorResolution.actor.requestId);
  }

  const parsed = await parseRequestBody(request, updateLegalTextSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const updatedId = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const updateResult = await client.query<{ id: string }>(
        `
UPDATE iam.legal_text_versions
SET
  content_hash = COALESCE($3, content_hash),
  is_active = COALESCE($4, is_active),
  published_at = COALESCE($5::timestamptz, published_at)
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          legalTextVersionId,
          parsed.data.contentHash ?? null,
          parsed.data.isActive ?? null,
          parsed.data.publishedAt ?? null,
        ]
      );

      const updatedLegalTextVersionId = updateResult.rows[0]?.id;
      if (!updatedLegalTextVersionId) {
        return undefined;
      }

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'iam.legal_text.updated',
        result: 'success',
        payload: {
          legal_text_version_id: updatedLegalTextVersionId,
          updated_fields: Object.keys(parsed.data),
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return updatedLegalTextVersionId;
    });

    if (!updatedId) {
      return createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actorResolution.actor.requestId);
    }

    const item = await loadLegalTextById(actorResolution.actor.instanceId, updatedId);
    if (!item) {
      return createApiError(404, 'not_found', 'Rechtstext-Version wurde nicht gefunden.', actorResolution.actor.requestId);
    }

    return new Response(JSON.stringify(asApiItem(item, actorResolution.actor.requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Legal text update failed', {
      operation: 'legal_text_update',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      legal_text_version_id: legalTextVersionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Rechtstext konnte nicht aktualisiert werden.',
      actorResolution.actor.requestId
    );
  }
};

export const listLegalTextsHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, listLegalTextsInternal);

export const createLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, createLegalTextInternal);

export const updateLegalTextHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedLegalTextsHandler(request, updateLegalTextInternal);
