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
import type { RequestContextSdk, ServerTransportComponent } from './lib/server-entry-types';
import { dispatchKnownServerEntryRoutes } from './lib/server-entry-routes.server';
import { startStagingFallowBeacon } from './lib/fallow-staging-beacon.server';
import {
  finalizeProtectedApiResponse,
  resolveProtectedApiRouteTemplate,
} from './lib/server-entry-error-finalization.server';

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

type ServerEntryDebugLogger = (message: string, meta: Record<string, unknown>) => Promise<void>;

const createServerEntryDebugLogger = (request: Request): ServerEntryDebugLogger => {
  if (process.env.SVA_SERVER_ENTRY_DEBUG !== 'true') return async () => undefined;
  return async (message, meta) =>
    (await getLogger('server-entry-transport')).info(message, {
      operation: 'server_entry_transport',
      method: request.method,
      path: new URL(request.url).pathname,
      ...meta,
    });
};

const dispatchStudioServerRoutes = async (
  request: Request,
  sdk: RequestContextSdk,
  logDebug: ServerEntryDebugLogger
): Promise<Response | null> => {
  const requestPath = new URL(request.url).pathname;
  await logDebug('Server entry request received', {});
  if (requestPath === '/api/v1/monitoring/client-errors') {
    const { dispatchClientErrorTelemetryRequest } =
      await import('./lib/client-error-telemetry.server');
    const response = await dispatchClientErrorTelemetryRequest(request);
    if (response) return response;
  }
  if (
    requestPath.startsWith('/internal/plugins/') &&
    [...request.headers.keys()].some(
      (name) => name === 'forwarded' || name.startsWith('x-forwarded-')
    )
  ) {
    return new Response(null, { status: 404 });
  }
  if (requestPath === ssfAdminLoginDirectoryPath) {
    const dispatch = await getDispatchSsfAdminLoginDirectoryRequest();
    const response = await dispatch(request);
    if (response) {
      await logDebug('Server entry SSF directory route dispatched', { status: response.status });
      return response;
    }
  }
  if (requestPath === ssfInstallationContentV2Path) {
    const dispatch = (await import('#studio-ssf-admin-login-directory'))
      .dispatchStudioSsfInstallationContentV2Request;
    const response = await dispatch(request);
    if (response) return response;
  }
  await ensurePluginActivationPoliciesConfigured();
  sdk.runWithoutWorkspaceContext(startPluginOperationWorkerInBackground);
  const routedResponse = await dispatchKnownServerEntryRoutes(request, logDebug);
  if (routedResponse) return routedResponse;
  if (requestPath.startsWith('/api/v1/') || requestPath.startsWith('/internal/plugins/')) {
    const dispatch = await getPluginServerHandlerDispatcher();
    const response = await dispatch(request);
    if (response) {
      await logDebug('Server entry plugin route dispatched', { status: response.status });
      return response;
    }
  }
  return null;
};

const dispatchStartHandler = async (
  request: Request,
  requestOptions: Parameters<RequestHandler<Register>>[1],
  sdk: RequestContextSdk,
  logDebug: ServerEntryDebugLogger
): Promise<Response> => {
  await ensurePluginOperationHandlersRegistered();
  const dispatch = await getDispatchAuthRouteRequest();
  const authResponse = await dispatch(request);
  if (authResponse) {
    await logDebug('Server entry auth route dispatched', { status: authResponse.status });
    return authResponse;
  }
  if (!diagnosticsEnabled) {
    await logDebug('Server entry delegated to start handler', { diagnostics_enabled: false });
    const response = await startFetch(request, requestOptions);
    await logDebug('Server entry response completed', {
      status: response.status,
      diagnostics_enabled: false,
    });
    return response;
  }
  const diagnostics = createServerFunctionRequestDiagnostics({
    request,
    requestId: sdk.getWorkspaceContext().requestId ?? 'unknown',
    serverFnBase,
  });
  if (!diagnostics.isServerFnRequest) {
    await logDebug('Server entry delegated to start handler', {
      diagnostics_enabled: true,
      server_fn_request: false,
    });
    const response = await startFetch(request, requestOptions);
    await logDebug('Server entry response completed', {
      status: response.status,
      diagnostics_enabled: true,
      server_fn_request: false,
    });
    return response;
  }
  const logger = await getLogger('server-function-transport');
  logger.info('Server function request received', {
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
  await logDebug('Server entry response completed', {
    status: response.status,
    diagnostics_enabled: true,
    server_fn_request: true,
    branch_decision: branchDecision,
  });
  logger.info('Server function request routed', {
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
    const logDebug = createServerEntryDebugLogger(request);
    let response: Response;
    let dispatchFailed = false;
    try {
      response =
        (await dispatchStudioServerRoutes(request, sdk, logDebug)) ??
        (await dispatchStartHandler(request, requestOptions, sdk, logDebug));
    } catch (error) {
      const routeTemplate = resolveProtectedApiRouteTemplate(request);
      if (!routeTemplate) throw error;
      const requestId = sdk.getWorkspaceContext().requestId;
      const headers = new Headers();
      if (requestId) headers.set('X-Request-Id', requestId);
      response = Response.json(
        { error: { code: 'internal_error' }, ...(requestId ? { requestId } : {}) },
        { status: 500, headers }
      );
      dispatchFailed = true;
    }
    return finalizeProtectedApiResponse(
      request,
      response,
      sdk.getWorkspaceContext().requestId,
      () => getLogger('server-entry-transport'),
      dispatchFailed ? 'dispatch' : 'response'
    );
  });
};

export default createServerEntry({ fetch: instrumentedFetch });
