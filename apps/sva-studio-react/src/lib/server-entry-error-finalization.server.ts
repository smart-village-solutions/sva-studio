import type { PluginWorkerBootstrapLogger } from './plugin-worker-bootstrap-logging.server';

const safeRouteSegments = new Set([
  'account-action',
  'admin',
  'api',
  'archive',
  'assign',
  'audit',
  'auth',
  'authorize',
  'authorize-performance',
  'bulk-deactivate',
  'bulk-reprovision-mainserver',
  'bus-api-keys',
  'callback',
  'categories',
  'complete',
  'confirmation',
  'consents',
  'content-preference',
  'contents',
  'context',
  'deactivate',
  'deletion-rules',
  'delivery',
  'draft-readiness',
  'events',
  'execute',
  'export',
  'groups',
  'health',
  'history',
  'iam',
  'instances',
  'invitation-template',
  'items',
  'jobs',
  'keycloak',
  'keycloak-roles',
  'legal-consents',
  'legal-holds',
  'legal-texts',
  'live',
  'login',
  'logout',
  'mainserver',
  'map-geocoding',
  'media',
  'memberships',
  'me',
  'modules',
  'monitoring',
  'news',
  'organizations',
  'permissions',
  'plugins',
  'poi',
  'preflight',
  'profile',
  'provision-mainserver',
  'provisioning',
  'reconcile',
  'references',
  'register',
  'roles',
  'runs',
  'seed-iam-baseline',
  'suspend',
  'surveys',
  'sync-keycloak',
  'templates',
  'tenant-iam',
  'timeline',
  'transfer-ownership',
  'upload-sessions',
  'users',
  'v1',
  'waste-management',
  'workflows',
]);

const safeFailureReasonCodes = new Set([
  'missing_credentials',
  'organization_not_found',
  'partial_credentials',
  'verification_pending',
]);

export const resolveProtectedApiRouteTemplate = (request: Request): string | null => {
  const pathname = new URL(request.url).pathname;
  if (!['/api/v1/', '/auth/', '/iam/'].some((prefix) => pathname.startsWith(prefix))) return null;

  const segments = pathname.split('/').filter(Boolean);
  const firstVariableSegment = segments.findIndex((segment) => !safeRouteSegments.has(segment));
  const routeSegments =
    firstVariableSegment < 0 ? segments : segments.slice(0, firstVariableSegment);
  return `/${routeSegments.join('/')}${firstVariableSegment < 0 ? '' : '/*'}`;
};

const readResponseErrorDiagnostics = async (
  response: Response
): Promise<{ readonly errorCode?: string; readonly reasonCode?: string }> => {
  try {
    const body: unknown = await response.clone().json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return {};
    const record = body as Record<string, unknown>;
    const nestedError = record.error;
    const candidate =
      typeof nestedError === 'string'
        ? nestedError
        : typeof nestedError === 'object' && nestedError !== null
          ? (nestedError as Record<string, unknown>).code
          : undefined;
    const details = record.details;
    const reasonCandidate =
      typeof details === 'object' && details !== null && !Array.isArray(details)
        ? (details as Record<string, unknown>).reasonCode
        : undefined;
    return {
      ...(typeof candidate === 'string' && /^[a-z][a-z0-9_.-]{0,95}$/i.test(candidate)
        ? { errorCode: candidate }
        : {}),
      ...(typeof reasonCandidate === 'string' && safeFailureReasonCodes.has(reasonCandidate)
        ? { reasonCode: reasonCandidate }
        : {}),
    };
  } catch {
    return {};
  }
};

export const finalizeProtectedApiResponse = async (
  request: Request,
  response: Response,
  requestId: string | null | undefined,
  getLogger: () => Promise<PluginWorkerBootstrapLogger>,
  phase: 'response' | 'dispatch' = 'response'
): Promise<Response> => {
  const routeTemplate = resolveProtectedApiRouteTemplate(request);
  if (!routeTemplate || response.status < 400) return response;

  const headers = new Headers(response.headers);
  if (requestId) headers.set('X-Request-Id', requestId);
  const finalizedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  if (new URL(request.url).pathname === '/api/v1/monitoring/client-errors') {
    return finalizedResponse;
  }

  const errorDiagnostics = await readResponseErrorDiagnostics(response);
  const metadata = {
    event: 'studio.request.failed',
    operation: 'studio_request_failed',
    request_id: requestId ?? 'unknown',
    http_status: response.status,
    ...(errorDiagnostics.errorCode ? { error_code: errorDiagnostics.errorCode } : {}),
    ...(errorDiagnostics.reasonCode ? { reason_code: errorDiagnostics.reasonCode } : {}),
    route_template: routeTemplate,
    method: request.method,
    phase,
  };
  const logger = await getLogger();
  if (response.status >= 500) logger.error('Studio API request failed', metadata);
  else logger.warn('Studio API request failed', metadata);
  return finalizedResponse;
};
