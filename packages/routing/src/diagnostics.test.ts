import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRoutingDiagnosticsLogger,
  emitRoutingDiagnostic,
  registerServerFallbackLogger,
  resetServerFallbackLogger,
  type RoutingDiagnosticEvent,
} from './diagnostics';

const fallbackLogger = {
  error: vi.fn(),
};

const testEvent: RoutingDiagnosticEvent = {
  level: 'info',
  event: 'routing.guard.access_denied',
  route: '/account',
  reason: 'unauthenticated',
  redirect_target: '/auth/login',
};

beforeEach(() => {
  fallbackLogger.error.mockReset();
  setRoutingDiagnosticsFailureLogger(fallbackLogger);
  vi.unstubAllGlobals();
});

describe('emitRoutingDiagnostic', () => {
  it('uses the registered server fallback logger for server-side hook failures', async () => {
    registerServerFallbackLogger(fallbackLogger);

    expect(() =>
      emitRoutingDiagnostic(() => {
        throw new Error('diagnostics failed');
      }, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fallbackLogger.error).toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/account',
        error_type: 'Error',
        error_message: 'diagnostics failed',
      })
    );

    resetServerFallbackLogger();
    fallbackLogger.error.mockReset();
  });

  it('returns early when no diagnostics hook is configured', () => {
    expect(() => emitRoutingDiagnostic(undefined, testEvent)).not.toThrow();
  });

  it('supports synchronous diagnostics hooks without promise handling', () => {
    const diagnostics = vi.fn();

    expect(() => emitRoutingDiagnostic(diagnostics, testEvent)).not.toThrow();
    expect(diagnostics).toHaveBeenCalledWith(testEvent);
  });

  it('swallows rejected promises from async diagnostics hooks', async () => {
    registerServerFallbackLogger(fallbackLogger);

    expect(() =>
      emitRoutingDiagnostic((() => Promise.reject(new Error('diagnostics failed'))) as never, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fallbackLogger.error).toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/account',
        error_type: 'Error',
        error_message: 'diagnostics failed',
      })
    );

    resetServerFallbackLogger();
    fallbackLogger.error.mockReset();
  });

  it('normalizes non-Error diagnostics hook failures deterministically', async () => {
    registerServerFallbackLogger(fallbackLogger);

    expect(() =>
      emitRoutingDiagnostic(() => {
        throw 'plain diagnostics failure';
      }, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fallbackLogger.error).toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/account',
        error_type: 'string',
        error_message: 'plain diagnostics failure',
      })
    );

    resetServerFallbackLogger();
    fallbackLogger.error.mockReset();
  });

  it('logs browser-side diagnostics hook failures directly to console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('window', {});

    expect(() =>
      emitRoutingDiagnostic(() => {
        throw new Error('browser diagnostics failed');
      }, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleError).toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/account',
        error_type: 'Error',
        error_message: 'browser diagnostics failed',
      })
    );
    expect(fallbackLogger.error).not.toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        error_message: 'browser diagnostics failed',
      })
    );

    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it('falls back to console.error when the server fallback logger cannot be created', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      emitRoutingDiagnostic(() => {
        throw new Error('diagnostics failed without fallback logger');
      }, testEvent)
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleError).toHaveBeenCalledWith(
      'Routing diagnostics hook failed',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/account',
        error_type: 'Error',
        error_message: 'diagnostics failed without fallback logger',
      })
    );

    consoleError.mockRestore();
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

  it('includes required permission metadata for permission-based access denials', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const diagnostics = createRoutingDiagnosticsLogger(logger);

    diagnostics({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/media',
      reason: 'insufficient-permission',
      redirect_target: '/',
      required_permissions: ['media.read', 'media.update'],
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Routing guard denied access',
      expect.objectContaining({
        event: 'routing.guard.access_denied',
        route: '/admin/media',
        reason: 'insufficient-permission',
        required_permissions: ['media.read', 'media.update'],
      })
    );
  });
});
