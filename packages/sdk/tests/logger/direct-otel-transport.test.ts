import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setGlobalLoggerProviderForMonitoring } from '../../src/observability/monitoring-client.bridge.server';
import { createSdkLogger } from '../../src/logger/index.server';
import { readDevelopmentLogEntries, resetDevelopmentLogBufferForTests } from '../../src/logger/dev-log-buffer.server';
import { runWithWorkspaceContext } from '../../src/observability/context.server';
import {
  getRegisteredOtelLoggerCountForTests,
  resetLoggingRuntimeForTests,
  setOtelInitializationResult,
} from '../../src/logger/logging-runtime.server';

/**
 * Test suite for DirectOtelTransport
 * Verifies that the transport can connect to a Logger Provider and emit logs
 */
describe('DirectOtelTransport', () => {
  const flushAsyncLogs = async () => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeEach(() => {
    // Clear global state
    process.env.NODE_ENV = 'development';
    resetLoggingRuntimeForTests();
    resetDevelopmentLogBufferForTests();
    return setGlobalLoggerProviderForMonitoring(null);
  });

  it('should connect to global logger provider on first log', async () => {
    // Create mock provider
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);
    setOtelInitializationResult({
      status: 'ready',
      reason: 'test-ready',
    });

    // Import and use DirectOtelTransport
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Log a message
    logger.info('Test message', { test_data: 'value' });
    await flushAsyncLogs();

    // Transport should have called getLogger on provider
    expect(mockProvider.getLogger).toHaveBeenCalledWith('@sva/winston', '1.0.0');

    // Logger.emit should have been called
    expect(mockEmit).toHaveBeenCalled();
  });

  it('should map log levels correctly to OTEL severity', async () => {
    const mockEmit = vi.fn();
    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);
    setOtelInitializationResult({
      status: 'ready',
      reason: 'test-ready',
    });

    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Test different log levels
    logger.error('Error message');
    await flushAsyncLogs();
    logger.warn('Warn message');
    await flushAsyncLogs();
    logger.info('Info message');
    await flushAsyncLogs();

    // Should have 3 emits (one per log level)
    expect(mockEmit).toHaveBeenCalledTimes(3);

    // Check severity mapping
    const calls = mockEmit.mock.calls;
    expect(calls[0][0].severityNumber).toBe(17); // error
    expect(calls[1][0].severityNumber).toBe(13); // warn
    expect(calls[2][0].severityNumber).toBe(9); // info
  });

  it('should handle missing provider gracefully', () => {
    // No provider set
    const logger = createSdkLogger({
      component: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    // Should not throw
    expect(() => {
      logger.info('Test message');
    }).not.toThrow();
  });

  it('adds OTEL transport to existing loggers after runtime becomes ready', async () => {
    const mockEmit = vi.fn();
    const mockProvider = {
      getLogger: vi.fn(() => ({
        emit: mockEmit,
      })),
    };

    const logger = createSdkLogger({
      component: 'late-otel',
      enableOtel: true,
      enableConsole: false,
    });

    logger.info('not yet ready');
    await flushAsyncLogs();
    expect(mockEmit).not.toHaveBeenCalled();

    await setGlobalLoggerProviderForMonitoring(mockProvider);
    setOtelInitializationResult({
      status: 'ready',
      reason: 'test-ready',
    });

    logger.info('ready now');
    await flushAsyncLogs();
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it('should preserve log attributes through OTEL emit', async () => {
    let emittedData: Record<string, unknown> | null = null;

    const mockEmit = vi.fn((data: Record<string, unknown>) => {
      emittedData = data;
    });

    const mockLogger = {
      emit: mockEmit,
    };

    const mockProvider = {
      getLogger: vi.fn(() => mockLogger),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);
    setOtelInitializationResult({
      status: 'ready',
      reason: 'test-ready',
    });

    const logger = createSdkLogger({
      component: 'test-component',
      environment: 'test',
      enableOtel: true,
      enableConsole: false,
    });

    logger.info('Test message', {
      custom_data: 'custom_value',
      request_id: 'req-123',
    });
    await flushAsyncLogs();

    // Verify emitted data
    expect(emittedData).toBeDefined();
    expect(emittedData?.body).toContain('Test message');
    expect(emittedData?.severityText).toBe('INFO');
    expect((emittedData?.attributes as Record<string, unknown>).component).toBe('test-component');
  });

  it('merges request context without overwriting explicit ids', async () => {
    let emittedData: Record<string, unknown> | null = null;
    const mockProvider = {
      getLogger: vi.fn(() => ({
        emit: vi.fn((data: Record<string, unknown>) => {
          emittedData = data;
        }),
      })),
    };

    await setGlobalLoggerProviderForMonitoring(mockProvider);
    setOtelInitializationResult({
      status: 'ready',
      reason: 'test-ready',
    });

    const logger = createSdkLogger({
      component: 'ctx-test',
      enableOtel: true,
      enableConsole: false,
    });

    await runWithWorkspaceContext(
      {
        workspaceId: 'ws-123',
        requestId: 'req-context',
        traceId: 'trace-context',
        userId: 'user-123',
      },
      async () => {
        logger.info('Context message', {
          context: {
            request_id: 'req-explicit',
          },
        });
        await flushAsyncLogs();
      }
    );

    expect((emittedData?.attributes as Record<string, unknown>).workspace_id).toBe('ws-123');
    expect((emittedData?.attributes as Record<string, unknown>).context).toMatchObject({
      request_id: 'req-explicit',
      trace_id: 'trace-context',
      user_id: '[REDACTED]',
    });
  });

  it('creates no transports when console and otel are disabled', () => {
    process.env.NODE_ENV = 'production';
    resetLoggingRuntimeForTests();
    const logger = createSdkLogger({
      component: 'silent-test',
      enableOtel: false,
      enableConsole: false,
    });

    expect(logger.transports).toHaveLength(0);
  });

  it('unregisters OTEL-aware loggers deterministically on close', () => {
    const logger = createSdkLogger({
      component: 'close-test',
      enableOtel: true,
      enableConsole: false,
    });

    logger.close();
    setOtelInitializationResult({
      status: 'ready',
      reason: 'late-ready',
    });

    expect(logger.transports).toHaveLength(0);
  });

  it('clears pending logger registrations once OTEL initialization finishes', () => {
    createSdkLogger({
      component: 'pending-a',
      enableOtel: true,
      enableConsole: false,
    });

    createSdkLogger({
      component: 'pending-b',
      enableOtel: true,
      enableConsole: false,
    });

    expect(getRegisteredOtelLoggerCountForTests()).toBe(2);

    setOtelInitializationResult({
      status: 'failed',
      reason: 'collector unavailable',
    });

    expect(getRegisteredOtelLoggerCountForTests()).toBe(0);
  });

  it('does not retain newly created loggers after OTEL reached a final state', () => {
    setOtelInitializationResult({
      status: 'ready',
      reason: 'ready',
    });

    createSdkLogger({
      component: 'post-ready',
      enableOtel: true,
      enableConsole: false,
    });

    expect(getRegisteredOtelLoggerCountForTests()).toBe(0);
  });

  it('drops non-object development ui context after serialization', async () => {
    class CustomContext {
      toString() {
        return 'custom-context';
      }
    }

    const logger = createSdkLogger({
      component: 'dev-ui-test',
      enableOtel: false,
      enableConsole: false,
    });

    logger.info('Context message', {
      context: new CustomContext(),
    });
    await flushAsyncLogs();

    expect(readDevelopmentLogEntries()).toEqual([
      expect.objectContaining({
        component: 'dev-ui-test',
        message: 'Context message',
        context: undefined,
      }),
    ]);
  });
});
