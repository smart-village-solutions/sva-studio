import type { Register } from '@tanstack/react-router';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import type { RequestHandler } from '@tanstack/react-start/server';
import { dispatchAuthRouteRequest } from '@sva/routing/server';

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
let loggerPromise: Promise<ServerTransportLogger> | null = null;
const getSdk = async (): Promise<RequestContextSdk> => {
  sdkPromise ??= import('@sva/sdk/server') as Promise<RequestContextSdk>;
  return sdkPromise;
};

const getLogger = async (): Promise<ServerTransportLogger> => {
  loggerPromise ??= getSdk().then((sdk) =>
    sdk.createSdkLogger({
      component: 'server-function-transport',
      level: 'info',
      enableConsole: true,
      enableOtel: false,
    })
  );

  return loggerPromise;
};

export type ServerEntry = { fetch: RequestHandler<Register> };

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args);
    },
  };
}

const instrumentedFetch: RequestHandler<Register> = async (...args) => {
  const [request, requestOptions] = args;
  const authResponse = await dispatchAuthRouteRequest(request);

  if (authResponse) {
    return authResponse;
  }

  if (!diagnosticsEnabled) {
    return startFetch(request, requestOptions);
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
      return startFetch(request, requestOptions);
    }

    (await getLogger()).info('Server function request received', {
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

    (await getLogger()).info('Server function request routed', {
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
