import type { Register } from '@tanstack/react-router';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import type { RequestHandler } from '@tanstack/react-start/server';

import {
  createServerFunctionRequestDiagnostics,
  normalizeServerFnBase,
  readServerFunctionResponseBodyForDiagnostics,
  resolveServerFunctionBranchDecision,
} from './lib/server-function-request-diagnostics.server';
import {
  logPluginWorkerBootstrapFailure,
  type PluginWorkerBootstrapLogger,
} from './lib/plugin-worker-bootstrap-logging.server';
import {
  ensurePluginActivationPoliciesConfigured,
  startPluginActivationPolicyFleetReconcileInBackground,
} from './lib/plugin-activation-policy-bootstrap.server';
import type {
  RequestContextSdk,
  RouteDispatchDescriptor,
  ServerTransportComponent,
} from './lib/server-entry-types';
import { serverEntryRouteDispatchers } from './lib/server-entry-routes.server';
import { startStagingFallowBeacon } from './lib/fallow-staging-beacon.server';

const startFetch = createStartHandler(defaultStreamHandler);
const ssfAdminLoginDirectoryPath = '/internal/plugins/ssf/v1/admin-login-tenants';
const ssfInstallationContentV2Path = '/internal/plugins/ssf/v2/installation-content';
const diagnosticsEnabled = (process.env.NODE_ENV ?? 'development') === 'development';
const devRuntimeRefreshEnabled = diagnosticsEnabled;
const serverFnBase = normalizeServerFnBase(process.env.TSS_SERVER_FN_BASE);
const studioJobWorkerEnabled = process.env.SVA_PLUGIN_OPERATION_WORKER_ENABLED !== 'false';
const studioJobWorkerLane =
  process.env.SVA_PLUGIN_OPERATION_WORKER_LANE === 'privileged' ? 'privileged' : 'default';

let sdkPromise: Promise<RequestContextSdk> | null = null;
const loggerPromises = new Map<ServerTransportComponent, Promise<PluginWorkerBootstrapLogger>>();
let dispatchAuthRouteRequestPromise: Promise<
  (typeof import('@sva/routing/server'))['dispatchAuthRouteRequest']
> | null = null;
let dispatchSsfAdminLoginDirectoryRequestPromise: Promise<
  (typeof import('@sva/auth-runtime/server'))['dispatchSsfAdminLoginDirectoryRequest']
> | null = null;
let pluginServerHandlerDispatcherPromise: Promise<
  (request: Request) => Promise<Response | null>
> | null = null;
let ensureStudioJobWorkerStartedPromise: Promise<
  (typeof import('@sva/auth-runtime/server'))['ensureStudioJobWorkerStarted']
> | null = null;
let registerStudioPluginOperationHandlersPromise: Promise<
  (typeof import('#studio-plugin-operation-runtime'))['registerStudioPluginOperationHandlers']
> | null = null;
let pluginOperationHandlerRegistrationPromise: Promise<void> | null = null;
let pluginOperationWorkerBootstrapPromise: Promise<void> | null = null;
const getSdk = async (): Promise<RequestContextSdk> => {
  sdkPromise ??= import('@sva/server-runtime') as Promise<RequestContextSdk>;
  return sdkPromise;
};

const getDispatchAuthRouteRequest = async () => {
  dispatchAuthRouteRequestPromise ??= import('@sva/routing/server').then(
    (mod) => mod.dispatchAuthRouteRequest
  );
  return dispatchAuthRouteRequestPromise;
};
const getDispatchSsfAdminLoginDirectoryRequest = async () => {
  dispatchSsfAdminLoginDirectoryRequestPromise ??= import('#studio-ssf-admin-login-directory').then(
    (mod) => mod.dispatchStudioSsfAdminLoginDirectoryRequest
  );
  return dispatchSsfAdminLoginDirectoryRequestPromise;
};
const getPluginServerHandlerDispatcher = async () => {
  if (devRuntimeRefreshEnabled) {
    return (
      await import('./lib/plugin-server-runtime.server')
    ).createStudioPluginServerHandlerDispatcher();
  }
  pluginServerHandlerDispatcherPromise ??= import('./lib/plugin-server-runtime.server').then(
    (mod) => mod.createStudioPluginServerHandlerDispatcher()
  );
  return pluginServerHandlerDispatcherPromise;
};
const getEnsureStudioJobWorkerStarted = async () => {
  ensureStudioJobWorkerStartedPromise ??= import('@sva/auth-runtime/server').then((mod) =>
    studioJobWorkerLane === 'privileged'
      ? mod.ensurePrivilegedStudioJobWorkerStarted
      : mod.ensureStudioJobWorkerStarted
  );
  return ensureStudioJobWorkerStartedPromise;
};
const getRegisterStudioPluginOperationHandlers = async () => {
  if (devRuntimeRefreshEnabled) {
    return (await import('#studio-plugin-operation-runtime')).registerStudioPluginOperationHandlers;
  }
  registerStudioPluginOperationHandlersPromise ??= import('#studio-plugin-operation-runtime').then(
    (mod) => mod.registerStudioPluginOperationHandlers
  );
  return registerStudioPluginOperationHandlersPromise;
};
const ensurePluginOperationHandlersRegistered = async (): Promise<void> => {
  if (devRuntimeRefreshEnabled) {
    pluginOperationHandlerRegistrationPromise ??= (async () => {
      const registerPluginOperationHandlers = await getRegisterStudioPluginOperationHandlers();
      await registerPluginOperationHandlers();
    })().finally(() => {
      pluginOperationHandlerRegistrationPromise = null;
      registerStudioPluginOperationHandlersPromise = null;
    });
    await pluginOperationHandlerRegistrationPromise;
    return;
  }
  pluginOperationHandlerRegistrationPromise ??= (async () => {
    const registerPluginOperationHandlers = await getRegisterStudioPluginOperationHandlers();
    await registerPluginOperationHandlers();
  })().catch((error) => {
    pluginOperationHandlerRegistrationPromise = null;
    registerStudioPluginOperationHandlersPromise = null;
    throw error;
  });

  await pluginOperationHandlerRegistrationPromise;
};

const reportPluginWorkerBootstrapFailure = async (error: unknown): Promise<void> =>
  logPluginWorkerBootstrapFailure(await getLogger('server-entry-transport'), error);

const terminateAfterTerminalWorkerFailure = (): never => process.exit(1);

const startPluginOperationWorkerInBackground = (): void => {
  if (pluginOperationWorkerBootstrapPromise) {
    if (devRuntimeRefreshEnabled) {
      void ensurePluginOperationHandlersRegistered().catch((error) =>
        reportPluginWorkerBootstrapFailure(error)
      );
    }

    return;
  }

  pluginOperationWorkerBootstrapPromise = (async () => {
    try {
      await ensurePluginActivationPoliciesConfigured();
      await ensurePluginOperationHandlersRegistered();
      if (studioJobWorkerLane === 'default') {
        startPluginActivationPolicyFleetReconcileInBackground();
      }
      if (!studioJobWorkerEnabled) return;
      const startWorker = await getEnsureStudioJobWorkerStarted();
      await startWorker({
        onTerminalFailure: terminateAfterTerminalWorkerFailure,
      });
      if (studioJobWorkerLane === 'default') {
        const { startWasteEmailReminderProcessing } =
          await import('#studio-plugin-operation-runtime');
        startWasteEmailReminderProcessing();
      }
    } catch (error) {
      await reportPluginWorkerBootstrapFailure(error);
    } finally {
      pluginOperationWorkerBootstrapPromise = null;
    }
  })();
};

const getLogger = async (
  component: ServerTransportComponent
): Promise<PluginWorkerBootstrapLogger> => {
  let loggerPromise = loggerPromises.get(component);
  if (!loggerPromise) {
    loggerPromise = getSdk().then((sdk) =>
      sdk.createSdkLogger({
        component,
        level: 'info',
      })
    );
    loggerPromises.set(component, loggerPromise);
  }

  return loggerPromise;
};

const resolveProtectedApiRouteTemplate = (request: Request): string | null => {
  const pathname = new URL(request.url).pathname;
  if (
    !pathname.startsWith('/api/v1/') &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/iam/')
  ) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
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
  const firstVariableSegment = segments.findIndex((segment) => !safeRouteSegments.has(segment));
  const routeSegments =
    firstVariableSegment < 0 ? segments : segments.slice(0, firstVariableSegment);
  return `/${routeSegments.join('/')}${firstVariableSegment < 0 ? '' : '/*'}`;
};

const safeFailureReasonCodes = new Set([
  'missing_credentials',
  'organization_not_found',
  'partial_credentials',
  'verification_pending',
]);

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

const finalizeProtectedApiResponse = async (
  request: Request,
  response: Response,
  requestId: string | null | undefined,
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

  const isClientTelemetryRequest =
    new URL(request.url).pathname === '/api/v1/monitoring/client-errors';
  if (isClientTelemetryRequest) return finalizedResponse;

  const logger = await getLogger('server-entry-transport');
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
  if (response.status >= 500) {
    logger.error('Studio API request failed', metadata);
  } else {
    logger.warn('Studio API request failed', metadata);
  }
  return finalizedResponse;
};

const dispatchServerEntryRoute = async (
  request: Request,
  logServerEntryDebug: (message: string, meta: Record<string, unknown>) => Promise<void>,
  route: RouteDispatchDescriptor
): Promise<Response | null> => {
  const dispatch = await route.getDispatcher();
  const response = await dispatch(request);

  if (!response) {
    return null;
  }

  await logServerEntryDebug(`Server entry ${route.label} route dispatched`, {
    status: response.status,
  });

  return response;
};

const dispatchKnownServerEntryRoutes = async (
  request: Request,
  logServerEntryDebug: (message: string, meta: Record<string, unknown>) => Promise<void>
): Promise<Response | null> => {
  for (const route of serverEntryRouteDispatchers) {
    const response = await dispatchServerEntryRoute(request, logServerEntryDebug, route);
    if (response) {
      return response;
    }
  }

  return null;
};

if (studioJobWorkerEnabled) {
  startPluginOperationWorkerInBackground();
}

startStagingFallowBeacon((message, meta) => {
  void getLogger('server-entry-transport').then((logger) => logger.error(message, meta));
});

const instrumentedFetch: RequestHandler<Register> = async (...args) => {
  const [request, requestOptions] = args;
  const sdk = await getSdk();
  return sdk.withRequestContext({ request, fallbackWorkspaceId: 'platform' }, async () => {
    const dispatchResponse = async (): Promise<Response> => {
      const requestPath = new URL(request.url).pathname;
      const serverEntryDebugEnabled = process.env.SVA_SERVER_ENTRY_DEBUG === 'true';
      const logServerEntryDebug = async (message: string, meta: Record<string, unknown>) => {
        if (!serverEntryDebugEnabled) {
          return;
        }

        (await getLogger('server-entry-transport')).info(message, {
          operation: 'server_entry_transport',
          method: request.method,
          path: new URL(request.url).pathname,
          ...meta,
        });
      };

      await logServerEntryDebug('Server entry request received', {});
      if (requestPath === '/api/v1/monitoring/client-errors') {
        const { dispatchClientErrorTelemetryRequest } = await import(
          './lib/client-error-telemetry.server'
        );
        const telemetryResponse = await dispatchClientErrorTelemetryRequest(request);
        if (telemetryResponse) return telemetryResponse;
      }

      // Internal services connect directly over the private container network.
      // Traefik adds forwarding headers on every public ingress request.
      if (
        requestPath.startsWith('/internal/plugins/') &&
        [...request.headers.keys()].some(
          (name) => name === 'forwarded' || name.startsWith('x-forwarded-')
        )
      ) {
        return new Response(null, { status: 404 });
      }
      if (requestPath === ssfAdminLoginDirectoryPath) {
        const dispatchSsfAdminLoginDirectoryRequest =
          await getDispatchSsfAdminLoginDirectoryRequest();
        const directoryResponse = await dispatchSsfAdminLoginDirectoryRequest(request);
        if (directoryResponse) {
          await logServerEntryDebug('Server entry SSF directory route dispatched', {
            status: directoryResponse.status,
          });
          return directoryResponse;
        }
      }
      if (requestPath === ssfInstallationContentV2Path) {
        const dispatchInstallationContent = (await import('#studio-ssf-admin-login-directory'))
          .dispatchStudioSsfInstallationContentV2Request;
        const installationResponse = await dispatchInstallationContent(request);
        if (installationResponse) return installationResponse;
      }

      await ensurePluginActivationPoliciesConfigured();
      sdk.runWithoutWorkspaceContext(startPluginOperationWorkerInBackground);
      const routedResponse = await dispatchKnownServerEntryRoutes(request, logServerEntryDebug);

      if (routedResponse) {
        return routedResponse;
      }

      if (requestPath.startsWith('/api/v1/') || requestPath.startsWith('/internal/plugins/')) {
        const dispatchPluginServerHandler = await getPluginServerHandlerDispatcher();
        const pluginServerResponse = await dispatchPluginServerHandler(request);
        if (pluginServerResponse) {
          await logServerEntryDebug('Server entry plugin route dispatched', {
            status: pluginServerResponse.status,
          });
          return pluginServerResponse;
        }
      }

      await ensurePluginOperationHandlersRegistered();

      const dispatchAuthRouteRequest = await getDispatchAuthRouteRequest();
      const authResponse = await dispatchAuthRouteRequest(request);

      if (authResponse) {
        await logServerEntryDebug('Server entry auth route dispatched', {
          status: authResponse.status,
        });
        return authResponse;
      }

      if (!diagnosticsEnabled) {
        await logServerEntryDebug('Server entry delegated to start handler', {
          diagnostics_enabled: false,
        });
        const response = await startFetch(request, requestOptions);
        await logServerEntryDebug('Server entry response completed', {
          status: response.status,
          diagnostics_enabled: false,
        });
        return response;
      }

      const workspaceContext = sdk.getWorkspaceContext();
      const diagnostics = createServerFunctionRequestDiagnostics({
        request,
        requestId: workspaceContext.requestId ?? 'unknown',
        serverFnBase,
      });

      if (!diagnostics.isServerFnRequest) {
        await logServerEntryDebug('Server entry delegated to start handler', {
          diagnostics_enabled: true,
          server_fn_request: false,
        });
        const response = await startFetch(request, requestOptions);
        await logServerEntryDebug('Server entry response completed', {
          status: response.status,
          diagnostics_enabled: true,
          server_fn_request: false,
        });
        return response;
      }

      (await getLogger('server-function-transport')).info('Server function request received', {
        operation: 'server_function_transport',
        request_id: diagnostics.requestId,
        method: diagnostics.method,
        path: diagnostics.path,
        server_fn_base: diagnostics.serverFnBase,
        accept: diagnostics.accept ?? undefined,
        content_type: diagnostics.contentType ?? undefined,
      });

      const response = await startFetch(request, requestOptions);
      const responseBody = await readServerFunctionResponseBodyForDiagnostics(response);
      const branchDecision = resolveServerFunctionBranchDecision({
        diagnostics,
        responseStatus: response.status,
        responseBody,
      });

      await logServerEntryDebug('Server entry response completed', {
        status: response.status,
        diagnostics_enabled: true,
        server_fn_request: true,
        branch_decision: branchDecision,
      });

      (await getLogger('server-function-transport')).info('Server function request routed', {
        operation: 'server_function_transport',
        request_id: diagnostics.requestId,
        method: diagnostics.method,
        path: diagnostics.path,
        server_fn_base: diagnostics.serverFnBase,
        branch_decision: branchDecision,
        http_status: response.status,
        accept: diagnostics.accept ?? undefined,
        content_type: diagnostics.contentType ?? undefined,
        response_content_type: response.headers.get('content-type') ?? undefined,
      });

      return response;
    };

    let response: Response;
    let dispatchFailed = false;
    try {
      response = await dispatchResponse();
    } catch (error) {
      const routeTemplate = resolveProtectedApiRouteTemplate(request);
      if (!routeTemplate) throw error;
      const requestId = sdk.getWorkspaceContext().requestId;
      const headers = new Headers();
      if (requestId) headers.set('X-Request-Id', requestId);
      response = Response.json(
        {
          error: {
            code: 'internal_error',
          },
          ...(requestId ? { requestId } : {}),
        },
        { status: 500, headers }
      );
      dispatchFailed = true;
    }
    return finalizeProtectedApiResponse(
      request,
      response,
      sdk.getWorkspaceContext().requestId,
      dispatchFailed ? 'dispatch' : 'response'
    );
  });
};

export default createServerEntry({ fetch: instrumentedFetch });
