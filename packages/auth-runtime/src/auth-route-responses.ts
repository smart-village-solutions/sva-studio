import { createSdkLogger, getWorkspaceContext, toJsonErrorResponse } from '@sva/server-runtime';
import { buildLogContext } from './log-context.js';
import { PLATFORM_WORKSPACE_ID } from './scope.js';
import { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
import { SessionStoreUnavailableError, TenantAuthResolutionError } from './runtime-errors.js';

export const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

const shouldAttachDebugAuthHeaders = (): boolean => process.env.SVA_AUTH_DEBUG_HEADERS === 'true';

export const createRedirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location },
  });

export const createAuthMeHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
});

export const createNotFoundResponse = () =>
  new Response(null, {
    status: 404,
  });

export const collectEffectivePermissionActions = (
  permissions: readonly {
    action?: string;
  }[]
): string[] => {
  return [
    ...new Set(
      permissions
        .map((permission) =>
          typeof permission.action === 'string' ? permission.action.trim() : ''
        )
        .filter((action) => action.length > 0)
    ),
  ].sort((left, right) => left.localeCompare(right));
};

export const summarizeRequestUrl = (
  request: Request
): { endpoint_path: string; has_sensitive_query: boolean } => {
  const url = new URL(request.url);
  return {
    endpoint_path: url.pathname,
    has_sensitive_query:
      url.searchParams.has('code') ||
      url.searchParams.has('state') ||
      url.searchParams.has('id_token_hint') ||
      url.searchParams.has('iss'),
  };
};

export const createAuthDependencyErrorResponse = (
  request: Request,
  operation: 'auth_callback' | 'auth_login' | 'auth_logout' | 'auth_me',
  error: unknown
): Response => {
  const requestId = getWorkspaceContext().requestId;

  if (error instanceof TenantAuthResolutionError) {
    logger.error('Auth route failed during tenant auth resolution', {
      ...summarizeRequestUrl(request),
      operation,
      error_type: error.name,
      reason_code: 'scope_resolution_failed',
      reason: error.reason,
      tenant_host: error.host,
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(error.statusCode, 'internal_error', error.publicMessage, {
      requestId,
    });
  }

  if (error instanceof SessionStoreUnavailableError) {
    logger.error('Auth route failed because session storage is unavailable', {
      ...summarizeRequestUrl(request),
      operation,
      error_type: error.name,
      reason_code: 'session_store_unavailable',
      request_id: requestId,
      ...buildLogContext(),
    });
    return toJsonErrorResponse(
      503,
      'internal_error',
      'Authentifizierung ist momentan nicht verfügbar, weil der Sitzungsspeicher nicht erreichbar ist.',
      { requestId }
    );
  }

  logger.error('Auth route failed unexpectedly', {
    ...summarizeRequestUrl(request),
    operation,
    error_type: error instanceof Error ? error.name : typeof error,
    reason_code: 'internal_auth_route_failure',
    request_id: requestId,
    ...buildLogContext(),
  });
  return toJsonErrorResponse(
    500,
    'internal_error',
    'Authentifizierung ist momentan nicht verfügbar.',
    {
      requestId,
    }
  );
};

export const attachDebugAuthHeaders = (
  response: Response,
  input: {
    request: Request;
    authConfig: {
      kind: 'platform' | 'instance';
      instanceId?: string;
      authRealm?: string;
      clientId: string;
      redirectUri: string;
    };
  }
): void => {
  if (!shouldAttachDebugAuthHeaders()) {
    return;
  }

  response.headers.set('x-sva-debug-request-host', resolveEffectiveRequestHost(input.request));
  response.headers.set('x-sva-debug-request-origin', buildRequestOriginFromHeaders(input.request));
  response.headers.set('x-sva-debug-auth-scope-kind', input.authConfig.kind);
  const debugInstanceId =
    input.authConfig.kind === 'instance'
      ? (input.authConfig.instanceId ?? PLATFORM_WORKSPACE_ID)
      : PLATFORM_WORKSPACE_ID;
  response.headers.set('x-sva-debug-auth-instance-id', debugInstanceId);
  response.headers.set(
    'x-sva-debug-auth-realm',
    input.authConfig.authRealm ?? PLATFORM_WORKSPACE_ID
  );
  response.headers.set('x-sva-debug-auth-client-id', input.authConfig.clientId);
  response.headers.set('x-sva-debug-auth-redirect-uri', input.authConfig.redirectUri);
};

export const summarizeRedirectTarget = (
  value: string
): {
  redirect_target_origin?: string;
  redirect_target_path: string;
  has_sensitive_query: boolean;
} => {
  try {
    const url = new URL(value);
    return {
      redirect_target_origin: url.origin,
      redirect_target_path: url.pathname,
      has_sensitive_query: url.searchParams.has('id_token_hint') || url.searchParams.has('code'),
    };
  } catch {
    const [path] = value.split('?');
    return {
      redirect_target_path: path || value,
      has_sensitive_query: value.includes('id_token_hint=') || value.includes('code='),
    };
  }
};
