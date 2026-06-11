import { createSdkLogger, toJsonErrorResponse } from '@sva/server-runtime';

import type { AuthHandlers } from './auth.route-handlers.types.js';
import type { RoutingDiagnosticEvent } from './diagnostics.js';
import {
  defaultServerRoutingDiagnostics,
  readRoutingDiagnosticsContextFromRequest,
} from './diagnostics.server.js';

const logger = createSdkLogger({ component: 'auth-routing', level: 'info' });

const getErrorType = (error: unknown): string =>
  error instanceof Error ? error.constructor.name : typeof error;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const writeLoggerFallback = (input: {
  method: string;
  route: string;
  workspaceId: string;
  requestId?: string;
  traceId?: string;
  errorType: string;
  errorMessage: string;
}): void => {
  const payload = JSON.stringify({
    level: 'error',
    component: 'auth-routing',
    event: 'routing.logger.fallback_activated',
    method: input.method,
    route: input.route,
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    trace_id: input.traceId,
    error_type: input.errorType,
    error_message: input.errorMessage,
  });
  process.stderr.write(`${payload}\n`);
};

const emitServerRoutingDiagnostic = (
  event: RoutingDiagnosticEvent,
  fallback?: {
    readonly method: string;
    readonly route: string;
    readonly workspaceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
  }
): void => {
  try {
    defaultServerRoutingDiagnostics(event);
  } catch (error) {
    if (!fallback) {
      return;
    }

    writeLoggerFallback({
      ...fallback,
      errorType: getErrorType(error),
      errorMessage: getErrorMessage(error),
    });
  }
};

type AuthHandlerExecutionContext = {
  readonly diagnosticsContext: ReturnType<typeof readRoutingDiagnosticsContextFromRequest>;
  readonly fallback: {
    readonly method: string;
    readonly route: string;
    readonly workspaceId: string;
    readonly requestId?: string;
    readonly traceId?: string;
  };
  readonly method: string;
  readonly route: string;
  readonly startedAt: number;
};

const createAuthHandlerExecutionContext = (
  request: Request,
  method: string,
  route: string
): AuthHandlerExecutionContext => {
  const diagnosticsContext = readRoutingDiagnosticsContextFromRequest(request);

  return {
    diagnosticsContext,
    fallback: {
      method,
      route,
      workspaceId: diagnosticsContext.workspace_id ?? 'default',
      requestId: diagnosticsContext.request_id,
      traceId: diagnosticsContext.trace_id,
    },
    method,
    route,
    startedAt: Date.now(),
  };
};

const emitAuthHandlerDispatched = (context: AuthHandlerExecutionContext): void => {
  emitServerRoutingDiagnostic(
    {
      level: 'info',
      event: 'routing.handler.dispatched',
      method: context.method,
      route: context.route,
      ...context.diagnosticsContext,
    },
    context.fallback
  );
};

const emitAuthHandlerCompleted = (context: AuthHandlerExecutionContext, response: Response): void => {
  emitServerRoutingDiagnostic(
    {
      level: 'info',
      event: 'routing.handler.completed',
      method: context.method,
      route: context.route,
      status_code: response.status,
      duration_ms: Date.now() - context.startedAt,
      ...context.diagnosticsContext,
    },
    context.fallback
  );
};

const createAuthHandlerErrorResponse = (context: AuthHandlerExecutionContext, error: unknown): Response => {
  const errorType = getErrorType(error);
  const errorMessage = getErrorMessage(error);
  const response = toJsonErrorResponse(500, 'internal_error', 'Ein unerwarteter Fehler ist aufgetreten.', {
    requestId: context.diagnosticsContext.request_id,
  });

  emitServerRoutingDiagnostic(
    {
      level: 'error',
      event: 'routing.handler.error_caught',
      method: context.method,
      route: context.route,
      ...context.diagnosticsContext,
      error_type: errorType,
      error_message: errorMessage,
    },
    context.fallback
  );

  emitAuthHandlerCompleted(context, response);
  return response;
};

export const emitMethodNotAllowedDiagnostic = (
  request: Request,
  route: string,
  allow: string,
  options: { readonly log?: boolean } = {}
): string | undefined => {
  const context = readRoutingDiagnosticsContextFromRequest(request);

  if (options.log !== false) {
    emitServerRoutingDiagnostic(
      {
        level: 'warn',
        event: 'routing.handler.method_not_allowed',
        route,
        reason: 'method-not-allowed',
        method: request.method.toUpperCase(),
        allow,
        ...context,
      },
      {
        method: request.method.toUpperCase(),
        route,
        workspaceId: context.workspace_id ?? 'default',
        requestId: context.request_id,
        traceId: context.trace_id,
      }
    );
  }

  return context.request_id;
};

export const verifyRouteDiagnosticsLogger = () => logger;

export const wrapHandlersWithJsonErrorBoundary = (handlers: AuthHandlers, routePath?: string): AuthHandlers => {
  if (!handlers || typeof handlers !== 'object') {
    throw new Error(`invalid_auth_route_handlers:${routePath ?? 'unknown-route'}`);
  }

  const wrapped: AuthHandlers = {};
  for (const [method, handler] of Object.entries(handlers) as [string, NonNullable<AuthHandlers[keyof AuthHandlers]>][]) {
    (wrapped as Record<string, typeof handler>)[method] = async (ctx) => {
      const executionContext = createAuthHandlerExecutionContext(
        ctx.request,
        method,
        routePath ?? new URL(ctx.request.url).pathname
      );
      emitAuthHandlerDispatched(executionContext);

      try {
        const response = await handler(ctx);
        emitAuthHandlerCompleted(executionContext, response);
        return response;
      } catch (error) {
        return createAuthHandlerErrorResponse(executionContext, error);
      }
    };
  }
  return wrapped;
};
