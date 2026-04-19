import { describe, expect, it, vi } from 'vitest';

import {
  createRoutingDiagnosticsLogger,
  emitRoutingDiagnostic,
  type RoutingDiagnosticEvent,
} from './diagnostics';

const testEvent: RoutingDiagnosticEvent = {
  level: 'info',
  event: 'routing.guard.access_denied',
  route: '/account',
  reason: 'unauthenticated',
  redirect_target: '/auth/login',
};

describe('emitRoutingDiagnostic', () => {
  it('swallows rejected promises from async diagnostics hooks', async () => {
    expect(() =>
      emitRoutingDiagnostic((() => Promise.reject(new Error('diagnostics failed'))) as never, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('createRoutingDiagnosticsLogger', () => {
  it('maps routing events to the matching logger level with normalized metadata', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const diagnostics = createRoutingDiagnosticsLogger(logger);

    diagnostics({
      level: 'info',
      event: 'routing.handler.completed',
      route: '/auth/me',
      method: 'GET',
      status_code: 200,
      duration_ms: 12,
      request_id: 'req-1',
      trace_id: 'trace-1',
      workspace_id: 'workspace-1',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Routing handler completed',
      expect.objectContaining({
        event: 'routing.handler.completed',
        route: '/auth/me',
        method: 'GET',
        status_code: 200,
        duration_ms: 12,
        request_id: 'req-1',
        trace_id: 'trace-1',
        workspace_id: 'workspace-1',
      })
    );
  });

  it('maps warn and error events with the shared routing fields', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const diagnostics = createRoutingDiagnosticsLogger(logger);

    diagnostics({
      level: 'warn',
      event: 'routing.plugin.guard_unsupported',
      route: '/plugins/news',
      reason: 'unsupported-plugin-guard',
      plugin: 'news',
      unsupported_guard: 'unknown.guard',
    });
    diagnostics({
      level: 'error',
      event: 'routing.handler.error_caught',
      route: '/auth/me',
      method: 'GET',
      error_type: 'Error',
      error_message: 'boom',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Unsupported plugin route guard',
      expect.objectContaining({
        event: 'routing.plugin.guard_unsupported',
        route: '/plugins/news',
        reason: 'unsupported-plugin-guard',
        plugin: 'news',
        unsupported_guard: 'unknown.guard',
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        route: '/auth/me',
        method: 'GET',
        error_type: 'Error',
        error_message: 'boom',
      })
    );
  });
});
