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
  it('returns early when no diagnostics hook is configured', () => {
    expect(() => emitRoutingDiagnostic(undefined, testEvent)).not.toThrow();
  });

  it('swallows synchronous diagnostics hook failures', () => {
    expect(() =>
      emitRoutingDiagnostic(() => {
        throw new Error('diagnostics failed');
      }, testEvent)
    ).not.toThrow();
  });

  it('supports synchronous diagnostics hooks without promise handling', () => {
    const diagnostics = vi.fn();

    expect(() => emitRoutingDiagnostic(diagnostics, testEvent)).not.toThrow();
    expect(diagnostics).toHaveBeenCalledWith(testEvent);
  });

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

  it('maps guard, dispatch, method-not-allowed, and fallback events with optional metadata', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const diagnostics = createRoutingDiagnosticsLogger(logger);

    diagnostics({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/users',
      reason: 'insufficient-role',
      redirect_target: '/',
      required_roles: ['system_admin'],
    });
    diagnostics({
      level: 'info',
      event: 'routing.handler.dispatched',
      route: '/auth/me',
      method: 'GET',
      handler_name: 'meHandler',
    });
    diagnostics({
      level: 'warn',
      event: 'routing.handler.method_not_allowed',
      route: '/auth/logout',
      reason: 'method-not-allowed',
      method: 'GET',
      allow: 'POST',
    });
    diagnostics({
      level: 'error',
      event: 'routing.logger.fallback_activated',
      route: '/auth/me',
      method: 'GET',
      error_type: 'Error',
      error_message: 'logger down',
      handler_name: 'meHandler',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Routing guard denied access',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/admin/users',
        reason: 'insufficient-role',
        redirect_target: '/',
        required_roles: ['system_admin'],
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/auth/me',
        method: 'GET',
        handler_name: 'meHandler',
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Unsupported HTTP method for route handler',
      expect.objectContaining({
        event: 'routing.handler.method_not_allowed',
        route: '/auth/logout',
        reason: 'method-not-allowed',
        method: 'GET',
        allow: 'POST',
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Routing logger fallback activated',
      expect.objectContaining({
        event: 'routing.logger.fallback_activated',
        route: '/auth/me',
        method: 'GET',
        error_type: 'Error',
        error_message: 'logger down',
        handler_name: 'meHandler',
      })
    );
  });
});
