import type { PermissionDenialDetails } from '@sva/core';

import { isRecord } from './error-message-utils';

import {
  createClientError,
  getErrorPayload,
  isAuthenticatedInterfacesRunResult,
  isErrorPayload,
  jsonResponse,
  parseJson,
  type AuthenticatedInterfacesRunResult,
  type ErrorPayload,
} from './interfaces-api-transport';

export const COMPONENT = 'interfaces-api';
const INTERFACES_PERMISSION_ACTION = 'integration.manage';

export type ServerRuntimeLogger =
  Awaited<typeof import('@sva/server-runtime')> extends {
    createSdkLogger: (...args: never[]) => infer T;
  }
    ? T
    : never;

export type AuthenticatedInterfacesUser = {
  readonly id: string;
  readonly instanceId?: string;
  readonly roles: string[];
};

export type AuthenticatedInterfacesContext = {
  readonly sessionId: string;
  readonly user: AuthenticatedInterfacesUser;
};

export type InterfacesRequestDependencies = {
  readonly request: Request;
  readonly logger: ServerRuntimeLogger;
};

export type SaveInterfacesDependencies = InterfacesRequestDependencies & {
  readonly saveSvaMainserverSettings: typeof import('@sva/sva-mainserver/server').saveSvaMainserverSettings;
};

export type InterfacesOperation =
  'list_interfaces' | 'save_interfaces_settings' | 'upsert_interface' | 'delete_interface';

export const loadInterfacesRequestDependencies = async (
  request?: Request
): Promise<InterfacesRequestDependencies> => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { createSdkLogger } = await import('@sva/server-runtime');

  return {
    request: request ?? getRequest(),
    logger: createSdkLogger({ component: COMPONENT }),
  };
};

export const loadSaveInterfacesDependencies = async (
  request?: Request
): Promise<SaveInterfacesDependencies> => {
  const base = await loadInterfacesRequestDependencies(request);
  const { saveSvaMainserverSettings } = await import('@sva/sva-mainserver/server');

  return {
    ...base,
    saveSvaMainserverSettings,
  };
};

export const runWithAuthenticatedInterfacesUser = async <T>(input: {
  readonly request: Request;
  readonly fallbackMessage: string;
  readonly personalBearerRoute?: Readonly<{
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
  }>;
  readonly run: (ctx: AuthenticatedInterfacesContext) => Promise<T>;
}): Promise<T> => {
  const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');

  const response = await withAuthenticatedUser(
    input.request,
    async (ctx) => {
      try {
        return jsonResponse(200, {
          ok: true,
          result: await input.run({
            sessionId: ctx.sessionId,
            user: ctx.user,
          }),
        } satisfies AuthenticatedInterfacesRunResult<T>);
      } catch (error) {
        return jsonResponse(200, {
          ok: false,
          error: getErrorPayload(error, 'invalid_config'),
        } satisfies AuthenticatedInterfacesRunResult<T>);
      }
    },
    input.personalBearerRoute ? { personalBearerRoute: input.personalBearerRoute } : undefined
  );

  if (response.ok) {
    const payload = await parseJson<AuthenticatedInterfacesRunResult<T>>(response);
    if (!isAuthenticatedInterfacesRunResult<T>(payload)) {
      throw new Error('missing_authenticated_result');
    }

    if (payload.ok) {
      return payload.result;
    }

    throw Object.assign(createClientError(payload.error, input.fallbackMessage), {
      code: payload.error.error,
      statusCode: payload.error.statusCode ?? 500,
    });
  }

  const raw = await parseJson<unknown>(response);
  const payload: ErrorPayload | null =
    isRecord(raw) && isRecord(raw.error) && typeof raw.error.code === 'string'
      ? { error: raw.error.code }
      : isErrorPayload(raw) ? raw : null;
  throw Object.assign(createClientError(payload, input.fallbackMessage), {
    code: payload?.error,
    statusCode: response.status,
  });
};

const logMissingInterfacesInstanceContext = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  operation: InterfacesOperation
): void => {
  logger.warn('Interfaces request rejected: missing instance context', {
    operation,
    user_id: user.id,
  });
};

const logDeniedInterfacesAccess = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  instanceId: string,
  operation: InterfacesOperation,
  reasonCode: string
): void => {
  logger.warn('Interfaces request rejected: insufficient permissions', {
    operation,
    workspace_id: instanceId,
    user_id: user.id,
    user_roles: user.roles,
    reason_code: reasonCode,
  });
};

const logInterfacesInstanceMismatch = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  requestedInstanceId: string,
  actualInstanceId: string,
  operation: InterfacesOperation
): void => {
  logger.warn('Interfaces request rejected: instance mismatch', {
    operation,
    requested_workspace_id: requestedInstanceId,
    workspace_id: actualInstanceId,
    user_id: user.id,
  });
};

const createStatusError = (
  message: string,
  statusCode: number,
  permissionDenial?: PermissionDenialDetails
): Error & { statusCode: number; permissionDenial?: PermissionDenialDetails } =>
  Object.assign(new Error(message), {
    statusCode,
    ...(permissionDenial ? { permissionDenial } : {}),
  });

export const resolveAuthorizedInterfacesInstanceId = async (
  logger: ServerRuntimeLogger,
  ctx: AuthenticatedInterfacesContext,
  operation: InterfacesOperation,
  requestedInstanceId?: string
): Promise<string> => {
  const { authorizeInstancePermissionForUser } = await import('@sva/auth-runtime/server');
  const { user } = ctx;
  if (!user.instanceId) {
    logMissingInterfacesInstanceContext(logger, user, operation);
    throw createStatusError('invalid_config', 400);
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx,
    action: INTERFACES_PERMISSION_ACTION,
  });
  if (!authorization.ok) {
    logDeniedInterfacesAccess(logger, user, user.instanceId, operation, authorization.error);
    throw createStatusError(
      authorization.error,
      authorization.status,
      authorization.permissionDenial
    );
  }

  if (requestedInstanceId && requestedInstanceId !== user.instanceId) {
    logInterfacesInstanceMismatch(logger, user, requestedInstanceId, user.instanceId, operation);
    throw createStatusError('forbidden', 403);
  }

  return user.instanceId;
};

export const validateInterfaceMutationCsrf = async (request: Request): Promise<void> => {
  // withAuthenticatedUser must first validate Bearer tokens on an opted-in route.
  if (request.headers.has('authorization')) return;
  const { validateCsrf } = await import('@sva/auth-runtime/server');
  const response = validateCsrf(request);
  if (response) {
    throw Object.assign(new Error('csrf_validation_failed'), { statusCode: response.status });
  }
};
