export type RoutingDenyReason =
  | 'unauthenticated'
  | 'insufficient-role'
  | 'unsupported-plugin-guard'
  | 'method-not-allowed';

export type RoutingDiagnosticEvent =
  | {
      readonly level: 'info';
      readonly event: 'routing.guard.access_denied';
      readonly route: string;
      readonly reason: 'unauthenticated' | 'insufficient-role';
      readonly redirect_target: string;
      readonly required_roles?: readonly string[];
    }
  | {
      readonly level: 'warn';
      readonly event: 'routing.plugin.guard_unsupported';
      readonly route: string;
      readonly reason: 'unsupported-plugin-guard';
      readonly plugin?: string;
      readonly unsupported_guard?: string;
    }
  | {
      readonly level: 'warn';
      readonly event: 'routing.handler.method_not_allowed';
      readonly route: string;
      readonly reason: 'method-not-allowed';
      readonly method: string;
      readonly allow: string;
      readonly request_id?: string;
      readonly trace_id?: string;
      readonly workspace_id?: string;
    }
  | {
      readonly level: 'error';
      readonly event: 'routing.handler.error_caught';
      readonly route: string;
      readonly method: string;
      readonly request_id?: string;
      readonly trace_id?: string;
      readonly workspace_id?: string;
      readonly error_type: string;
      readonly error_message: string;
    }
  | {
      readonly level: 'error';
      readonly event: 'routing.logger.fallback_activated';
      readonly route: string;
      readonly method: string;
      readonly request_id?: string;
      readonly trace_id?: string;
      readonly workspace_id?: string;
      readonly error_type: string;
      readonly error_message: string;
    };

export interface RoutingDiagnosticsHook {
  (event: RoutingDiagnosticEvent): void;
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'then') === 'function';

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
      void Promise.resolve(maybePromise).catch(() => {
        // Diagnostics hooks must never change routing behavior.
      });
    }
  } catch {
    // Diagnostics hooks must never change routing behavior.
  }
};
