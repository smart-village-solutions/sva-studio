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

const startFetch = createStartHandler(defaultStreamHandler);
const diagnosticsEnabled = (process.env.NODE_ENV ?? 'development') === 'development';
const serverFnBase = normalizeServerFnBase(process.env.TSS_SERVER_FN_BASE);

type WorkspaceContext = {
  readonly requestId?: string | null;
};

type ServerTransportLogger = {
  info: (message: string, meta: Record<string, unknown>) => void;
};

type ServerTransportComponent = 'server-entry-transport' | 'server-function-transport';

type RequestContextSdk = {
  createSdkLogger: (options: {
    readonly component: string;
    readonly level: 'info';
    readonly enableConsole: boolean;
    readonly enableOtel: boolean;
  }) => ServerTransportLogger;
  getWorkspaceContext: () => WorkspaceContext;
  withRequestContext: <T>(
    input: {
      readonly request: Request;
      readonly fallbackWorkspaceId: string;
    },
    callback: () => Promise<T>
  ) => Promise<T>;
};

let sdkPromise: Promise<RequestContextSdk> | null = null;
const loggerPromises = new Map<ServerTransportComponent, Promise<ServerTransportLogger>>();
let dispatchAuthRouteRequestPromise: Promise<typeof import('@sva/routing/server')['dispatchAuthRouteRequest']> | null = null;
const getSdk = async (): Promise<RequestContextSdk> => {
  sdkPromise ??= import('@sva/sdk/server') as Promise<RequestContextSdk>;
  return sdkPromise;
};

const getDispatchAuthRouteRequest = async () => {
  dispatchAuthRouteRequestPromise ??= import('@sva/routing/server').then((mod) => mod.dispatchAuthRouteRequest);
  return dispatchAuthRouteRequestPromise;
};

const getLogger = async (component: ServerTransportComponent): Promise<ServerTransportLogger> => {
  let loggerPromise = loggerPromises.get(component);
  if (!loggerPromise) {
    loggerPromise = getSdk().then((sdk) =>
      sdk.createSdkLogger({
        component,
        level: 'info',
        enableConsole: true,
        enableOtel: false,
      })
    );
    loggerPromises.set(component, loggerPromise);
  }

  return loggerPromise;
};

const instrumentedFetch: RequestHandler<Register> = async (...args) => {
  const [request, requestOptions] = args;
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

  const sdk = await getSdk();

  return sdk.withRequestContext({ request, fallbackWorkspaceId: 'platform' }, async () => {
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
  });
};

export default createServerEntry({ fetch: instrumentedFetch });
