import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { requireRoles } from '../iam-account-management/shared-actor-resolution.js';
import { createPoolResolver, jsonResponse } from '../shared/db-helpers.js';
import { buildLogContext } from '../shared/log-context.js';
import { createSdkLogger, getWorkspaceContext, isCanonicalAuthHost } from '@sva/sdk/server';
import {
  buildPrimaryHostname,
  classifyHost,
  instanceStatuses,
  isTrafficEnabledInstanceStatus,
  normalizeHost,
  type HostClassification,
  type InstanceStatus,
} from '@sva/core';
import { createInstanceRegistryRepository } from '@sva/data';
import { invalidateInstanceRegistryHost, loadInstanceByHostname } from '@sva/data/server';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { createInstanceRegistryService } from './service.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });
const ADMIN_ROLES = new Set(['instance_registry_admin']);
const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

const createExecutor = (client: {
  query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rowCount: number; rows: TRow[] }>;
}) => ({
  execute: async <TRow = Record<string, unknown>>(statement: { text: string; values: readonly unknown[] }) => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

const withRegistryRepository = async <T>(
  work: (repository: ReturnType<typeof createInstanceRegistryRepository>) => Promise<T>
): Promise<T> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }
  const client = await pool.connect();
  try {
    return await work(createInstanceRegistryRepository(createExecutor(client)));
  } finally {
    client.release();
  }
};

const withRegistryService = async <T>(work: (service: ReturnType<typeof createInstanceRegistryService>) => Promise<T>): Promise<T> =>
  withRegistryRepository((repository) =>
    work(
      createInstanceRegistryService({
        repository,
        invalidateHost: invalidateInstanceRegistryHost,
      })
    )
  );

const isRootHostRequest = (request: Request): boolean => isCanonicalAuthHost(new URL(request.url).host);

const ensurePlatformAccess = (request: Request, ctx: AuthenticatedRequestContext): Response | null => {
  if (!isRootHostRequest(request)) {
    return createApiError(403, 'forbidden', 'Globale Instanzverwaltung ist nur auf dem Root-Host erlaubt.', getWorkspaceContext().requestId);
  }

  return requireRoles(ctx, ADMIN_ROLES, getWorkspaceContext().requestId);
};

const requireFreshReauth = (request: Request): Response | null => {
  const header = request.headers.get('x-sva-reauth-confirmed');
  if (header?.toLowerCase() === 'true') {
    return null;
  }
  return createApiError(403, 'reauth_required', 'Frische Re-Authentisierung ist für diese Mutation erforderlich.', getWorkspaceContext().requestId);
};

const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(instanceStatuses).optional(),
});

const createInstanceSchema = z.object({
  instanceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  parentDomain: z.string().trim().min(1),
  themeKey: z.string().trim().min(1).optional(),
  mainserverConfigRef: z.string().trim().min(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

const statusMutationSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
});

const readDetailInstanceId = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const instanceIndex = segments.findIndex((segment) => segment === 'instances');
  return instanceIndex >= 0 ? segments[instanceIndex + 1] : undefined;
};

export const listInstancesInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });

  if (!parsed.success) {
    return createApiError(400, 'invalid_request', 'Ungültige Filter für die Instanzverwaltung.', getWorkspaceContext().requestId);
  }

  const enriched = await withRegistryService((service) => service.listInstances(parsed.data));

  return jsonResponse(200, asApiList(enriched, { page: 1, pageSize: enriched.length || 1, total: enriched.length }, getWorkspaceContext().requestId));
};

export const getInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const instance = await withRegistryService((service) => service.getInstanceDetail(instanceId));
  if (!instance) {
    return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
  }

  return jsonResponse(
    200,
    asApiItem(instance, getWorkspaceContext().requestId)
  );
};

export const createInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const payloadResult = await parseRequestBody(request, createInstanceSchema);
  if (!payloadResult.ok) {
    return createApiError(400, 'invalid_request', payloadResult.message, getWorkspaceContext().requestId);
  }

  const result = await withRegistryService((service) =>
    service.createProvisioningRequest({
      idempotencyKey: idempotencyResult.key,
      instanceId: payloadResult.data.instanceId,
      displayName: payloadResult.data.displayName,
      parentDomain: payloadResult.data.parentDomain,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
      themeKey: payloadResult.data.themeKey,
      featureFlags: payloadResult.data.featureFlags,
      mainserverConfigRef: payloadResult.data.mainserverConfigRef,
    })
  );

  if (!result.ok) {
    return createApiError(409, 'conflict', 'Instanz-ID ist bereits vergeben.', getWorkspaceContext().requestId);
  }

  logger.info('Instance provisioning requested', {
    operation: 'instance_create',
    instance_id: result.instance.instanceId,
    primary_hostname: buildPrimaryHostname(result.instance.instanceId, normalizeHost(payloadResult.data.parentDomain)),
    actor_id: ctx.user.id,
    ...buildLogContext('platform', { includeTraceId: true }),
  });

  return jsonResponse(201, asApiItem(result.instance, getWorkspaceContext().requestId));
};

const mutateInstanceStatus = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => {
  const accessError = ensurePlatformAccess(request, ctx);
  if (accessError) {
    return accessError;
  }

  const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
  if (csrfError) {
    return csrfError;
  }

  const reauthError = requireFreshReauth(request);
  if (reauthError) {
    return reauthError;
  }

  const idempotencyResult = requireIdempotencyKey(request, getWorkspaceContext().requestId);
  if ('error' in idempotencyResult) {
    return idempotencyResult.error;
  }

  const payloadResult = await parseRequestBody(request, statusMutationSchema);
  if (!payloadResult.ok || payloadResult.data.status !== nextStatus) {
    return createApiError(400, 'invalid_request', 'Ungültiger Statuswechsel.', getWorkspaceContext().requestId);
  }

  const instanceId = readDetailInstanceId(request);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.', getWorkspaceContext().requestId);
  }

  const result = await withRegistryService((service) =>
    service.changeStatus({
      idempotencyKey: idempotencyResult.key,
      instanceId,
      nextStatus,
      actorId: ctx.user.id,
      requestId: getWorkspaceContext().requestId,
    })
  );

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', getWorkspaceContext().requestId);
    }
    return createApiError(409, 'conflict', 'Statuswechsel ist im aktuellen Zustand nicht erlaubt.', getWorkspaceContext().requestId);
  }

  return jsonResponse(200, asApiItem(result.instance, getWorkspaceContext().requestId));
};

export const activateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'active');

export const suspendInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'suspended');

export const archiveInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'archived');

export const resolveRuntimeInstanceFromRequest = async (request: Request): Promise<{
  readonly hostClassification: HostClassification;
  readonly instance: Awaited<ReturnType<typeof loadInstanceByHostname>>;
}> => {
  const host = new URL(request.url).host;
  const resolved = await withRegistryService((service) => service.resolveRuntimeInstance(host));
  return {
    hostClassification: resolved.hostClassification,
    instance: resolved.instance,
  };
};

export const createTenantForbiddenResponse = (): Response =>
  createApiError(403, 'forbidden', 'Host not permitted for this operation', getWorkspaceContext().requestId);

export const isInstanceTrafficAllowed = (status: InstanceStatus): boolean =>
  isTrafficEnabledInstanceStatus(status);
