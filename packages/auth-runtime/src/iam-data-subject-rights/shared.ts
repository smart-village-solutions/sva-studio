import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  createPoolResolver,
  jsonResponse,
  type QueryClient,
  withResolvedInstanceDb as withScopedDbTransaction,
} from '../db.js';
import { readString } from '../shared/input-readers.js';
import { buildLogContext } from '../log-context.js';
import { dataSubjectRightsRequestSchema } from '../shared/schemas.js';
import { createApiError } from '../iam-account-management/api-helpers.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

const logger = createSdkLogger({ component: 'iam-dsr', level: 'info' });
export const DSR_READ_ACTION = 'iam.dsr.read';
export const DSR_WRITE_ACTION = 'iam.dsr.write';
export const DSR_EXPORT_ACTION = 'iam.dsr.export';
export const DELETE_SLA_HOURS = 48;
const DEFAULT_DELETE_RETENTION_HOURS = 24;

export type DsrRequestType = 'access' | 'deletion' | 'rectification' | 'restriction' | 'objection';

export type DsrRequestMutationResult = {
  requestId: string;
  status: string;
  afterCommitRevocation?: {
    keycloakSubject: string;
    reason: 'dsr_deletion_requested';
  };
};

const resolvePool = createPoolResolver(getIamDatabaseUrl);
export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withScopedDbTransaction(resolvePool, instanceId, work);
const buildDsrLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });
export const authorizeDsrJsonAction = async (ctx: AuthenticatedRequestContext, action: string) => {
  const authorization = await authorizeInstancePermissionForUser({ ctx, action });
  if (authorization.ok) {
    return null;
  }

  return jsonResponse(authorization.status, {
    error: toInstancePermissionApiErrorCode(authorization.error),
    ...(authorization.permissionDenial ? { details: authorization.permissionDenial } : {}),
  });
};

export const authorizeDsrApiAction = async (
  ctx: AuthenticatedRequestContext,
  action: string,
  message: string
) => {
  const authorization = await authorizeInstancePermissionForUser({ ctx, action });
  if (authorization.ok) {
    return null;
  }

  return createApiError(
    authorization.status,
    toInstancePermissionApiErrorCode(authorization.error),
    message,
    getWorkspaceContext().requestId,
    authorization.permissionDenial
  );
};
const resolveInstanceId = (input: {
  bodyInstanceId?: string;
  request: Request;
  fallback?: string;
}): string | undefined => {
  const fromQuery = readString(new URL(input.request.url).searchParams.get('instanceId'));
  return input.bodyInstanceId ?? fromQuery ?? input.fallback;
};

export const resolveRetentionHours = () => {
  const parsed = Number(
    process.env.IAM_DSR_DELETE_RETENTION_HOURS ?? DEFAULT_DELETE_RETENTION_HOURS
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DELETE_RETENTION_HOURS;
  }
  return Math.floor(parsed);
};
export const parseJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = dataSubjectRightsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
};

export const parseDsrRequestType = (raw: unknown): DsrRequestType | null => {
  const type = readString(raw)?.toLowerCase();
  if (!type) {
    return null;
  }
  if (
    type === 'access' ||
    type === 'deletion' ||
    type === 'rectification' ||
    type === 'restriction' ||
    type === 'objection'
  ) {
    return type;
  }
  return null;
};

export const jsonError = (status: number, error: string): Response =>
  jsonResponse(status, { error });

export const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

type ScopedInstanceResult = { ok: true; instanceId: string } | { ok: false; response: Response };

export const resolveJsonScopedInstance = (input: {
  request?: Request;
  bodyInstanceId?: string;
  fallback?: string;
  userInstanceId?: string;
}): ScopedInstanceResult => {
  const instanceId =
    input.request !== undefined
      ? resolveInstanceId({
          bodyInstanceId: input.bodyInstanceId,
          request: input.request,
          fallback: input.fallback,
        })
      : (input.bodyInstanceId ?? input.fallback);

  if (!instanceId) {
    return { ok: false, response: jsonError(400, 'invalid_instance_id') };
  }
  if (input.userInstanceId && input.userInstanceId !== instanceId) {
    return { ok: false, response: jsonError(403, 'instance_scope_mismatch') };
  }

  return { ok: true, instanceId };
};

export const resolveApiScopedInstance = (input: {
  request?: Request;
  bodyInstanceId?: string;
  fallback?: string;
  userInstanceId?: string;
  missingMessage: string;
  mismatchMessage: string;
}): ScopedInstanceResult => {
  const instanceId =
    input.request !== undefined
      ? resolveInstanceId({
          bodyInstanceId: input.bodyInstanceId,
          request: input.request,
          fallback: input.fallback,
        })
      : (input.bodyInstanceId ?? input.fallback);

  if (!instanceId) {
    return {
      ok: false,
      response: createApiError(400, 'invalid_instance_id', input.missingMessage, getRequestId()),
    };
  }
  if (input.userInstanceId && input.userInstanceId !== instanceId) {
    return {
      ok: false,
      response: createApiError(403, 'forbidden', input.mismatchMessage, getRequestId()),
    };
  }

  return { ok: true, instanceId };
};

export const requireJsonBody = async (
  request: Request
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> => {
  const body = await parseJsonBody(request);
  if (!body) {
    return { ok: false, response: jsonError(400, 'invalid_request') };
  }
  return { ok: true, body };
};

const logDsrDatabaseError = (
  message: string,
  operation: string,
  instanceId: string,
  error: unknown
): void => {
  logger.error(message, {
    operation,
    error: error instanceof Error ? error.message : String(error),
    ...buildDsrLogContext(instanceId),
  });
};

export const handleJsonDatabaseError = (
  message: string,
  operation: string,
  instanceId: string,
  error: unknown
): Response => {
  logDsrDatabaseError(message, operation, instanceId, error);
  return jsonError(503, 'database_unavailable');
};

export const handleApiDatabaseError = (
  message: string,
  operation: string,
  instanceId: string,
  error: unknown,
  responseMessage: string
): Response => {
  logDsrDatabaseError(message, operation, instanceId, error);
  return createApiError(503, 'database_unavailable', responseMessage, getRequestId());
};
