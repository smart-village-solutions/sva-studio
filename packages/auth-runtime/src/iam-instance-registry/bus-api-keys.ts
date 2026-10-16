/** Session-only Bus facade; registry and existing platform guards own authorization. */
import { randomUUID } from 'node:crypto';
import { instanceBusKeyExpiresAt, isValidInstanceId } from '@sva/core';
import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { z } from 'zod';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { getSession } from '../redis-session.js';
import { validateCsrf } from '../shared/request-security.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import { withRegistryRepository } from './repository.js';
import { BusApiError, createBusApiClient } from './bus-api-client.js';

type Action = 'list' | 'create' | 'revoke' | 'activate';
const logger = createSdkLogger({ component: 'instance-bus-api-keys' });
const createSchema = z
  .object({
    contact: z.string().trim().email().max(254),
    createdBy: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[\p{L}\p{M}]+$/u),
    validThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  })
  .strict();
const json = (status: number, payload: unknown) =>
  Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const errorResponse = (status: number, code: string, requestId: string) =>
  json(status, { error: { code, message: code }, requestId });

const audit = async (input: {
  instanceId: string;
  actorId: string;
  requestId: string;
  action: Action;
  keyId?: string;
  result: string;
}): Promise<boolean> => {
  try {
    await withRegistryRepository((repository) =>
      repository.appendAuditEvent({
        instanceId: input.instanceId,
        actorId: input.actorId,
        requestId: input.requestId,
        eventType: 'instance_reconfigured',
        details: {
          area: 'bus_api_keys',
          action: `instance.busKeys.${input.action}`,
          keyId: input.keyId,
          result: input.result,
        },
      })
    );
    return true;
  } catch {
    logger.error('Bus key audit persistence failed', {
      operation: 'bus_key_audit',
      instance_id: input.instanceId,
      key_id: input.keyId,
      action: input.action,
      result: input.result,
      request_id: input.requestId,
      error_type: 'audit_unavailable',
      error: 'audit_unavailable',
    });
    return false;
  }
};

const parseTarget = (request: Request, action: Action) => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  let instanceId: string;
  let keyId: string | undefined;
  try {
    instanceId = decodeURIComponent(segments[4] ?? '');
    keyId = segments[6] === undefined ? undefined : decodeURIComponent(segments[6]);
  } catch {
    return null;
  }
  if (
    !isValidInstanceId(instanceId) ||
    ((action === 'revoke' || action === 'activate') &&
      (!keyId || keyId.length > 256 || /[\p{Cc}]/u.test(keyId)))
  )
    return null;
  return { instanceId, keyId };
};

const createKey = async (
  request: Request,
  client: ReturnType<typeof createBusApiClient>,
  instance: { displayName: string; instanceId: string }
) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  const expiresAt = instanceBusKeyExpiresAt(parsed.data.validThrough);
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return null;
  return client.create({
    owner: instance.displayName,
    label: instance.instanceId,
    contact: parsed.data.contact,
    createdBy: parsed.data.createdBy,
    expiresAt,
  });
};

const mutateKey = async (
  client: ReturnType<typeof createBusApiClient>,
  instanceId: string,
  keyId: string | undefined,
  action: 'revoke' | 'activate',
  requestId: string
) => {
  if (!keyId) return errorResponse(400, 'invalid_request', requestId);
  if (action === 'activate') {
    const key = (await client.list(instanceId)).find((item) => item.keyId === keyId);
    if (!key) return errorResponse(404, 'bus_key_not_found', requestId);
    if (!key.revoked || (key.expiresAt !== undefined && Date.parse(key.expiresAt) <= Date.now())) {
      return errorResponse(409, 'bus_key_not_activatable', requestId);
    }
  }
  await client.mutate(instanceId, keyId, action);
  return { keyId };
};

const authorize = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  action: Action,
  requestId: string
): Promise<Response | undefined> => {
  const context = { ...ctx, authKind: 'session' as const };
  const accessError = ensurePlatformAccess(request, context);
  if (accessError) return accessError;
  // Root realm provenance is checked on the stored session, never browser headers or initials.
  const session = await getSession(ctx.sessionId, { decryptTokens: false });
  if (ctx.user.instanceId || session?.auth?.kind !== 'platform')
    return errorResponse(403, 'forbidden', requestId);
  if (action !== 'list') {
    const guardError = validateCsrf(request, requestId) ?? requireFreshReauth(request, context);
    if (guardError) return guardError;
  }
  return undefined;
};

const handle = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  action: Action,
  requestId: string
): Promise<Response> => {
  const accessError = await authorize(request, ctx, action, requestId);
  if (accessError) return accessError;
  const target = parseTarget(request, action);
  if (!target) return errorResponse(400, 'invalid_request', requestId);
  const { instanceId, keyId } = target;
  const instance = await withRegistryRepository((repository) =>
    repository.getInstanceById(instanceId)
  );
  if (!instance) return errorResponse(404, 'not_found', requestId);
  if ((action === 'create' || action === 'activate') && instance.status !== 'active') {
    return errorResponse(409, 'bus_instance_inactive', requestId);
  }
  const actorId = ctx.user.id;
  try {
    const client = createBusApiClient(actorId, requestId);
    if (action === 'list') return json(200, { data: await client.list(instanceId), requestId });
    let result: { keyId: string; apiKey?: string };
    if (action === 'create') {
      const created = await createKey(request, client, instance);
      if (!created) return errorResponse(400, 'invalid_request', requestId);
      result = created;
    } else {
      const mutation = await mutateKey(client, instanceId, keyId, action, requestId);
      if (mutation instanceof Response) return mutation;
      result = mutation;
    }
    const auditRecorded = await audit({
      instanceId,
      actorId,
      requestId,
      action,
      keyId: result.keyId,
      result: 'success',
    });
    return json(action === 'create' ? 201 : 200, { data: { ...result, auditRecorded }, requestId });
  } catch (error) {
    const safeError =
      error instanceof BusApiError
        ? error
        : new BusApiError(action === 'list' ? 'bus_unavailable' : 'bus_outcome_unknown', 502);
    if (action !== 'list')
      await audit({ instanceId, actorId, requestId, action, keyId, result: safeError.code });
    return errorResponse(safeError.status, safeError.code, requestId);
  }
};

const sessionHandler =
  (action: Action) =>
  async (request: Request): Promise<Response> => {
    const response = await withRequestContext(
      { request, fallbackWorkspaceId: 'platform' },
      async () => {
        const requestId = getWorkspaceContext().requestId ?? randomUUID();
        try {
          // This middleware rejects all bearer authentication on session-only routes.
          return await withAuthenticatedUser(request, (ctx) =>
            handle(request, ctx, action, requestId)
          );
        } catch {
          return errorResponse(503, 'bus_unavailable', requestId);
        }
      }
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };

export const busApiKeyHandlers = {
  list: sessionHandler('list'),
  create: sessionHandler('create'),
  revoke: sessionHandler('revoke'),
  activate: sessionHandler('activate'),
};
