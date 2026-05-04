export type RoutingDenyReason =
  | 'unauthenticated'
  | 'insufficient-role'
  | 'insufficient-permission'
  | 'unsupported-plugin-guard'
  | 'method-not-allowed';

type RoutingDiagnosticBase = {
  readonly route: string;
  readonly request_id?: string;
  readonly trace_id?: string;
  readonly workspace_id?: string;
};

export type RoutingDiagnosticEvent =
  | (RoutingDiagnosticBase & {
      readonly level: 'info';
      readonly event: 'routing.guard.access_denied';
      readonly reason: 'unauthenticated' | 'insufficient-role' | 'insufficient-permission';
      readonly redirect_target: string;
      readonly required_roles?: readonly string[];
      readonly required_permissions?: readonly string[];
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'warn';
      readonly event: 'routing.plugin.guard_unsupported';
      readonly reason: 'unsupported-plugin-guard';
      readonly plugin?: string;
      readonly unsupported_guard?: string;
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'info';
      readonly event: 'routing.handler.dispatched';
      readonly method: string;
      readonly handler_name?: string;
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'info';
      readonly event: 'routing.handler.completed';
      readonly method: string;
      readonly status_code: number;
      readonly duration_ms: number;
      readonly handler_name?: string;
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'warn';
      readonly event: 'routing.handler.method_not_allowed';
      readonly reason: 'method-not-allowed';
      readonly method: string;
      readonly allow: string;
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'error';
      readonly event: 'routing.handler.error_caught';
      readonly method: string;
      readonly error_type: string;
      readonly error_message: string;
      readonly handler_name?: string;
    })
  | (RoutingDiagnosticBase & {
      readonly level: 'error';
      readonly event: 'routing.logger.fallback_activated';
      readonly method: string;
      readonly error_type: string;
      readonly error_message: string;
      readonly handler_name?: string;
    });

export interface RoutingDiagnosticsHook {
  (event: RoutingDiagnosticEvent): void;
}

export interface RoutingDiagnosticsLogger {
  info: (message: string, meta: Record<string, unknown>) => void;
  warn: (message: string, meta: Record<string, unknown>) => void;
  error: (message: string, meta: Record<string, unknown>) => void;
}

type RoutingFallbackLogger = Pick<RoutingDiagnosticsLogger, 'error'>;

let serverFallbackLogger: RoutingFallbackLogger | null = null;

const isBrowserRuntime = () => typeof globalThis.window !== 'undefined';

export const setRoutingDiagnosticsFailureLogger = (logger: RoutingFallbackLogger | null): void => {
  serverFallbackLogger = logger;
};

export const registerServerFallbackLogger = (logger: RoutingFallbackLogger): void => {
  setRoutingDiagnosticsFailureLogger(logger);
};

export const resetServerFallbackLogger = (): void => {
  setRoutingDiagnosticsFailureLogger(null);
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'then') === 'function';

const getRoutingDiagnosticMessage = (event: RoutingDiagnosticEvent): string => {
  switch (event.event) {
    case 'routing.guard.access_denied':
      return 'Routing guard denied access';
    case 'routing.plugin.guard_unsupported':
      return 'Unsupported plugin route guard';
    case 'routing.handler.dispatched':
      return 'Routing handler dispatched';
    case 'routing.handler.completed':
      return 'Routing handler completed';
    case 'routing.handler.method_not_allowed':
      return 'Unsupported HTTP method for route handler';
    case 'routing.handler.error_caught':
      return 'Unhandled exception in route handler';
    case 'routing.logger.fallback_activated':
      return 'Routing logger fallback activated';
  }
};

const getRoutingDiagnosticMeta = (event: RoutingDiagnosticEvent): Record<string, unknown> => ({
  event: event.event,
  route: event.route,
  reason: 'reason' in event ? event.reason : undefined,
  request_id: event.request_id,
  trace_id: event.trace_id,
  workspace_id: event.workspace_id,
  redirect_target: 'redirect_target' in event ? event.redirect_target : undefined,
  required_roles: 'required_roles' in event ? event.required_roles : undefined,
  required_permissions: 'required_permissions' in event ? event.required_permissions : undefined,
  plugin: 'plugin' in event ? event.plugin : undefined,
  unsupported_guard: 'unsupported_guard' in event ? event.unsupported_guard : undefined,
  method: 'method' in event ? event.method : undefined,
  allow: 'allow' in event ? event.allow : undefined,
  status_code: 'status_code' in event ? event.status_code : undefined,
  duration_ms: 'duration_ms' in event ? event.duration_ms : undefined,
  handler_name: 'handler_name' in event ? event.handler_name : undefined,
  error_type: 'error_type' in event ? event.error_type : undefined,
  error_message: 'error_message' in event ? event.error_message : undefined,
});

export const createRoutingDiagnosticsLogger = (logger: RoutingDiagnosticsLogger): RoutingDiagnosticsHook => {
  return (event) => {
    const message = getRoutingDiagnosticMessage(event);
    const meta = getRoutingDiagnosticMeta(event);

    switch (event.level) {
      case 'info':
        logger.info(message, meta);
        return;
      case 'warn':
        logger.warn(message, meta);
        return;
      case 'error':
        logger.error(message, meta);
        return;
    }
  };
};

const logRoutingDiagnosticFailure = (event: RoutingDiagnosticEvent, error: unknown): void => {
  const message = 'Routing diagnostics hook failed';
  const meta = {
    event: event.event,
    route: event.route,
    request_id: event.request_id,
    trace_id: event.trace_id,
    workspace_id: event.workspace_id,
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
  };

  if (isBrowserRuntime()) {
    console.error(message, meta);
    return;
  }

  if (serverFallbackLogger) {
    serverFallbackLogger.error(message, meta);
    return;
  }

  console.error(message, meta);
};

export const emitRoutingDiagnostic = (
  diagnostics: RoutingDiagnosticsHook | undefined,
  event: RoutingDiagnosticEvent
): void => {
  if (!diagnostics) {
    return;
  }

  try {
    const maybePromise = diagnostics(event) as void | PromiseLike<unknown>;
    if (isPromiseLike(maybePromise)) {
      void Promise.resolve(maybePromise).catch((error) => {
        logRoutingDiagnosticFailure(event, error);
        // Diagnostics hooks must never change routing behavior.
      });
    }
  } catch (error) {
    logRoutingDiagnosticFailure(event, error);
    // Diagnostics hooks must never change routing behavior.
  }
};
